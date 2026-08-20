import type { VRLayout, VRGeometry, VRBehavior, VRInteraction } from '../types.ts';
import type { RepresentationFamily } from './RepresentationFamily.ts';
import type { SemanticRepresentationId, InformationType } from './RepresentationCandidate.ts';
import type { SpatialStrategy } from '../SpatialStrategy.ts';
import type { DatasetSignature } from './DatasetSignature.ts';

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
}

export interface RepresentationDecision {
  id?: string;
  chosenCandidateId?: SemanticRepresentationId;
  chosenFamily?: RepresentationFamily;
  chosenLayout?: VRLayout;
  confidenceScore?: number; // 0.0 to 1.0
  explanation?: string;
  rulesEvaluated?: HardConstraintTrace[];
  rankedCandidates?: CandidateScore[];
  preserves?: InformationType[];
  loses?: InformationType[];
  datasetFingerprint?: string;
  kernelVersion?: string;
  decisionTimestamp?: number;

  // Compatibility aliases
  representationFamily: RepresentationFamily;
  confidence: number;
  utilityScore: number;
  embodiment: DecisionEmbodiment;
  evidence: DecisionEvidenceItem[];
  rejectedAlternatives: RejectedAlternative[];
  provenance: DecisionProvenance;
  datasetSignature: DatasetSignature;
  scalePolicy?: Record<string, unknown>;
  progressiveDisclosurePolicy?: Record<string, unknown>;
}
