import type { DatasetSignature } from './DatasetSignature.ts';
import type {
  RepresentationCandidate,
  StructureCapability,
} from './RepresentationCandidate.ts';
import type {
  RepresentationRequirements,
  StructureRequirementType,
} from './RepresentationRequirements.ts';
import {
  isCandidateAssignedToReasoningFamily,
  type RepresentationFamily,
} from './RepresentationFamily.ts';
import type { PerceptualFitnessEvidence } from '../evidence/PerceptualFitnessEvidence.ts';

/**
 * V4 Gate 3 bootstrap model.
 *
 * These weights are engineering priors, not empirical probabilities. The model
 * is deliberately explicit and versioned so later learned models can replace it
 * without changing the Moneta search contract.
 */
export interface BootstrapFitnessWeights {
  structure: number;
  task: number;
  scale: number;
  informationPreservation: number;
  densityHandling: number;
  configuredPrior: number;
  perceptualFitness: number;
}

/**
 * V4 preserves the R6B canonical-family treatment and frozen numeric weights,
 * while making source-partition cluster authority explicit and narrowing
 * CLUSTER_REGIONS to the information its bounded partition summary can actually
 * preserve. This is rank-effective because information/capability scoring changes.
 */
export const BOOTSTRAP_FITNESS_MODEL_VERSION = 'bootstrap-fitness-v4';

/**
 * Frozen study-treatment identity for the default ranking treatment.
 *
 * The default bootstrap weights are engineering priors, not empirical
 * probabilities. Any rank-effective change to weights, requirement coverage,
 * family membership, or information semantics is a study-treatment change and
 * MUST mint a new `treatmentId` plus pass study/treatment review before
 * promotion. The treatment id is recorded in decision provenance so a later
 * analyst can tell which treatment produced a decision.
 */
export const FITNESS_TREATMENT_ID = 'fitness-treatment-v4';

export interface FitnessTreatmentManifest {
  readonly treatmentId: string;
  readonly weights: BootstrapFitnessWeights;
  readonly rationale: string;
}

export const DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS: BootstrapFitnessWeights = {
  structure: 0.30,
  task: 0.25,
  scale: 0.15,
  informationPreservation: 0.15,
  densityHandling: 0.05,
  configuredPrior: 0.05,
  perceptualFitness: 0.05,
};

export const DEFAULT_FITNESS_TREATMENT_MANIFEST: FitnessTreatmentManifest = {
  treatmentId: FITNESS_TREATMENT_ID,
  weights: DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
  rationale:
    'Study-treatment V4 preserves the frozen bootstrap weights and R6B canonical-family rules while requiring explicit source-partition authority for CLUSTER_REGIONS and narrowing its information contract to partition distinction plus group magnitude. Observation identity, exact values, distribution shape, density semantics, and formal outlier boundaries are no longer credited to the bounded cluster summary.',
};

export interface FitnessComponent {
  dimension: keyof BootstrapFitnessWeights;
  weight: number;
  rawScore: number;
  weightedScore: number;
  rationale: string;
}

export interface FitnessEvaluation {
  modelVersion: string;
  utilityScore: number;
  components: FitnessComponent[];
}

const REQUIREMENT_CAPABILITIES: Record<StructureRequirementType, StructureCapability[]> = {
  distribution: ['univariate-distribution'],
  'cluster-separation': ['cluster-partition', 'continuous-density'],
  density: ['binned-empirical-mass', 'continuous-density'],
  'temporal-order': ['temporal-sequence'],
  periodicity: ['periodic-spectrum'],
  manifold: ['multivariate-correlation', 'continuous-density'],
  hierarchy: ['tree-hierarchy'],
  connectivity: ['relational-topology'],
  'anomaly-visibility': ['anomaly-isolation'],
  'observation-identity': ['discrete-observations'],
  'group-comparison': ['aggregate-metrics', 'cluster-partition'],
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function validateBootstrapFitnessWeights(
  weights: BootstrapFitnessWeights
): BootstrapFitnessWeights {
  const entries = Object.entries(weights);
  for (const [name, value] of entries) {
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(`Fitness weight ${name} must be a finite non-negative number`);
    }
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-9) {
    throw new RangeError(`Active fitness weights must sum to 1 (received ${total})`);
  }
  return { ...weights };
}

export class BootstrapFitnessModel {
  readonly version = BOOTSTRAP_FITNESS_MODEL_VERSION;
  readonly weights: BootstrapFitnessWeights;

  constructor(weights: Partial<BootstrapFitnessWeights> = {}) {
    this.weights = validateBootstrapFitnessWeights({
      ...DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
      ...weights,
    });
  }

