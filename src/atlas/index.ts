/**
 * Atlas Subsystem — Barrel Export
 */

export { AtlasCore } from './AtlasCore.ts';
export type { WasmRuntimeBridgeFull } from './AtlasCore.ts';

export { DatasetSpace } from './DatasetSpace.ts';
export { generateGuidance } from './GuidanceEngine.ts';
export type { GuidanceOptions } from './GuidanceEngine.ts';

export type {
  StructureKind,
  StructureEvidence,
  DiscoveredStructure,
  StructureSet,
} from './structures.ts';

export * from './domain/index.ts';

export type {
  AnalysisSpec,
  EvidenceStatus,
  AnalysisResult,
  RecommendationDecision,
  AnalyticalAction,
  AnalyticalEvidence,
  VRCommand,
  AtlasRecommendation,
  ResearchEventKind,
  ResearchEvent,
  ResearchContext as AtlasResearchContextRecord,
  AtlasCoreState,
} from './types.ts';
