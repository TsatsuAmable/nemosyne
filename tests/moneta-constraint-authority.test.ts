import { describe, expect, it } from 'vitest';
import {
  ConstraintEngine,
  isNoFeasibleConstraintResult,
} from '../src/moneta/ConstraintEngine.ts';
import type { MonetaDataInput, MonetaFacts } from '../src/moneta/types.ts';
import { TopologyTypes } from '../src/types/topology.ts';

const facts: MonetaFacts = {
  topology: TopologyTypes.TABULAR,
  rowCount: 2,
  nodeCount: 2,
  edgeCount: 0,
  depth: 0,
  numericColumns: 1,
  categoricalColumns: 0,
  temporalColumns: 0,
  hasTimeSeries: false,
  hasContinuousValues: true,
  density: 0,
  estimatedDensity: 0,
  outlierCount: 0,
  cardinalityOfColor: 1,
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
  topCategory: undefined,
};

describe('Moneta constraint authority boundary', () => {
  it('returns typed NIL when hard constraints eliminate every candidate', () => {
    const engine = new ConstraintEngine();
    engine.hardConstraints = [() => false];

    const result = engine.solve(facts);

    expect(isNoFeasibleConstraintResult(result)).toBe(true);
    if (!isNoFeasibleConstraintResult(result)) throw new Error('expected NIL');
    expect(result.kind).toBe('NIL');
    expect(result.reason).toBe('NO_FEASIBLE_CANDIDATE');
    expect(result.spec).toBeNull();
    expect(result.cost).toBeNull();
  });

  it('refuses raw-row fact extraction when no evidence authority is injected', () => {
    const engine = new ConstraintEngine();
    const raw = { rows: [{ x: 1 }, { x: 2 }] } as MonetaDataInput;

    expect(() => engine.extractFacts(raw)).toThrow(/raw-row analytical fallback is forbidden/);
    expect(() => engine.solve(raw)).toThrow(/raw-row analytical fallback is forbidden/);
  });

  it('delegates raw-input fact resolution only to the injected FactProvider', () => {
    const raw = { rows: [{ x: 1 }, { x: 2 }] } as MonetaDataInput;
    let calls = 0;
    const engine = new ConstraintEngine({
      factProvider: {
        facts(input) {
          calls += 1;
          expect(input).toBe(raw);
          return facts;
        },
      },
    });

    expect(engine.extractFacts(raw)).toBe(facts);
    const result = engine.solve(raw);
    expect(isNoFeasibleConstraintResult(result)).toBe(false);
    expect(calls).toBe(2);
  });
});