  evaluate(
    signature: DatasetSignature,
    requirements: RepresentationRequirements,
    candidate: RepresentationCandidate,
    family: RepresentationFamily,
    perceptualEvidence?: PerceptualFitnessEvidence
  ): FitnessEvaluation {
    if (!isCandidateAssignedToReasoningFamily(candidate.id, family)) {
      throw new RangeError(
        `Candidate ${candidate.id} is not assigned to reasoning family ${family}`
      );
    }

    const perceptual = this.scorePerceptual(candidate, perceptualEvidence);

    const components: FitnessComponent[] = [
      this.component(
        'structure',
        this.scoreStructure(signature, requirements, candidate, family),
        'Alignment with authoritative dataset structure, candidate capability and canonical reasoning family'
      ),
      this.component(
        'task',
        this.scoreTask(requirements, candidate),
        'Coverage of every declared structure requirement'
      ),
      this.component(
        'scale',
        this.scoreScale(signature.cardinality.rowCount, candidate),
        'Dataset cardinality relative to the candidate scale envelope'
      ),
      this.component(
        'informationPreservation',
        this.scoreInformationPreservation(requirements, candidate),
        'Preservation of explicitly requested information'
      ),
      this.component(
        'densityHandling',
        this.scoreDensityHandling(signature, requirements, candidate),
        'Ability to expose density-relevant structure without conflating empirical bin mass with continuous population density'
      ),
      this.component(
        'configuredPrior',
        signature.preferredFamilies?.includes(family) ? 1 : 0.5,
        'Configured canonical-family preference prior; not an empirical probability'
      ),
      this.component(
        'perceptualFitness',
        perceptual.score,
        perceptual.rationale
      ),
    ];

    const utilityScore = clamp01(
      components.reduce((sum, component) => sum + component.weightedScore, 0)
    );

    return { modelVersion: this.version, utilityScore, components };
  }

  private scorePerceptual(
    candidate: RepresentationCandidate,
    evidence?: PerceptualFitnessEvidence
  ): { score: number; rationale: string } {
    if (evidence?.source === 'measured' && evidence.measured) {
      const m = evidence.measured;
      const score = clamp01(
        (1 - m.projectedOverlapFraction) * 0.3 +
        (1 - m.frustumExclusionFraction) * 0.3 +
        (1 - m.depthOrderAmbiguityFraction) * 0.2 +
        clamp01(m.medianProjectedGlyphSizePx / 32) * 0.2
      );
      return {
        score,
        rationale: `Measured perceptual fitness across ${m.viewpointEnvelope.length}-pose viewpoint envelope (${m.deviceClass})`,
      };
    }

    const { occlusionResistance, cognitiveLoad } = candidate.interactionCharacteristics;
    const score = clamp01(occlusionResistance * 0.6 + (1 - cognitiveLoad) * 0.4);
    return {
      score,
      rationale: 'Engineering prior based on candidate occlusion resistance and cognitive load',
    };
  }

  private component(
    dimension: keyof BootstrapFitnessWeights,
    rawScore: number,
    rationale: string
  ): FitnessComponent {
    const score = clamp01(rawScore);
    const weight = this.weights[dimension];
    return {
      dimension,
      weight,
      rawScore: score,
      weightedScore: score * weight,
      rationale,
    };
  }

  private scoreStructure(
    signature: DatasetSignature,
    requirements: RepresentationRequirements,
    candidate: RepresentationCandidate,
    family: RepresentationFamily
  ): number {
    const top = signature.topologicalStructure.topology;
    const epistemic = signature.epistemic;
    const hasAuthoritativeClusterEvidence =
      epistemic?.facts['clusterStructure.hasClusters']?.source === 'measured' ||
      epistemic?.facts['clusterStructure.hasClusters']?.source === 'derived';
    const hasAuthoritativeHighVariance =
      epistemic?.facts['distribution.highVariance']?.source === 'measured' ||
      epistemic?.facts['distribution.highVariance']?.source === 'derived';
    const hasAuthoritativeHierarchyDepth =
      epistemic?.facts['cardinality.depth']?.source === 'measured' ||
      epistemic?.facts['cardinality.depth']?.source === 'derived';

    const knownHierarchyDepth =
      hasAuthoritativeHierarchyDepth &&
      typeof signature.cardinality.depth === 'number' &&
      signature.cardinality.depth > 1;
    let score = 0.4;

    if (
      family === 'GRAPH' &&
      candidate.supports.includes('relational-topology') &&
      (top === 'GRAPH' || signature.cardinality.edgeCount > 0)
    ) score = 1;
    else if (
      family === 'HIERARCHICAL' &&
      candidate.supports.includes('tree-hierarchy') &&
      (top === 'HIERARCHY' || knownHierarchyDepth)
    ) score = 1;
    else if (
      family === 'TEMPORAL' &&
      candidate.supports.includes('temporal-sequence') &&
      (top === 'TIME_SERIES' || signature.temporalStructure.isTimeSeries === true)
    ) score = 1;
    else if (
      family === 'FREQUENCY' &&
      candidate.supports.includes('periodic-spectrum') &&
      signature.spectralStructure?.hasPeriodicity === true
    ) score = 1;
    else if (
      family === 'FIELD' &&
      candidate.supports.includes('spatial-coordinates') &&
      (top === 'VECTOR_FIELD' || top === 'GEO')
    ) score = 1;
    else if (
      family === 'CLUSTER' &&
      candidate.supports.includes('cluster-partition') &&
      hasAuthoritativeClusterEvidence &&
      signature.clusterStructure.hasClusters === true
    ) score = 0.95;
    else if (
      family === 'DISTRIBUTION' &&
      candidate.supports.includes('univariate-distribution') &&
      (signature.distribution.hasOutliers === true ||
        (hasAuthoritativeHighVariance && signature.distribution.highVariance === true))
    ) score = 0.9;

    const requiredCoverage = requirements.requiredStructures.length === 0
      ? 1
      : requirements.requiredStructures.reduce((sum, requirement) => {
          const capabilities = REQUIREMENT_CAPABILITIES[requirement.type];
          const covered = capabilities.some((capability) => candidate.supports.includes(capability));
          return sum + (covered ? requirement.importance : 0);
        }, 0) /
        Math.max(
          Number.EPSILON,
          requirements.requiredStructures.reduce((sum, requirement) => sum + requirement.importance, 0)
        );

    return 0.7 * score + 0.3 * requiredCoverage;
  }

