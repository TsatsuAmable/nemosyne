import type { VRLayout, VRGeometry, VRBehavior, VRInteraction } from '../types.ts';
import type { RepresentationFamily } from './RepresentationFamily.ts';
import type { SemanticRepresentationId, InformationType } from './RepresentationCandidate.ts';
import type { SpatialStrategy } from '../SpatialStrategy.ts';
import type { DatasetSignature } from './DatasetSignature.ts';
import type { RepresentationDecisionStatus } from './DecisionPolicy.ts';

export interface ScoreComponent {
  component: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  reason: string;
}

export interface HardConstraintTrace {
  ruleName: string;
  passed: boolean;
  reason: string;
}

export interface CandidateScore {
  family: RepresentationFamily;
  candidateId: SemanticRepresentationId;
  layout: VRLayout;
  score: number;
  components: ScoreComponent[];
  disqualified?: boolean;
  disqualificationReason?: string;
  preserves: InformationType[];
  loses: InformationType[];
}

export interface DecisionEvidenceItem {
  fact: string;
  weight: number;
  supports: RepresentationFamily | boolean;
  source: string;
}

export interface RejectedAlternative {
  family: RepresentationFamily;
  score: number;
  reason: string;
  hardPassed: boolean;
}

export interface DecisionEmbodiment {
  primaryLayout: VRLayout;
  primaryGeometry: VRGeometry;
  primaryBehavior: VRBehavior;
  primaryInteraction: VRInteraction;
  spatialStrategy: SpatialStrategy;
}

export interface DecisionProvenance {
  generatedAt: number;
  engine: string;
  version: string;
  datasetFingerprint: string;
  requirementsHash?: string;
  fitnessModelVersion?: string;
}

export interface RepresentationDecision {
  id?: string;
  chosenCandidateId?: SemanticRepresentationId;
  chosenFamily?: RepresentationFamily;
  chosenLayout?: VRLayout;
  explanation?: string;
  rulesEvaluated?: HardConstraintTrace[];
  rankedCandidates?: CandidateScore[];
  preserves?: InformationType[];
  loses?: InformationType[];
  datasetFingerprint?: string;
  kernelVersion?: string;
  decisionTimestamp?: number;

  /** V3: utility is an uncalibrated model score, not a probability. */
  utilityScore: number;
  decisionStatus?: RepresentationDecisionStatus;
  runnerUp?: CandidateScore | null;
  decisionMargin?: number | null;
  decisionRationale?: string;
  fitnessModelVersion?: string;

  /** @deprecated Uncalibrated utility must not be described as confidence. */
  confidenceScore?: number;

  // Compatibility aliases retained while downstream call sites migrate.
  representationFamily: RepresentationFamily;
  /** @deprecated Use utilityScore + decisionStatus. */
  confidence?: number;
  embodiment: DecisionEmbodiment;
  evidence: DecisionEvidenceItem[];
  rejectedAlternatives: RejectedAlternative[];
  provenance: DecisionProvenance;
  datasetSignature: DatasetSignature;
  scalePolicy?: Record<string, unknown>;
  progressiveDisclosurePolicy?: Record<string, unknown>;
}
