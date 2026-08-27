import { describe, expect, it } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/StructureProfileEvidenceAdapter.ts';
import type { Facts } from '../src/data/types.ts';
import type { MonetaFacts } from '../src/moneta/types.ts';
import { datasetEvidenceToSignature } from '../src/moneta/representation/DatasetEvidenceSignature.ts';
import { BootstrapFitnessModel } from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { createMonetaStructureProfile, createMonetaKernelFixture } from './helpers/moneta-kernel-fixture.ts';

function legacyGraphFacts(): MonetaFacts {
  return {
    topology: 'GRAPH',
    rowCount: 2,
    nodeCount: 2,
    edgeCount: 1,
    depth: 0,
    numericColumns: 1,
    categoricalColumns: 0,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0.5,
    estimatedDensity: 0.5,
    outlierCount: 0,
    cardinalityOfColor: 0,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 1,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };
}

function kernelFactsWithLargeVarianceAndCategory(): Facts {
  return {
    rowCount: 3,
    columnCount: 2,
    numeric: [
      {
        name: 'value',
        count: 3,
        sum: 303,
        mean: 101,
        median: 2,
        std: 140,
        var: 19_600,
        min: 1,
        max: 300,
        skew: 1.7,
        kurtosis: 1.1,
        outlierCount: 1,
      },
    ],
    correlation: [],
    categorical: [
      {
        name: 'group',
        cardinality: 2,
        entropy: 0.6365,
        top: [
          { value: 'a', count: 2 },
          { value: 'b', count: 1 },
        ],
      },
    ],
    temporal: [],
    temporalStats: [],
  };
}

describe('RF-045 truthful DatasetSignature evidence contract', () => {
  it('keeps unsupported legacy analytical facts unknown instead of fabricating scientific-looking defaults', () => {
    const signature = buildDatasetSignature(legacyGraphFacts(), null, 'legacy-graph-fp', 'unknown');

    expect(signature.distribution.meanEntropy).toBeUndefined();
    expect(signature.dependence.rankDeficiency).toBeUndefined();
    expect(signature.clusterStructure.separationScore).toBeUndefined();
    expect(signature.clusterStructure.densityVariation).toBeUndefined();
    expect(signature.topologicalStructure.hasCycles).toBeUndefined();

    expect(signature.epistemic?.facts['distribution.meanEntropy'].source).toBe('unknown');
    expect(signature.epistemic?.facts['dependence.rankDeficiency'].source).toBe('unknown');
    expect(signature.epistemic?.facts['clusterStructure.separationScore'].source).toBe('unknown');
    expect(signature.epistemic?.facts['clusterStructure.densityVariation'].source).toBe('unknown');
    expect(signature.epistemic?.facts['topologicalStructure.hasCycles'].source).toBe('unknown');
  });

  it('does not turn categorical cardinality or an arbitrary variance threshold into cluster/high-variance evidence', () => {
    const dataset = Dataset.fromJSON({
      name: 'rf045-observed-dataset',
      columns: [
        { name: 'value', type: 'NUMERIC' },
        { name: 'group', type: 'CATEGORICAL' },
      ],
      rows: [
        { value: 1, group: 'a' },
        { value: 2, group: 'a' },
        { value: 300, group: 'b' },
      ],
    });

    const signature = buildDatasetSignature(
      dataset,
      kernelFactsWithLargeVarianceAndCategory(),
      'rf045-observed-fp',
      'kernel-test',
    );

    expect(signature.distribution.meanEntropy).toBeCloseTo(0.6365);
    expect(signature.distribution.highVariance).toBeUndefined();
    expect(signature.clusterStructure.estimatedCount).toBeUndefined();
    expect(signature.clusterStructure.hasClusters).toBeUndefined();

    expect(signature.epistemic?.facts['distribution.meanEntropy'].source).toBe('measured');
    expect(signature.epistemic?.facts['distribution.highVariance'].source).toBe('unknown');
    expect(signature.epistemic?.facts['clusterStructure.hasClusters'].source).toBe('unknown');
  });

  it('preserves source classes on canonical Rust DatasetEvidence', () => {
    const profile = createMonetaStructureProfile({
      datasetName: 'rf045-canonical',
      rowCount: 50,
      columnCount: 3,
      numericColumns: 2,
      categoricalColumns: 1,
      clusterCount: 3,
      hasClusters: true,
      separationScore: 0.81,
      densityVariation: 0.47,
    });
    profile.categorical.meanEntropy = 0.72;
    profile.graph = {
      isGraph: true,
      nodeCount: 50,
      edgeCount: 1,
      hasCycles: false,
      isConnected: false,
    };

    const signature = datasetEvidenceToSignature(structureProfileToDatasetEvidence(profile));

    expect(signature.topologicalStructure).toEqual({ topology: 'GRAPH', hasCycles: false });
    expect(signature.clusterStructure.separationScore).toBe(0.81);
    expect(signature.distribution.meanEntropy).toBe(0.72);
    expect(signature.epistemic?.facts['topologicalStructure.hasCycles'].source).toBe('derived');
    expect(signature.epistemic?.facts['topologicalStructure.hasCycles'].evidenceId).toBe('topology:graph');
    expect(signature.epistemic?.facts['clusterStructure.separationScore'].source).toBe('heuristic');
    expect(signature.epistemic?.facts['clusterStructure.separationScore'].evidenceId).toBe('cluster:global');
    expect(signature.epistemic?.facts['distribution.meanEntropy'].source).toBe('measured');
    expect(signature.epistemic?.facts['cardinality.depth'].source).toBe('unknown');
  });

  it('does not let unknown hierarchy evidence satisfy hierarchy-only hard constraints', () => {
    const signature = minimalDatasetSignature(50, 3, 0, 0, 'rf045-unknown-hierarchy', 0);
    // A zero depth sentinel is retained for compatibility, but it is explicitly
    // not evidence and therefore cannot make a hierarchy candidate feasible.
    expect(signature.cardinality.depth).toBe(0);
    expect(signature.epistemic?.facts['cardinality.depth'].source).toBe('unknown');

    const decision = new MonetaHypothesisEngine().arbitrate(
      signature,
      createDefaultRequirements('explore', 'SMALL'),
    );
    const hierarchyTrace = decision.rulesEvaluated?.find(
      (trace) => trace.ruleName === 'HIERARCHICAL_SPACE_on_RADIAL_ORBITAL',
    );

    expect(hierarchyTrace).toBeDefined();
    expect(hierarchyTrace?.passed).toBe(false);
  });

  it('does not penalize density handling merely because density evidence is unknown', () => {
    const signature = minimalDatasetSignature(100, 3, 0, 0, 'rf045-unknown-density', 0);
    expect(signature.clusterStructure.densityVariation).toBeUndefined();

    const requirements = createDefaultRequirements('individual-inspection', 'SMALL');
    requirements.requiredStructures = [];
    const evaluation = new BootstrapFitnessModel().evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
      'POINT',
    );
    const density = evaluation.components.find((component) => component.dimension === 'densityHandling');

    expect(density?.rawScore).toBe(1);
  });
});

