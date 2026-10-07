import { AtlasCore } from '../../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../../src/data/Dataset.ts';
import { makeKernelMockBridge } from './kernelMock.ts';
import {
  QUEST_CONSTRAINED_BUDGET,
  DESKTOP_EXPANSIVE_BUDGET,
  type DeviceCapabilityBudgetV1,
} from '../../src/moneta/forma/FormaResolutionBroker.ts';
import type { EvidenceReferenceTupleV1 } from '../../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../../src/moneta/representation/SemanticEmbodimentPayload.ts';

// Shared FM5 advice-vs-bypass battery fixture (moved verbatim from
// fm5-advice-measurement.test.ts so the R5 battery and the Stage 1 value
// gate run the identical frozen cases). Headless by design (mock kernels);
// figures are routing/provenance evidence, never analytical-truth claims.

const SCHEMA = [
  { name: 'dim1', type: ColumnType.NUMERIC },
  { name: 'dim2', type: ColumnType.NUMERIC },
  { name: 'category', type: ColumnType.CATEGORICAL },
] as const;

export function makeAdviceDataset(rowCount: number): Dataset {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      dim1: i * 2.0,
      dim2: (i % 6) * 1.5,
      category: i % 2 === 0 ? 'TypeA' : 'TypeB',
    });
  }
  return new Dataset('fm5-measure-ds', [...SCHEMA], rows);
}

export function makeAdviceEvidence(
  datasetFingerprint: string,
  rowCount: number
): {
  envelope: SemanticEmbodimentEnvelopeV1;
  evidenceReferences: EvidenceReferenceTupleV1[];
} {
  const half = rowCount / 2;
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
      resource: { sourceRowCount: rowCount, elementCount: 2, maxElementCount: 4096 },
      provenance: {
        kernelVersion: '1.0.0',
        algorithmVersion: '1.0.0',
        decisionId: 'decision-fm5-005',
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
            groups: [
              { semanticId: 'group-type-a', key: 'TypeA', count: half },
              { semanticId: 'group-type-b', key: 'TypeB', count: half },
            ],
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

export interface AdviceBatteryRow {
  readonly caseId: string;
  readonly adviceStatus: string;
  readonly advisedUtility: number;
  readonly bypassedUtility: number;
  readonly utilityDelta: number;
  readonly advisedSeeded: boolean;
}

export function runAdviceCase(
  caseId: string,
  rowCount: number,
  budget: DeviceCapabilityBudgetV1
): AdviceBatteryRow {
  const runArm = (ignoreSystem1Advice?: boolean) => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeAdviceDataset(rowCount));
    atlas.commitInvestigationContext(`node-${caseId}`, {
      schemaVersion: 2,
      nodeId: `node-${caseId}`,
      intent: {
        schemaVersion: 1,
        researchQuestion: 'How do points cluster?',
        variablesOfInterest: ['dim1', 'dim2'],
        currentTask: 'cluster_analysis',
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });
    const evidence = makeAdviceEvidence(atlas.datasetFingerprint!, rowCount);
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

  const advisedSeeded = advised.paretoFrontier.some((c) =>
    (c.lineage.operatorApplied ?? '').startsWith('SYSTEM1_SEED_')
  );

  return {
    caseId,
    adviceStatus: advised.system1ProposalSet.status,
    advisedUtility: advised.candidate.utility,
    bypassedUtility: bypassed.candidate.utility,
    utilityDelta: advised.candidate.utility - bypassed.candidate.utility,
    advisedSeeded,
  };
}

export const ADVICE_BATTERY_CASES = [
  { id: 'rows-80-desktop', rows: 80, budget: DESKTOP_EXPANSIVE_BUDGET },
  { id: 'rows-80-quest', rows: 80, budget: QUEST_CONSTRAINED_BUDGET },
  { id: 'rows-8-desktop', rows: 8, budget: DESKTOP_EXPANSIVE_BUDGET },
  { id: 'rows-8-quest', rows: 8, budget: QUEST_CONSTRAINED_BUDGET },
] as const;

export function runAdviceBattery(): AdviceBatteryRow[] {
  return ADVICE_BATTERY_CASES.map((c) => runAdviceCase(c.id, c.rows, c.budget));
}
