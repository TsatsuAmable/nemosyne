import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import {
  LoadDatasetUseCase,
  type DatasetLoadAuthority,
} from '../src/app/dataset/LoadDatasetUseCase.ts';
import { loadDistributionSemanticEmbodiment } from '../src/app/dataset/SemanticEmbodimentLoader.ts';
import { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import type { MonetaDataInput, SolverResult } from '../src/moneta/types.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

const RAW_ROW_SENTINEL = 'M3_RAW_ROW_FALLBACK';

function dataset(): Dataset {
  return new Dataset(
    'm3-distribution',
    [
      { name: 'value', type: 'NUMERIC' },
      { name: 'other', type: 'NUMERIC' },
    ],
    [
      { value: 0, other: 100 },
      { value: 1, other: 200 },
      { value: 2, other: 300 },
      { value: 4, other: 400 },
    ]
  );
}

function datasetThatForbidsRows(): Dataset {
  const guarded = { edges: [] } as unknown as Dataset;
  Object.defineProperty(guarded, 'rows', {
    get() {
      throw new Error(RAW_ROW_SENTINEL);
    },
  });
  return guarded;
}

function decision(id = 'decision-m3-distribution'): RepresentationDecision {
  return {
    id,
    chosenCandidateId: 'DISTRIBUTION_FIELD',
    decisionStatus: 'DECISIVE',
    provenance: { fitnessModelVersion: 'bootstrap-fitness-v1' },
    embodiment: {
      primaryLayout: 'GRID_3D',
      primaryGeometry: 'DISTRIBUTION_FIELD',
      primaryBehavior: 'STATIC',
      primaryInteraction: 'INSPECT_CELL',
    },
  } as unknown as RepresentationDecision;
}

function envelope(
  fingerprint: string,
  decisionId = 'decision-m3-distribution',
  domain: { min: number; max: number } = { min: 0, max: 4 }
): SemanticEmbodimentEnvelopeV1 {
  const midpoint = domain.min === -Number.MAX_VALUE ? 0 : 2;
  return {
    schemaVersion: 1,
    datasetFingerprint: fingerprint,
    candidateId: 'DISTRIBUTION_FIELD',
    representationFamily: 'DISTRIBUTION',
    analyticalMethod: {
      name: 'univariate-empirical-distribution',
      version: 'empirical-distribution-columnar-v1',
      parameters: {
        histogram: { binning: 'equal-width' },
        ecdf: { selection: 'deterministic-rank-knots' },
        quantiles: { interpolation: 'linear-r7', probabilities: [0, 0.5, 1] },
      },
    },
    approximation: { mode: 'BINNED', representedRowCount: 4 },
    informationContract: {
      preserves: ['population-density-distribution', 'outlier-boundary-visibility'],
      loses: ['individual-observation-identity', 'exact-metric-values'],
    },
    resource: { sourceRowCount: 4, elementCount: 8, maxElementCount: 544 },
    provenance: {
      kernelVersion: 'test-kernel',
      algorithmVersion: 'empirical-distribution-columnar-v1',
      decisionId,
      decisionModelVersion: 'bootstrap-fitness-v1',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'EMPIRICAL_DISTRIBUTION',
        data: {
          measureField: 'value',
          domain,
          counts: { sourceCount: 4, validCount: 4, excludedCount: 0 },
          histogram: [
            {
              semanticId: 'distribution-bin:000',
              lowerBound: domain.min,
              upperBound: midpoint,
              count: 2,
              upperInclusive: false,
            },
            {
              semanticId: 'distribution-bin:001',
              lowerBound: midpoint,
              upperBound: domain.max,
              count: 2,
              upperInclusive: true,
            },
          ],
          ecdf: [
            {
              semanticId: 'distribution-ecdf:000',
              value: domain.min,
              cumulativeCount: 1,
              cumulativeProbability: 0.25,
            },
            {
              semanticId: 'distribution-ecdf:001',
              value: midpoint,
              cumulativeCount: 2,
              cumulativeProbability: 0.5,
            },
            {
              semanticId: 'distribution-ecdf:002',
              value: domain.max,
              cumulativeCount: 4,
              cumulativeProbability: 1,
            },
          ],
          quantiles: [
            { semanticId: 'distribution-quantile:000', probability: 0, value: domain.min },
            { semanticId: 'distribution-quantile:001', probability: 0.5, value: midpoint },
            { semanticId: 'distribution-quantile:002', probability: 1, value: domain.max },
          ],
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

function distributionSolverResult(): SolverResult {
  return {
    facts: {
      topology: 'TABULAR',
      rowCount: 4,
      nodeCount: 4,
      edgeCount: 0,
      depth: 0,
      numericColumns: 2,
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
    },
    spec: {
      layout: 'GRID_3D',
      geometry: 'DISTRIBUTION_FIELD',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    },
    cost: 0,
  };
}

describe('Stream M M3 distribution production cutover', () => {
  it('routes the explicit requirements measure through the production use case without request rows', async () => {
    const data = dataset();
    const chosen = decision();
    const { port, execute, registerDataset } = portFor(envelope(data.fingerprint));
    const authority = {
      setOriginalDataset: vi.fn(),
      setCurrentDataset: vi.fn(),
      dataset: data,
      isReady: vi.fn(() => true),
      inferEncodings: vi.fn(() => ({ size: 'other' })),
      arbitrateRepresentation: vi.fn(() => chosen),
      computeDatasetSignature: vi.fn(() => ({})),
      executionPort: port,
      generation: 3,
      datasetVersion: 7,
      datasetFingerprint: data.fingerprint,
    } as unknown as DatasetLoadAuthority;
    const requirements = createDefaultRequirements('distribution-analysis', ['value']);
    const result = new LoadDatasetUseCase(authority).execute(
      { name: 'M3', topology: 'TABULAR', dataset: data },
      { preserveAnalyticalState: true, requirements }
    );

    const semanticInput = result.dataInput as MonetaDataInput & {
      semanticEmbodimentPromise?: Promise<SemanticEmbodimentEnvelopeV1 | null>;
    };
    expect(await semanticInput.semanticEmbodimentPromise).toEqual(envelope(data.fingerprint));
    expect(registerDataset).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    const request = execute.mock.calls[0][0];
    expect(request.operation).toBe('semanticEmbodiment');
    expect(request.datasetPayload).toBeUndefined();
    expect(request.params).toMatchObject({
      schemaVersion: 1,
      candidateId: 'DISTRIBUTION_FIELD',
      measureField: 'value',
      histogramBinCount: 32,
      ecdfKnotCount: 64,
      quantileProbabilities: [0, 0.25, 0.5, 0.75, 1],
      decisionId: chosen.id,
    });
    expect(JSON.stringify(request.params)).not.toContain('rows');
    expect(request.params.measureField).not.toBe('other');
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
    expect(await loadDistributionSemanticEmbodiment(authority, data, chosen, 'value')).toBeNull();

    const wrongDecision = portFor(envelope(data.fingerprint, 'another-decision'));
    authority.executionPort = wrongDecision.port;
    expect(await loadDistributionSemanticEmbodiment(authority, data, chosen, 'value')).toBeNull();
  });

  it('renders only bounded payload elements with stable IDs and complete provenance', () => {
    const fingerprint = 'f'.repeat(64);
    const semantic = envelope(fingerprint, decision().id, {
      min: -Number.MAX_VALUE,
      max: Number.MAX_VALUE,
    });
    const input = {
      dataset: datasetThatForbidsRows(),
      semanticEmbodiment: semantic,
    } as MonetaDataInput & {
      semanticEmbodiment: SemanticEmbodimentEnvelopeV1;
    };
    Object.defineProperty(input, 'rows', {
      get() {
        throw new Error(RAW_ROW_SENTINEL);
      },
    });

    const artifact = VRTopologyTranslator.synthesizeArtifact(distributionSolverResult(), input);
    try {
      expect(artifact.nodeMeshes).toHaveLength(semantic.resource.elementCount);
      if (
        semantic.result.status !== 'READY' ||
        semantic.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION'
      ) {
        throw new Error('expected empirical distribution fixture');
      }
      const distribution = semantic.result.payload.data;
      const expectedIds = [
        ...distribution.histogram,
        ...distribution.ecdf,
        ...distribution.quantiles,
      ].map((element) => element.semanticId);
      expect(artifact.nodeMeshes.map((mesh) => mesh.name)).toEqual(expectedIds);
      expect(
        artifact.nodeMeshes.every((mesh) =>
          mesh.position.toArray().every((coordinate) => Number.isFinite(coordinate))
        )
      ).toBe(true);
      expect(artifact.nodeMeshes[0].userData).toMatchObject({
        representationKind: 'DISTRIBUTION_FIELD',
        payloadKind: 'EMPIRICAL_DISTRIBUTION',
        datasetFingerprint: fingerprint,
        semanticId: 'distribution-bin:000',
        provenance: semantic.provenance,
      });
      expect(artifact.group.userData.semanticEmbodiment).toMatchObject({
        datasetFingerprint: fingerprint,
        candidateId: 'DISTRIBUTION_FIELD',
        payloadKind: 'EMPIRICAL_DISTRIBUTION',
        provenance: semantic.provenance,
      });
      expect(artifact.group.userData.semanticEmbodiment.artifactId).toContain(decision().id);
    } finally {
      disposeObject(artifact.group);
    }
  });

  it('keeps pending, refused, and invalid distribution output row-free with no chart fallback', () => {
    const chartPlaneFactory = vi.fn();
    const input = { dataset: datasetThatForbidsRows() } as MonetaDataInput & {
      semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
    };
    Object.defineProperty(input, 'rows', {
      get() {
        throw new Error(RAW_ROW_SENTINEL);
      },
    });

    const pending = VRTopologyTranslator.synthesizeArtifact(distributionSolverResult(), input, {
      chartPlaneFactory,
    });
    expect(pending.nodeMeshes).toHaveLength(0);
    expect(pending.group.userData.semanticEmbodimentStatus).toBe('PENDING');

    input.semanticEmbodiment = {
      ...envelope('c'.repeat(64)),
      result: {
        status: 'REFUSED',
        refusal: { code: 'INVALID_PARAMETERS', message: 'explicit measure required' },
      },
    };
    const refused = VRTopologyTranslator.synthesizeArtifact(distributionSolverResult(), input, {
      chartPlaneFactory,
    });
    expect(refused.nodeMeshes).toHaveLength(0);
    expect(refused.group.userData.semanticEmbodimentStatus).toBe('REFUSED');

    input.semanticEmbodiment = {
      ...envelope('c'.repeat(64)),
      candidateId: 'DENSITY_FIELD',
    };
    const invalid = VRTopologyTranslator.synthesizeArtifact(distributionSolverResult(), input, {
      chartPlaneFactory,
    });
    expect(invalid.nodeMeshes).toHaveLength(0);
    expect(invalid.group.userData.semanticEmbodimentStatus).toBe('INVALID');
    expect(chartPlaneFactory).not.toHaveBeenCalled();

    disposeObject(pending.group);
    disposeObject(refused.group);
    disposeObject(invalid.group);
  });

  it('ignores a late distribution payload after the representation decision changes', async () => {
    let resolvePayload!: (value: SemanticEmbodimentEnvelopeV1 | null) => void;
    const promise = new Promise<SemanticEmbodimentEnvelopeV1 | null>((resolve) => {
      resolvePayload = resolve;
    });
    const input = { semanticEmbodimentPromise: promise } as MonetaDataInput & {
      semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
      semanticEmbodimentPromise: Promise<SemanticEmbodimentEnvelopeV1 | null>;
    };
    const scene = new THREE.Scene();
    const node = new MonetaTopologyNode(
      scene,
      input,
      [0, 0, 0],
      {},
      { facts: () => distributionSolverResult().facts },
      false,
      decision()
    );
    const synthesize = vi.spyOn(node, 'reSolveAndSynthesize');
    node.setRepresentationDecision({
      ...decision('decision-point'),
      chosenCandidateId: 'POINT_SET',
      embodiment: {
        primaryLayout: 'GRID_3D',
        primaryGeometry: 'CUBE_MATRIX',
        primaryBehavior: 'STATIC',
        primaryInteraction: 'INSPECT_CELL',
      },
    } as unknown as RepresentationDecision);

    resolvePayload(envelope('d'.repeat(64)));
    await promise;
    await Promise.resolve();

    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(input.semanticEmbodiment).toBeUndefined();
    if (node.group) disposeObject(node.group);
  });

  it('dispatches semantic candidates independently in the Worker and contains no row fallback', () => {
    const source = readFileSync('src/atlas/ports/analytical.worker.ts', 'utf8');
    const start = source.indexOf("case 'semanticEmbodiment':");
    const end = source.indexOf("case 'operation':", start);
    const semanticCase = source.slice(start, end);
    expect(semanticCase).toContain("req.params.candidateId === 'AGGREGATE_VOLUME'");
    expect(semanticCase).toContain("req.params.candidateId === 'DISTRIBUTION_FIELD'");
    expect(semanticCase).toContain('buildAggregateSemanticEmbodimentV1');
    expect(semanticCase).toContain('buildDistributionSemanticEmbodimentV1');
    expect(semanticCase).toContain('Unsupported semantic embodiment candidate');
    expect(semanticCase).not.toContain('.rows');
  });
});
