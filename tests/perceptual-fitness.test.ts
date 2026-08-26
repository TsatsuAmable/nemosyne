import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
  type PerceptualFitnessEvidence,
  validatePerceptualFitnessEvidence,
} from '../src/moneta/evidence/PerceptualFitnessEvidence.ts';
import {
  PerceptualFitnessSampler,
  type PerceptualSamplingTarget,
} from '../src/vr/perception/PerceptualFitnessSampler.ts';
import {
  BootstrapFitnessModel,
  DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
  validateBootstrapFitnessWeights,
  DEFAULT_FITNESS_TREATMENT_MANIFEST,
  FITNESS_TREATMENT_ID,
} from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import { createDefaultRequirements, minimalDatasetSignature } from '../src/moneta/index.ts';

function createMockSignature() {
  return minimalDatasetSignature(100, 3, 1, 0, 'mock-fp-12345', 0);
}

describe('P1-D: 3D-Native Perceptual Fitness Contracts', () => {
  it('D1: contract versioning and envelope validation', () => {
    const validEvidence: PerceptualFitnessEvidence = {
      version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
      candidateId: 'SCATTER_VOLUME',
      datasetFingerprint: 'mock-fp',
      source: 'prior',
      measured: null,
      priors: { occlusionResistance: 0.8, cognitiveLoad: 0.3 },
    };

    expect(validatePerceptualFitnessEvidence(validEvidence)).toBe(validEvidence);

    // Invalid version throws
    expect(() =>
      validatePerceptualFitnessEvidence({
        ...validEvidence,
        version: 'invalid-v9' as any,
      })
    ).toThrow(/Unsupported perceptual fitness evidence version/);

    // Measured without measured payload throws
    expect(() =>
      validatePerceptualFitnessEvidence({
        ...validEvidence,
        source: 'measured',
        measured: null,
      })
    ).toThrow(/must contain measured payload/);
  });

  it('D2: dormancy activation — priors influence ranking when source is prior', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    const engine = new MonetaHypothesisEngine();

    const decision = engine.arbitrate(signature, requirements);
    expect(decision).toBeDefined();

    // Check evidence item for perceptual fitness
    const perceptualEvidence = decision.evidence.find((e) =>
      e.fact.startsWith('Perceptual fitness:')
    );
    expect(perceptualEvidence).toBeDefined();
    expect(perceptualEvidence?.source).toBe('prior');
    expect(perceptualEvidence?.weight).toBe(engine.fitnessModel.weights.perceptualFitness);
  });

  it('D3: measured beats prior, labelled in DecisionEvidenceItem', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    const sampler = new PerceptualFitnessSampler();

    const candidate = MONETA_REPRESENTATION_CANDIDATES.POINT_SET;
    const target: PerceptualSamplingTarget = {
      candidate,
      datasetFingerprint: signature.provenance.datasetFingerprint,
      markPositions: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.5, 0.5, 0.5),
        new THREE.Vector3(1, 1, 1),
      ],
      deviceClass: 'quest-3s',
    };

    const anchor = {
      position: new THREE.Vector3(0, 0, 2),
      gazeDirection: new THREE.Vector3(0, 0, -1),
    };

    const measuredEvidence = sampler.sample(target, anchor);
    expect(measuredEvidence.source).toBe('measured');
    expect(measuredEvidence.measured?.deviceClass).toBe('quest-3s');

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(
      signature,
      requirements,
      undefined,
      undefined,
      measuredEvidence
    );

    const pointSetScore = decision.rankedCandidates?.find(
      (c) => c.candidateId === 'POINT_SET'
    );
    const perceptualComp = pointSetScore?.components.find(
      (comp) => comp.component === 'perceptualFitness'
    );
    expect(perceptualComp).toBeDefined();
    expect(perceptualComp?.reason).toMatch(/Measured perceptual fitness across 9-pose/);
  });

  it('D4: hard-before-preference — frustumExclusionFraction exceeding maxFrustumExclusionTolerance disqualifies candidate', () => {
    const signature = createMockSignature();
    const requirements = {
      ...createDefaultRequirements('explore'),
      maxFrustumExclusionTolerance: 0.1, // very strict tolerance (10% max excluded)
    };

    const candidate = MONETA_REPRESENTATION_CANDIDATES.POINT_SET;
    const highExclusionEvidence: PerceptualFitnessEvidence = {
      version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
      candidateId: candidate.id,
      datasetFingerprint: signature.provenance.datasetFingerprint,
      source: 'measured',
      measured: {
        projectedOverlapFraction: 0.5,
        frustumExclusionFraction: 0.8, // 80% excluded > 10% allowed
        medianProjectedGlyphSizePx: 24,
        labelCrowdingIndex: 0.2,
        depthOrderAmbiguityFraction: 0.3,
        spatialExtentMeters: 2.0,
        requiredViewpointTravelMeters: 0.5,
        viewpointEnvelope: [
          { position: [0, 0, 2], gazeDirection: [0, 0, -1], poseHash: 'p1' },
          { position: [0.3, 0, 2], gazeDirection: [0, 0, -1], poseHash: 'p2' },
        ],
        deviceClass: 'desktop',
        metricFidelity: {
          projectedOverlapFraction: { class: 'estimated', method: 'pairwise projected overlap' },
          frustumExclusionFraction: { class: 'surrogate', method: 'frustum/depth-range exclusion; NOT occlusion' },
          medianProjectedGlyphSizePx: { class: 'estimated', method: 'projected glyph size' },
          labelCrowdingIndex: { class: 'surrogate', method: 'label count per extent' },
          depthOrderAmbiguityFraction: { class: 'estimated', method: 'depth-tie pairs' },
        },
      },
      priors: { occlusionResistance: 0.8, cognitiveLoad: 0.3 },
    };

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(
      signature,
      requirements,
      undefined,
      undefined,
      highExclusionEvidence
    );

    const scatterScore = decision.rankedCandidates?.find(
      (c) => c.candidateId === 'POINT_SET'
    );
    expect(scatterScore?.disqualified).toBe(true);
    expect(scatterScore?.disqualificationReason).toMatch(/exceeds maximum frustum exclusion tolerance/);
  });

  it('D5: envelope stability and multi-pose requirement', () => {
    const sampler = new PerceptualFitnessSampler();
    const anchor = {
      position: new THREE.Vector3(0, 0, 2),
      gazeDirection: new THREE.Vector3(0, 0, -1),
    };
    const envelope = sampler.generateViewpointEnvelope(anchor);
    expect(envelope.length).toBe(9); // 1 center + 8 offsets
  });

  it('D6: weight integrity — BootstrapFitnessWeights sums to 1', () => {
    const validated = validateBootstrapFitnessWeights(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS);
    const sum = Object.values(validated).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    expect(validated.perceptualFitness).toBeGreaterThan(0);
  });

  it('D7: provenance persistence — perceptualModelVersion is recorded', () => {
    const signature = createMockSignature();
    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(signature);

    expect(decision.provenance.perceptualModelVersion).toBe('perceptual-fitness-v1');
    expect(decision.perceptualModelVersion).toBe('perceptual-fitness-v1');
  });

  it('D8: no-confidence-labelling — fitness model outputs utility score, not probability', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    const candidate = MONETA_REPRESENTATION_CANDIDATES.POINT_SET;
    const model = new BootstrapFitnessModel();

    const evaluation = model.evaluate(signature, requirements, candidate, 'POINT');
    expect(evaluation.utilityScore).toBeGreaterThanOrEqual(0);
    expect(evaluation.utilityScore).toBeLessThanOrEqual(1);

    const comp = evaluation.components.find((c) => c.dimension === 'perceptualFitness');
    expect(comp).toBeDefined();
    expect(comp?.rationale).not.toMatch(/confidence/i);
  });

  it('D9: zero-mark embodiments cannot receive ideal measured evidence', () => {
    const sampler = new PerceptualFitnessSampler();
    const candidate = MONETA_REPRESENTATION_CANDIDATES.POINT_SET;
    expect(() =>
      sampler.sample(
        {
          candidate,
          datasetFingerprint: 'mock-fp',
          markPositions: [],
        },
        {
          position: new THREE.Vector3(0, 0, 2),
          gazeDirection: new THREE.Vector3(0, 0, -1),
        }
      )
    ).toThrow(/zero marks/);
  });

  it('D10: bounded perceptual sampling is invariant to mark input order', () => {
    const sampler = new PerceptualFitnessSampler();
    const candidate = MONETA_REPRESENTATION_CANDIDATES.POINT_SET;
    const marks = Array.from({ length: 150 }, (_, i) =>
      new THREE.Vector3(
        ((i * 37) % 31) * 0.03 - 0.45,
        ((i * 17) % 23) * 0.025 - 0.25,
        -1 - (i % 19) * 0.04
      )
    );
    const anchor = {
      position: new THREE.Vector3(0, 0, 2),
      gazeDirection: new THREE.Vector3(0.25, 0.05, -1).normalize(),
    };

    const forward = sampler.sample(
      { candidate, datasetFingerprint: 'mock-fp', markPositions: marks },
      anchor
    );
    const reversed = sampler.sample(
      { candidate, datasetFingerprint: 'mock-fp', markPositions: marks.slice().reverse() },
      anchor
    );

    expect(reversed.measured).toEqual(forward.measured);
  });
});

