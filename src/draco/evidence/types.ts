/**
 * Types for the Evidence-Informed Draco Recommender Loop.
 *
 * Encapsulates empirical study outcomes (accuracy, response time, NASA-TLX
 * workload) to dynamically adjust Draco soft constraint weights and candidate
 * carousel ranking policies based on verified human performance.
 */

import type { DracoSpec } from '../types.ts';
import type { StudyCondition } from '../../study/types.ts';

export interface EmpiricalOutcome {
  trialId: string;
  datasetFingerprint: string;
  condition: StudyCondition;
  taskType: string;
  spec?: DracoSpec;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  durationMs: number;
  nasaTlxAverage?: number; // 0 to 100
  confidenceRating?: number; // 1 to 7
  timestamp: number;
}

export interface EmpiricalUtilityScore {
  specKey: string;
  condition: StudyCondition;
  sampleCount: number;
  meanAccuracy: number;
  meanF1: number;
  meanDurationMs: number;
  meanNasaTlx: number;
  compositeUtility: number; // 0.0 to 1.0 (higher = better human performance)
}

export interface EmpiricalWeightModifiers {
  softConstraintAdjustments: Record<string, number>;
  layoutBoosts: Record<string, number>;
  geometryBoosts: Record<string, number>;
}
