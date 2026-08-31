import { describe, expect, it } from 'vitest';
import {
  markDatasetSignatureFact,
  minimalDatasetSignature,
} from '../src/moneta/representation/DatasetSignature.ts';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
  FITNESS_TREATMENT_ID,
} from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import {
  createDefaultRequirements,
  validateRepresentationRequirements,
  type RepresentationRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';

function sourcePartitionRequirements(): RepresentationRequirements {
  const requirements = createDefaultRequirements('cluster-comparison', 'MEDIUM');
  requirements.primaryDimensions = ['x', 'y'];
  requirements.clusterAuthority = { kind: 'SOURCE_PARTITION', field: 'group' };
  return requirements;
}

function clusterSignature() {
  const signature = minimalDatasetSignature(5_000, 3, 1, 0, 'r2d-c1-cluster', 0);
  signature.clusterStructure.hasClusters = true;
  signature.clusterStructure.densityVariation = 0.8;
  if (!signature.epistemic) throw new Error('minimal signature must carry epistemic metadata');
  markDatasetSignatureFact(signature.epistemic, 'clusterStructure.hasClusters', 'measured');
  markDatasetSignatureFact(signature.epistemic, 'clusterStructure.densityVariation', 'measured');
  return signature;
}

describe('P1-R2D C1 source-partition cluster authority', () => {
  it('retains the reviewed cluster contract under the current V5 treatment', () => {
    expect(BOOTSTRAP_FITNESS_MODEL_VERSION).toBe('bootstrap-fitness-v5');
    expect(FITNESS_TREATMENT_ID).toBe('fitness-treatment-v5');
  });

  it('narrows CLUSTER_REGIONS to a source-partition summary without density or outlier-boundary claims', () => {
    const candidate = MONETA_REPRESENTATION_CANDIDATES.CLUSTER_REGIONS;
    expect(candidate.name).toBe('Source Partition Regions');
    expect(candidate.supports).toEqual(['cluster-partition', 'aggregate-metrics']);
    expect(candidate.preserves).toEqual(['cluster-separation', 'aggregate-group-magnitude']);
    expect(candidate.loses).toEqual([
      'individual-observation-identity',
      'exact-metric-values',
      'population-density-distribution',
      'empirical-bivariate-bin-mass',
      'empirical-distribution-shape',
      'outlier-boundary-visibility',
    ]);
    expect(candidate.description).toMatch(/source-authoritative partition/i);
    expect(candidate.constraints[0]?.description).toMatch(/explicit source-authoritative partition/i);
    expect(candidate.constraints[0]?.description).not.toMatch(/multi-modal density/i);
  });

  it('validates one explicit partition field plus exactly 2 or 3 distinct coordinate fields', () => {
    expect(() => validateRepresentationRequirements(sourcePartitionRequirements())).not.toThrow();

    const oneAxis = sourcePartitionRequirements();
    oneAxis.primaryDimensions = ['x'];
    expect(() => validateRepresentationRequirements(oneAxis)).toThrow(/exactly 2 or 3 primaryDimensions/);

    const fourAxes = sourcePartitionRequirements();
    fourAxes.primaryDimensions = ['x', 'y', 'z', 'w'];
    expect(() => validateRepresentationRequirements(fourAxes)).toThrow(/exactly 2 or 3 primaryDimensions/);

    const duplicateAxis = sourcePartitionRequirements();
    duplicateAxis.primaryDimensions = ['x', 'x'];
    expect(() => validateRepresentationRequirements(duplicateAxis)).toThrow(/coordinate fields must be distinct/);

    const partitionAsAxis = sourcePartitionRequirements();
    partitionAsAxis.primaryDimensions = ['group', 'x'];
    expect(() => validateRepresentationRequirements(partitionAsAxis)).toThrow(/partition field must be distinct/);

    const paddedPartition = sourcePartitionRequirements();
    paddedPartition.clusterAuthority = { kind: 'SOURCE_PARTITION', field: ' group ' };
    expect(() => validateRepresentationRequirements(paddedPartition)).toThrow(/must not contain surrounding whitespace/);
  });

  it('disqualifies CLUSTER_REGIONS when cluster-like evidence exists but no source partition is declared', () => {
    const requirements = createDefaultRequirements('cluster-comparison', 'MEDIUM');
    requirements.primaryDimensions = ['x', 'y'];

    const decision = MonetaHypothesisEngine.arbitrate(clusterSignature(), requirements);
    const clusterCandidates = (decision.rankedCandidates ?? []).filter(
      (candidate) => candidate.candidateId === 'CLUSTER_REGIONS'
    );

    expect(clusterCandidates.length).toBeGreaterThan(0);
    expect(clusterCandidates.every((candidate) => candidate.disqualified)).toBe(true);
    expect(
      clusterCandidates.every(
        (candidate) => candidate.disqualificationCode === 'cluster-authority-required'
      )
    ).toBe(true);
    expect(decision.chosenCandidateId).not.toBe('CLUSTER_REGIONS');
  });

  it('does not let multimodal-density evidence substitute for partition authority', () => {
    const signature = clusterSignature();
    signature.clusterStructure.hasClusters = false;
    markDatasetSignatureFact(signature.epistemic!, 'clusterStructure.hasClusters', 'measured');

    const requirements = createDefaultRequirements('cluster-comparison', 'MEDIUM');
    requirements.primaryDimensions = ['x', 'y', 'z'];
    const decision = MonetaHypothesisEngine.arbitrate(signature, requirements);

    const clusterCandidates = (decision.rankedCandidates ?? []).filter(
      (candidate) => candidate.candidateId === 'CLUSTER_REGIONS'
    );
    expect(clusterCandidates.every((candidate) => candidate.disqualified)).toBe(true);
    expect(decision.chosenCandidateId).not.toBe('CLUSTER_REGIONS');
  });

  it('admits the cluster candidate only when explicit authority and coordinate dimensionality are present', () => {
    const decision = MonetaHypothesisEngine.arbitrate(
      clusterSignature(),
      sourcePartitionRequirements()
    );
    const clusterCandidates = (decision.rankedCandidates ?? []).filter(
      (candidate) => candidate.candidateId === 'CLUSTER_REGIONS'
    );

    expect(clusterCandidates.length).toBeGreaterThan(0);
    expect(clusterCandidates.some((candidate) => !candidate.disqualified)).toBe(true);
    expect(
      clusterCandidates.some((candidate) => candidate.disqualificationCode === 'cluster-authority-required')
    ).toBe(false);
    expect(decision.provenance.fitnessTreatmentId).toBe('fitness-treatment-v5');
    expect(decision.provenance.version).toBe('2.1.0-v5-bootstrap');
  });

  it('fails the cluster candidate closed when the dataset signature cannot support the declaration', () => {
    const requirements = sourcePartitionRequirements();

    const noCategorical = minimalDatasetSignature(5_000, 3, 0, 0, 'r2d-no-partition-column', 0);
    const decisionWithoutPartitionCapacity = MonetaHypothesisEngine.arbitrate(
      noCategorical,
      requirements
    );
    expect(
      (decisionWithoutPartitionCapacity.rankedCandidates ?? [])
        .filter((candidate) => candidate.candidateId === 'CLUSTER_REGIONS')
        .every(
          (candidate) =>
            candidate.disqualified &&
            candidate.disqualificationCode === 'cluster-authority-required'
        )
    ).toBe(true);

    const tooFewNumeric = minimalDatasetSignature(5_000, 1, 1, 0, 'r2d-too-few-coordinates', 0);
    const decisionWithoutCoordinateCapacity = MonetaHypothesisEngine.arbitrate(
      tooFewNumeric,
      requirements
    );
    expect(
      (decisionWithoutCoordinateCapacity.rankedCandidates ?? [])
        .filter((candidate) => candidate.candidateId === 'CLUSTER_REGIONS')
        .every(
          (candidate) =>
            candidate.disqualified &&
            candidate.disqualificationCode === 'cluster-authority-required'
        )
    ).toBe(true);
  });
});
