import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  QUEST_CONSTRAINED_BUDGET,
  DESKTOP_EXPANSIVE_BUDGET,
  type DeviceCapabilityBudgetV1,
} from '../src/moneta/forma/FormaResolutionBroker.ts';
import type { EvidenceReferenceTupleV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

/**
 * FM5-R7: dataset-group-disjoint advice-vs-baseline battery.
 *
 * R5 measured advice-vs-bypassed deltas on one fixture shape (2 categories,
 * cluster task). This battery extends the same two-arm production-path method
 * to structurally disjoint fixtures (3 categories, skewed/larger shape,
 * distribution task) and pins stability under irrelevant intent rewording.
 *
 * Assertions are structural only: both arms complete, advice is recorded on
 * both, deltas are finite and reproduce, and rewording the research question
 * (same task) does not change the advice. NOTHING here asserts advice wins —
 * a negative delta is a valid measurement, and target-device qualification
 * remains open.
 */

const SCHEMA = [
  { name: 'dim1', type: ColumnType.NUMERIC },
  { name: 'dim2', type: ColumnType.NUMERIC },
  { name: 'category', type: ColumnType.CATEGORICAL },
] as const;

interface FixtureSpec {
  readonly rows: { dim1: number; dim2: number; category: string }[];
  readonly groups: { semanticId: string; key: string; count: number }[];
}

function twoCategoryFixture(rowCount: number): FixtureSpec {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      dim1: i * 2.0,
      dim2: (i % 6) * 1.5,
      category: i % 2 === 0 ? 'TypeA' : 'TypeB',
    });
  }
  const half = rowCount / 2;
  return {
    rows,
    groups: [
      { semanticId: 'group-type-a', key: 'TypeA', count: half },
      { semanticId: 'group-type-b', key: 'TypeB', count: half },
    ],
  };
}

function threeCategoryFixture(): FixtureSpec {
  const rows = [];
  for (let i = 0; i < 90; i++) {
    const category = i % 3 === 0 ? 'TypeA' : i % 3 === 1 ? 'TypeB' : 'TypeC';
    rows.push({ dim1: i * 1.7, dim2: (i % 9) * 0.9, category });
  }
  return {
    rows,
    groups: [
      { semanticId: 'group-type-a', key: 'TypeA', count: 30 },
      { semanticId: 'group-type-b', key: 'TypeB', count: 30 },
      { semanticId: 'group-type-c', key: 'TypeC', count: 30 },
    ],
  };
}

function skewedFixture(): FixtureSpec {
  const rows = [];
  for (let i = 0; i < 120; i++) {
    rows.push({
      dim1: (i % 12) * 3.1,
      dim2: (i % 5) * 2.2,
      category: i % 2 === 0 ? 'TypeA' : 'TypeB',
    });
  }
  return {
    rows,
    groups: [
      { semanticId: 'group-type-a', key: 'TypeA', count: 60 },
      { semanticId: 'group-type-b', key: 'TypeB', count: 60 },
    ],
  };
}

