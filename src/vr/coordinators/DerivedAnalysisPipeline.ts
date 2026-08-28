import type { Provenance } from '../../data/types.ts';
import type { Dataset } from '../../data/Dataset.ts';
import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import {
  mapClusterStructures,
  mapMapperStructures,
  mapPersistenceStructures,
  type StructureSet,
} from '../../atlas/structures.ts';
import type { TDAComputationResult } from '../artifacts/TDAPlanes.ts';
import type { WorldRendererLifecycle } from './WorldRendererLifecycle.ts';
import {
  DerivedAnalysisScheduler,
  type DerivedAnalysisRequest,
  type DerivedAnalysisSchedulerStats,
} from './DerivedAnalysisScheduler.ts';

interface ClusterDerivedResult {
  parameters: Record<string, unknown>;
  assignments: number[];
  provenance: Provenance | null;
}

interface DerivedComputation {
  dataset: Dataset;
  tda: TDAComputationResult | null;
  cluster: ClusterDerivedResult | null;
}

export interface DerivedAnalysisPipelineOptions {
  atlas: AtlasCore;
  rendererLifecycle: Pick<WorldRendererLifecycle, 'tdaCompute' | 'tdaApply'>;
  publishStructureHandles: () => void;
  markRecommendationDirty: () => void;
  onError?: (error: unknown, request: DerivedAnalysisRequest) => void;
  defer?: (callback: () => void) => unknown;
  cancelDeferred?: (handle: unknown) => void;
}

function isClusterOperation(operation: string): boolean {
  return operation === 'cluster' || operation === 'hierarchical' || operation === 'density';
}

function clusterParameters(atlas: AtlasCore, request: DerivedAnalysisRequest): Record<string, unknown> {
  const matching = [...atlas.results]
    .reverse()
    .find(
      (result) =>
        result.datasetVersion === request.datasetVersion &&
        result.datasetFingerprint === request.datasetFingerprint
    );
  if (matching?.spec?.operation) return matching.spec.operation as unknown as Record<string, unknown>;
  const opMap: Record<string, string> = {
    cluster: 'k_means',
    hierarchical: 'hierarchical',
    density: 'dbscan',
  };
  return { op: opMap[request.operation] ?? 'k_means', k: 3 };
}

function operationProvenance(atlas: AtlasCore, request: DerivedAnalysisRequest): Provenance | null {
  return (
    [...atlas.results]
      .reverse()
      .find(
        (result) =>
          result.datasetVersion === request.datasetVersion &&
          result.datasetFingerprint === request.datasetFingerprint
      )?.provenance ?? null
  );
}

function eventTimestamp(atlas: AtlasCore, request: DerivedAnalysisRequest): number {
  return (
    [...atlas.ledger]
      .reverse()
      .find(
        (event) =>
          event.datasetVersion === request.datasetVersion &&
          event.datasetFingerprint === request.datasetFingerprint
      )?.timestamp ?? 0
  );
}

/**
 * RF-061 production adapter around the generic scheduler. It consumes the
 * authoritative mutation/TDA outputs already produced by Rust/WASM and maps
 * them into durable structure entities without rerunning analytical kernels.
 */
export class DerivedAnalysisPipeline {
  private readonly atlas: AtlasCore;
  private readonly rendererLifecycle: Pick<WorldRendererLifecycle, 'tdaCompute' | 'tdaApply'>;
  private readonly publishStructureHandles: () => void;
  private readonly markRecommendationDirty: () => void;
  private readonly scheduler: DerivedAnalysisScheduler<DerivedComputation>;

  constructor(options: DerivedAnalysisPipelineOptions) {
    this.atlas = options.atlas;
    this.rendererLifecycle = options.rendererLifecycle;
    this.publishStructureHandles = options.publishStructureHandles;
    this.markRecommendationDirty = options.markRecommendationDirty;
    this.scheduler = new DerivedAnalysisScheduler<DerivedComputation>({
      isCurrent: (request) => this.isCurrent(request),
      compute: (request) => this.compute(request),
      publish: (request, result) => this.publish(request, result),
      defer: options.defer,
      cancelDeferred: options.cancelDeferred,
      onError: options.onError,
    });
  }

  schedule(operation: string): boolean {
    const datasetFingerprint = this.atlas.datasetFingerprint;
    if (!datasetFingerprint || !this.atlas.hasDataset) return false;
    this.scheduler.schedule({
      datasetVersion: this.atlas.datasetVersion,
      datasetFingerprint,
      operation,
    });
    return true;
  }

  whenIdle(): Promise<void> {
    return this.scheduler.whenIdle();
  }

  stats(): DerivedAnalysisSchedulerStats {
    return this.scheduler.stats();
  }

  dispose(): void {
    this.scheduler.dispose();
  }

  private isCurrent(request: DerivedAnalysisRequest): boolean {
    return (
      this.atlas.datasetVersion === request.datasetVersion &&
      this.atlas.datasetFingerprint === request.datasetFingerprint
    );
  }

  private async compute(request: DerivedAnalysisRequest): Promise<DerivedComputation> {
    const dataset = this.atlas.dataset;
    const tda = this.rendererLifecycle.tdaCompute
      ? await this.rendererLifecycle.tdaCompute()
      : null;

    let cluster: ClusterDerivedResult | null = null;
    if (isClusterOperation(request.operation)) {
      const assignments = dataset.rows.map((row) => {
        const value = row._cluster;
        return typeof value === 'number' ? value : Number(value);
      });
      if (assignments.length > 0 && assignments.every((value) => Number.isFinite(value))) {
        cluster = {
          parameters: clusterParameters(this.atlas, request),
          assignments,
          provenance: operationProvenance(this.atlas, request),
        };
      }
    }

    return { dataset, tda, cluster };
  }

  private publish(request: DerivedAnalysisRequest, result: DerivedComputation): void {
    if (!this.isCurrent(request)) return;

    if (result.tda && request.operation !== 'anomaly') {
      this.rendererLifecycle.tdaApply?.(result.tda);
    }

    const space = this.atlas.datasetSpace;
    if (!space || space.fingerprint !== request.datasetFingerprint) return;

    const structureSets: StructureSet[] = [];
    const algorithmVersion = this.atlas.kernelVersion() ?? 'unknown';
    if (result.cluster) {
      structureSets.push(
        mapClusterStructures(
          result.cluster.assignments,
          space.datumIds,
          request.datasetFingerprint,
          request.datasetVersion,
          algorithmVersion,
          result.cluster.parameters,
          result.cluster.provenance
        )
      );
    } else if (result.tda) {
      structureSets.push(
        mapMapperStructures(
          result.tda.mapper,
          space.datumIds,
          request.datasetFingerprint,
          request.datasetVersion,
          algorithmVersion,
          result.tda.mapperParams,
          null
        ),
        mapPersistenceStructures(
          result.tda.persistence,
          request.datasetFingerprint,
          request.datasetVersion,
          algorithmVersion,
          result.tda.persistenceParams,
          null
        )
      );
    }

    const timestamp = eventTimestamp(this.atlas, request);
    for (const structureSet of structureSets) {
      this.atlas.evidenceLedger.recordStructure(structureSet, this.atlas.sessionId, timestamp);
    }

    if (!this.isCurrent(request)) return;
    this.atlas.generateRecommendation();
    this.markRecommendationDirty();
    this.publishStructureHandles();
  }
}
