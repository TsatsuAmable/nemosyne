/**
 * Frozen Study Configuration for Nemosyne Empirical Research.
 *
 * Locked protocol bundle matching `docs/study/PROTOCOL.md` and `docs/study/ANALYSIS_PLAN.md`.
 */

import { GROUND_TRUTH_FRAUD_IDS } from './StudyDatasets.ts';
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
    maxDurationMs: 180000, // 3 minutes
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
    maxDurationMs: 120000, // 2 minutes
    groundTruth: {
      targetNodeIds: ['acc_fraud_99'],
      description: 'Primary outlier account acc_fraud_99 with peak volume $98,500',
    },
  },
];

export const FROZEN_CONFIG_HASH = 'draft-study-manifest-unfrozen';
