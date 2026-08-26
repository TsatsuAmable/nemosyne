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

function assertUnitInterval(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${name} must be a finite number in [0, 1]`);
  }
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite non-negative number`);
  }
}

function assertFiniteVector(name: string, values: readonly number[]): void {
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`${name} must contain exactly three finite coordinates`);
  }
}

function validateViewpointSample(sample: ViewpointSample, index: number): void {
  assertFiniteVector(`viewpointEnvelope[${index}].position`, sample.position);
  assertFiniteVector(`viewpointEnvelope[${index}].gazeDirection`, sample.gazeDirection);
  const gazeMagnitudeSq = sample.gazeDirection.reduce((sum, value) => sum + value * value, 0);
  if (gazeMagnitudeSq < 1e-8) {
    throw new TypeError(`viewpointEnvelope[${index}].gazeDirection must be non-zero`);
  }
  if (!sample.poseHash || typeof sample.poseHash !== 'string') {
    throw new TypeError(`viewpointEnvelope[${index}].poseHash must be a non-empty string`);
  }
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
  if (!evidence.datasetFingerprint || typeof evidence.datasetFingerprint !== 'string') {
    throw new TypeError('PerceptualFitnessEvidence datasetFingerprint must be a non-empty string');
  }

  assertUnitInterval('PerceptualFitnessEvidence.priors.occlusionResistance', evidence.priors.occlusionResistance);
  assertUnitInterval('PerceptualFitnessEvidence.priors.cognitiveLoad', evidence.priors.cognitiveLoad);

  if (evidence.interactionSignals) {
    assertUnitInterval(
      'PerceptualFitnessEvidence.interactionSignals.airClickMissRate',
      evidence.interactionSignals.airClickMissRate
    );
    assertUnitInterval(
      'PerceptualFitnessEvidence.interactionSignals.dwellHesitationRate',
      evidence.interactionSignals.dwellHesitationRate
    );
  }

  if (evidence.source === 'measured') {
    if (!evidence.measured) {
      throw new TypeError('PerceptualFitnessEvidence with source "measured" must contain measured payload');
    }
    if (
      !Array.isArray(evidence.measured.viewpointEnvelope) ||
      evidence.measured.viewpointEnvelope.length < 2
    ) {
      throw new TypeError(
        'PerceptualFitnessEvidence measured payload requires a multi-pose viewpoint envelope'
      );
    }

    assertUnitInterval(
      'PerceptualFitnessEvidence.measured.projectedOverlapFraction',
      evidence.measured.projectedOverlapFraction
    );
    assertUnitInterval(
      'PerceptualFitnessEvidence.measured.hiddenMarkFraction',
      evidence.measured.hiddenMarkFraction
    );
    assertUnitInterval(
      'PerceptualFitnessEvidence.measured.labelCrowdingIndex',
      evidence.measured.labelCrowdingIndex
    );
    assertUnitInterval(
      'PerceptualFitnessEvidence.measured.depthOrderAmbiguityFraction',
      evidence.measured.depthOrderAmbiguityFraction
    );
    assertNonNegative(
      'PerceptualFitnessEvidence.measured.medianProjectedGlyphSizePx',
      evidence.measured.medianProjectedGlyphSizePx
    );
    assertNonNegative(
      'PerceptualFitnessEvidence.measured.spatialExtentMeters',
      evidence.measured.spatialExtentMeters
    );
    assertNonNegative(
      'PerceptualFitnessEvidence.measured.requiredViewpointTravelMeters',
      evidence.measured.requiredViewpointTravelMeters
    );
    evidence.measured.viewpointEnvelope.forEach(validateViewpointSample);
  } else if (evidence.source === 'prior') {
    if (evidence.measured !== null) {
      throw new TypeError('PerceptualFitnessEvidence with source "prior" must have null measured field');
    }
  } else {
    throw new TypeError(`Invalid PerceptualFitnessEvidence source: ${String(evidence.source)}`);
  }
  return evidence;
}