function makeMeasuredEvidence(
  candidateId: string,
  datasetFingerprint: string,
  frustumExclusionFraction = 0.05
): PerceptualFitnessEvidence {
  return {
    version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
    candidateId,
    datasetFingerprint,
    source: 'measured',
    measured: {
      projectedOverlapFraction: 0.2,
      frustumExclusionFraction,
      medianProjectedGlyphSizePx: 24,
      labelCrowdingIndex: 0.2,
      depthOrderAmbiguityFraction: 0.3,
      spatialExtentMeters: 1.5,
      requiredViewpointTravelMeters: 0.1,
      viewpointEnvelope: [
        { position: [0, 0, 2], gazeDirection: [0, 0, -1], poseHash: 'p1' },
        { position: [0.3, 0, 2], gazeDirection: [0, 0, -1], poseHash: 'p2' },
      ],
      deviceClass: 'desktop',
      metricFidelity: {
        projectedOverlapFraction: { class: 'estimated', method: 'pairwise projected overlap' },
        frustumExclusionFraction: { class: 'surrogate', method: 'frustum/depth-range exclusion; NOT occlusion' },
        medianProjectedGlyphSizePx: { class: 'estimated', method: 'projected glyph size' },
        labelCrowdingIndex: { class: 'surrogate', method: 'label count per extent' },
        depthOrderAmbiguityFraction: { class: 'estimated', method: 'depth-tie pairs' },
      },
    },
    priors: { occlusionResistance: 0.8, cognitiveLoad: 0.3 },
  };
}

