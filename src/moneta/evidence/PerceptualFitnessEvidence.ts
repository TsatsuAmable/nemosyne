export const PERCEPTUAL_FITNESS_EVIDENCE_VERSION = 'perceptual-fitness-v1';

export interface ViewpointSample {
  position: [number, number, number];
  gazeDirection: [number, number, number];
  poseHash: string;
}

export interface MeasuredPerceptualEvidence {
  projectedOverlapFraction: number;
  hiddenMarkFraction: number;
  medianProjectedGlyphSizePx: number;
  labelCrowdingIndex: number;
  depthOrderAmbiguityFraction: number;
  spatialExtentMeters: number;
  requiredViewpointTravelMeters: number;
  viewpointEnvelope: ViewpointSample[];
  deviceClass: 'desktop' | 'quest-3s' | 'other-headset';
}

export interface PerceptualPriors {
  occlusionResistance: number;
  cognitiveLoad: number;
}

export interface InteractionSignals {
  airClickMissRate: number;
  dwellHesitationRate: number;
}

export interface PerceptualFitnessEvidence {
  version: typeof PERCEPTUAL_FITNESS_EVIDENCE_VERSION;
  candidateId: string;
  datasetFingerprint: string;
  source: 'measured' | 'prior';
  measured: MeasuredPerceptualEvidence | null;
  priors: PerceptualPriors;
  interactionSignals?: InteractionSignals;
}

export function validatePerceptualFitnessEvidence(
  evidence: PerceptualFitnessEvidence
): PerceptualFitnessEvidence {
  if (evidence.version !== PERCEPTUAL_FITNESS_EVIDENCE_VERSION) {
    throw new TypeError(
      `Unsupported perceptual fitness evidence version: ${String(evidence.version)}`
    );
  }
  if (!evidence.candidateId || typeof evidence.candidateId !== 'string') {
    throw new TypeError('PerceptualFitnessEvidence candidateId must be a non-empty string');
  }
  if (evidence.source === 'measured') {
    if (!evidence.measured) {
      throw new TypeError('PerceptualFitnessEvidence with source "measured" must contain measured payload');
    }
    if (!Array.isArray(evidence.measured.viewpointEnvelope) || evidence.measured.viewpointEnvelope.length === 0) {
      throw new TypeError('PerceptualFitnessEvidence measured payload requires a valid viewpoint envelope array');
    }
  } else if (evidence.source === 'prior') {
    if (evidence.measured !== null) {
      throw new TypeError('PerceptualFitnessEvidence with source "prior" must have null measured field');
    }
  } else {
    throw new TypeError(`Invalid PerceptualFitnessEvidence source: ${String(evidence.source)}`);
  }
  return evidence;
}
