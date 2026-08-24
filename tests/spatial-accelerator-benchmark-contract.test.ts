import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'scripts/benchmark-spatial-accelerator.mjs');

describe('spatial accelerator benchmark contract', () => {
  it('reports native/BVH first-hit parity without imposing a CI timing threshold', () => {
    const run = spawnSync(
      process.execPath,
      [scriptPath, '--suite=objects', '--tiers=16', '--rays=4', '--repeat=1', '--json'],
      { encoding: 'utf8' }
    );

    expect(run.status).toBe(0);
    const result = JSON.parse(run.stdout) as {
      scope: string;
      suite: string;
      results: Array<{ primitiveCount: number; parity: boolean; speedup: number }>;
    };
    expect(result.scope).toBe('host-characterization-not-device-qualification');
    expect(result.suite).toBe('objects');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].primitiveCount).toBe(16);
    expect(result.results[0].parity).toBe(true);
    expect(result.results[0].speedup).toBeGreaterThan(0);
  });

  it('can characterize geometry-level primitive crossover separately', () => {
    const run = spawnSync(
      process.execPath,
      [scriptPath, '--suite=geometry', '--tiers=128', '--rays=4', '--repeat=1', '--json'],
      { encoding: 'utf8' }
    );

    expect(run.status).toBe(0);
    const result = JSON.parse(run.stdout) as { suite: string; results: Array<{ parity: boolean }> };
    expect(result.suite).toBe('geometry');
    expect(result.results[0].parity).toBe(true);
  });

  it('rejects invalid tiers before benchmarking', () => {
    const run = spawnSync(process.execPath, [scriptPath, '--tiers=invalid'], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/--tiers must be a positive integer/);
  });
});
