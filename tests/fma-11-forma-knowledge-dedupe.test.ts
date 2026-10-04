import { describe, test, expect } from 'vitest';
import { FormaKnowledgeStore } from '../src/moneta/forma/FormaKnowledgeBase.js';
import {
  recordEmbodimentCritique,
  recordHumanMeaningJudgment,
} from '../src/moneta/forma/FormaHumanFeedback.js';

describe('FMA-11 residual: FormaKnowledgeStore attributable record deduplication & discovery threshold isolation', () => {
  test('resubmitting duplicate confirmed critique records does not inflate confirmed human evidence count', () => {
    const store = new FormaKnowledgeStore('kb0-dedupe-critique-test');

    const critique = recordEmbodimentCritique({
      planId: 'plan-1',
      sliceId: 'slice-1',
      contextId: 'ctx-1',
      semanticNodeId: 'node-1',
      critiqueText: 'Radial scatter is highly legible on mobile',
      confirmed: true,
    });

    // Attempting to promote with two references to the EXACT SAME critique record
    // must be deduped and fail because 1 distinct record < 2 required.
    expect(() =>
      store.promoteCase({
        templateId: 'template-sparse-scatter-v1',
        bindingId: 'binding-radial-scatter',
        phenotype: 'SPATIAL_SCATTER_V1',
        critiques: [critique, critique],
      })
    ).toThrow(/Insufficient confirmed evidence to promote case \(1 distinct confirmed human evidence records, minimum 2 required/);
  });

  test('resubmitting duplicate confirmed judgment records does not inflate confirmed human evidence count', () => {
    const store = new FormaKnowledgeStore('kb0-dedupe-judgment-test');

    const judgment = recordHumanMeaningJudgment({
      representationId: 'rep-1',
      versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
      intendedSemanticMeaning: 'Density distribution',
      perceivedMeaning: 'Density distribution',
      taskComprehensionOutcome: 'ACCURATE',
      author: { researcherId: 'researcher-1' },
      confirmed: true,
    });

    // Attempting to promote with two references to the EXACT SAME judgment record
    // must be deduped and fail because 1 distinct record < 2 required.
    expect(() =>
      store.promoteCase({
        templateId: 'template-sparse-scatter-v1',
        bindingId: 'binding-radial-scatter',
        phenotype: 'SPATIAL_SCATTER_V1',
        meaningJudgments: [judgment, judgment],
      })
    ).toThrow(/1 distinct confirmed human evidence records/);
  });

  test('discoveryOutcomeCount alone or with 1 confirmed record cannot satisfy 2-record threshold', () => {
    const store = new FormaKnowledgeStore('kb0-discovery-isolation-test');

    const critique = recordEmbodimentCritique({
      planId: 'plan-1',
      sliceId: 'slice-1',
      contextId: 'ctx-1',
      semanticNodeId: 'node-1',
      critiqueText: 'Clear spatial grouping',
      confirmed: true,
    });

    // 1 confirmed critique + discoveryOutcomeCount: 100 must fail because confirmedHumanEvidence is 1 (< 2 required)
    expect(() =>
      store.promoteCase({
        templateId: 'template-sparse-scatter-v1',
        bindingId: 'binding-radial-scatter',
        phenotype: 'SPATIAL_SCATTER_V1',
        critiques: [critique],
        discoveryOutcomeCount: 100,
      })
    ).toThrow(/discovery outcome counts cannot substitute/);
  });

  test('case identity binds exact attributable critique and judgment record IDs', () => {
    const store1 = new FormaKnowledgeStore('kb0-identity-test-1');
    const store2 = new FormaKnowledgeStore('kb0-identity-test-2');

    const critiqueA = recordEmbodimentCritique({
      planId: 'plan-1',
      sliceId: 'slice-1',
      contextId: 'ctx-1',
      semanticNodeId: 'node-1',
      critiqueText: 'First critique text',
      confirmed: true,
    });

    const critiqueB = recordEmbodimentCritique({
      planId: 'plan-1',
      sliceId: 'slice-1',
      contextId: 'ctx-1',
      semanticNodeId: 'node-2',
      critiqueText: 'Second critique text',
      confirmed: true,
    });

    const judgment = recordHumanMeaningJudgment({
      representationId: 'rep-1',
      versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
      intendedSemanticMeaning: 'Meaning A',
      perceivedMeaning: 'Meaning A',
      taskComprehensionOutcome: 'ACCURATE',
      author: { researcherId: 'researcher-1' },
      confirmed: true,
    });

    const case1 = store1.promoteCase({
      templateId: 'template-sparse-scatter-v1',
      bindingId: 'binding-radial-scatter',
      phenotype: 'SPATIAL_SCATTER_V1',
      critiques: [critiqueA],
      meaningJudgments: [judgment],
    });

    const case2 = store2.promoteCase({
      templateId: 'template-sparse-scatter-v1',
      bindingId: 'binding-radial-scatter',
      phenotype: 'SPATIAL_SCATTER_V1',
      critiques: [critiqueB],
      meaningJudgments: [judgment],
    });

    expect(case1.caseId).not.toBe(case2.caseId);
    expect(case1.provenanceDigest).not.toBe(case2.provenanceDigest);
  });
});
