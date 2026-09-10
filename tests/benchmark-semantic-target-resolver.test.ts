import { PerformanceObserver, performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SemanticTargetResolver } from '../src/vr/input/SemanticTargetResolver.ts';
import type { SceneHit } from '../src/vr/input/InteractableRegistry.ts';

const ENABLED = process.env.NEMOSYNE_BENCHMARK_SEMANTIC === '1';
const ITERATIONS = Number(process.env.NEMOSYNE_BENCHMARK_ITERATIONS ?? 20_000);
const HIT_COUNTS = [1, 8, 32, 128];

interface GcStats {
  count: number;
  durationMs: number;
}

function makeHits(count: number): SceneHit[] {
  const hits: SceneHit[] = [];
  for (let i = 0; i < count; i++) {
    const object = new THREE.Object3D();
    object.position.set((i % 7) * 0.01, (i % 5) * 0.01, 0.5 + i * 0.005);
    object.updateMatrixWorld();
    const isStructure = i % 4 === 0;
    hits.push({
      entry: {
        mesh: object,
        data: isStructure ? undefined : { row: i },
        semantic: isStructure
          ? { kind: 'mapper-node', structureId: `structure-${i}`, salience: 0.8 }
          : { kind: 'observation', salience: 0.4 },
      },
      distance: 0.5 + i * 0.005,
    });
  }
  return hits;
}

async function runCase(hitCount: number, withGaze: boolean) {
  const resolver = new SemanticTargetResolver({}, 0.05);
  const hits = makeHits(hitCount);
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
  const gaze = withGaze ? new THREE.Vector3(0, 0, 1) : undefined;

  for (let i = 0; i < 2_000; i++) resolver.rank(hits, ray, gaze, undefined, i * 16);
  resolver.clearHold();

  const gc: GcStats = { count: 0, durationMs: 0 };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      gc.count++;
      gc.durationMs += entry.duration;
    }
  });
  observer.observe({ entryTypes: ['gc'] });

  global.gc?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  gc.count = 0;
  gc.durationMs = 0;
  const heapBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  let winnerScore = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    winnerScore += resolver.rank(hits, ray, gaze, undefined, 100_000 + i * 16)?.score ?? 0;
  }
  const elapsedMs = performance.now() - start;
  const heapAfter = process.memoryUsage().heapUsed;
  await new Promise<void>((resolve) => setImmediate(resolve));
  observer.disconnect();

  return {
    hitCount,
    withGaze,
    iterations: ITERATIONS,
    elapsedMs,
    nsPerCall: (elapsedMs * 1e6) / ITERATIONS,
    heapDeltaBytes: heapAfter - heapBefore,
    gcCount: gc.count,
    gcDurationMs: gc.durationMs,
    winnerScore,
  };
}

describe.skipIf(!ENABLED)('UXR0C3 manual benchmark: SemanticTargetResolver.rank()', () => {
  it('reports candidate-count scaling and GC pressure', async () => {
    expect(Number.isFinite(ITERATIONS) && ITERATIONS > 0).toBe(true);
    const results = [];
    for (const withGaze of [false, true]) {
      for (const hitCount of HIT_COUNTS) results.push(await runCase(hitCount, withGaze));
    }
    console.log(`SEMANTIC_RESOLVER_BENCHMARK ${JSON.stringify(results)}`);
    expect(results).toHaveLength(HIT_COUNTS.length * 2);
  }, 120_000);
});
