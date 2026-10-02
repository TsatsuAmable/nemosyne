import { describe, expect, it } from 'vitest';
import {
  BootstrapFitnessModel,
  DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
} from '../src/moneta/representation/FitnessModel.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type RepresentationCandidate,
  type SemanticRepresentationId,
} from '../src/moneta/representation/RepresentationCandidate.ts';
import {
  createDefaultRequirements,
  type RepresentationRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';
import { CANDIDATE_TO_REASONING_FAMILY } from '../src/moneta/representation/RepresentationFamily.ts';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/StructureProfileEvidenceAdapter.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { datasetEvidenceToSignature } from '../src/moneta/representation/DatasetEvidenceSignature.ts';
import {
  markDatasetSignatureFact,
  minimalDatasetSignature,
} from '../src/moneta/representation/DatasetSignature.ts';
import {
  PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
  type MeasuredPerceptualEvidence,
  type PerceptualFitnessEvidence,
} from '../src/moneta/evidence/PerceptualFitnessEvidence.ts';
import { PerceptualFitnessSampler } from '../src/vr/perception/PerceptualFitnessSampler.ts';
import { MonetaHypothesisEngine } from '../src/moneta/index.ts';
import * as THREE from 'three';

// TEC3-MA2 fourth slice: control fixtures for the F-5 densityHandling ladder
// and the F-7 perceptualFitness family (MA1
// docs/audits/TEC3_METRIC_ADMISSIBILITY_INVENTORY_2026-10-02.md section 1 and
// its section 4 densityVariation note). Deterministic synthetic fixtures
// through the production classes only; no production threshold, weight or
// ladder value is changed. Every pinned number below was observed by running
// these fixtures and then pinned as measured truth; none is inferred from
// ladder/blend arithmetic in the source. Constants that are exported (the
// 0.05 weights) are asserted against the imported production constants; the
// ladder rungs, the blend weights and the 32 px glyph normalization are
// module-private literals and are pinned behaviourally (P-5 precedent: the
// non-export is itself the finding).

const FP = 'sha256:test:ma2-f5f7-controls';
const MODEL = new BootstrapFitnessModel();

const CANDIDATE_IDS = Object.keys(MONETA_REPRESENTATION_CANDIDATES) as SemanticRepresentationId[];

/** Requirements with no density requirement: the ladder's decision input is
 * then the `clusterStructure.densityVariation` fact alone. */
function noDensityRequirements(): RepresentationRequirements {
  return {
    task: 'explore',
    primaryDimensions: ['x', 'y'],
    requiredStructures: [],
    preservationGoals: [],
    acceptableLoss: {
      allowIdentityLoss: true,
      allowExactMetricLoss: true,
      allowClusterLoss: true,
      maxFrustumExclusionTolerance: 0.3,
    },
    scale: 'MEDIUM',
    hardwareConstraints: {},
    maxFrustumExclusionTolerance: 0.3,
    interactionBudget: 'MEDIUM',
  };
}

// -------------------------------------------------------------------------
// F-5 fixtures — canonical intake through the exact producer path
// -------------------------------------------------------------------------

const F5_PROFILE = createMonetaStructureProfile({
  datasetName: 'ma2-f5f7-density-fixture',
  rowCount: 200,
  columnCount: 3,
  numericColumns: 3,
  categoricalColumns: 0,
});
const F5_CANONICAL = datasetEvidenceToSignature(structureProfileToDatasetEvidence(F5_PROFILE));
const F5_FLIPPED = structuredClone(F5_CANONICAL);
F5_FLIPPED.clusterStructure.densityVariation = 0.42;
markDatasetSignatureFact(F5_FLIPPED.epistemic!, 'clusterStructure.densityVariation', 'measured');

function densityRawScores(signature: ReturnType<typeof datasetEvidenceToSignature>): Record<string, number> {
  const scores: Record<string, number> = {};
  const reqs = noDensityRequirements();
  for (const id of CANDIDATE_IDS) {
    scores[id] = MODEL.evaluate(
      signature,
      reqs,
      MONETA_REPRESENTATION_CANDIDATES[id],
      CANDIDATE_TO_REASONING_FAMILY[id],
      undefined,
    ).components.find((component) => component.dimension === 'densityHandling')!.rawScore;
  }
  return scores;
}

// -------------------------------------------------------------------------
// F-7 fixtures — hand-built measured payloads and sampler scenes
// -------------------------------------------------------------------------

function measuredEvidence(overrides: Partial<MeasuredPerceptualEvidence>): PerceptualFitnessEvidence {
  const measured: MeasuredPerceptualEvidence = {
    projectedOverlapFraction: 0,
    frustumExclusionFraction: 0,
    medianProjectedGlyphSizePx: 32,
    labelCrowdingIndex: 0.5,
    depthOrderAmbiguityFraction: 0,
    spatialExtentMeters: 1,
    requiredViewpointTravelMeters: 0,
    viewpointEnvelope: [
      { position: [0, 0, 0], gazeDirection: [0, 0, -1], poseHash: 'pose-0' },
      { position: [0.1, 0, 0], gazeDirection: [0, 0, -1], poseHash: 'pose-1' },
    ],
    deviceClass: 'desktop',
    ...overrides,
    metricFidelity: {
      projectedOverlapFraction: { class: 'estimated', method: 'control fixture payload' },
      frustumExclusionFraction: { class: 'surrogate', method: 'control fixture payload' },
      medianProjectedGlyphSizePx: { class: 'estimated', method: 'control fixture payload' },
      labelCrowdingIndex: { class: 'surrogate', method: 'control fixture payload' },
      depthOrderAmbiguityFraction: { class: 'estimated', method: 'control fixture payload' },
    },
  };
  return {
    version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
    candidateId: 'POINT_SET',
    datasetFingerprint: FP,
    source: 'measured',
    measured,
    priors: { occlusionResistance: 0.3, cognitiveLoad: 0.6 },
  };
}

function perceptualRaw(evidence?: PerceptualFitnessEvidence, candidateId: SemanticRepresentationId = 'POINT_SET'): number {
  return MODEL.evaluate(
    minimalDatasetSignature(200, 2, 0, 0, FP, 0),
    noDensityRequirements(),
    MONETA_REPRESENTATION_CANDIDATES[candidateId],
    CANDIDATE_TO_REASONING_FAMILY[candidateId],
    evidence,
  ).components.find((component) => component.dimension === 'perceptualFitness')!.rawScore;
}

// The production sampler is constructible from plain mark geometry and an
// anchor pose — no renderer is needed. Observed while authoring, and re-pinned
// below: the measured blend route and the hard-constraint gate therefore ARE
// exercised at the TS layer by these fixtures.
const ANCHOR = { position: new THREE.Vector3(0, 0, 0), gazeDirection: new THREE.Vector3(0, 0, -1) };
const SAMPLER = new PerceptualFitnessSampler();

function sampleScene(marks: Array<[number, number, number]>, candidateId: SemanticRepresentationId = 'POINT_SET') {
  return SAMPLER.sample(
    {
      candidate: MONETA_REPRESENTATION_CANDIDATES[candidateId],
      datasetFingerprint: FP,
      markPositions: marks.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    },
    ANCHOR
  );
}

// Ten marks: one inside the front frustum at the anchor pose, nine behind it,
// so ~0.9 of the marks are excluded per pose of the 9-pose envelope.
const TEN_MARKS_ONE_VISIBLE: Array<[number, number, number]> = [
  [0, 0, -1],
  [1, 0, 1], [0.1, 0, 1], [0.2, 0, 1], [0.3, 0, 1], [0.4, 0, 1],
  [0.5, 0, 1], [0.6, 0, 1], [0.7, 0, 1], [0.8, 0, 1],
];
// Ten separated marks on one front plane: none excluded.
const TEN_MARKS_ALL_VISIBLE: Array<[number, number, number]> =
  [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((x) => [x, 0, -1] as [number, number, number]);

// -------------------------------------------------------------------------
// F-5 — densityHandling ladder and the never-produced densityVariation gate
// -------------------------------------------------------------------------

describe('TEC3-MA2 F-5 density-ladder controls (MA1 F-5, F-12; MA1 section 4)', () => {
  it('the densityHandling weight is the exported production constant', () => {
    expect(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS.densityHandling).toBe(0.05);
  });

  it('canonical intake never sets the densityVariation decision input', () => {
    const signature = datasetEvidenceToSignature(structureProfileToDatasetEvidence(F5_PROFILE));
    expect(signature.clusterStructure.densityVariation).toBeUndefined();
    expect(signature.epistemic?.facts['clusterStructure.densityVariation']?.source).toBe('unknown');
  });

  it('the absent-fact default rung is the top rung (1) for every production candidate', () => {
    // No density requirement in the fixture, so the density-relevant decision
    // rides on the densityVariation fact alone; canonical intake leaves it
    // unset, and the un-gated default returns the maximum component value.
    const canonical = densityRawScores(F5_CANONICAL);
    for (const id of CANDIDATE_IDS) {
      expect(canonical[id], id).toBe(1);
    }
  });

  it('the flipped fact opens the hand-set ladder: rungs 0, 0.25 and 1 over the production registry', () => {
    // The fixture sets the fact by the only non-canonical means the component
    // reads: a direct signature value plus a measured/derived source (slice 1's
    // markDatasetSignatureFact gate-flip style). All three density-capable
    // candidates (DENSITY_FIELD, MANIFOLD_EMBEDDING, MULTISCALE_FIELD) share
    // the top rung; candidates that declare a density loss hit 0; candidates
    // that neither support, preserve nor lose a density capability hit 0.25.
    // The 0.75 rung is hit by NO production candidate — recorded below.
    const flipped = densityRawScores(F5_FLIPPED);
    expect(flipped.POINT_SET).toBe(0);
    expect(flipped.DISTRIBUTION_FIELD).toBe(0);
    expect(flipped.CLUSTER_REGIONS).toBe(0);
    expect(flipped.AGGREGATE_VOLUME).toBe(0.25);
    expect(flipped.TEMPORAL_TRAJECTORY).toBe(0.25);
    expect(flipped.HIERARCHICAL_SPACE).toBe(0.25);
    expect(flipped.RELATIONSHIP_GRAPH).toBe(0.25);
    expect(flipped.MATRIX_FIELD).toBe(0.25);
    expect(flipped.SPATIAL_REGION).toBe(0.25);
    expect(flipped.DENSITY_FIELD).toBe(1);
    expect(flipped.MANIFOLD_EMBEDDING).toBe(1);
    expect(flipped.MULTISCALE_FIELD).toBe(1);
    expect(Object.values(flipped)).not.toContain(0.75);
  });

  it('flipping the gate never separates the density-capable candidate: D = 0 on DENSITY_FIELD, D = 1 on POINT_SET', () => {
    // Canonical (fact absent -> default 1) versus flipped (fact present ->
    // candidate-metadata ladder). The component can only penalize: the
    // density-appropriate candidate it exists to reward already sits at its
    // top rung with the fact absent, and still shares that rung with all
    // density-capable siblings once the gate opens.
    const canonical = densityRawScores(F5_CANONICAL);
    const flipped = densityRawScores(F5_FLIPPED);
    expect(canonical.DENSITY_FIELD).toBe(flipped.DENSITY_FIELD);
    expect((flipped.DENSITY_FIELD - canonical.DENSITY_FIELD) / 1).toBe(0);
    expect((canonical.POINT_SET - flipped.POINT_SET) / 1).toBe(1);
  });

  it('the 0.75 rung is reachable only off the production candidate registry (synthetic capability shapes)', () => {
    // Each partial-capability shape the 0.75 branch is written for, observed:
    // 0.75 exactly, for support-without-preservation and
    // preservation-without-support, on both continuous-density and
    // binned-mass capabilities. None of the 12 production candidates has
    // exactly one of the four ladder conditions, so this rung is dead on the
    // candidate registry and only reachable with a synthetic candidate shape.
    const partialShapes: RepresentationCandidate[] = [
      { ...MONETA_REPRESENTATION_CANDIDATES.POINT_SET, supports: ['continuous-density'], preserves: [], loses: [] },
      { ...MONETA_REPRESENTATION_CANDIDATES.POINT_SET, supports: [], preserves: ['population-density-distribution'], loses: [] },
      { ...MONETA_REPRESENTATION_CANDIDATES.POINT_SET, supports: ['binned-empirical-mass'], preserves: [], loses: [] },
    ];
    for (const shape of partialShapes) {
      const raw = MODEL.evaluate(F5_FLIPPED, noDensityRequirements(), shape, 'POINT')
        .components.find((component) => component.dimension === 'densityHandling')!
        .rawScore;
      expect(raw).toBe(0.75);
    }
  });

  it('the fact gate refuses heuristic-labelled or zero values: the ladder stays on the default rung', () => {
    // Source gate first (measured|derived only), then the > 0 value gate. A
    // value with a heuristic label — how a legacy producer would carry it —
    // and a zero-variation measured value both leave every candidate at the
    // absent-fact default.
    const heuristic = structuredClone(F5_CANONICAL);
    heuristic.clusterStructure.densityVariation = 0.42;
    markDatasetSignatureFact(heuristic.epistemic!, 'clusterStructure.densityVariation', 'heuristic');
    expect(densityRawScores(heuristic).POINT_SET).toBe(1);

    const zero = structuredClone(F5_CANONICAL);
    zero.clusterStructure.densityVariation = 0;
    markDatasetSignatureFact(zero.epistemic!, 'clusterStructure.densityVariation', 'measured');
    expect(densityRawScores(zero).POINT_SET).toBe(1);
  });

  it('authored density requirements produce the identical ladder without the fact', () => {
    // The other density-relevant trigger is a declared requirement. The
    // requirement-driven ladder (canonical signature, fact still absent) is
    // identical to the flipped-fact ladder — so once the component is
    // relevant at all, its value is a pure function of candidate metadata.
    const reqs: RepresentationRequirements = {
      ...noDensityRequirements(),
      primaryDimensions: undefined,
      requiredStructures: [{ type: 'density', importance: 0.8 }],
    };
    const scores: Record<string, number> = {};
    for (const id of CANDIDATE_IDS) {
      scores[id] = MODEL.evaluate(
        F5_CANONICAL,
        reqs,
        MONETA_REPRESENTATION_CANDIDATES[id],
        CANDIDATE_TO_REASONING_FAMILY[id],
        undefined,
      ).components.find((component) => component.dimension === 'densityHandling')!.rawScore;
    }
    expect(scores).toEqual(densityRawScores(F5_FLIPPED));
  });

  it('through engine.arbitrate the canonical intake rung never advances; flipping the fact does', () => {
    const requirements = noDensityRequirements();
    const canonicalDecision = new MonetaHypothesisEngine().arbitrate(F5_CANONICAL, requirements);
    const canonical = densityRawScores(F5_CANONICAL);
    const flippedDecision = new MonetaHypothesisEngine().arbitrate(F5_FLIPPED, requirements);

    const readLadder = (decision: RepresentationDecision) => {
      const ladder: Record<string, number> = {};
      for (const entry of decision.rankedCandidates ?? []) {
        const component = entry.components.find((item) => item.component === 'densityHandling');
        if (component) ladder[entry.candidateId] = component.rawScore;
      }
      return ladder;
    };
    // Every feasible candidate's live component equals the corresponding
    // direct-model value, and the canonical engine run stays on the top rung.
    const canonicalLive = readLadder(canonicalDecision);
    const flippedLive = readLadder(flippedDecision);
    for (const [id, raw] of Object.entries(canonicalLive)) {
      expect(raw, id).toBe(canonical[id]);
      expect(raw).toBe(1);
    }
    expect(canonicalLive.DENSITY_FIELD).toBe(1);
    expect(canonicalLive.POINT_SET).toBe(1);
    // The only change between the two arbitrations is the densityVariation
    // fact plus its label: the non-capable candidates drop to the ladder.
    expect(flippedLive.DENSITY_FIELD).toBe(1);
    expect(flippedLive.POINT_SET).toBe(0);
    expect(flippedLive.MATRIX_FIELD).toBe(0.25);
  });
});

// -------------------------------------------------------------------------
// F-7 — perceptualFitness: hard-constraint route, both blends, surrogates
// -------------------------------------------------------------------------

describe('TEC3-MA2 F-7 perceptual-fitness controls (MA1 F-7)', () => {
  it('the perceptualFitness weight is the exported production constant', () => {
    expect(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS.perceptualFitness).toBe(0.05);
    const weighted = MODEL.evaluate(
      minimalDatasetSignature(200, 2, 0, 0, FP, 0),
      noDensityRequirements(),
      MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
      'POINT',
      measuredEvidence({}),
    ).components.find((component) => component.dimension === 'perceptualFitness')!;
    expect(weighted.weight).toBe(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS.perceptualFitness);
    expect(weighted.rawScore).toBe(1);
    expect(weighted.weightedScore).toBeCloseTo(weighted.rawScore * DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS.perceptualFitness, 15);
  });

  it('the prior blend is a fixed function of authored candidate metadata alone', () => {
    // No perceptual evidence supplied: the prior branch pins to
    // occlusionResistance/cognitiveLoad authored on the candidate. Observed
    // values: POINT_SET 0.3/0.6 -> 0.34; DENSITY_FIELD 0.85/0.4 -> 0.75;
    // MATRIX_FIELD 0.5/0.4 -> 0.54; RELATIONSHIP_GRAPH 0.45/0.7 -> 0.39.
    expect(perceptualRaw(undefined)).toBe(0.34);
    expect(perceptualRaw(undefined, 'DENSITY_FIELD')).toBe(0.75);
    expect(perceptualRaw(undefined, 'MATRIX_FIELD')).toBe(0.54);
    expect(perceptualRaw(undefined, 'RELATIONSHIP_GRAPH')).toBe(0.39);

    // Prior-route diagnostics, both observed: (a) an explicitly prior-source
    // evidence item does not arm the frustum-exclusion constraint (that gate
    // requires the measured payload); (b) the prior blend never reads the
    // evidence item's own `priors` payload — it re-reads the candidate's
    // authored characteristics, so a wildly different supplied prior changes
    // nothing.
    const priorRoute: PerceptualFitnessEvidence = {
      version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
      candidateId: 'POINT_SET',
      datasetFingerprint: FP,
      source: 'prior',
      measured: null,
      priors: { occlusionResistance: 0, cognitiveLoad: 1 },
    };
    expect(perceptualRaw(priorRoute)).toBe(0.34);
  });

  it('the measured blend weights: one observed delta per input, hand-build payload pairs', () => {
    // Base payload is the reference point: zero overlap/exclusion/ambiguity,
    // glyph 32 (the normalization pivot), labelCrowding 0. -> rawScore 1.
    expect(perceptualRaw(measuredEvidence({}))).toBe(1);
    // The four blend inputs move the score by exactly their hand-set share
    // (0.3 / 0.3 / 0.2 / 0.2) when driven 0 -> 1; these literals are
    // module-private (non-export recorded as the finding; P-5 precedent).
    expect(perceptualRaw(measuredEvidence({ frustumExclusionFraction: 1 }))).toBe(0.7);
    expect(perceptualRaw(measuredEvidence({ projectedOverlapFraction: 1 }))).toBe(0.7);
    expect(perceptualRaw(measuredEvidence({ depthOrderAmbiguityFraction: 1 }))).toBe(0.8);
    // The surrogate `labelCrowdingIndex` is required, validated — and NOT read
    // by the blend: 0.5 -> 1 leaves the score bit-identical.
    const withLabel = perceptualRaw(measuredEvidence({ labelCrowdingIndex: 1 }));
    expect(withLabel).toBe(perceptualRaw(measuredEvidence({ labelCrowdingIndex: 0 })));
    expect(withLabel).toBe(1);
  });

  it('the glyph-size term normalizes at the hand-picked 32 px and clamps there', () => {
    // Below 32 px the term is linear (16 px -> half credit, observed rawScore
    // 0.9); at or above 32 px it saturates: 64 px is not worth more than
    // 32 px, both observed at the maximum rawScore 1.
    expect(perceptualRaw(measuredEvidence({ medianProjectedGlyphSizePx: 16 }))).toBe(0.9);
    expect(perceptualRaw(measuredEvidence({ medianProjectedGlyphSizePx: 32 }))).toBe(1);
    expect(perceptualRaw(measuredEvidence({ medianProjectedGlyphSizePx: 64 }))).toBe(1);
  });

  it('the production sampler is renderer-free: measured evidence is constructible from synthetic geometry', () => {
    // Reachability finding, observed: PerceptualFitnessSampler computes from
    // plain THREE mark geometry and an anchor pose only — no rendering pass is
    // involved — so TS-layer fixtures DO exercise the measured blend, not only
    // the prior one. A single in-frustum mark at 0.625 m median depth measures
    // essentially the 32 px pivot; the same mark at twice the distance
    // measures essentially 16 px. The pixel values are the observed sampler
    // medians over its own 9-pose envelope (envelope offsets shift the median
    // off the exact pivot), not the analytic 32/16.
    const near = sampleScene([[0, 0, -0.625]]);
    expect(near.source).toBe('measured');
    expect(near.measured!.medianProjectedGlyphSizePx).toBeCloseTo(33.00021815331016, 12);
    expect(near.measured!.frustumExclusionFraction).toBe(0);
    const far = sampleScene([[0, 0, -1.25]]);
    expect(far.measured!.medianProjectedGlyphSizePx).toBeCloseTo(16.40685104441762, 12);
    expect(far.measured!.frustumExclusionFraction).toBe(0);

    // The same content at the two distances: the blend moves by exactly the
    // glyph share's near-halving (1.0 -> observed 0.9025428190276101). The
    // hand-picked 32 px is the entire difference between the two scenes.
    expect(perceptualRaw(near)).toBe(1);
    expect(perceptualRaw(far)).toBeCloseTo(0.9025428190276101, 15);
    expect(perceptualRaw(far) - perceptualRaw(near)).toBeCloseTo(-0.0974571809723899, 15);

    // The sampler declares its surrogates honestly (RF-024), and the model
    // consumes them as ordinary blend inputs anyway: the frustum-exclusion
    // surrogate carries its own share of rawScore.
    expect(near.measured!.metricFidelity.frustumExclusionFraction).toEqual({
      class: 'surrogate',
      method: 'fraction of marks outside the view frustum / depth range across the viewpoint envelope; NOT occlusion',
    });
    expect(near.measured!.metricFidelity.labelCrowdingIndex).toEqual({
      class: 'surrogate',
      method: 'label count per spatial extent; NOT screen-space label overlap',
    });
    expect(near.measured!.metricFidelity.projectedOverlapFraction.class).toBe('estimated');
  });

  it('the frustum-exclusion surrogate carries 0.3 of rawScore; labelCrowding is declared and never read', () => {
    // A high-surrogate scene (nine of ten marks excluded per pose) measured by
    // the production sampler: frustumExclusionFraction 0.9000000000000001 (the
    // accumulating double), rawScore 0.6583137462246742 through the model.
    const mostlyBehind = sampleScene(TEN_MARKS_ONE_VISIBLE);
    expect(mostlyBehind.measured!.frustumExclusionFraction).toBe(0.9000000000000001);
    expect(perceptualRaw(mostlyBehind)).toBeCloseTo(0.6583137462246742, 15);
    // The clean twin: same shape, no exclusion, and the observed blend delta
    // is the surrogate share of the score (raw +0.3 of it against the same
    // geometry's overlap/ambiguity conditions).
    const allFront = sampleScene(TEN_MARKS_ALL_VISIBLE);
    expect(allFront.measured!.frustumExclusionFraction).toBe(0);
    expect(allFront.measured!.projectedOverlapFraction).toBe(0);
    expect(allFront.measured!.depthOrderAmbiguityFraction).toBe(0.4666666666666667);
    expect(allFront.measured!.medianProjectedGlyphSizePx).toBeCloseTo(20.739321697695633, 12);
    expect(perceptualRaw(allFront)).toBeCloseTo(0.8362874272772644, 15);

    // Positive/low surrogate separation on the blend's own scale, with the
    // surrogate-labelled input isolated to the hand-built payloads (the
    // observed double carries an accumulation residue 1 - 0.7):
    expect(
      perceptualRaw(measuredEvidence({})) - perceptualRaw(measuredEvidence({ frustumExclusionFraction: 1 }))
    ).toBe(0.30000000000000004);
    // And the metric truly measures its declared inputs on the sampler side
    // too: labelCrowdingIndex only exists when label positions are supplied,
    // never otherwise, and the blend ignores it either way.
    const withLabels = SAMPLER.sample(
      {
        candidate: MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
        datasetFingerprint: FP,
        markPositions: [new THREE.Vector3(0, 0, -1)],
        labels: [new THREE.Vector3(0, 0.1, -1), new THREE.Vector3(0.2, 0, -1)],
      },
      ANCHOR
    );
    expect(withLabels.source).toBe('measured');
    expect(withLabels.measured!.metricFidelity.labelCrowdingIndex.class).toBe('surrogate');
  });

  it('the hard-constraint route is reachable through arbitrate and refuses a high-exclusion candidate', () => {
    // The frustum-exclusion hard constraint requires (a) a tolerance in the
    // requirements and (b) MEASURED evidence bound to the current dataset and
    // candidate. Both a passing and a refusing case through the production
    // engine, with sampler-produced evidence.
    const requirements = createDefaultRequirements('explore');
    expect(requirements.maxFrustumExclusionTolerance).toBe(0.3);

    const refuse = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(200, 2, 0, 0, FP, 0),
      requirements,
      undefined,
      undefined,
      { POINT_SET: sampleScene(TEN_MARKS_ONE_VISIBLE) },
    );
    const refused = (refuse.rankedCandidates ?? []).find((entry) => entry.candidateId === 'POINT_SET')!;
    expect(refused.disqualified).toBe(true);
    expect(refused.disqualificationCode).toBe('frustum-exclusion');
    expect(refused.score).toBe(0);
    expect(refused.components).toHaveLength(0);
    expect(refused.disqualificationReason).toBe(
      'Candidate frustum exclusion fraction 0.90 exceeds maximum frustum exclusion tolerance 0.30'
    );
    // The refusal is per-candidate: the arbitration still completes.
    expect(refuse.chosenCandidateId).toBeDefined();

    const pass = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(200, 2, 0, 0, FP, 0),
      requirements,
      undefined,
      undefined,
      { POINT_SET: sampleScene(TEN_MARKS_ALL_VISIBLE) },
    );
    const passed = (pass.rankedCandidates ?? []).find((entry) => entry.candidateId === 'POINT_SET')!;
    expect(passed.disqualified).toBeUndefined();
    const component = passed.components.find((item) => item.component === 'perceptualFitness')!;
    expect(component.rawScore).toBeCloseTo(0.8362874272772644, 15);
    expect(component.weightedScore).toBeCloseTo(0.04181437136386322, 15);
    expect(component.reason).toBe('Measured perceptual fitness across 9-pose viewpoint envelope (desktop)');
  });

  it('stale/mismatched measured evidence is dropped fail-closed to the prior blend, not consumed', () => {
    const requirements = createDefaultRequirements('explore');
    const stale = sampleScene(TEN_MARKS_ALL_VISIBLE);
    (stale as { datasetFingerprint: string }).datasetFingerprint = 'other-fp';
    const decision = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(200, 2, 0, 0, FP, 0),
      requirements,
      undefined,
      undefined,
      { POINT_SET: stale },
    );
    expect(decision.provenance.stalePerceptualEvidenceDropped).toBe(1);
    const point = (decision.rankedCandidates ?? []).find((entry) => entry.candidateId === 'POINT_SET')!;
    expect(point.disqualified).toBeUndefined();
    const component = point.components.find((item) => item.component === 'perceptualFitness')!;
    expect(component.rawScore).toBe(0.34);
    expect(component.reason).toBe('Engineering prior based on candidate occlusion resistance and cognitive load');
  });

  it('the measured blend is exercised live alongside the prior blend for candidates without evidence', () => {
    // One arbitration, two blend routes at once: POINT_SET carries sampler
    // measured evidence; DENSITY_FIELD (feasible in the same fixture) falls
    // back to the prior blend on its authored metadata.
    const requirements = noDensityRequirements();
    const decision = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(200, 4, 0, 0, FP, 0),
      requirements,
      undefined,
      undefined,
      { POINT_SET: sampleScene(TEN_MARKS_ALL_VISIBLE) },
    );
    expect(decision.provenance.stalePerceptualEvidenceDropped).toBe(0);
    const measured = (decision.rankedCandidates ?? []).find((entry) => entry.candidateId === 'POINT_SET')!
      .components.find((item) => item.component === 'perceptualFitness')!;
    expect(measured.reason.startsWith('Measured perceptual fitness across 9-pose')).toBe(true);
    const prior = (decision.rankedCandidates ?? []).find((entry) => entry.candidateId === 'DENSITY_FIELD')!;
    // DENSITY_FIELD with no evidence: the prior blend value observed through
    // the same arbitration that carries a measured sibling.
    expect(
      prior.components.find((item) => item.component === 'perceptualFitness')!.rawScore
    ).toBe(0.75);
  });
});