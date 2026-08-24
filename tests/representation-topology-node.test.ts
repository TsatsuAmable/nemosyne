import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MonetaTopologyNode as DracoTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import {
  RepresentationHypothesisEngine,
  createDefaultRequirements,
  type DracoFacts,
  type FactProvider,
} from '../src/moneta/index.ts';

describe('Phase 4: Integrate RepresentationDecision into DracoTopologyNode', () => {
  const scene = new THREE.Scene();

  const mockFacts: DracoFacts = {
    topology: 'TIME_SERIES',
    rowCount: 20,
    nodeCount: 20,
    edgeCount: 0,
    depth: 1,
    numericColumns: 1,
    categoricalColumns: 0,
    temporalColumns: 1,
    hasTimeSeries: true,
    hasContinuousValues: true,
    density: 0.1,
    estimatedDensity: 0.1,
    outlierCount: 0,
    cardinalityOfColor: 0,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 1,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'up',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };

  const factProvider: FactProvider = {
    facts: () => mockFacts,
  };

  const dataInput = {
    topology: 'TIME_SERIES' as const,
    rows: Array.from({ length: 20 }, (_, i) => ({ time: i, val: i * 2 })),
  };

  it('uses embodiment spec when representationDecision is provided', () => {
    const decision = RepresentationHypothesisEngine.reason(
      mockFacts,
      null,
      createDefaultRequirements('temporal-trend')
    );

    const node = new DracoTopologyNode(
      scene,
      dataInput,
      [0, 0, 0],
      {},
      factProvider,
      false,
      decision
    );

    expect(node.solverResult).toBeDefined();
    expect(node.solverResult.spec.layout).toBe(decision.embodiment.primaryLayout);
    expect(node.solverResult.spec.geometry).toBe(decision.embodiment.primaryGeometry);
    expect(node.solverResult.spec.behavior).toBe(decision.embodiment.primaryBehavior);
    expect(node.solverResult.spec.interaction).toBe(decision.embodiment.primaryInteraction);
    expect(node.solverResult.cost).toBe(decision.utilityScore);
    expect(node.artifact).toBeDefined();
  });

  it('falls back to ConstraintEngine when decision is null', () => {
    const node = new DracoTopologyNode(
      scene,
      dataInput,
      [0, 0, 0],
      {},
      factProvider,
      false,
      null
    );

    expect(node.solverResult).toBeDefined();
    expect(node.representationDecision).toBeNull();
    expect(node.artifact).toBeDefined();
  });

  it('updates artifact when setRepresentationDecision() is called', () => {
    const node = new DracoTopologyNode(
      scene,
      dataInput,
      [0, 0, 0],
      {},
      factProvider,
      false,
      null
    );

    const decision = RepresentationHypothesisEngine.reason(
      mockFacts,
      null,
      createDefaultRequirements('temporal-trend')
    );

    node.setRepresentationDecision(decision);

    expect(node.representationDecision).toBe(decision);
    expect(node.solverResult.spec.layout).toBe(decision.embodiment.primaryLayout);
    expect(node.artifact).toBeDefined();
  });
});
