import { describe, expect, it } from 'vitest';
import {
  JUDGEMENT_LEDGER_SCHEMA_VERSION,
  JudgementLedger,
  REPRESENTATION_JUDGEMENT_SCHEMA_VERSION,
  assertRepresentationJudgement,
  type PairwisePreferenceJudgement,
  type RepresentationJudgement,
} from '../src/judgement/index.ts';

function preference(sequence = 0, id = 'j-1'): PairwisePreferenceJudgement {
  return {
    schemaVersion: REPRESENTATION_JUDGEMENT_SCHEMA_VERSION,
    judgementId: id,
    investigationId: 'inv-1',
    researcherId: 'researcher-pseudonym-1',
    sequence,
    recordedAt: 1000 + sequence,
    kind: 'PAIRWISE_PREFERENCE',
    preferredGraphId: 'graph-a',
    alternativeGraphId: 'graph-b',
    strength: 6,
    rationale: 'Graph A preserves the cluster split more legibly.',
    provenance: {
      datasetFingerprint: 'sha256:dataset',
      kernelVersion: 'wasm-1',
      monetaVersion: 'moneta-1',
      fitnessModelVersion: 'fitness-1',
      ontologyVersion: 'ontology-1',
      nilVersion: '1.0.0',
      representationGraphId: 'graph-a',
      representationDecisionId: 'decision-1',
      studyProtocolVersion: 'protocol-1',
      studyConfigHash: 'config-1',
    },
  };
}

describe('RepresentationJudgement', () => {
  it('validates attributable pairwise preference evidence', () => {
    expect(assertRepresentationJudgement(preference())).toBeTruthy();
  });

  it('rejects self-comparison and invalid ratings/weights', () => {
    const self = preference();
    self.alternativeGraphId = self.preferredGraphId;
    expect(() => assertRepresentationJudgement(self)).toThrow(/differ/i);

    const invalidRating: RepresentationJudgement = {
      ...preference(),
      kind: 'ABSOLUTE_RATING',
      graphId: 'graph-a',
      dimension: 'OVERALL',
      rating: 8 as 7,
    };
    expect(() => assertRepresentationJudgement(invalidRating)).toThrow(/rating/i);

    const invalidWeight: RepresentationJudgement = {
      ...preference(),
      kind: 'WEIGHT_ADJUSTMENT',
      dimension: 'structure',
      previousWeight: 0.35,
      proposedWeight: 1.2,
      applied: false,
    };
    expect(() => assertRepresentationJudgement(invalidWeight)).toThrow(/proposedWeight/i);
  });
});

describe('JudgementLedger', () => {
  it('is append-only, ordered per investigation, and clones caller state', () => {
    const ledger = new JudgementLedger();
    const first = preference();
    ledger.append(first);
    first.rationale = 'caller mutation';

    expect(ledger.all()[0].rationale).not.toBe('caller mutation');
    expect(() => ledger.append(preference(1, 'j-1'))).toThrow(/already exists/i);
    expect(() => ledger.append(preference(2, 'j-3'))).toThrow(/out-of-order/i);

    ledger.append(preference(1, 'j-2'));
    expect(ledger.expectedSequence('inv-1')).toBe(2);
  });

  it('restores atomically and rejects malformed history', () => {
    const ledger = new JudgementLedger();
    ledger.append(preference());

    const invalid = preference(2, 'j-gap');
    expect(() =>
      ledger.restore({
        schemaVersion: JUDGEMENT_LEDGER_SCHEMA_VERSION,
        judgementSchemaVersion: REPRESENTATION_JUDGEMENT_SCHEMA_VERSION,
        judgements: [preference(0, 'candidate'), invalid],
      }),
    ).toThrow(/out-of-order/i);

    expect(ledger.all()).toHaveLength(1);
    expect(ledger.all()[0].judgementId).toBe('j-1');
  });

  it('round-trips a mixed evidence stream without learning from it', () => {
    const ledger = new JudgementLedger();
    ledger.append(preference());
    ledger.append({
      ...preference(1, 'j-2'),
      kind: 'DISCOVERY_OUTCOME_LINK',
      discoveryId: 'discovery-1',
      graphId: 'graph-a',
      outcome: 'SUPPORTED',
      provenance: {
        ...preference().provenance,
        discoveryId: 'discovery-1',
      },
    });

    const restored = new JudgementLedger();
    restored.restore(ledger.toJSON());
    expect(restored.all()).toEqual(ledger.all());
  });
});
