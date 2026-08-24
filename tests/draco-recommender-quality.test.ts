// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { ConstraintEngine, TopologyTypes } from '../src/moneta/ConstraintEngine.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import goldenData from './fixtures/draco-golden/golden-pairs.json';
import { computeFacts, makeFactProvider } from './helpers/dracoFactsHelper.ts';

describe('Draco Recommender Quality Evaluation Suite', () => {
  const engine = new ConstraintEngine({ factProvider: makeFactProvider() });

  it('exposes evaluateCandidate method for scoring testability', () => {
    const facts = computeFacts({
      dataset: new Dataset(
        'Test',
        [{ name: 'val', type: ColumnType.NUMERIC }],
        [{ val: 10 }, { val: 20 }]
      ),
    });

    const candidate = {
      layout: 'GRID_3D' as const,
      geometry: 'CUBE_MATRIX' as const,
      behavior: 'STATIC' as const,
      interaction: 'INSPECT_CELL' as const,
    };

    const evalResult = engine.evaluateCandidate(candidate, facts);
    expect(evalResult).toHaveProperty('isValid');
    expect(evalResult).toHaveProperty('cost');
    expect(evalResult).toHaveProperty('softConstraintViolations');
    expect(typeof evalResult.cost).toBe('number');
  });

  it('achieves >= 80% topology match precision on golden dataset pairs', () => {
    let matches = 0;
    const pairs = goldenData.pairs as any[];

    for (const pair of pairs) {
      let inputData: any = pair.dataInput;
      if (pair.dataInput.dataset) {
        const ds = new Dataset(
          pair.dataInput.dataset.name,
          pair.dataInput.dataset.columns,
          pair.dataInput.dataset.rows
        );
        inputData = { ...pair.dataInput, dataset: ds };
      }

      const result = engine.solve(inputData);

      let layoutMatch = true;
      if (pair.expectedLayout && result.spec.layout !== pair.expectedLayout) {
        layoutMatch = false;
      }
      let geometryMatch = true;
      if (pair.expectedGeometry && result.spec.geometry !== pair.expectedGeometry) {
        geometryMatch = false;
      }

      if (layoutMatch && geometryMatch) {
        matches++;
      } else {
        console.log(`Mismatch on ${pair.id}: expected (${pair.expectedLayout}, ${pair.expectedGeometry}), got (${result.spec.layout}, ${result.spec.geometry})`);
      }
    }

    const precision = matches / pairs.length;
    expect(precision).toBeGreaterThanOrEqual(0.80);
  });

  it('computes soft constraint penalties correctly without hard constraint violation', () => {
    const ds = new Dataset(
      'TabularTest',
      [{ name: 'val1', type: ColumnType.NUMERIC }, { name: 'val2', type: ColumnType.NUMERIC }, { name: 'cat', type: ColumnType.CATEGORICAL }],
      [{ val1: 10, val2: 5, cat: 'A' }, { val1: 20, val2: 15, cat: 'B' }]
    );
    const facts = computeFacts({ dataset: ds });

    const goodSpec = {
      layout: 'GRID_3D' as const,
      geometry: 'CUBE_MATRIX' as const,
      behavior: 'PULSE_QUANTITATIVE' as const,
      interaction: 'INSPECT_CELL' as const,
    };

    const evalResult = engine.evaluateCandidate(goodSpec, facts);
    expect(evalResult.isValid).toBe(true);
    expect(evalResult.cost).toBeLessThan(100);
  });
});
