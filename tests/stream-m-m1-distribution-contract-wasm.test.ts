import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  MAX_DISTRIBUTION_ELEMENTS_V1,
  SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
  type EmpiricalDistributionPayloadV1,
  type SemanticEmbodimentEnvelopeV1,
} from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';

function distributionFixture(): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    datasetFingerprint: 'd'.repeat(64),
    candidateId: 'DISTRIBUTION_FIELD',
    representationFamily: 'DISTRIBUTION',
    analyticalMethod: {
      name: 'univariate-empirical-distribution',
      version: 'empirical-distribution-contract-v1',
      parameters: {
        histogram: {
          binning: 'equal-width',
          interval: 'left-closed-right-open-final-closed',
        },
        ecdf: { selection: 'deterministic-rank-knots' },
        quantiles: { interpolation: 'linear-r7', probabilities: [0, 0.5, 1] },
        missingPolicy: 'exclude-and-count',
        nonFinitePolicy: 'exclude-and-count',
      },
    },
    approximation: {
      mode: 'BINNED',
      representedRowCount: 4,
      description: 'Equal-width histogram with bounded ECDF knots and explicit quantiles',
    },
    informationContract: {
      preserves: ['population-density-distribution', 'outlier-boundary-visibility'],
      loses: ['individual-observation-identity', 'exact-metric-values'],
    },
    resource: {
      sourceRowCount: 7,
      elementCount: 9,
      maxElementCount: MAX_DISTRIBUTION_ELEMENTS_V1,
    },
    provenance: {
      kernelVersion: '0.1.0',
      algorithmVersion: 'empirical-distribution-contract-v1',
      decisionId: 'decision_distribution_fixture',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'EMPIRICAL_DISTRIBUTION',
        data: {
          measureField: 'value',
          domain: { min: 1, max: 4 },
          counts: { sourceCount: 7, validCount: 4, missingCount: 2, nonFiniteCount: 1 },
          histogram: [
            {
              semanticId: 'distribution-bin:000',
              lowerBound: 1,
              upperBound: 2.5,
              count: 2,
              upperInclusive: false,
            },
            {
              semanticId: 'distribution-bin:001',
              lowerBound: 2.5,
              upperBound: 4,
              count: 2,
              upperInclusive: true,
            },
          ],
          ecdf: [
            {
              semanticId: 'distribution-ecdf:000',
              value: 1,
              cumulativeCount: 1,
              cumulativeProbability: 0.25,
            },
            {
              semanticId: 'distribution-ecdf:001',
              value: 2,
              cumulativeCount: 2,
              cumulativeProbability: 0.5,
            },
            {
              semanticId: 'distribution-ecdf:002',
              value: 3,
              cumulativeCount: 3,
              cumulativeProbability: 0.75,
            },
            {
              semanticId: 'distribution-ecdf:003',
              value: 4,
              cumulativeCount: 4,
              cumulativeProbability: 1,
            },
          ],
          quantiles: [
            { semanticId: 'distribution-quantile:000', probability: 0, value: 1 },
            { semanticId: 'distribution-quantile:500', probability: 0.5, value: 2.5 },
            { semanticId: 'distribution-quantile:1000', probability: 1, value: 4 },
          ],
        },
      },
    },
  };
}

function distributionPayload(
  envelope: SemanticEmbodimentEnvelopeV1
): EmpiricalDistributionPayloadV1 {
  if (envelope.result.status !== 'READY') throw new Error('expected READY distribution payload');
  if (envelope.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION') {
    throw new Error('expected empirical distribution payload kind');
  }
  return envelope.result.payload.data;
}

describe('Stream M M1 empirical distribution contract', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('M1 requires the real WASM runtime');
  });

  it('round-trips a distinct, bounded, count-truthful empirical summary deterministically', () => {
    const first = bridge.roundTripSemanticEmbodimentPayloadV1(distributionFixture());
    expect(first).not.toBeNull();
    if (!first) throw new Error('expected validated distribution payload');

    const payload = distributionPayload(first);
    expect(first.candidateId).toBe('DISTRIBUTION_FIELD');
    expect(first.representationFamily).toBe('DISTRIBUTION');
    expect(first.approximation).toMatchObject({ mode: 'BINNED', representedRowCount: 4 });
    expect(first.resource).toEqual({
      sourceRowCount: 7,
      elementCount: 9,
      maxElementCount: MAX_DISTRIBUTION_ELEMENTS_V1,
    });
    expect(payload.counts).toEqual({
      sourceCount: 7,
      validCount: 4,
      missingCount: 2,
      nonFiniteCount: 1,
    });
    expect(payload.histogram.reduce((sum, bin) => sum + bin.count, 0)).toBe(4);
    expect(payload.ecdf.at(-1)).toMatchObject({ cumulativeCount: 4, cumulativeProbability: 1 });

    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('"rows"');
    expect(serialized).not.toContain('"layout"');
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(first)).toEqual(first);
  });

  it('fails closed on identity, count, bound, and semantic-ID drift', () => {
    const wrongIdentity = distributionFixture();
    wrongIdentity.candidateId = 'DENSITY_FIELD';
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(wrongIdentity)).toBeNull();

    const wrongCounts = distributionFixture();
    distributionPayload(wrongCounts).counts.missingCount = 1;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(wrongCounts)).toBeNull();

    const wrongBound = distributionFixture();
    wrongBound.resource.maxElementCount = MAX_DISTRIBUTION_ELEMENTS_V1 - 1;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(wrongBound)).toBeNull();

    const duplicateId = distributionFixture();
    const duplicatePayload = distributionPayload(duplicateId);
    duplicatePayload.quantiles[0].semanticId = duplicatePayload.histogram[0].semanticId;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(duplicateId)).toBeNull();
  });

  it('rejects continuous-density claims, non-finite values, and raw-row smuggling', () => {
    const densityClaim = distributionFixture();
    densityClaim.analyticalMethod.name = 'continuous-density-pdf';
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(densityClaim)).toBeNull();

    const nonFinite = distributionFixture();
    distributionPayload(nonFinite).domain.max = Number.POSITIVE_INFINITY;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(nonFinite)).toBeNull();

    const withRows = distributionFixture() as unknown as Record<string, unknown>;
    withRows.rows = [{ value: 1 }];
    expect(
      bridge.roundTripSemanticEmbodimentPayloadV1(
        withRows as unknown as SemanticEmbodimentEnvelopeV1
      )
    ).toBeNull();
  });

  it('keeps the candidate ontology univariate, empirical, and explicit about losses', () => {
    const candidate = MONETA_REPRESENTATION_CANDIDATES.DISTRIBUTION_FIELD;
    expect(`${candidate.name} ${candidate.description}`).not.toMatch(
      /pdf|kde|density|contour|bivariate/i
    );
    expect(candidate.supports).toEqual(['univariate-distribution', 'anomaly-isolation']);
    expect(candidate.preserves).toEqual([
      'population-density-distribution',
      'outlier-boundary-visibility',
    ]);
    expect(candidate.loses).toEqual(['individual-observation-identity', 'exact-metric-values']);
  });
});
