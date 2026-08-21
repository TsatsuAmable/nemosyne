import { describe, expect, it } from 'vitest';
import { AnalystJudgementController } from '../src/judgement/AnalystJudgementController.ts';
import { JudgementLedger } from '../src/judgement/JudgementLedger.ts';

function controller() {
  const ledger = new JudgementLedger();
  let id = 0;
  const capture = new AnalystJudgementController(ledger, {
    context: () => ({
      investigationId: 'inv-1',
      researcherId: 'researcher-1',
      provenance: {
        datasetFingerprint: 'dataset-1',
        kernelVersion: 'kernel-1',
        monetaVersion: 'moneta-1',
        fitnessModelVersion: 'fitness-1',
        ontologyVersion: 'ontology-1',
        nilVersion: 'nil-1',
        representationGraphId: 'graph-current',
      },
    }),
    now: () => 100,
    nextId: () => `j-${id++}`,
  });
  return { ledger, capture };
}

describe('AnalystJudgementController', () => {
  it('converts cockpit preference and rating actions into contiguous append-only evidence', () => {
    const { ledger, capture } = controller();
    const preference = capture.prefer({
      preferredGraphId: 'graph-a',
      alternativeGraphId: 'graph-b',
      strength: 6,
      rationale: 'Graph A makes the temporal break legible',
    });
    const rating = capture.rate({ graphId: 'graph-a', dimension: 'TASK_FIT', rating: 7 });

    expect(preference.sequence).toBe(0);
    expect(rating.sequence).toBe(1);
    expect(ledger.all()).toHaveLength(2);
    expect(ledger.all().map((entry) => entry.kind)).toEqual(['PAIRWISE_PREFERENCE', 'ABSOLUTE_RATING']);
  });

  it('records weight adjustment as evidence without applying model state', () => {
    const { ledger, capture } = controller();
    const adjustment = capture.adjustWeight({
      dimension: 'readability',
      previousWeight: 0.2,
      proposedWeight: 0.3,
      applied: false,
    });

    expect(adjustment.kind).toBe('WEIGHT_ADJUSTMENT');
    expect(adjustment.applied).toBe(false);
    expect(ledger.size).toBe(1);
  });

  it('links discovery outcomes with matching discovery provenance', () => {
    const { capture } = controller();
    const result = capture.linkDiscoveryOutcome({
      discoveryId: 'discovery-7',
      graphId: 'graph-a',
      outcome: 'SUPPORTED',
    });

    expect(result.provenance.discoveryId).toBe('discovery-7');
    expect(result.outcome).toBe('SUPPORTED');
  });

  it('rejects invalid researcher context before appending anything', () => {
    const ledger = new JudgementLedger();
    const capture = new AnalystJudgementController(ledger, {
      context: () => ({
        investigationId: 'inv-1',
        researcherId: '   ',
        provenance: {
          datasetFingerprint: 'dataset-1',
          kernelVersion: 'kernel-1',
          monetaVersion: 'moneta-1',
          fitnessModelVersion: 'fitness-1',
          ontologyVersion: 'ontology-1',
          nilVersion: 'nil-1',
          representationGraphId: 'graph-current',
        },
      }),
    });

    expect(() => capture.reject({ rejectedGraphId: 'graph-b', reasonCodes: ['OCCLUSION'] })).toThrow(/context/i);
    expect(ledger.size).toBe(0);
  });
});
