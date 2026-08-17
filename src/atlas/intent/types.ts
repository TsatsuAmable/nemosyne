/**
 * Type definitions for the Nemosyne Atlas 7 Intent & Explanation Layer.
 *
 * Governing rule: Language models and intent parsers only interpret user intent
 * or explain verified findings; all authoritative computation, clustering,
 * filtering, and confidence calculations remain in AtlasCore and the versioned
 * Rust kernel.
 */

import type { OperationSpec, Predicate } from '../../data/types.ts';

export type IntentKind =
  | 'filter'
  | 'sort'
  | 'aggregate'
  | 'anomaly'
  | 'cluster'
  | 'inspect'
  | 'explain'
  | 'reset'
  | 'unknown';

export interface ParsedIntent {
  kind: IntentKind;
  rawQuery: string;
  matchedColumns: string[];
  predicate?: Predicate;
  operation?: OperationSpec;
  description: string;
  confidence: number; // 0.0 to 1.0
  warnings?: string[];
}

export interface GroundedExplanation {
  title: string;
  summary: string;
  keyFindings: string[];
  groundedMetrics: Record<string, unknown>;
  provenanceHash?: string;
  sourceDatasetFingerprint: string;
}
