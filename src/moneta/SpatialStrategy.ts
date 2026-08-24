import type { VRLayout, VRGeometry, VRBehavior, VRInteraction } from './types.ts';
import type { EncodingMapping } from '../data/types.ts';
import type { PositionSemanticsType } from './PositionSemantics.ts';

export type WorldType = 'MEMORY_PALACE' | 'ANALYST_COCKPIT' | 'FOCUSED_CHAMBER' | 'MINI_OVERVIEW';

export interface StrategyMacroLayout {
  layout: VRLayout;
  parameters: Record<string, number | string | boolean>;
  positionSemantics: PositionSemanticsType;
}

export interface StrategyDatumEncoding {
  geometry: VRGeometry;
  mappings: EncodingMapping;
  behavior: VRBehavior;
}

export interface StrategyInteraction {
  primaryInteraction: VRInteraction;
  supportedGestures: string[];
  detailLens: 'INSPECTOR_SLATE' | 'OUTLIER_HALO' | 'CLUSTER_ZONE' | 'TIME_DIAL';
}

export interface StrategyRejectionEntry {
  strategyId: string;
  layout: VRLayout;
  geometry: VRGeometry;
  score: number;
  reason: string;
}

export interface StrategyProvenance {
  generatedAt: number;
  engine: string;
  version: string;
  datasetFingerprint: string;
  requirementsHash: string;
  /** Exact fitness model semantic version used to rank this strategy, when known. */
  fitnessModelVersion?: string;
  /** Immutable learned-model artifact identity, present only for pinned learned ranking. */
  fitnessModelArtifactHash?: string | null;
}

export interface SpatialStrategy {
  id: string;
  worldType: WorldType;
  macroLayout: StrategyMacroLayout;
  datumEncoding: StrategyDatumEncoding;
  interactionStrategy: StrategyInteraction;
  /** Ranking utility from the active FitnessModel. This is not a calibrated probability. */
  score: number;
  rationale: string;
  rejectionLog: StrategyRejectionEntry[];
  provenance: StrategyProvenance;
}
