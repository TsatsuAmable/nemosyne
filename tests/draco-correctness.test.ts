// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ConstraintEngine } from '../src/draco/ConstraintEngine.ts';
import { Engine } from '../src/vr/Engine.ts';

describe('Sprint 22.6 Data/Draco Correctness & Architecture Hygiene', () => {
  it('ConstraintEngine evaluates correlation-based soft constraints gracefully', () => {
    const engine = new ConstraintEngine();
    const facts = {
      topology: 'TABULAR',
      rowCount: 100,
      columns: [{ name: 'a', type: 'numeric' }, { name: 'b', type: 'numeric' }],
      correlationMatrix: {
        a: { a: 1.0, b: 0.85 },
        b: { a: 0.85, b: 1.0 },
      },
    };

    const specWithBeams = {
      geometry: 'BEAM',
      layout: 'GRID',
      encoding: { x: 'a', y: 'b' },
      interaction: 'POINT_AND_CLICK',
    };

    const specWithoutBeams = {
      geometry: 'POINT_CLOUD',
      layout: 'GRID',
      encoding: { x: 'a', y: 'b' },
      interaction: 'POINT_AND_CLICK',
    };

    const costWithBeams = engine.evaluateCandidate(specWithBeams, facts).cost;
    const costWithoutBeams = engine.evaluateCandidate(specWithoutBeams, facts).cost;

    // Prefer beam for correlations gives penalty if not BEAM_SEARCH
    expect(costWithoutBeams).toBeGreaterThan(costWithBeams);
  });

  it('Engine manages updatables lifecycle with addUpdatable and removeUpdatable', () => {
    const engine = new Engine();
    let tickCount = 0;
    const task = {
      update: () => {
        tickCount++;
      },
    };

    engine.addUpdatable(task);
    expect(engine.updatables.has(task)).toBe(true);

    // Run tick
    (engine as unknown as { _tick: () => void })._tick();
    expect(tickCount).toBe(1);

    engine.removeUpdatable(task);
    expect(engine.updatables.has(task)).toBe(false);

    (engine as unknown as { _tick: () => void })._tick();
    expect(tickCount).toBe(1);

    engine.dispose();
  });
});
