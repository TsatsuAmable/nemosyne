import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import {
  LoadDatasetUseCase,
  type DatasetLoadAuthority,
} from '../src/app/dataset/LoadDatasetUseCase.ts';
import { loadClusterSemanticEmbodiment } from '../src/app/dataset/SemanticEmbodimentLoader.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  CLUSTER_BOUNDS_SURFACE_NAME,
  CLUSTER_CENTROID_SURFACE_NAME,
} from '../src/moneta/embodiment/ClusterSemanticEmbodiment.ts';
import { SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME } from '../src/moneta/embodiment/SemanticEmbodimentStatus.ts';
import { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { ClusterEmbodimentEnvelopeV1 } from '../src/moneta/representation/ClusterEmbodimentPayload.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import type { FactProvider, MonetaDataInput, MonetaFacts, SolverResult } from '../src/moneta/types.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

const RAW_ROW_SENTINEL = 'C3_CLUSTER_RAW_ROW_FALLBACK';

function dataset(): Dataset {
  return new Dataset(
    'c3-cluster',
    [
      { name: 'cohort', type: 'CATEGORICAL' },
      { name: 'decoy', type: 'CATEGORICAL' },
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ],
    [
      { cohort: 'A', decoy: 'red', x: 0, y: 0 },
      { cohort: 'A', decoy: 'blue', x: 2, y: 2 },
      { cohort: 'B', decoy: 'red', x: 10, y: 5 },
      { cohort: 'B', decoy: 'blue', x: null, y: 6 },
      { cohort: 'C', decoy: 'red', x: null, y: 7 },
    ]
  );
}

function guardedDataset(): Dataset {
  const guarded = { edges: [] } as unknown as Dataset;
  Object.defineProperty(guarded, 'rows', {
    get() {
      throw new Error(RAW_ROW_SENTINEL);
    },
  });
  return guarded;
}

function decision(id = 'decision-cluster-c3'): RepresentationDecision {
  return {
    id,
    chosenCandidateId: 'CLUSTER_REGIONS',
    decisionStatus: 'DECISIVE',
    provenance: { fitnessModelVersion: 'bootstrap-fitness-v4' },
    embodiment: {
      primaryLayout: 'GRID_3D',
      primaryGeometry: 'CLUSTER_VOLUME',
      primaryBehavior: 'STATIC',
      primaryInteraction: 'INSPECT_CELL',
    },
  } as unknown as RepresentationDecision;
}

function envelope(
  fingerprint: string,
  decisionId = 'decision-cluster-c3'
): ClusterEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: fingerprint,
    candidateId: 'CLUSTER_REGIONS',
    representationFamily: 'CLUSTER',
    analyticalMethod: {
      name: 'source-partition-cluster-summary',
      version: 'source-partition-cluster-summary-v1',
      parameters: {
        partitionField: 'cohort',
        coordinateFields: ['x', 'y'],
        membershipAuthority: 'source-partition',
        coordinateValidity: 'complete-case-finite',
        spatialSummary: 'arithmetic-centroid-axis-aligned-bounds',
        maxGroups: 256,
      },
    },
    approximation: {
      mode: 'BOUNDED',
      representedRowCount: 3,
      description: 'Exact source partition counts with bounded descriptive spatial summaries.',
    },
    informationContract: {
      preserves: ['cluster-separation', 'aggregate-group-magnitude'],
      loses: [
        'individual-observation-identity',
        'exact-metric-values',
        'population-density-distribution',
        'empirical-bivariate-bin-mass',
        'empirical-distribution-shape',
        'outlier-boundary-visibility',
      ],
    },
    resource: { sourceRowCount: 5, elementCount: 3, maxElementCount: 256 },
    provenance: {
      kernelVersion: 'test-kernel',
      algorithmVersion: 'source-partition-cluster-columnar-v1',
      decisionId,
      decisionModelVersion: 'bootstrap-fitness-v4',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'CLUSTER_REGIONS',
        data: {
          partitionField: 'cohort',
          coordinateFields: ['x', 'y'],
          counts: {
            sourceCount: 5,
            assignedCount: 5,
            unassignedCount: 0,
            coordinateValidCount: 3,
            coordinateExcludedCount: 2,
          },
          regions: [
            {
              semanticId: 'cluster-region:A',
              sourcePartitionValue: 'A',
              assignedCount: 2,
              coordinateValidCount: 2,
              coordinateExcludedCount: 0,
              spatialSummary: {
                axes: [
                  { field: 'x', centroid: 1, min: 0, max: 2 },
                  { field: 'y', centroid: 1, min: 0, max: 2 },
                ],
              },
            },
            {
              semanticId: 'cluster-region:B',
              sourcePartitionValue: 'B',
              assignedCount: 2,
              coordinateValidCount: 1,
              coordinateExcludedCount: 1,
              spatialSummary: {
                axes: [
                  { field: 'x', centroid: 10, min: 10, max: 10 },
                  { field: 'y', centroid: 5, min: 5, max: 5 },
                ],
              },
            },
            {
              semanticId: 'cluster-region:C',
              sourcePartitionValue: 'C',
              assignedCount: 1,
              coordinateValidCount: 0,
              coordinateExcludedCount: 1,
              spatialSummary: null,
            },
          ],
        },
      },
    },
  };
}

