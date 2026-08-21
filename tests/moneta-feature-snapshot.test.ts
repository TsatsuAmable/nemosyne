import { describe, expect, it } from 'vitest';
import {
  captureMonetaPairwiseFeatureSnapshots,
  MONETA_PAIRWISE_FEATURE_DIMENSIONS,
} from '../src/fitness/index.ts';
import type { RepresentationDecision, CandidateScore } from '../src/moneta/representation/RepresentationDecision.ts';

function candidate(id: 'POINT_SET' | 'DENSITY_FIELD', raw: readonly number[], score: number): CandidateScore {
  return {
    family: id === 'POINT_SET' ? 'POINT_CLOUD' : 'DENSITY_FIELD',
    candidateId: id,
    layout: 'CARTESIAN',
    score,
    components: MONETA_PAIRWISE_FEATURE_DIMENSIONS.map((component, index) => ({
      component,
      weight: 1 / MONETA_PAIRWISE_FEATURE_DIMENSIONS.length,
      rawScore: raw[index],
      weightedScore: raw[index] / MONETA_PAIRWISE_FEATURE_DIMENSIONS.length,
      reason: component,
    })),
    preserves: [],
    loses: [],
  } as CandidateScore;
}

function decision(): RepresentationDecision {
  return {
    utilityScore: 0.8,
    representationFamily: 'POINT_CLOUD',
    embodiment: {} as RepresentationDecision['embodiment'],
    evidence: [],
    rejectedAlternatives: [],
    provenance: {
      generatedAt: 1,
      engine: 'moneta',
      version: 'v1',
      datasetFingerprint: 'dataset-1',
      fitnessModelVersion: 'bootstrap-fitness-v1',
    },
    datasetSignature: {} as RepresentationDecision['datasetSignature'],
    rankedCandidates: [
      candidate('POINT_SET', [0.9, 0.8, 0.7, 0.6, 0.5, 0.4], 0.75),
      candidate('DENSITY_FIELD', [0.4, 0.5, 0.6, 0.7, 0.8, 0.9], 0.65),
    ],
  };
}

describe('Moneta candidate feature snapshot capture', () => {
  it('captures raw fitness dimensions in canonical order with graph provenance', () => {
    const snapshots = captureMonetaPairwiseFeatureSnapshots(decision(), {
      POINT_SET: 'graph-point',
      DENSITY_FIELD: 'graph-density',
    });
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].features).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]);
    expect(snapshots[0].bootstrapUtility).toBe(0.75);
    expect(snapshots[0].datasetFingerprint).toBe('dataset-1');
    expect(snapshots[0].fitnessModelVersion).toBe('bootstrap-fitness-v1');
  });

  it('fails closed when an exposed candidate has no RepresentationGraph identity', () => {
    expect(() => captureMonetaPairwiseFeatureSnapshots(decision(), { POINT_SET: 'graph-point' }))
      .toThrow(/Missing RepresentationGraph identity/);
  });

  it('fails closed when a canonical feature component is missing', () => {
    const value = decision();
    value.rankedCandidates![0].components = value.rankedCandidates![0].components.slice(0, -1);
    expect(() => captureMonetaPairwiseFeatureSnapshots(value, {
      POINT_SET: 'graph-point',
      DENSITY_FIELD: 'graph-density',
    })).toThrow(/missing fitness component/i);
  });
});
