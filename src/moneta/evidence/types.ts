/**
 * Types for the Evidence-Informed Moneta Recommender Loop.
 */

import type { MonetaSpec, DracoSpec } from '../types.ts';
import type { StudyCondition } from '../../study/types.ts';

export interface EmpiricalOutcome {
  trialId: string;
  datasetFingerprint: string;
  condition: StudyCondition;
  taskType: string;
  spec?: MonetaSpec | DracoSpec;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  durationMs: number;
  nasaTlxAverage?: number;
  confidenceRating?: number;
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
  compositeUtility: number;
}

export interface EmpiricalWeightModifiers {
  softConstraintAdjustments: Record<string, number>;
  layoutBoosts: Record<string, number>;
  geometryBoosts: Record<string, number>;
}
