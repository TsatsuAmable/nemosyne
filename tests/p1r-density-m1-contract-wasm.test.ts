import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  MAX_DENSITY_CELLS_V1,
  SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
  type BinnedDensityPayloadV1,
  type SemanticEmbodimentEnvelopeV1,
} from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';

function densityFixture(): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    datasetFingerprint: 'e'.repeat(64),
    candidateId: 'DENSITY_FIELD',
    representationFamily: 'DENSITY',
    analyticalMethod: {
      name: 'bivariate-binned-density',
      version: 'binned-density-contract-v1',
      parameters: {
        binning: 'equal-width',
        interval: 'left-closed-right-open-final-closed',
        excludedPolicy: 'canonical-invalid-exclude-and-count',
      },
    },
    approximation: {
      mode: 'BINNED',
      representedRowCount: 4,
      description: 'Bivariate equal-width binned density grid',
    },
    informationContract: {
      preserves: ['population-density-distribution'],
      loses: [
        'individual-observation-identity',
        'exact-metric-values',
        'empirical-distribution-shape',
        'outlier-boundary-visibility',
      ],
    },
    resource: {
      sourceRowCount: 6,
      elementCount: 4,
      maxElementCount: MAX_DENSITY_CELLS_V1,
    },
    provenance: {
      kernelVersion: '0.1.0',
      algorithmVersion: 'binned-density-contract-v1',
      decisionId: 'decision_density_fixture',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'BINNED_DENSITY',
        data: {
          measureFieldX: 'x',
          measureFieldY: 'y',
          domainX: { min: 0, max: 4 },
          domainY: { min: 0, max: 2 },
          counts: { sourceCount: 6, validCount: 4, excludedCount: 2 },
          binsX: 2,
          binsY: 2,
          grid: [
            {
              semanticId: 'density-cell:0-0',
              xIndex: 0,
              yIndex: 0,
              xLowerBound: 0,
              xUpperBound: 2,
              yLowerBound: 0,
              yUpperBound: 1,
              count: 1,
              xUpperInclusive: false,
              yUpperInclusive: false,
            },
            {
              semanticId: 'density-cell:0-1',
              xIndex: 0,
              yIndex: 1,
              xLowerBound: 0,
              xUpperBound: 2,
              yLowerBound: 1,
              yUpperBound: 2,
              count: 1,
              xUpperInclusive: false,
              yUpperInclusive: true,
            },
            {
              semanticId: 'density-cell:1-0',
              xIndex: 1,
              yIndex: 0,
              xLowerBound: 2,
              xUpperBound: 4,
              yLowerBound: 0,
              yUpperBound: 1,
              count: 1,
              xUpperInclusive: true,
              yUpperInclusive: false,
            },
            {
              semanticId: 'density-cell:1-1',
              xIndex: 1,
              yIndex: 1,
              xLowerBound: 2,
              xUpperBound: 4,
              yLowerBound: 1,
              yUpperBound: 2,
              count: 1,
              xUpperInclusive: true,
              yUpperInclusive: true,
            },
          ],
        },
      },
    },
  };
}

function densityPayload(envelope: SemanticEmbodimentEnvelopeV1): BinnedDensityPayloadV1 {
  if (envelope.result.status !== 'READY') throw new Error('expected READY density payload');
  if (envelope.result.payload.kind !== 'BINNED_DENSITY') throw new Error('expected binned density payload kind');
  return envelope.result.payload.data;
}

describe('P1-R density M1 binned density contract', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('M1 requires the real WASM runtime');
  });

  it('round-trips a distinct, bounded, count-truthful binned density deterministically', () => {
    const first = bridge.roundTripSemanticEmbodimentPayloadV1(densityFixture());
    expect(first).not.toBeNull();
    if (!first) throw new Error('expected validated density payload');
    const payload = densityPayload(first);
    expect(first.candidateId).toBe('DENSITY_FIELD');
    expect(first.representationFamily).toBe('DENSITY');
    expect(first.approximation).toMatchObject({ mode: 'BINNED', representedRowCount: 4 });
    expect(first.informationContract).toEqual({
      preserves: ['population-density-distribution'],
      loses: [
        'individual-observation-identity',
        'exact-metric-values',
        'empirical-distribution-shape',
        'outlier-boundary-visibility',
      ],
    });
    expect(first.resource).toEqual({
      sourceRowCount: 6,
      elementCount: 4,
      maxElementCount: MAX_DENSITY_CELLS_V1,
    });
    expect(payload.counts).toEqual({ sourceCount: 6, validCount: 4, excludedCount: 2 });
    expect(payload.grid.reduce((sum, cell) => sum + cell.count, 0)).toBe(4);
    expect(payload.grid.length).toBe(4);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('"rows"');
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(first)).toEqual(first);
  });

  it('fails closed on identity, count, bound, and semantic-ID drift', () => {
    const wrongIdentity = densityFixture();
    wrongIdentity.candidateId = 'DISTRIBUTION_FIELD';
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(wrongIdentity)).toBeNull();

    const wrongFamily = densityFixture();
    wrongFamily.representationFamily = 'DISTRIBUTION' as unknown as typeof wrongFamily.representationFamily;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(wrongFamily)).toBeNull();

    const wrongCounts = densityFixture();
    densityPayload(wrongCounts).counts.excludedCount = 1;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(wrongCounts)).toBeNull();

    const wrongBound = densityFixture();
    wrongBound.resource.maxElementCount = MAX_DENSITY_CELLS_V1 - 1;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(wrongBound)).toBeNull();

    const duplicateId = densityFixture();
    const dup = densityPayload(duplicateId);
    dup.grid[0].semanticId = dup.grid[1].semanticId;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(duplicateId)).toBeNull();
  });

  it('rejects distribution alias, KDE/PDF claims, non-finite, and raw-row smuggling', () => {
    const alias = densityFixture();
    alias.analyticalMethod.name = 'univariate-empirical-distribution';
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(alias)).toBeNull();

    const kdeClaim = densityFixture();
    kdeClaim.analyticalMethod.name = 'continuous-density-kde';
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(kdeClaim)).toBeNull();

    const preservesClaim = densityFixture();
    preservesClaim.informationContract = {
      preserves: ['empirical-distribution-shape'],
      loses: ['individual-observation-identity', 'exact-metric-values'],
    };
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(preservesClaim)).toBeNull();

    const nonFinite = densityFixture();
    densityPayload(nonFinite).domainX.max = Number.POSITIVE_INFINITY;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(nonFinite)).toBeNull();

    const withRows = densityFixture() as unknown as Record<string, unknown>;
    withRows.rows = [{ x: 1, y: 2 }];
    expect(
      bridge.roundTripSemanticEmbodimentPayloadV1(withRows as unknown as SemanticEmbodimentEnvelopeV1),
    ).toBeNull();
  });

  it('keeps the candidate ontology bivariate binned and explicit about losses', () => {
    const candidate = MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD;
    expect(candidate.name).toBe('Binned Density Field');
    expect(`${candidate.name} ${candidate.description}`).not.toMatch(/continuous.*estimation|kde|pdf|contour/i);
    expect(candidate.supports).toEqual(['continuous-density', 'discrete-observations']);
    expect(candidate.preserves).toEqual(['population-density-distribution']);
    expect(candidate.loses).toEqual([
      'individual-observation-identity',
      'exact-metric-values',
      'empirical-distribution-shape',
      'outlier-boundary-visibility',
    ]);
  });
});