function portFor(
  value: ClusterEmbodimentEnvelopeV1,
  resultPatch: Partial<{
    generation: number;
    datasetVersion: number;
    datasetFingerprint: string;
  }> = {}
) {
  const registerDataset = vi.fn(async () => undefined);
  const execute = vi.fn(async (request: AnalyticalExecutionRequest) => ({
    requestId: request.requestId,
    generation: resultPatch.generation ?? request.generation,
    datasetVersion: resultPatch.datasetVersion ?? request.dataset.version,
    datasetFingerprint: resultPatch.datasetFingerprint ?? request.dataset.fingerprint,
    value,
  }));
  const port: AnalyticalExecutionPort = {
    isAsync: true,
    supersede: vi.fn(),
    hasRegisteredDataset: vi.fn(() => true),
    registerDataset,
    execute: execute as unknown as AnalyticalExecutionPort['execute'],
  };
  return { port, execute, registerDataset };
}

function facts(): MonetaFacts {
  return {
    topology: 'TABULAR',
    rowCount: 5,
    nodeCount: 5,
    edgeCount: 0,
    depth: 0,
    numericColumns: 2,
    categoricalColumns: 2,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0,
    estimatedDensity: 0,
    outlierCount: 0,
    cardinalityOfColor: 2,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 3,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };
}

function solverResult(): SolverResult {
  return {
    facts: facts(),
    spec: {
      layout: 'GRID_3D',
      geometry: 'CLUSTER_VOLUME',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    },
    cost: 0,
  };
}

function guardedInput(semantic?: ClusterEmbodimentEnvelopeV1 | null): MonetaDataInput {
  const input = {
    dataset: guardedDataset(),
    semanticEmbodiment: semantic,
    semanticEmbodimentCandidateId: 'CLUSTER_REGIONS',
  } as unknown as MonetaDataInput;
  Object.defineProperty(input, 'rows', {
    get() {
      throw new Error(RAW_ROW_SENTINEL);
    },
  });
  return input;
}

