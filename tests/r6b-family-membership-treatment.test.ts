import { describe, expect, it } from 'vitest';
import {
  markDatasetSignatureFact,
  minimalDatasetSignature,
} from '../src/moneta/representation/DatasetSignature.ts';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
  BootstrapFitnessModel,
  FITNESS_TREATMENT_ID,
} from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type SemanticRepresentationId,
} from '../src/moneta/representation/RepresentationCandidate.ts';
import {
  ALL_REPRESENTATION_FAMILIES,
  CANDIDATE_TO_REASONING_FAMILY,
  FAMILY_TO_CANDIDATE_IDS,
} from '../src/moneta/representation/RepresentationFamily.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';

function component(
  evaluation: ReturnType<BootstrapFitnessModel['evaluate']>,
  dimension: 'structure' | 'task' | 'configuredPrior',
): number {
  return evaluation.components.find((entry) => entry.dimension === dimension)?.rawScore ?? -1;
}

function neutralRequirements() {
  const requirements = createDefaultRequirements('explore', 'LARGE');
  requirements.requiredStructures = [];
  requirements.preservationGoals = [];
  return requirements;
}

describe('P1-R6B rank-effective family membership treatment', () => {
  it('mints a new fitness model and treatment identity', () => {
    expect(BOOTSTRAP_FITNESS_MODEL_VERSION).toBe('bootstrap-fitness-v3');
    expect(FITNESS_TREATMENT_ID).toBe('fitness-treatment-v3');
  });

  it('assigns every semantic candidate to exactly one canonical reasoning family', () => {
    const memberships = new Map<SemanticRepresentationId, string[]>();
    for (const family of ALL_REPRESENTATION_FAMILIES) {
      for (const candidateId of FAMILY_TO_CANDIDATE_IDS[family]) {
        const families = memberships.get(candidateId) ?? [];
        families.push(family);
        memberships.set(candidateId, families);
      }
    }

    const candidateIds = Object.keys(MONETA_REPRESENTATION_CANDIDATES) as SemanticRepresentationId[];
    expect(memberships.size).toBe(candidateIds.length);
    for (const candidateId of candidateIds) {
      expect(memberships.get(candidateId)).toEqual([CANDIDATE_TO_REASONING_FAMILY[candidateId]]);
    }

    expect(FAMILY_TO_CANDIDATE_IDS.CLUSTER).not.toContain('DENSITY_FIELD');
    expect(FAMILY_TO_CANDIDATE_IDS.TOPOLOGY).not.toContain('RELATIONSHIP_GRAPH');
    expect(FAMILY_TO_CANDIDATE_IDS.FREQUENCY).not.toContain('TEMPORAL_TRAJECTORY');
  });

  it('fails closed when a caller asks the fitness model to score a candidate under a non-canonical family', () => {
    const signature = minimalDatasetSignature(5_000, 3, 0, 0, 'r6b-invalid-family', 0);
    const requirements = neutralRequirements();
    const model = new BootstrapFitnessModel();

    expect(() =>
      model.evaluate(
        signature,
        requirements,
        MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
        'CLUSTER',
      )
    ).toThrow(/DENSITY_FIELD is not assigned to reasoning family CLUSTER/);

    expect(() =>
      model.evaluate(
        signature,
        requirements,
        MONETA_REPRESENTATION_CANDIDATES.RELATIONSHIP_GRAPH,
        'TOPOLOGY',
      )
    ).toThrow(/RELATIONSHIP_GRAPH is not assigned to reasoning family TOPOLOGY/);

    expect(() =>
      model.evaluate(
        signature,
        requirements,
        MONETA_REPRESENTATION_CANDIDATES.TEMPORAL_TRAJECTORY,
        'FREQUENCY',
      )
    ).toThrow(/TEMPORAL_TRAJECTORY is not assigned to reasoning family FREQUENCY/);
  });

  it('does not let cluster or univariate-distribution evidence inflate binned density structure score', () => {
    const signature = minimalDatasetSignature(5_000, 3, 0, 0, 'r6b-density-family-leak', 0);
    signature.clusterStructure.hasClusters = true;
    signature.distribution.highVariance = true;
    signature.distribution.hasOutliers = true;
    if (!signature.epistemic) throw new Error('minimal signature must carry epistemic metadata');
    markDatasetSignatureFact(signature.epistemic, 'clusterStructure.hasClusters', 'measured');
    markDatasetSignatureFact(signature.epistemic, 'distribution.highVariance', 'measured');

    const requirements = neutralRequirements();
    const model = new BootstrapFitnessModel();
    const density = model.evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
      'DISTRIBUTION',
    );
    const distribution = model.evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.DISTRIBUTION_FIELD,
      'DISTRIBUTION',
    );

    // Density has a distribution reasoning family for search organization, but
    // it does not claim the univariate-distribution capability that makes these
    // particular distribution facts relevant. It therefore stays at the neutral
    // family base (0.4) plus full empty-requirement coverage: 0.7*0.4 + 0.3 = 0.58.
    expect(component(density, 'structure')).toBeCloseTo(0.58, 12);
    expect(component(distribution, 'structure')).toBeCloseTo(0.93, 12);

    signature.preferredFamilies = ['CLUSTER'];
    const densityWithClusterPrior = model.evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
      'DISTRIBUTION',
    );
    expect(component(densityWithClusterPrior, 'configuredPrior')).toBe(0.5);
  });

  it('keeps cross-task fitness capability-driven after duplicate family aliases are removed', () => {
    const signature = minimalDatasetSignature(5_000, 3, 0, 1, 'r6b-cross-task', 0);
    const requirements = neutralRequirements();
    requirements.requiredStructures = [{ type: 'periodicity', importance: 1 }];

    const temporal = new BootstrapFitnessModel().evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.TEMPORAL_TRAJECTORY,
      'TEMPORAL',
    );
    expect(MONETA_REPRESENTATION_CANDIDATES.TEMPORAL_TRAJECTORY.supports).toContain(
      'periodic-spectrum',
    );
    expect(component(temporal, 'task')).toBe(1);
  });

  it('removes duplicate family-generated layout variants and records the new treatment in decisions', () => {
    const signature = minimalDatasetSignature(5_000, 3, 0, 0, 'r6b-search-space', 0);
    const decision = MonetaHypothesisEngine.arbitrate(signature, neutralRequirements());
    const ranked = decision.rankedCandidates ?? [];

    expect(decision.fitnessModelVersion).toBe('bootstrap-fitness-v3');
    expect(decision.provenance.fitnessModelVersion).toBe('bootstrap-fitness-v3');
    expect(decision.provenance.fitnessTreatmentId).toBe('fitness-treatment-v3');

    const density = ranked.filter((candidate) => candidate.candidateId === 'DENSITY_FIELD');
    expect(new Set(density.map((candidate) => candidate.family))).toEqual(new Set(['DISTRIBUTION']));
    expect(new Set(density.map((candidate) => candidate.layout))).toEqual(new Set(['GRID_3D']));

    const graph = ranked.filter((candidate) => candidate.candidateId === 'RELATIONSHIP_GRAPH');
    expect(new Set(graph.map((candidate) => candidate.family))).toEqual(new Set(['GRAPH']));
    expect(new Set(graph.map((candidate) => candidate.layout))).toEqual(
      new Set(['FORCE_DIRECTED_3D']),
    );

    const temporal = ranked.filter((candidate) => candidate.candidateId === 'TEMPORAL_TRAJECTORY');
    expect(new Set(temporal.map((candidate) => candidate.family))).toEqual(new Set(['TEMPORAL']));
    expect(new Set(temporal.map((candidate) => candidate.layout))).toEqual(new Set(['TIME_RIBBON']));
  });
});
