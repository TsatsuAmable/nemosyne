import type { VRLayout, VRGeometry, VRBehavior, VRInteraction } from '../types.ts';
import type { RepresentationFamily } from './RepresentationFamily.ts';
import type { SemanticRepresentationId, InformationType } from './RepresentationCandidate.ts';
import type { SpatialStrategy } from '../SpatialStrategy.ts';
import type { DatasetSignature } from './DatasetSignature.ts';
import type { RepresentationDecisionStatus } from './DecisionPolicy.ts';
import type { WeightSensitivityResult } from './SensitivityAnalysis.ts';
import type { HardConstraintCode } from './HardConstraintCode.ts';

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
  /** RF-027: machine-readable constraint code, present on failure. */
  code?: HardConstraintCode;
}

export interface CandidateScore {
  family: RepresentationFamily;
  candidateId: SemanticRepresentationId;
  layout: VRLayout;
  score: number;
  components: ScoreComponent[];
  disqualified?: boolean;
  disqualificationReason?: string;
  /** RF-027: machine-readable constraint code that disqualified this candidate. */
  disqualificationCode?: HardConstraintCode;
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

/**
 * FM2: Semantic eligibility of an alternative representation candidate.
 */
export type AlternativeEligibility =
  | 'ELIGIBLE'
  | 'NEAR_MISS'
  | 'AMBIGUOUS'
  | 'ABSTAIN'
  | 'DISQUALIFIED';

/**
 * FM2: Bounded inspectable candidate identity for the Road Not Taken flow.
 * Promotes passive RejectedAlternative metadata into an actionable representation candidate
 * with preserved spatial embodiment and shared semantic anchors.
 */
export interface AlternativeCandidate {
  readonly candidateId: SemanticRepresentationId;
  readonly family: RepresentationFamily;
  readonly layout: VRLayout;
  readonly geometry: VRGeometry;
  readonly behavior: VRBehavior;
  readonly interaction: VRInteraction;
  readonly score: number;
  readonly scoreMarginToWinner: number;
  readonly eligibility: AlternativeEligibility;
  readonly reason: string;
  readonly hardPassed: boolean;
  readonly sharedSemanticAnchors?: readonly string[];
}

export interface DecisionEmbodiment {
  primaryLayout: VRLayout;
  primaryGeometry: VRGeometry;
  primaryBehavior: VRBehavior;
  primaryInteraction: VRInteraction;
  spatialStrategy: SpatialStrategy;
}

/**
 * FM2: Construct a DecisionEmbodiment for an AlternativeCandidate.
 */
export function createEmbodimentForAlternative(
  candidate: AlternativeCandidate,
  datasetFingerprint: string
): DecisionEmbodiment {
  const positionSemantics =
    candidate.layout === 'GEO_SURFACE'
      ? 'SEMANTIC'
      : candidate.layout === 'FORCE_DIRECTED_3D' || candidate.layout === 'RADIAL_ORBITAL'
        ? 'STRUCTURAL'
        : 'ALGORITHMIC_LAYOUT';
  const detailLens =
    candidate.layout === 'TIME_RIBBON'
      ? 'TIME_DIAL'
      : candidate.candidateId === 'CLUSTER_REGIONS'
        ? 'CLUSTER_ZONE'
        : candidate.candidateId === 'DISTRIBUTION_FIELD'
          ? 'OUTLIER_HALO'
          : 'INSPECTOR_SLATE';

  const spatialStrategy: SpatialStrategy = {
    id: `strat:${candidate.candidateId}_${candidate.layout}`,
    worldType: candidate.layout === 'RADIAL_ORBITAL' ? 'FOCUSED_CHAMBER' : 'ANALYST_COCKPIT',
    macroLayout: { layout: candidate.layout, parameters: {}, positionSemantics },
    datumEncoding: { geometry: candidate.geometry, mappings: {}, behavior: candidate.behavior },
    interactionStrategy: { primaryInteraction: candidate.interaction, supportedGestures: [], detailLens },
    score: candidate.score,
    rationale: candidate.reason,
    rejectionLog: [],
    provenance: {
      generatedAt: 0,
      engine: 'MonetaHypothesisEngine',
      version: 'moneta-hypothesis-engine-v2',
      datasetFingerprint,
      requirementsHash: '',
      fitnessModelVersion: 'bootstrap-fitness-v5',
    },
  };

  return {
    primaryLayout: candidate.layout,
    primaryGeometry: candidate.geometry,
    primaryBehavior: candidate.behavior,
    primaryInteraction: candidate.interaction,
    spatialStrategy,
  };
}

export interface DecisionProvenance {
  generatedAt: number;
  engine: string;
  version: string;
  datasetFingerprint: string;
  requirementsHash?: string;
  fitnessModelVersion?: string;
  /** Exact immutable learned model artifact used for this decision, when applicable. */
  fitnessModelArtifactHash?: string | null;
  perceptualModelVersion?: string;
  perceptualDeviceClass?: string;
  /** RF-023: count of perceptual evidence items dropped for stale/cross-dataset/version/key mismatch. */
  stalePerceptualEvidenceDropped?: number;
  /** RF-024: frozen study-treatment id whose default ranking weights produced this decision. */
  fitnessTreatmentId?: string;
  /** Signed certificate considered by the scientific-admission gate, when authentically verified. */
  stabilityCertificateDigest?: string;
  /** RFC 0006 tranche is deliberately verified but non-promotable. */
  stabilityAdmissionDisposition?: 'VERIFIED_NON_PROMOTABLE';
  /** FM1: exact committed context identity framing this decision. */
  contextIdentity?: string;
  /** FM1: exact canonical intent identity framing this decision. */
  intentIdentity?: string;
  /** FM1: exact canonical perspective identity framing this decision. */
  perspectiveIdentity?: string;
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
  /** Exact immutable learned model artifact used for this decision, when applicable. */
  fitnessModelArtifactHash?: string | null;
  perceptualModelVersion?: string;
  weightSensitivity?: WeightSensitivityResult;

  /** @deprecated Uncalibrated utility must not be described as confidence. */
  confidenceScore?: number;

  // Compatibility aliases retained while downstream call sites migrate.
  /** Chosen family, or the highest-ranked near-miss family when decisionStatus is ABSTAIN. */
  representationFamily: RepresentationFamily;
  /** @deprecated Use utilityScore + decisionStatus. */
  confidence?: number;
  /** Promoted embodiment, or an inspectable non-active preview when decisionStatus is ABSTAIN. */
  embodiment: DecisionEmbodiment;
  evidence: DecisionEvidenceItem[];
  rejectedAlternatives: RejectedAlternative[];
  /** FM2: Promoted inspectable alternative candidates for Road Not Taken comparison and branching. */
  alternatives?: AlternativeCandidate[];
  provenance: DecisionProvenance;
  datasetSignature: DatasetSignature;
  scalePolicy?: Record<string, unknown>;
  progressiveDisclosurePolicy?: Record<string, unknown>;
}