describe('RF-023: perceptual evidence identity binding', () => {
  it('rejects measured evidence whose datasetFingerprint disagrees with the current signature', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    const stale = makeMeasuredEvidence('POINT_SET', 'a-different-dataset-fp');

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(signature, requirements, undefined, undefined, stale);

    // Stale evidence must NOT hard-disqualify POINT_SET (would have if frustumExclusionFraction
    // exceeded tolerance). It is dropped and the engine falls back to the prior.
    expect(decision.provenance.stalePerceptualEvidenceDropped).toBe(1);
    const pointSet = decision.rankedCandidates?.find((c) => c.candidateId === 'POINT_SET');
    // Stale evidence must NOT hard-disqualify the candidate (falls back to prior).
    expect(pointSet?.disqualified).toBeFalsy();
  });

  it('rejects evidence keyed under a candidate id that disagrees with its own candidateId', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    // Evidence claims POINT_SET but is handed to the engine keyed as SCATTER_VOLUME
    // via a Record keyed by the wrong id.
    const miskeyed: Record<string, PerceptualFitnessEvidence> = {
      SCATTER_VOLUME: makeMeasuredEvidence('POINT_SET', signature.provenance.datasetFingerprint),
    };

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(
      signature,
      requirements,
      undefined,
      undefined,
      miskeyed
    );

    expect(decision.provenance.stalePerceptualEvidenceDropped).toBe(1);
  });

  it('rejects evidence with an unsupported version', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    const badVersion = makeMeasuredEvidence('POINT_SET', signature.provenance.datasetFingerprint);
    (badVersion as unknown as { version: string }).version = 'perceptual-fitness-v9';

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(signature, requirements, undefined, undefined, badVersion);

    expect(decision.provenance.stalePerceptualEvidenceDropped).toBe(1);
  });

  it('consumes fresh, identity-bound measured evidence (sanity: no spurious drop)', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    const fresh = makeMeasuredEvidence('POINT_SET', signature.provenance.datasetFingerprint);

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(signature, requirements, undefined, undefined, fresh);

    expect(decision.provenance.stalePerceptualEvidenceDropped).toBe(0);
    const perceptualComp = pointSetScoreComponent(decision, 'POINT_SET');
    expect(perceptualComp?.reason).toMatch(/Measured perceptual fitness across 2-pose/);
  });

  it('drops multiple stale items and counts them all', () => {
    const signature = createMockSignature();
    const requirements = createDefaultRequirements('explore');
    const stale: Record<string, PerceptualFitnessEvidence> = {
      POINT_SET: makeMeasuredEvidence('POINT_SET', 'stale-fp-1'),
      SCATTER_VOLUME: makeMeasuredEvidence('SCATTER_VOLUME', 'stale-fp-2'),
    };

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(signature, requirements, undefined, undefined, stale);

    expect(decision.provenance.stalePerceptualEvidenceDropped).toBe(2);
  });
});

