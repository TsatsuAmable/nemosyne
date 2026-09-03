export * from './types.ts';
// ConstraintEngine is intentionally not part of the production Moneta barrel.
// It is a bounded compatibility/internal solver whose raw-input seam is gated
// by an authoritative FactProvider. Production representation selection uses
// the governed Moneta decision/evidence surfaces below.
export * from './VRTopologyTranslator.ts';
export * from './MonetaTopologyNode.ts';
export * from './SpatialStrategy.ts';
export * from './PositionSemantics.ts';
export * from './TDAGlyphs.ts';
export * from './EmbodimentHints.ts';
export * from './EvidenceInformedRecommender.ts';
export * from './layouts/index.ts';
export * from './evidence/index.ts';
export * from './representation/index.ts';
