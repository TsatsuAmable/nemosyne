import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  QUEST_CONSTRAINED_BUDGET,
  DESKTOP_EXPANSIVE_BUDGET,
  type DeviceCapabilityBudgetV1,
} from '../src/moneta/forma/FormaResolutionBroker.ts';
import type { SynthesizedCandidate } from '../src/moneta/search/RepresentationSearchEngine.ts';
import type { EvidenceReferenceTupleV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

/**
 * FM5-R8: advised-vs-bypassed Pareto-frontier coverage probe.
 *
 * R7 showed advice is winner-utility-neutral (delta 0.0000) on disjoint
 * fixtures. A neutral winner does not rule out a coverage effect: advice
 * could still expand the admitted Pareto set (candidate-coverage recall,
 * per the System-1 architecture evaluation requirements) even when the
 * top-utility pick is unchanged. This probe compares the full frontier
 * structure sets of the advised and bypassed arms on the production path.
 *
 * Assertions are structural only: both arms complete with non-empty
 * frontiers, the set comparison is computable and reproduces exactly.
 * Added/lost counts are reported, never gated — zero coverage change is a
 * valid measurement, not a failure.
 */

const SCHEMA = [
  { name: 'dim1', type: ColumnType.NUMERIC },
  { name: 'dim2', type: ColumnType.NUMERIC },
  { name: 'category', type: ColumnType.CATEGORICAL },
] as const;

/**
 * Coarse structure identity: sorted primitive-kind multiset plus sorted
 * relation multiset. Endpoint IDs are deliberately excluded because mutated
 * IDs embed generation counters and timestamps that differ run-to-run even
 * for the same topology; the coarseness is documented and conservative
 * (it can only understate coverage differences, never invent them).
 */
function structureKey(c: SynthesizedCandidate): string {
  const kinds = c.graph.primitives.map((p) => p.kind).sort().join('+');
  const relations = c.graph.edges.map((e) => e.relation).sort().join(';');
  return `${kinds}|${relations}`;
}

interface FixtureSpec {
  readonly rows: { dim1: number; dim2: number; category: string }[];
  readonly groups: { semanticId: string; key: string; count: number }[];
}

function twoCategoryFixture(): FixtureSpec {
  const rows = [];
  for (let i = 0; i < 80; i++) {
    rows.push({
      dim1: i * 2.0,
      dim2: (i % 6) * 1.5,
      category: i % 2 === 0 ? 'TypeA' : 'TypeB',
    });
  }
  return {
    rows,
    groups: [
      { semanticId: 'group-type-a', key: 'TypeA', count: 40 },
      { semanticId: 'group-type-b', key: 'TypeB', count: 40 },
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
        decisionId: 'decision-fm5-008',
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

interface CoverageRow {
  readonly caseId: string;
  readonly advisedFrontierSize: number;
  readonly bypassedFrontierSize: number;
  readonly coverageAdded: number;
  readonly coverageLost: number;
  readonly winnerDelta: number;
  readonly addedKeys: readonly string[];
}

function runCoverageCase(
  caseId: string,
  fixture: FixtureSpec,
  currentTask: string,
  budget: DeviceCapabilityBudgetV1,
  search: { maxGenerations: number; populationSize: number } = { maxGenerations: 1, populationSize: 4 }
): CoverageRow {
  const runArm = (ignoreSystem1Advice?: boolean) => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(new Dataset(`fm5-r8-${caseId}-ds`, [...SCHEMA], fixture.rows));
    atlas.commitInvestigationContext(`node-${caseId}`, {
      schemaVersion: 2,
      nodeId: `node-${caseId}`,
      intent: {
        schemaVersion: 1,
        researchQuestion: 'How do points cluster?',
        variablesOfInterest: ['dim1', 'dim2'],
        currentTask,
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });
    const evidence = makeEvidence(atlas.datasetFingerprint!, fixture.groups, fixture.rows.length);
    return atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget,
      maxGenerations: search.maxGenerations,
      populationSize: search.populationSize,
      analyticalEvidence: evidence,
      ...(ignoreSystem1Advice === true ? { ignoreSystem1Advice: true as const } : {}),
    });
  };

  const advised = runArm();
  const bypassed = runArm(true);

  expect(advised.paretoFrontier.length).toBeGreaterThan(0);
  expect(bypassed.paretoFrontier.length).toBeGreaterThan(0);

  const advisedKeys = new Set(advised.paretoFrontier.map(structureKey));
  const bypassedKeys = new Set(bypassed.paretoFrontier.map(structureKey));
  const addedKeys = [...advisedKeys].filter((k) => !bypassedKeys.has(k));
  const lostCount = [...bypassedKeys].filter((k) => !advisedKeys.has(k)).length;

  return {
    caseId,
    advisedFrontierSize: advisedKeys.size,
    bypassedFrontierSize: bypassedKeys.size,
    coverageAdded: addedKeys.length,
    coverageLost: lostCount,
    winnerDelta: advised.candidate.utility - bypassed.candidate.utility,
    addedKeys,
  };
}

describe('FM5-R8: advised-vs-bypassed frontier coverage probe', () => {
  test('frontier coverage comparison completes with non-empty frontiers and finite deltas', () => {
    const rows = [
      runCoverageCase('three-cat-desktop', threeCategoryFixture(), 'cluster_analysis', DESKTOP_EXPANSIVE_BUDGET),
      runCoverageCase('three-cat-quest', threeCategoryFixture(), 'cluster_analysis', QUEST_CONSTRAINED_BUDGET),
      runCoverageCase('two-cat-desktop', twoCategoryFixture(), 'cluster_analysis', DESKTOP_EXPANSIVE_BUDGET),
      runCoverageCase('three-cat-wide', threeCategoryFixture(), 'cluster_analysis', DESKTOP_EXPANSIVE_BUDGET, { maxGenerations: 3, populationSize: 12 }),
    ];

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(Number.isFinite(row.winnerDelta)).toBe(true);
      expect(Number.isInteger(row.coverageAdded)).toBe(true);
      expect(Number.isInteger(row.coverageLost)).toBe(true);
    }

    console.log(
      ['caseId,advisedSize,bypassedSize,added,lost,winnerDelta,addedKeys']
        .concat(
          rows.map((r) =>
            [
              r.caseId,
              String(r.advisedFrontierSize),
              String(r.bypassedFrontierSize),
              String(r.coverageAdded),
              String(r.coverageLost),
              r.winnerDelta.toFixed(4),
              r.addedKeys.join('+') || '(none)',
            ].join(',')
          )
        )
        .join('\n')
    );
  });

  test('coverage comparison reproduces exactly on rerun', () => {
    const first = runCoverageCase('three-cat-desktop', threeCategoryFixture(), 'cluster_analysis', DESKTOP_EXPANSIVE_BUDGET);
    const second = runCoverageCase('three-cat-desktop', threeCategoryFixture(), 'cluster_analysis', DESKTOP_EXPANSIVE_BUDGET);
    expect(second).toEqual(first);
  });
});
