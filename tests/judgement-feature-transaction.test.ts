import { describe, expect, it } from 'vitest';
import { JudgementFeatureTransaction } from '../src/app/JudgementFeatureTransaction.ts';
import { PairwiseFeatureSnapshotLedger } from '../src/fitness/PairwiseFeatureSnapshotLedger.ts';
import { AnalystJudgementController } from '../src/judgement/AnalystJudgementController.ts';
import { JudgementLedger } from '../src/judgement/JudgementLedger.ts';
import type { RepresentationDecision, CandidateScore } from '../src/moneta/representation/RepresentationDecision.ts';
import { MONETA_PAIRWISE_FEATURE_DIMENSIONS } from '../src/fitness/MonetaFeatureSnapshot.ts';

function candidate(id: 'POINT_SET' | 'DENSITY_FIELD', raw: readonly number[], score: number): CandidateScore {
  return {
    family: id === 'POINT_SET' ? 'POINT' : 'DISTRIBUTION',
    candidateId: id,
    layout: 'GRID_3D',
    score,
    components: MONETA_PAIRWISE_FEATURE_DIMENSIONS.map((component, index) => ({
      component,
      weight: 1 / 6,
      rawScore: raw[index],
      weightedScore: raw[index] / 6,
      reason: component,
    })),
    preserves: [],
    loses: [],
  };
}

function decision(): RepresentationDecision {
  return {
    utilityScore: 0.8,
    representationFamily: 'POINT',
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

function setup() {
  const judgements = new JudgementLedger();
  const features = new PairwiseFeatureSnapshotLedger();
  const controller = new AnalystJudgementController(judgements, {
    now: () => 10,
    nextId: () => 'judgement-1',
    context: () => ({
      investigationId: 'investigation-1',
      researcherId: 'researcher-1',
      provenance: {
        datasetFingerprint: 'dataset-1',
        kernelVersion: '0.1.0',
        monetaVersion: 'v1',
        fitnessModelVersion: 'bootstrap-fitness-v1',
        ontologyVersion: 'bootstrap-ontology-v1',
        nilVersion: '1.0.0',
        representationGraphSchemaVersion: '1.0.0',
      },
    }),
  });
  return { judgements, features, tx: new JudgementFeatureTransaction(controller, judgements, features) };
}

describe('JudgementFeatureTransaction', () => {
  it('commits pairwise judgement and exact Moneta feature snapshots together', () => {
    const { judgements, features, tx } = setup();
    tx.recordPairwise({
      decision: decision(),
      graphIdsByCandidate: { POINT_SET: 'graph-point', DENSITY_FIELD: 'graph-density' },
      preferredGraphId: 'graph-point',
      alternativeGraphId: 'graph-density',
    });
    expect(judgements.size).toBe(1);
    expect(features.all()).toHaveLength(2);
    expect(features.all()[0].datasetFingerprint).toBe('dataset-1');
  });

  it('leaves both ledgers unchanged when feature capture fails', () => {
    const { judgements, features, tx } = setup();
    expect(() => tx.recordPairwise({
      decision: decision(),
      graphIdsByCandidate: { POINT_SET: 'graph-point' },
      preferredGraphId: 'graph-point',
      alternativeGraphId: 'graph-density',
    })).toThrow(/Missing RepresentationGraph identity/);
    expect(judgements.size).toBe(0);
    expect(features.all()).toHaveLength(0);
  });
});
