import { describe, expect, it } from 'vitest';
import type { MonetaFacts } from '../src/moneta/types.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import type { RepresentationRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';

function facts(rowCount: number): MonetaFacts {
  return {
    topology: 'TABULAR',
    rowCount,
    nodeCount: rowCount,
    edgeCount: 0,
    depth: 0,
    numericColumns: 1,
    categoricalColumns: 1,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0,
    estimatedDensity: 0,
    outlierCount: 0,
    cardinalityOfColor: 4,
    hasHighCardinality: false,
    isLargeDataset: true,
    clusterCount: 0,
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

function groupComparisonRequirements(): RepresentationRequirements {
  return {
    task: 'group-comparison',
    requiredStructures: [{ type: 'group-comparison', importance: 1 }],
    preservationGoals: [
      { information: 'aggregate-group-magnitude', priority: 'CRITICAL' },
    ],
    acceptableLoss: {
      allowIdentityLoss: true,
      allowExactMetricLoss: true,
      allowClusterLoss: true,
      maxFrustumExclusionTolerance: 0.7,
    },
    scale: 'LARGE',
    hardwareConstraints: {
      maxVertices: 100_000,
      maxDrawCalls: 120,
      targetFrameRate: 72,
      deviceTier: 'quest3',
      targetFps: 72,
      maxElements: 500_000,
      preferInstanced: true,
    },
    maxFrustumExclusionTolerance: 0.7,
    interactionBudget: 'MEDIUM',
  };
}

describe('Stream A A4 production reachability', () => {
  it('allows AGGREGATE_VOLUME to win for a legitimate group-level requirement at scale', () => {
    // 100,001 rows is deliberate: the current CLUSTER_REGIONS candidate is
    // outside its declared max-N envelope, while AGGREGATE_VOLUME remains in
    // its declared scale range. No source rows are constructed for this
    // representation-decision proof.
    const signature = buildDatasetSignature(
      facts(100_001),
      null,
      'a'.repeat(64),
      '0.1.0',
      null,
      0,
    );
    const decision = new MonetaHypothesisEngine().arbitrate(
      signature,
      groupComparisonRequirements(),
    );

    expect(decision.chosenCandidateId).toBe('AGGREGATE_VOLUME');
    expect(decision.chosenFamily).toBe('AGGREGATE');
    expect(decision.embodiment.primaryGeometry).toBe('AGGREGATE_BARS');
  });

  it('keeps fresh individual-inspection requirements incompatible with aggregate identity loss', () => {
    const signature = buildDatasetSignature(
      facts(1_000),
      null,
      'b'.repeat(64),
      '0.1.0',
      null,
      0,
    );
    const requirements = createDefaultRequirements('individual-inspection', 'MEDIUM');
    const decision = new MonetaHypothesisEngine().arbitrate(signature, requirements);

    expect(decision.chosenCandidateId).not.toBe('AGGREGATE_VOLUME');
    const aggregateCandidates = decision.rankedCandidates?.filter(
      (candidate) => candidate.candidateId === 'AGGREGATE_VOLUME',
    ) ?? [];
    expect(aggregateCandidates.length).toBeGreaterThan(0);
    expect(aggregateCandidates.every((candidate) => candidate.disqualified)).toBe(true);
    expect(
      aggregateCandidates.some((candidate) =>
        candidate.disqualificationReason?.includes('critical information') ||
        candidate.disqualificationReason?.includes('Identity loss'),
      ),
    ).toBe(true);
  });
});
