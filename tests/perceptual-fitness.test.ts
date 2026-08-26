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

  it('D4: hard-before-preference — hiddenMarkFraction exceeding maxOcclusionTolerance disqualifies candidate', () => {
    const signature = createMockSignature();
    const requirements = {
      ...createDefaultRequirements('explore'),
      maxOcclusionTolerance: 0.1, // very strict tolerance (10% max hidden)
    };

    const candidate = MONETA_REPRESENTATION_CANDIDATES.POINT_SET;
    const highOcclusionEvidence: PerceptualFitnessEvidence = {
      version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
      candidateId: candidate.id,
      datasetFingerprint: signature.provenance.datasetFingerprint,
      source: 'measured',
      measured: {
        projectedOverlapFraction: 0.5,
        hiddenMarkFraction: 0.8, // 80% hidden > 10% allowed
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
      },
      priors: { occlusionResistance: 0.8, cognitiveLoad: 0.3 },
    };

    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(
      signature,
      requirements,
      undefined,
      undefined,
      highOcclusionEvidence
    );

    const scatterScore = decision.rankedCandidates?.find(
      (c) => c.candidateId === 'POINT_SET'
    );
    expect(scatterScore?.disqualified).toBe(true);
    expect(scatterScore?.disqualificationReason).toMatch(/exceeds maximum occlusion tolerance/);
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