function pointSetScoreComponent(decision: { rankedCandidates?: any[] }, candidateId: string) {
  const candidate = decision.rankedCandidates?.find((c) => c.candidateId === candidateId);
  return candidate?.components.find((comp: any) => comp.component === 'perceptualFitness');
}

describe('RF-024: surrogate honesty and study-treatment governance', () => {
  it('sampler labels frustumExclusionFraction and labelCrowdingIndex as surrogates', () => {
    const sampler = new PerceptualFitnessSampler();
    const candidate = MONETA_REPRESENTATION_CANDIDATES.POINT_SET;
    const evidence = sampler.sample(
      {
        candidate,
        datasetFingerprint: 'mock-fp',
        markPositions: [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.5, 0.5, 0.5),
          new THREE.Vector3(1, 1, 1),
        ],
      },
      { position: new THREE.Vector3(0, 0, 2), gazeDirection: new THREE.Vector3(0, 0, -1) }
    );

    expect(evidence.measured?.metricFidelity.frustumExclusionFraction.class).toBe('surrogate');
    expect(evidence.measured?.metricFidelity.labelCrowdingIndex.class).toBe('surrogate');
    // The surrogate method string must honestly disclaim being occlusion.
    expect(evidence.measured?.metricFidelity.frustumExclusionFraction.method).toMatch(/NOT occlusion/);
  });

  it('validator rejects frustumExclusionFraction labelled as a direct measurement', () => {
    const bad = makeMeasuredEvidence('POINT_SET', 'mock-fp');
    (bad.measured!.metricFidelity.frustumExclusionFraction as any) = {
      class: 'measured',
      method: 'occlusion',
    };
    expect(() => validatePerceptualFitnessEvidence(bad)).toThrow(/surrogate/);
  });

  it('validator rejects labelCrowdingIndex labelled as estimated screen-space overlap', () => {
    const bad = makeMeasuredEvidence('POINT_SET', 'mock-fp');
    (bad.measured!.metricFidelity.labelCrowdingIndex as any) = {
      class: 'estimated',
      method: 'screen-space label overlap',
    };
    expect(() => validatePerceptualFitnessEvidence(bad)).toThrow(/surrogate/);
  });

  it('records the frozen fitness treatment id in decision provenance', () => {
    const signature = createMockSignature();
    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(signature);
    expect(decision.provenance.fitnessTreatmentId).toBe(FITNESS_TREATMENT_ID);
  });

  it('pins default weights to the frozen treatment manifest', () => {
    expect(DEFAULT_FITNESS_TREATMENT_MANIFEST.treatmentId).toBe(FITNESS_TREATMENT_ID);
    expect(DEFAULT_FITNESS_TREATMENT_MANIFEST.weights).toEqual(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS);
    // The manifest must explicitly call out the study-treatment governance rule.
    expect(DEFAULT_FITNESS_TREATMENT_MANIFEST.rationale).toMatch(/study-treatment/i);
  });
});