  private scoreTask(
    requirements: RepresentationRequirements,
    candidate: RepresentationCandidate
  ): number {
    if (requirements.requiredStructures.length === 0) return 1;

    const weightedTotal = requirements.requiredStructures.reduce(
      (sum, requirement) => sum + requirement.importance,
      0
    );
    if (weightedTotal === 0) return 1;

    const covered = requirements.requiredStructures.reduce((sum, requirement) => {
      const capabilities = REQUIREMENT_CAPABILITIES[requirement.type];
      const supports = capabilities.some((capability) => candidate.supports.includes(capability));
      return sum + (supports ? requirement.importance : 0);
    }, 0);

    return covered / weightedTotal;
  }

  private scoreScale(rowCount: number, candidate: RepresentationCandidate): number {
    const { minN, maxN, optimalN, scalabilityRating } = candidate.scaleCharacteristics;
    if (rowCount < minN || rowCount > maxN) return 0;
    if (rowCount >= optimalN[0] && rowCount <= optimalN[1]) return 1;
    return clamp01(scalabilityRating);
  }

  private scoreInformationPreservation(
    requirements: RepresentationRequirements,
    candidate: RepresentationCandidate
  ): number {
    if (requirements.preservationGoals.length === 0) return 1;

    const priorityWeight = { CRITICAL: 1, DESIRED: 0.6, OPTIONAL: 0.25 } as const;
    let total = 0;
    let preserved = 0;

    for (const goal of requirements.preservationGoals) {
      const weight = priorityWeight[goal.priority];
      total += weight;
      if (candidate.preserves.includes(goal.information)) preserved += weight;
      else if (!candidate.loses.includes(goal.information)) preserved += weight * 0.5;
    }

    return total === 0 ? 1 : preserved / total;
  }

  private scoreDensityHandling(
    signature: DatasetSignature,
    requirements: RepresentationRequirements,
    candidate: RepresentationCandidate
  ): number {
    const densityRequirement = requirements.requiredStructures.find((r) => r.type === 'density');
    const densityEvidenceSource =
      signature.epistemic?.facts['clusterStructure.densityVariation']?.source;
    const hasAuthoritativeDensityEvidence =
      densityEvidenceSource === 'measured' || densityEvidenceSource === 'derived';
    const knownDensityVariation =
      hasAuthoritativeDensityEvidence &&
      typeof signature.clusterStructure.densityVariation === 'number' &&
      signature.clusterStructure.densityVariation > 0;
    const densityRelevant = (densityRequirement?.importance ?? 0) > 0 || knownDensityVariation;

    // Cardinality is a scale fact, not density evidence. Large N by itself must
    // not silently bias Moneta toward a density-capable candidate.
    if (!densityRelevant) return 1;

    const supportsContinuousDensity = candidate.supports.includes('continuous-density');
    const preservesPopulationDensity = candidate.preserves.includes('population-density-distribution');
    if (supportsContinuousDensity && preservesPopulationDensity) return 1;

    const supportsBinnedMass = candidate.supports.includes('binned-empirical-mass');
    const preservesBinnedMass = candidate.preserves.includes('empirical-bivariate-bin-mass');
    if (supportsBinnedMass && preservesBinnedMass) return 1;

    if (
      supportsContinuousDensity ||
      preservesPopulationDensity ||
      supportsBinnedMass ||
      preservesBinnedMass
    ) {
      return 0.75;
    }
    if (
      candidate.loses.includes('population-density-distribution') ||
      candidate.loses.includes('empirical-bivariate-bin-mass')
    ) {
      return 0;
    }
    return 0.25;
  }
}
