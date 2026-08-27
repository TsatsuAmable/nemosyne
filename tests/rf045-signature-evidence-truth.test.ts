import { describe, expect, it } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import type { Facts } from '../src/data/types.ts';
import type { MonetaFacts } from '../src/moneta/types.ts';
import { BootstrapFitnessModel } from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import {
  minimalDatasetSignature,
} from '../src/moneta/representation/DatasetSignature.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';

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

  it('does not let unknown hierarchy evidence satisfy hierarchy-only hard constraints', () => {
    const signature = minimalDatasetSignature(50, 3, 0, 0, 'rf045-unknown-hierarchy', 0);
    expect(signature.cardinality.depth).toBeUndefined();

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
