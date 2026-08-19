/**
 * Draco / Representation Subsystem — Barrel Export
 */

export { ConstraintEngine } from './ConstraintEngine.ts';
export { VRTopologyTranslator } from './VRTopologyTranslator.ts';
export { DracoTopologyNode } from './DracoTopologyNode.ts';
export { PositionSemanticsEngine } from './PositionSemantics.ts';
export type { PositionSemanticsType, PositionSemanticsDescriptor } from './PositionSemantics.ts';
export { TDAGlyphs } from './TDAGlyphs.ts';
export { applyEmbodimentHint, clearEmbodimentHints } from './EmbodimentHints.ts';
export { EvidenceInformedRecommender } from './EvidenceInformedRecommender.ts';

export * from './layouts/index.ts';
export * from './evidence/index.ts';

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
