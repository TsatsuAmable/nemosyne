/**
 * Domain aggregate barrel export for the Atlas subsystem.
 */

export { AnalyticalState } from './AnalyticalState.ts';
export { EvidenceLedger } from './EvidenceLedger.ts';
export {
  RepresentationState,
  mapKernelFactsToDraco,
  minimalDracoFacts,
  estimateClusterCount,
} from './RepresentationState.ts';
export { DecisionHistory } from './DecisionHistory.ts';
export { ResearchContext, type ResearchContextOptions } from './ResearchContext.ts';
export {
  InvestigationGraph,
  type InvestigationNode,
  type InvestigationNodeKind,
  type InvestigationEdge,
  type InvestigationEdgeRelationship,
  type InvestigationGraphJSON,
} from './InvestigationGraph.ts';
export {
  InvestigationAggregate,
  type FormaInvestigationStateV1,
} from './InvestigationAggregate.ts';
export {
  CommittedInvestigationContextLedger,
  canonicalizeCommittedInvestigationContext,
  computeCommittedContextIdentity,
  checkContextCompatibility,
  CONTEXT_INCOMPATIBLE,
  type CommittedInvestigationContextV1,
  type CommittedInvestigationContextV2,
  type CommittedContextActivation,
  type ContextBinding,
  type EpistemicPurpose,
} from './CommittedInvestigationContext.ts';
export {
  canonicalizeInvestigationIntent,
  computeIntentIdentity,
  type InvestigationIntentV1,
} from './InvestigationIntent.ts';
export {
  canonicalizeInvestigationPerspective,
  computePerspectiveIdentity,
  ABSENT_PERSPECTIVE,
  type InvestigationPerspectiveV1,
  type PerspectiveMode,
  type TemporalForegrounding,
  type UncertaintyForegrounding,
} from './InvestigationPerspective.ts';
export {
  computeInvestigationDigest,
  computeSha256Hex,
  canonicalJsonStringify,
  type CanonicalInvestigationInput,
} from '../../investigation/index.ts';


