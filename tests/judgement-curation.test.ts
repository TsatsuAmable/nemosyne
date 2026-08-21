import { describe, expect, it } from 'vitest';
import {
  buildCuratedJudgementDataset,
  type PairwisePreferenceJudgement,
} from '../src/judgement/index.ts';

function judgement(
  judgementId: string,
  researcherId: string,
  datasetFingerprint: string,
  sequence = 0,
): PairwisePreferenceJudgement {
  return {
    schemaVersion: '1.0.0',
    judgementId,
    investigationId: `inv-${researcherId}`,
    researcherId,
    sequence,
    recordedAt: 1,
    kind: 'PAIRWISE_PREFERENCE',
    provenance: {
      datasetFingerprint,
      kernelVersion: 'kernel-1',
      monetaVersion: 'moneta-1',
      fitnessModelVersion: 'fitness-1',
      ontologyVersion: 'ontology-1',
      nilVersion: '1.0.0',
      representationGraphId: 'graph-a',
      studyProtocolVersion: 'study-1',
      studyConfigHash: 'hash-1',
    },
    preferredGraphId: 'graph-a',
    alternativeGraphId: 'graph-b',
  };
}

const policy = {
  partitionSeed: 'partition-seed-1',
  trainFraction: 0.6,
  validationFraction: 0.2,
  requireStudyProvenance: true,
  allowedKernelVersions: ['kernel-1'],
  allowedFitnessModelVersions: ['fitness-1'],
  allowedOntologyVersions: ['ontology-1'],
} as const;

describe('Wave 4 judgement curation', () => {
  it('keeps repeated researcher/dataset evidence in one deterministic partition', () => {
    const result = buildCuratedJudgementDataset([
      judgement('j-1', 'r-1', 'data-a', 0),
      judgement('j-2', 'r-1', 'data-a', 1),
      judgement('j-3', 'r-2', 'data-a', 0),
    ], policy);

    expect(result.excluded).toEqual([]);
    expect(result.included[0].partition).toBe(result.included[1].partition);
    expect(result.included[0].partitionGroup).toBe('data-a::r-1');
    expect(buildCuratedJudgementDataset([
      judgement('j-1', 'r-1', 'data-a', 0),
      judgement('j-2', 'r-1', 'data-a', 1),
      judgement('j-3', 'r-2', 'data-a', 0),
    ], policy)).toEqual(result);
  });

  it('records explicit exclusion reasons instead of silently dropping evidence', () => {
    const noStudy = judgement('j-no-study', 'r-1', 'data-a');
    delete noStudy.provenance.studyProtocolVersion;
    delete noStudy.provenance.studyConfigHash;
    const badKernel = judgement('j-bad-kernel', 'r-2', 'data-b');
    badKernel.provenance.kernelVersion = 'kernel-legacy';

    const result = buildCuratedJudgementDataset([noStudy, badKernel], policy);
    expect(result.included).toHaveLength(0);
    expect(result.excluded.map((entry) => entry.reason)).toEqual([
      'MISSING_REQUIRED_STUDY_PROVENANCE',
      'DISALLOWED_KERNEL_VERSION',
    ]);
  });

  it('rejects policies without a real holdout fraction', () => {
    expect(() => buildCuratedJudgementDataset([], {
      partitionSeed: 'seed',
      trainFraction: 0.8,
      validationFraction: 0.2,
    })).toThrow(/holdout/i);
  });

  it('excludes duplicate judgement IDs deterministically', () => {
    const first = judgement('dup', 'r-1', 'data-a');
    const duplicate = judgement('dup', 'r-2', 'data-b');
    const result = buildCuratedJudgementDataset([first, duplicate], policy);
    expect(result.included).toHaveLength(1);
    expect(result.excluded).toEqual([
      expect.objectContaining({ judgementId: 'dup', reason: 'DUPLICATE_JUDGEMENT_ID' }),
    ]);
  });
});
