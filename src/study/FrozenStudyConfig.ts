/**
 * Frozen Study Configuration for Nemosyne Empirical Research.
 *
 * Locked protocol bundle matching `docs/study/PROTOCOL.md` and `docs/study/ANALYSIS_PLAN.md`.
 */

import { GROUND_TRUTH_FRAUD_IDS } from './StudyDatasets.ts';
import {
  STUDY_FREEZE_MANIFEST_SCHEMA_VERSION,
  currentStudyRuntimeVersions,
  hashStudyFreezeManifest,
  type StudyFreezeManifest,
} from './StudyFreezeManifest.ts';
import type { TaskSpec, StudyCondition } from './types.ts';

export const FROZEN_STUDY_NAME = 'Find the Fraud';
export const FROZEN_PROTOCOL_VERSION = '1.0.0-draft';
export const FROZEN_STUDY_STATUS = 'DRAFT' as const;

export const FROZEN_STUDY_CONDITIONS: StudyCondition[] = ['2d_control', 'vr_experimental'];

export const FROZEN_STUDY_TASKS: TaskSpec[] = [
  {
    id: 'task_fraud_detection_1',
    name: 'Identify Fraud Mule Ring',
    datasetType: 'Financial Transaction Network',
    datasetFingerprint: 'draft-synthetic-fraud-v1',
    description: 'Find the coordinated high-risk accounts participating in the circular transaction ring.',
    instructions: 'Explore the dataset, inspect account attributes and transaction structures, and select all accounts belonging to the fraud ring.',
    maxDurationMs: 180000,
    groundTruth: {
      targetNodeIds: [...GROUND_TRUTH_FRAUD_IDS],
      expectedClusterLabel: 'mule_ring',
      expectedTopology: 'circular_cycle',
      description: 'Circular mule accounts acc_fraud_99, acc_fraud_98, acc_fraud_97 with risk scores > 0.85',
    },
  },
  {
    id: 'task_outlier_detection_2',
    name: 'Detect Isolated Anomaly',
    datasetType: 'Financial Scatter / Anomaly',
    datasetFingerprint: 'draft-synthetic-outlier-v1',
    description: 'Identify the primary outlier account exhibiting anomalous volume relative to its peer group.',
    instructions: 'Locate and select the single highest-deviation account node in the dataset space.',
    maxDurationMs: 120000,
    groundTruth: {
      targetNodeIds: ['acc_fraud_99'],
      description: 'Primary outlier account acc_fraud_99 with peak volume $98,500',
    },
  },
];

/**
 * Canonical protocol-visible treatment manifest. The study remains DRAFT until
 * protocol review supplies an exact Rust/WASM kernel version and promotes the
 * status to FROZEN; however drift detection is active already.
 */
export const FROZEN_STUDY_MANIFEST: StudyFreezeManifest = {
  schemaVersion: STUDY_FREEZE_MANIFEST_SCHEMA_VERSION,
  studyName: FROZEN_STUDY_NAME,
  protocolVersion: FROZEN_PROTOCOL_VERSION,
  protocolStatus: FROZEN_STUDY_STATUS,
  conditions: FROZEN_STUDY_CONDITIONS,
  tasks: FROZEN_STUDY_TASKS,
  runtimeVersions: currentStudyRuntimeVersions(null),
  adaptiveBehaviour: {
    policy: 'disabled',
    protocolVisible: true,
  },
};

export const FROZEN_CONFIG_HASH = hashStudyFreezeManifest(FROZEN_STUDY_MANIFEST);