function makeEvidence(
  datasetFingerprint: string,
  groups: FixtureSpec['groups'],
  rowCount: number
): {
  envelope: SemanticEmbodimentEnvelopeV1;
  evidenceReferences: EvidenceReferenceTupleV1[];
} {
  return {
    envelope: {
      schemaVersion: 1,
      datasetFingerprint,
      candidateId: 'AGGREGATE_VOLUME',
      representationFamily: 'AGGREGATE',
      analyticalMethod: {
        name: 'aggregateVolume',
        version: '1.0.0',
        parameters: { groupingFields: ['category'], measure: 'COUNT' },
      },
      approximation: { mode: 'EXACT', representedRowCount: rowCount },
      informationContract: {
        preserves: ['exact-metric-values'],
        loses: ['individual-observation-identity'],
      },
      resource: { sourceRowCount: rowCount, elementCount: groups.length, maxElementCount: 4096 },
      provenance: {
        kernelVersion: '1.0.0',
        algorithmVersion: '1.0.0',
        decisionId: 'decision-fm5-007',
        decisionModelVersion: 'onnx-v2',
        decisionModelArtifactHash: 'hash-xyz',
      },
      result: {
        status: 'READY',
        payload: {
          kind: 'AGGREGATE_VOLUME',
          data: {
            groupingFields: ['category'],
            measure: { function: 'COUNT' },
            groups: [...groups],
          },
        },
      },
    },
    evidenceReferences: [
      {
        datasetFingerprint,
        kernelVersion: '1.0.0',
        bundleContentDigest: 'sha256-bundle-001',
        receiptId: 'receipt-001',
        receiptContentDigest: 'sha256-receipt-digest-001',
        consumerId: 'descriptive-summary/v1',
        requirementProfileId: 'profile-001',
        requirementProfileDigest: 'sha256-profile-digest-001',
        admissionPolicyId: 'policy-001',
        admissionPolicyDigest: 'sha256-policy-digest-001',
      },
    ],
  };
}

interface BatteryRow {
  readonly caseId: string;
  readonly structure: string;
  readonly task: string;
  readonly budgetProfile: string;
  readonly adviceStatus: string;
  readonly advisedUtility: number;
  readonly bypassedUtility: number;
  readonly utilityDelta: number;
  readonly advisedSeeded: boolean;
  readonly adviceTemplates: string;
}

function runCase(
  caseId: string,
  structure: string,
  fixture: FixtureSpec,
  intent: { researchQuestion: string; currentTask: string },
  budget: DeviceCapabilityBudgetV1
): BatteryRow {
  const runArm = (ignoreSystem1Advice?: boolean) => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(new Dataset(`fm5-r7-${caseId}-ds`, [...SCHEMA], fixture.rows));
    atlas.commitInvestigationContext(`node-${caseId}`, {
      schemaVersion: 2,
      nodeId: `node-${caseId}`,
      intent: {
        schemaVersion: 1,
        researchQuestion: intent.researchQuestion,
        variablesOfInterest: ['dim1', 'dim2'],
        currentTask: intent.currentTask,
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });
    const evidence = makeEvidence(atlas.datasetFingerprint!, fixture.groups, fixture.rows.length);
    return atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget,
      maxGenerations: 1,
      populationSize: 4,
      analyticalEvidence: evidence,
      ...(ignoreSystem1Advice === true ? { ignoreSystem1Advice: true as const } : {}),
    });
  };

  const advised = runArm();
  const bypassed = runArm(true);

  // Advice must be recorded on both arms (bypassed arm records what it withheld).
  expect(advised.provenance.system1ProposalSetId).toBe(advised.system1ProposalSet.proposalSetId);
  expect(bypassed.provenance.system1ProposalSetId).toBe(bypassed.system1ProposalSet.proposalSetId);

  const advisedSeeded = advised.paretoFrontier.some((c) =>
    (c.lineage.operatorApplied ?? '').startsWith('SYSTEM1_SEED_')
  );
  const adviceTemplates =
    advised.system1ProposalSet.status === 'PROPOSED'
      ? advised.system1ProposalSet.candidates.map((c) => c.templateId).join('+')
      : 'ABSTAIN';

  return {
    caseId,
    structure,
    task: intent.currentTask,
    budgetProfile: budget.profileName,
    adviceStatus: advised.system1ProposalSet.status,
    advisedUtility: advised.candidate.utility,
    bypassedUtility: bypassed.candidate.utility,
    utilityDelta: advised.candidate.utility - bypassed.candidate.utility,
    advisedSeeded,
    adviceTemplates,
  };
}