describe('P1-R2D C3 source-partition cluster production cutover', () => {
  it('transports only explicit SOURCE_PARTITION authority and coordinate fields', async () => {
    const data = dataset();
    const chosen = decision();
    const expected = envelope(data.fingerprint);
    const { port, execute, registerDataset } = portFor(expected);
    const authority = {
      setOriginalDataset: vi.fn(),
      setCurrentDataset: vi.fn(),
      dataset: data,
      isReady: vi.fn(() => true),
      inferEncodings: vi.fn(() => ({ color: 'decoy', x: 'x', y: 'y' })),
      arbitrateRepresentation: vi.fn(() => chosen),
      computeDatasetSignature: vi.fn(() => ({})),
      executionPort: port,
      generation: 4,
      datasetVersion: 9,
      datasetFingerprint: data.fingerprint,
    } as unknown as DatasetLoadAuthority;
    const requirements = createDefaultRequirements('cluster-comparison', ['x', 'y']);
    requirements.clusterAuthority = { kind: 'SOURCE_PARTITION', field: 'cohort' };

    const result = new LoadDatasetUseCase(authority).execute(
      { name: 'C3 cluster', topology: 'TABULAR', dataset: data },
      { preserveAnalyticalState: true, requirements }
    );
    const semanticInput = result.dataInput as MonetaDataInput & {
      semanticEmbodimentPromise?: Promise<ClusterEmbodimentEnvelopeV1 | null>;
      semanticEmbodimentCandidateId?: 'CLUSTER_REGIONS';
    };

    expect(semanticInput.semanticEmbodimentCandidateId).toBe('CLUSTER_REGIONS');
    expect(await semanticInput.semanticEmbodimentPromise).toEqual(expected);
    expect(registerDataset).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    const request = execute.mock.calls[0][0];
    expect(request.operation).toBe('semanticEmbodiment');
    expect(request.datasetPayload).toBeUndefined();
    expect(request.params).toMatchObject({
      schemaVersion: 1,
      candidateId: 'CLUSTER_REGIONS',
      partitionField: 'cohort',
      coordinateFields: ['x', 'y'],
      decisionId: chosen.id,
    });
    expect(JSON.stringify(request.params)).not.toContain('rows');
    expect(JSON.stringify(request.params)).not.toContain('decoy');
  });

  it('fails closed on stale execution metadata or mismatched decision provenance', async () => {
    const data = dataset();
    const chosen = decision();
    const stale = portFor(envelope(data.fingerprint), { datasetVersion: 10 });
    const authority = {
      executionPort: stale.port,
      generation: 4,
      datasetVersion: 9,
      datasetFingerprint: data.fingerprint,
    };
    expect(
      await loadClusterSemanticEmbodiment(authority, data, chosen, 'cohort', ['x', 'y'])
    ).toBeNull();

    const wrongDecision = portFor(envelope(data.fingerprint, 'another-decision'));
    authority.executionPort = wrongDecision.port;
    expect(
      await loadClusterSemanticEmbodiment(authority, data, chosen, 'cohort', ['x', 'y'])
    ).toBeNull();
  });

  it('renders only bounded Rust region summaries while both row getters throw', () => {
    const semantic = envelope('f'.repeat(64));
    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult(), guardedInput(semantic));
    try {
      expect(artifact.nodeMeshes.map((mesh) => mesh.name)).toEqual([
        'cluster-region:A',
        'cluster-region:B',
      ]);
      expect(artifact.nodeMeshes.every((mesh) => mesh.position.toArray().every(Number.isFinite))).toBe(true);
      expect(artifact.nodeMeshes[0].userData).toMatchObject({
        representationKind: 'CLUSTER_REGIONS',
        semanticId: 'cluster-region:A',
        sourcePartitionValue: 'A',
        assignedCount: 2,
        datasetFingerprint: semantic.datasetFingerprint,
        provenance: semantic.provenance,
        supportBoundaryClaim: false,
      });
      expect(artifact.group.getObjectByName(CLUSTER_CENTROID_SURFACE_NAME)).toBeInstanceOf(
        THREE.InstancedMesh
      );
      expect(artifact.group.getObjectByName(CLUSTER_BOUNDS_SURFACE_NAME)).toBeInstanceOf(
        THREE.LineSegments
      );
      expect(artifact.group.userData.clusterRenderSurface).toMatchObject({
        semanticRegionCount: 3,
        spatialRegionCount: 2,
        unavailableSpatialRegionCount: 1,
        candidateLocalDrawCalls: 2,
      });
      expect(artifact.group.userData.semanticEmbodiment.unavailableSpatialRegions).toEqual([
        expect.objectContaining({
          semanticId: 'cluster-region:C',
          sourcePartitionValue: 'C',
          coordinateValidCount: 0,
        }),
      ]);
      expect(artifact.group.userData.semanticEmbodiment.supportBoundaryClaim).toBe(false);
      expect(artifact.group.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME)).toBeUndefined();
    } finally {
      disposeObject(artifact.group);
    }
  });

  it('keeps pending, refused, invalid and unavailable governed states row-free with no chart fallback', async () => {
    const chartPlaneFactory = vi.fn();
    const pending = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      guardedInput(),
      { chartPlaneFactory }
    );
    expect(pending.nodeMeshes).toHaveLength(0);
    expect(pending.group.userData.semanticEmbodimentStatus).toBe('PENDING');

    const refusedEnvelope: ClusterEmbodimentEnvelopeV1 = {
      ...envelope('c'.repeat(64)),
      resource: { sourceRowCount: 5, elementCount: 0, maxElementCount: 256 },
      approximation: { mode: 'BOUNDED', representedRowCount: 0 },
      result: {
        status: 'REFUSED',
        refusal: { code: 'INVALID_PARAMETERS', message: 'explicit cluster authority required' },
      },
    };
    const refused = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      guardedInput(refusedEnvelope),
      { chartPlaneFactory }
    );
    expect(refused.nodeMeshes).toHaveLength(0);
    expect(refused.group.userData.semanticEmbodimentStatus).toBe('REFUSED');

    const invalid = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      guardedInput({
        ...envelope('c'.repeat(64)),
        representationFamily: 'DENSITY',
      } as unknown as ClusterEmbodimentEnvelopeV1),
      { chartPlaneFactory }
    );
    expect(invalid.nodeMeshes).toHaveLength(0);
    expect(invalid.group.userData.semanticEmbodimentStatus).toBe('INVALID');
    expect(chartPlaneFactory).not.toHaveBeenCalled();

    let resolvePayload!: (value: ClusterEmbodimentEnvelopeV1 | null) => void;
    const promise = new Promise<ClusterEmbodimentEnvelopeV1 | null>((resolve) => {
      resolvePayload = resolve;
    });
    const scene = new THREE.Scene();
    const nodeInput = guardedInput() as MonetaDataInput & {
      semanticEmbodimentPromise: Promise<ClusterEmbodimentEnvelopeV1 | null>;
    };
    nodeInput.semanticEmbodimentPromise = promise;
    const factProvider = { facts: () => facts() } as FactProvider;
    const node = new MonetaTopologyNode(
      scene,
      nodeInput,
      [0, 0, 0],
      {},
      factProvider,
      false,
      decision()
    );
    expect(node.group?.userData.semanticEmbodimentStatus).toBe('PENDING');
    resolvePayload(null);
    await promise;
    await Promise.resolve();
    expect(node.group?.userData.semanticEmbodimentStatus).toBe('UNAVAILABLE');

    disposeObject(pending.group);
    disposeObject(refused.group);
    disposeObject(invalid.group);
    if (node.group) disposeObject(node.group);
  });

  it('does not reinterpret the generic CLUSTER_VOLUME primitive as scientific cluster authority', () => {
    const ungoverned = guardedInput(envelope('e'.repeat(64))) as MonetaDataInput & {
      semanticEmbodimentCandidateId?: 'CLUSTER_REGIONS';
    };
    delete ungoverned.semanticEmbodimentCandidateId;
    expect(() => VRTopologyTranslator.synthesizeArtifact(solverResult(), ungoverned)).toThrow(
      RAW_ROW_SENTINEL
    );
  });

  it('mechanically fences the semantic branch before rows while retaining legacy geometry after rows', () => {
    const worker = readFileSync('src/atlas/ports/analytical.worker.ts', 'utf8');
    const loader = readFileSync('src/app/dataset/LoadDatasetUseCase.ts', 'utf8');
    const translator = readFileSync('src/moneta/VRTopologyTranslator.ts', 'utf8');
    const adapter = readFileSync('src/moneta/embodiment/ClusterSemanticEmbodiment.ts', 'utf8');

    expect(worker).toContain("req.params.candidateId === 'CLUSTER_REGIONS'");
    expect(worker).toContain('buildClusterSemanticEmbodimentV1(');
    expect(loader).toContain("semanticEmbodimentCandidateId = 'CLUSTER_REGIONS'");
    expect(loader).toContain('activeRequirements.clusterAuthority.field');
    expect(translator).toContain("semanticEmbodimentCandidateId === 'CLUSTER_REGIONS'");
    expect(translator).toContain("spec.geometry === 'CLUSTER_VOLUME' && usesClusterSemanticEmbodiment");
    expect(translator).toContain('buildClusterSemanticRegions(');
    expect(translator).toContain('scalable.buildClusterVolume(');
    expect(translator.indexOf('buildClusterSemanticRegions(')).toBeLessThan(
      translator.indexOf('rows = dataset?.rows')
    );
    expect(translator.indexOf('scalable.buildClusterVolume(')).toBeGreaterThan(
      translator.indexOf('rows = dataset?.rows')
    );
    expect(adapter).not.toContain('.rows');
    expect(adapter).not.toContain('dataset.rows');
    expect(adapter).not.toContain('SphereGeometry');
    expect(adapter).toContain('supportBoundaryClaim: false');
  });
});
