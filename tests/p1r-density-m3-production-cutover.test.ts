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
import { loadDensitySemanticEmbodiment } from '../src/app/dataset/SemanticEmbodimentLoader.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME } from '../src/moneta/embodiment/SemanticEmbodimentStatus.ts';
import { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import type { FactProvider, MonetaDataInput, MonetaFacts, SolverResult } from '../src/moneta/types.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

const RAW_ROW_SENTINEL = 'DENSITY_M3_RAW_ROW_FALLBACK';

function dataset(): Dataset {
  return new Dataset(
    'm3-density',
    [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 'decoy', type: 'NUMERIC' },
    ],
    [
      { x: 0, y: 0, decoy: 100 },
      { x: 2, y: 2, decoy: 200 },
      { x: 8, y: 3, decoy: 300 },
      { x: 9, y: 9, decoy: 400 },
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

function decision(id = 'decision-density-m3'): RepresentationDecision {
  return {
    id,
    chosenCandidateId: 'DENSITY_FIELD',
    decisionStatus: 'DECISIVE',
    provenance: { fitnessModelVersion: 'bootstrap-fitness-v2' },
    embodiment: {
      primaryLayout: 'GRID_3D',
      primaryGeometry: 'DENSITY_FIELD',
      primaryBehavior: 'STATIC',
      primaryInteraction: 'INSPECT_CELL',
    },
  } as unknown as RepresentationDecision;
}

function envelope(
  fingerprint: string,
  decisionId = 'decision-density-m3'
): SemanticEmbodimentEnvelopeV1 {
  const binsX = 10;
  const binsY = 10;
  const counts = new Map<string, number>([
    ['0:0', 1],
    ['2:2', 1],
    ['8:3', 1],
    ['9:9', 1],
  ]);
  const grid = Array.from({ length: binsY }, (_, yIndex) =>
    Array.from({ length: binsX }, (_, xIndex) => ({
      semanticId: `density-cell:${xIndex}:${yIndex}`,
      xIndex,
      yIndex,
      xLowerBound: xIndex,
      xUpperBound: xIndex + 1,
      yLowerBound: yIndex,
      yUpperBound: yIndex + 1,
      count: counts.get(`${xIndex}:${yIndex}`) ?? 0,
      xUpperInclusive: xIndex === binsX - 1,
      yUpperInclusive: yIndex === binsY - 1,
    }))
  ).flat();
  return {
    schemaVersion: 1,
    datasetFingerprint: fingerprint,
    candidateId: 'DENSITY_FIELD',
    representationFamily: 'DENSITY',
    analyticalMethod: {
      name: 'bivariate-binned-density',
      version: 'binned-density-contract-v1',
      parameters: {
        binning: 'equal-width',
        interval: 'left-closed-right-open-final-closed',
        excludedPolicy: 'canonical-invalid-exclude-and-count',
        constantDomain: 'assign-final-bin-per-degenerate-axis',
      },
    },
    approximation: { mode: 'BINNED', representedRowCount: 4 },
    informationContract: {
      preserves: ['empirical-bivariate-bin-mass'],
      loses: [
        'individual-observation-identity',
        'exact-metric-values',
        'population-density-distribution',
        'empirical-distribution-shape',
        'outlier-boundary-visibility',
      ],
    },
    resource: { sourceRowCount: 4, elementCount: grid.length, maxElementCount: 400 },
    provenance: {
      kernelVersion: 'test-kernel',
      algorithmVersion: 'bivariate-binned-density-columnar-v1',
      decisionId,
      decisionModelVersion: 'bootstrap-fitness-v2',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'BINNED_DENSITY',
        data: {
          measureFieldX: 'x',
          measureFieldY: 'y',
          domainX: { min: 0, max: 10 },
          domainY: { min: 0, max: 10 },
          counts: { sourceCount: 4, validCount: 4, excludedCount: 0 },
          binsX,
          binsY,
          grid,
        },
      },
    },
  };
}

function portFor(
  value: SemanticEmbodimentEnvelopeV1,
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
    rowCount: 4,
    nodeCount: 4,
    edgeCount: 0,
    depth: 0,
    numericColumns: 3,
    categoricalColumns: 0,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0,
    estimatedDensity: 0,
    outlierCount: 0,
    cardinalityOfColor: 0,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 0,
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

function densitySolverResult(): SolverResult {
  return {
    facts: facts(),
    spec: {
      layout: 'GRID_3D',
      geometry: 'DENSITY_FIELD',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    },
    cost: 0,
  };
}

describe('P1-R2C density M3 production cutover', () => {
  it('routes two explicit requirement dimensions through the production use case without request rows', async () => {
    const data = dataset();
    const chosen = decision();
    const expected = envelope(data.fingerprint);
    const { port, execute, registerDataset } = portFor(expected);
    const authority = {
      setOriginalDataset: vi.fn(),
      setCurrentDataset: vi.fn(),
      dataset: data,
      isReady: vi.fn(() => true),
      inferEncodings: vi.fn(() => ({ size: 'decoy' })),
      arbitrateRepresentation: vi.fn(() => chosen),
      computeDatasetSignature: vi.fn(() => ({})),
      executionPort: port,
      generation: 3,
      datasetVersion: 7,
      datasetFingerprint: data.fingerprint,
    } as unknown as DatasetLoadAuthority;
    const requirements = createDefaultRequirements('spatial-analysis', ['x', 'y']);
    const result = new LoadDatasetUseCase(authority).execute(
      { name: 'M3 density', topology: 'TABULAR', dataset: data },
      { preserveAnalyticalState: true, requirements }
    );
    const semanticInput = result.dataInput as MonetaDataInput & {
      semanticEmbodimentPromise?: Promise<SemanticEmbodimentEnvelopeV1 | null>;
    };

    expect(await semanticInput.semanticEmbodimentPromise).toEqual(expected);
    expect(registerDataset).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    const request = execute.mock.calls[0][0];
    expect(request.operation).toBe('semanticEmbodiment');
    expect(request.datasetPayload).toBeUndefined();
    expect(request.params).toMatchObject({
      schemaVersion: 1,
      candidateId: 'DENSITY_FIELD',
      measureFieldX: 'x',
      measureFieldY: 'y',
      binsX: 10,
      binsY: 10,
      decisionId: chosen.id,
    });
    expect(JSON.stringify(request.params)).not.toContain('rows');
    expect(JSON.stringify(request.params)).not.toContain('decoy');
  });

  it('fails closed on stale execution metadata or mismatched decision provenance', async () => {
    const data = dataset();
    const chosen = decision();
    const stale = portFor(envelope(data.fingerprint), { datasetVersion: 8 });
    const authority = {
      executionPort: stale.port,
      generation: 3,
      datasetVersion: 7,
      datasetFingerprint: data.fingerprint,
    };
    expect(await loadDensitySemanticEmbodiment(authority, data, chosen, 'x', 'y')).toBeNull();

    const wrongDecision = portFor(envelope(data.fingerprint, 'another-decision'));
    authority.executionPort = wrongDecision.port;
    expect(await loadDensitySemanticEmbodiment(authority, data, chosen, 'x', 'y')).toBeNull();
  });

  it('renders only bounded Rust payload cells while both row getters throw', () => {
    const semantic = envelope('f'.repeat(64));
    const input = {
      dataset: guardedDataset(),
      semanticEmbodiment: semantic,
    } as MonetaDataInput & { semanticEmbodiment: SemanticEmbodimentEnvelopeV1 };
    Object.defineProperty(input, 'rows', {
      get() {
        throw new Error(RAW_ROW_SENTINEL);
      },
    });

    const artifact = VRTopologyTranslator.synthesizeArtifact(densitySolverResult(), input);
    try {
      expect(artifact.nodeMeshes).toHaveLength(semantic.resource.elementCount);
      if (semantic.result.status !== 'READY' || semantic.result.payload.kind !== 'BINNED_DENSITY') {
        throw new Error('expected density fixture');
      }
      expect(artifact.nodeMeshes.map((mesh) => mesh.name)).toEqual(
        semantic.result.payload.data.grid.map((cell) => cell.semanticId)
      );
      expect(artifact.nodeMeshes.every((mesh) => mesh.position.toArray().every(Number.isFinite))).toBe(true);
      expect(artifact.nodeMeshes[0].userData).toMatchObject({
        representationKind: 'DENSITY_FIELD',
        payloadKind: 'BINNED_DENSITY',
        datasetFingerprint: semantic.datasetFingerprint,
        semanticId: 'density-cell:0:0',
        provenance: semantic.provenance,
      });
      expect(artifact.group.userData.semanticEmbodiment).toMatchObject({
        candidateId: 'DENSITY_FIELD',
        payloadKind: 'BINNED_DENSITY',
        provenance: semantic.provenance,
      });
      expect(artifact.group.userData.semanticEmbodiment.artifactId).toContain(decision().id);
      expect(artifact.group.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME)).toBeUndefined();
    } finally {
      disposeObject(artifact.group);
    }
  });

  it('keeps pending, refused, invalid and unavailable states row-free with no chart fallback', async () => {
    const chartPlaneFactory = vi.fn();
    const input = { dataset: guardedDataset() } as MonetaDataInput & {
      semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
    };
    Object.defineProperty(input, 'rows', {
      get() {
        throw new Error(RAW_ROW_SENTINEL);
      },
    });

    const pending = VRTopologyTranslator.synthesizeArtifact(densitySolverResult(), input, { chartPlaneFactory });
    expect(pending.nodeMeshes).toHaveLength(0);
    expect(pending.group.userData.semanticEmbodimentStatus).toBe('PENDING');

    input.semanticEmbodiment = {
      ...envelope('c'.repeat(64)),
      result: {
        status: 'REFUSED',
        refusal: { code: 'INVALID_PARAMETERS', message: 'two distinct numeric measures required' },
      },
    };
    const refused = VRTopologyTranslator.synthesizeArtifact(densitySolverResult(), input, { chartPlaneFactory });
    expect(refused.nodeMeshes).toHaveLength(0);
    expect(refused.group.userData.semanticEmbodimentStatus).toBe('REFUSED');

    input.semanticEmbodiment = {
      ...envelope('c'.repeat(64)),
      representationFamily: 'DISTRIBUTION',
    };
    const invalid = VRTopologyTranslator.synthesizeArtifact(densitySolverResult(), input, { chartPlaneFactory });
    expect(invalid.nodeMeshes).toHaveLength(0);
    expect(invalid.group.userData.semanticEmbodimentStatus).toBe('INVALID');
    expect(chartPlaneFactory).not.toHaveBeenCalled();

    let resolvePayload!: (value: SemanticEmbodimentEnvelopeV1 | null) => void;
    const promise = new Promise<SemanticEmbodimentEnvelopeV1 | null>((resolve) => {
      resolvePayload = resolve;
    });
    const scene = new THREE.Scene();
    const nodeInput = { semanticEmbodimentPromise: promise } as MonetaDataInput & {
      semanticEmbodimentPromise: Promise<SemanticEmbodimentEnvelopeV1 | null>;
    };
    Object.defineProperty(nodeInput, 'rows', {
      get() {
        throw new Error(RAW_ROW_SENTINEL);
      },
    });
    const factProvider = { facts: () => facts() } as FactProvider;
    const node = new MonetaTopologyNode(scene, nodeInput, [0, 0, 0], {}, factProvider, false, decision());
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

  it('mechanically removes the legacy density authority from the production dispatch path', () => {
    const worker = readFileSync('src/atlas/ports/analytical.worker.ts', 'utf8');
    const translator = readFileSync('src/moneta/VRTopologyTranslator.ts', 'utf8');
    const adapter = readFileSync('src/moneta/embodiment/DensitySemanticEmbodiment.ts', 'utf8');
    const node = readFileSync('src/moneta/MonetaTopologyNode.ts', 'utf8');

    expect(worker).toContain("req.params.candidateId === 'DENSITY_FIELD'");
    expect(worker).toContain('buildDensitySemanticEmbodimentV1(');
    expect(translator).toContain('buildDensitySemanticField(group, nodeMeshes, semanticInput.semanticEmbodiment)');
    expect(translator).not.toContain('scalable.buildDensityField(');
    expect(adapter).not.toContain('computeLayoutPositions');
    expect(adapter).not.toContain('dataset.rows');
    expect(adapter).not.toContain('for (const row');
    expect(node).toContain("candidateId === 'DENSITY_FIELD'");
  });
});