describe('FM5-R7: dataset-group-disjoint advice-vs-baseline battery', () => {
  test('disjoint structures and tasks complete with recorded advice and finite deltas', () => {
    const cluster = { researchQuestion: 'How do points cluster?', currentTask: 'cluster_analysis' };
    const distribution = {
      researchQuestion: 'How is the measure distributed across groups?',
      currentTask: 'distribution_analysis',
    };
    const rows = [
      runCase('three-cat-90-desktop', 'three-category', threeCategoryFixture(), cluster, DESKTOP_EXPANSIVE_BUDGET),
      runCase('three-cat-90-quest', 'three-category', threeCategoryFixture(), cluster, QUEST_CONSTRAINED_BUDGET),
      runCase('skewed-120-desktop', 'skewed-large', skewedFixture(), cluster, DESKTOP_EXPANSIVE_BUDGET),
      runCase('two-cat-80-dist-desktop', 'two-category', twoCategoryFixture(80), distribution, DESKTOP_EXPANSIVE_BUDGET),
      runCase('two-cat-80-dist-quest', 'two-category', twoCategoryFixture(80), distribution, QUEST_CONSTRAINED_BUDGET),
    ];

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(Number.isFinite(row.advisedUtility)).toBe(true);
      expect(Number.isFinite(row.bypassedUtility)).toBe(true);
      expect(Number.isFinite(row.utilityDelta)).toBe(true);
    }

    console.log(
      ['caseId,structure,task,budget,adviceStatus,advised,bypassed,delta,seeded,templates']
        .concat(
          rows.map((r) =>
            [
              r.caseId,
              r.structure,
              r.task,
              r.budgetProfile,
              r.adviceStatus,
              r.advisedUtility.toFixed(4),
              r.bypassedUtility.toFixed(4),
              r.utilityDelta.toFixed(4),
              String(r.advisedSeeded),
              r.adviceTemplates,
            ].join(',')
          )
        )
        .join('\n')
    );
  });

  test('irrelevant intent rewording does not change the advice', () => {
    const fixture = twoCategoryFixture(80);
    const runWithQuestion = (nodeId: string, researchQuestion: string) => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(new Dataset('fm5-r7-stab-ds', [...SCHEMA], fixture.rows));
      atlas.commitInvestigationContext(nodeId, {
        schemaVersion: 2,
        nodeId,
        intent: {
          schemaVersion: 1,
          researchQuestion,
          variablesOfInterest: ['dim1', 'dim2'],
          currentTask: 'cluster_analysis',
        },
        epistemicPurpose: 'CLAIM_BEARING',
      });
      const evidence = makeEvidence(atlas.datasetFingerprint!, fixture.groups, fixture.rows.length);
      return atlas.adaptRepresentation({
        preference: 'BALANCED',
        budget: DESKTOP_EXPANSIVE_BUDGET,
        maxGenerations: 1,
        populationSize: 4,
        analyticalEvidence: evidence,
      });
    };

    const first = runWithQuestion('node-stab-a', 'How do points cluster?');
    const second = runWithQuestion('node-stab-b', 'In what way do the points form clusters?');

    expect(first.system1ProposalSet.status).toBe('PROPOSED');
    expect(second.system1ProposalSet.status).toBe(first.system1ProposalSet.status);
    if (
      first.system1ProposalSet.status === 'PROPOSED' &&
      second.system1ProposalSet.status === 'PROPOSED'
    ) {
      expect(second.system1ProposalSet.candidates.map((c) => c.templateId)).toEqual(
        first.system1ProposalSet.candidates.map((c) => c.templateId)
      );
    }
  });

  test('disjoint-battery measurements reproduce exactly on rerun', () => {
    const cluster = { researchQuestion: 'How do points cluster?', currentTask: 'cluster_analysis' };
    const first = runCase('three-cat-90-desktop', 'three-category', threeCategoryFixture(), cluster, DESKTOP_EXPANSIVE_BUDGET);
    const second = runCase('three-cat-90-desktop', 'three-category', threeCategoryFixture(), cluster, DESKTOP_EXPANSIVE_BUDGET);
    expect(second).toEqual(first);
  });
});
