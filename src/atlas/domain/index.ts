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
export { InvestigationGraph, type InvestigationNode } from './InvestigationGraph.ts';
export { InvestigationAggregate } from './InvestigationAggregate.ts';
