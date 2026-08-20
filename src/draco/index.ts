/**
 * Draco / Representation Subsystem — Barrel Export
 */

export { ConstraintEngine, VRChannels } from './ConstraintEngine.ts';
export { VRTopologyTranslator } from './VRTopologyTranslator.ts';
export { DracoTopologyNode } from './DracoTopologyNode.ts';
export { PositionSemanticsEngine } from './PositionSemantics.ts';
export type { PositionSemanticsType, PositionSemanticsDescriptor } from './PositionSemantics.ts';
export { TDAGlyphs } from './TDAGlyphs.ts';
export { applyEmbodimentHint, clearEmbodimentHints } from './EmbodimentHints.ts';
export { EvidenceInformedRecommender } from './EvidenceInformedRecommender.ts';
export { ConstraintArbiter } from './ConstraintArbiter.ts';
export type { ArbiterOptions } from './ConstraintArbiter.ts';
export {
  RepresentationRequirementsSchema,
  createDefaultRequirements,
} from './RepresentationRequirements.ts';
export type { RepresentationRequirements } from './RepresentationRequirements.ts';
export type {
  SpatialStrategy,
  WorldType,
  StrategyMacroLayout,
  StrategyDatumEncoding,
  StrategyInteraction,
  StrategyRejectionEntry,
  StrategyProvenance,
} from './SpatialStrategy.ts';

export * from './layouts/index.ts';
export * from './evidence/index.ts';
export * from './representation/index.ts';

export type {
  DracoSpec,
  VRLayout,
  VRGeometry,
  VRBehavior,
  VRInteraction,
  DracoFacts,
  FactProvider,
  SolverResult,
  DracoDataInput,
  Artifact,
} from './types.ts';