describe('RF-045 adversarial falsification tests', () => {
  it('legacy MonetaFacts with clusterCount does NOT fabricate cluster evidence', () => {
    const mf: MonetaFacts = {
      topology: 'TABULAR',
      rowCount: 100,
      nodeCount: 100,
      edgeCount: 0,
      depth: 0,
      numericColumns: 3,
      categoricalColumns: 2,
      temporalColumns: 0,
      hasTimeSeries: false,
      hasContinuousValues: true,
      density: 0.5,
      estimatedDensity: 0.5,
      outlierCount: 0,
      cardinalityOfColor: 0,
      hasHighCardinality: false,
      isLargeDataset: false,
      clusterCount: 5, // Legacy heuristic claims 5 clusters
      columnStats: {},
      correlationMatrix: {},
      categoryDistribution: {},
      trendDirection: 'flat',
      seasonalityHint: false,
      hasOutliers: false,
      hasHighVariance: true, // Legacy heuristic claims high variance
      numericSkew: 0.5,
      topCategory: null,
    };

    const sig = buildDatasetSignature(mf, null, 'test-fp', 'unknown');

    // RF-045: cluster fields MUST NOT be fabricated from legacy envelope
    expect(sig.clusterStructure.estimatedCount).toBeUndefined();
    expect(sig.clusterStructure.hasClusters).toBeUndefined();
    expect(sig.clusterStructure.separationScore).toBeUndefined();
    expect(sig.clusterStructure.densityVariation).toBeUndefined();

    // Epistemic source must be 'unknown' for absent analytical evidence
    expect(sig.epistemic?.facts['clusterStructure.hasClusters'].source).toBe('unknown');
    expect(sig.epistemic?.facts['clusterStructure.estimatedCount'].source).toBe('unknown');
    expect(sig.epistemic?.facts['clusterStructure.separationScore'].source).toBe('unknown');
    expect(sig.epistemic?.facts['clusterStructure.densityVariation'].source).toBe('unknown');

    // highVariance from legacy envelope must NOT be promoted to analytical evidence
    expect(sig.distribution.highVariance).toBeUndefined();
    expect(sig.epistemic?.facts['distribution.highVariance'].source).toBe('unknown');
  });

  it('graph dataset without Rust cycle analysis does NOT infer hasCycles', () => {
    // When no graph profile is provided, hasCycles must remain unknown
    const profile = createMonetaStructureProfile({
      datasetName: 'graph-no-cycle-analysis',
      rowCount: 50,
      columnCount: 2,
      numericColumns: 1,
      categoricalColumns: 1,
    });
    // No graph profile provided - graph is null by default
    // This simulates a dataset where Rust didn't provide graph analysis

    const sig = datasetEvidenceToSignature(structureProfileToDatasetEvidence(profile));

    // hasCycles must be undefined when Rust didn't provide graph analysis
    expect(sig.topologicalStructure.hasCycles).toBeUndefined();
    expect(sig.epistemic?.facts['topologicalStructure.hasCycles'].source).toBe('unknown');
  });

  it('high categorical cardinality does NOT imply cluster evidence', () => {
    const dataset = Dataset.fromJSON({
      name: 'high-cardinality-categorical',
      columns: [
        { name: 'value', type: 'NUMERIC' },
        { name: 'category', type: 'CATEGORICAL' },
      ],
      rows: Array.from({ length: 100 }, (_, i) => ({
        value: i,
        category: `cat-${i % 50}`, // 50 unique categories
      })),
    });

    const sig = buildDatasetSignature(dataset, null, 'test-fp', 'unknown');

    // RF-045: high categorical cardinality must NOT imply cluster evidence
    expect(sig.clusterStructure.hasClusters).toBeUndefined();
    expect(sig.epistemic?.facts['clusterStructure.hasClusters'].source).toBe('unknown');
  });

  it('FitnessModel does NOT give favourable CLUSTER score from heuristic/unknown cluster evidence', () => {
    const sig = minimalDatasetSignature(100, 3, 0, 0, 'test-fp', 0);
    // No cluster evidence - all unknown

    const requirements = createDefaultRequirements('individual-inspection', 'SMALL');
    const model = new BootstrapFitnessModel();

    const clusterCandidate = MONETA_REPRESENTATION_CANDIDATES['CLUSTER_REGIONS'];
    const evalResult = model.evaluate(sig, requirements, clusterCandidate, 'CLUSTER');

    // Without authoritative cluster evidence, CLUSTER family should NOT get favourable structure score
    const structureComponent = evalResult.components.find((c) => c.dimension === 'structure');
    // Should be at baseline (0.4) not favourable (0.95)
    expect(structureComponent?.rawScore).toBeLessThan(0.8);
  });

  it('FitnessModel does NOT give favourable DISTRIBUTION score from absent highVariance', () => {
    const sig = minimalDatasetSignature(100, 3, 0, 0, 'test-fp', 0);
    // No highVariance evidence

    const requirements = createDefaultRequirements('individual-inspection', 'SMALL');
    const model = new BootstrapFitnessModel();

    const distCandidate = MONETA_REPRESENTATION_CANDIDATES['DISTRIBUTION_FIELD'];
    const evalResult = model.evaluate(sig, requirements, distCandidate, 'DISTRIBUTION');

    // Without authoritative highVariance evidence, DISTRIBUTION should NOT get favourable score
    const structureComponent = evalResult.components.find((c) => c.dimension === 'structure');
    expect(structureComponent?.rawScore).toBeLessThan(0.8);
  });

  it('hierarchy sentinel depth=0 does NOT satisfy hierarchy hard constraint', () => {
    const sig = minimalDatasetSignature(50, 3, 0, 0, 'rf045-unknown-hierarchy', 0);
    expect(sig.cardinality.depth).toBe(0);
    expect(sig.epistemic?.facts['cardinality.depth'].source).toBe('unknown');

    const decision = new MonetaHypothesisEngine().arbitrate(
      sig,
      createDefaultRequirements('explore', 'SMALL'),
    );
    const hierarchyTrace = decision.rulesEvaluated?.find(
      (trace) => trace.ruleName === 'HIERARCHICAL_SPACE_on_RADIAL_ORBITAL',
    );

    expect(hierarchyTrace).toBeDefined();
    expect(hierarchyTrace?.passed).toBe(false);
  });

  it('kernel/model versions sourced from runtime, not literals', () => {
    const profile = createMonetaStructureProfile({
      datasetName: 'version-test',
      rowCount: 10,
      columnCount: 2,
      numericColumns: 1,
      categoricalColumns: 1,
    });
    const atlas = new AtlasCore({ kernel: createMonetaKernelFixture(profile) });
    const dataset = Dataset.fromJSON({
      name: 'version-test',
      columns: [
        { name: 'val', type: 'numeric' },
        { name: 'cat', type: 'categorical' },
      ],
      rows: [{ val: 1, cat: 'a' }, { val: 2, cat: 'b' }],
    });
    atlas.loadDataset(dataset);

    const sig = atlas.computeDatasetSignature();

    // kernelVersion must come from actual runtime, not 'unknown' literal
    expect(sig.provenance.kernelVersion).not.toBe('unknown');
    expect(sig.provenance.kernelVersion.length).toBeGreaterThan(0);
  });
});
