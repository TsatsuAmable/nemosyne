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
 * them into durable structure entities without rerunning analytical kernels on
 * the production Worker path. The inline port keeps deterministic synchronous
 * publication for non-Worker/test environments while still routing all science
 * through the Rust/WASM Atlas authority.
 */
export class DerivedAnalysisPipeline {
  private readonly atlas: AtlasCore;
  private readonly rendererLifecycle: Pick<WorldRendererLifecycle, 'tdaCompute' | 'tdaApply'>;
  private readonly publishStructureHandles: () => void;
  private readonly markRecommendationDirty: () => void;
  private readonly onError?: (error: unknown, request: DerivedAnalysisRequest) => void;
  private readonly scheduler: DerivedAnalysisScheduler<DerivedComputation>;

  constructor(options: DerivedAnalysisPipelineOptions) {
    this.atlas = options.atlas;
    this.rendererLifecycle = options.rendererLifecycle;
    this.publishStructureHandles = options.publishStructureHandles;
    this.markRecommendationDirty = options.markRecommendationDirty;
    this.onError = options.onError;
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
    const request: DerivedAnalysisRequest = {
      datasetVersion: this.atlas.datasetVersion,
      datasetFingerprint,
      operation,
    };

    // Production browsers use the asynchronous Worker port and therefore the
    // coalescing scheduler. Inline ports are deterministic compatibility/test
    // surfaces: publish their Rust-backed structures synchronously so session
    // capture immediately after an operation observes the same governed state.
    if (!this.atlas.executionPort?.isAsync) {
      try {
        this.publishInline(request);
      } catch (error) {
        this.onError?.(error, request);
      }
      return true;
    }

    this.scheduler.schedule(request);
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

  private clusterResult(request: DerivedAnalysisRequest, dataset: Dataset): ClusterDerivedResult | null {
    if (!isClusterOperation(request.operation)) return null;
    const assignments = dataset.rows.map((row) => {
      const value = row._cluster;
      return typeof value === 'number' ? value : Number(value);
    });
    if (assignments.length === 0 || assignments.some((value) => !Number.isFinite(value))) return null;
    return {
      parameters: clusterParameters(this.atlas, request),
      assignments,
      provenance: operationProvenance(this.atlas, request),
    };
  }

  private async compute(request: DerivedAnalysisRequest): Promise<DerivedComputation> {
    const dataset = this.atlas.dataset;
    const tda = this.rendererLifecycle.tdaCompute
      ? await this.rendererLifecycle.tdaCompute()
      : null;
    return { dataset, tda, cluster: this.clusterResult(request, dataset) };
  }

  private publishInline(request: DerivedAnalysisRequest): void {
    if (!this.isCurrent(request)) return;
    const dataset = this.atlas.dataset;
    const cluster = this.clusterResult(request, dataset);

    if (cluster) {
      const space = this.atlas.datasetSpace;
      if (space?.fingerprint === request.datasetFingerprint) {
        const structureSet = mapClusterStructures(
          cluster.assignments,
          space.datumIds,
          request.datasetFingerprint,
          request.datasetVersion,
          this.atlas.kernelVersion() ?? 'unknown',
          cluster.parameters,
          cluster.provenance
        );
        this.atlas.evidenceLedger.recordStructure(
          structureSet,
          this.atlas.sessionId,
          eventTimestamp(this.atlas, request)
        );
      }
    } else {
      // Inline execution remains Rust/WASM authoritative. Omitting JS-derived
      // filter values lets the kernel derive its filtration vector directly.
      const featureColumns = [dataset.columns[0]?.name].filter((name): name is string => !!name);
      const mapperParams = { featureColumns, bins: 10, overlap: 0.5 };
      const persistenceParams = { featureColumns, maxDistance: 2 };
      this.atlas.discoverMapperStructures(dataset, mapperParams);
      this.atlas.discoverPersistenceStructures(dataset, persistenceParams);
    }

    if (!this.isCurrent(request)) return;
    this.atlas.generateRecommendation();
    this.markRecommendationDirty();
    this.publishStructureHandles();

    // Keep the inline visual TDA panels fresh without making their completion a
    // prerequisite for the deterministic structure/session contract above.
    if (request.operation !== 'anomaly' && this.rendererLifecycle.tdaCompute) {
      void this.rendererLifecycle
        .tdaCompute()
        .then((result) => {
          if (result && this.isCurrent(request)) this.rendererLifecycle.tdaApply?.(result);
        })
        .catch((error) => this.onError?.(error, request));
    }
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
          result.tda.mapperProvenance
        ),
        mapPersistenceStructures(
          result.tda.persistence,
          request.datasetFingerprint,
          request.datasetVersion,
          algorithmVersion,
          result.tda.persistenceParams,
          result.tda.persistenceProvenance
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
