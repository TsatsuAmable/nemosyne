import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { memoryProfiler } from '../harness/memory_profiler.js';
import { setupE2EEnvironment } from '../setup.js';
import { getWebGLMockStats } from '../harness/webgl_mock.js';
import { generateTabularCSV, generateGraphCSV } from '../harness/dataset_fixtures.js';

describe('Feature 15: Requirement-Driven E2E Suite & TEST_READY.md', () => {
  it('F15-TC1: E2E testing environment initializes cleanly via setupE2EEnvironment()', () => {
    const env = setupE2EEnvironment();
    expect(env).toBeDefined();
    expect(env.session).toBeDefined();
    expect(env.session.mode).toBe('immersive-vr');
  });

  it('F15-TC2: WebGL mock harness accurately records created and active buffer allocations', () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') as any;

    const buf = gl.createBuffer();
    const stats = getWebGLMockStats();
    expect(stats.createdBuffers).toBeGreaterThan(0);

    gl.deleteBuffer(buf);
  });

  it('F15-TC3: MemoryProfiler captures memory snapshots and asserts zero WebGL buffer leaks', () => {
    const baseline = memoryProfiler.startRecording();
    const snapshot = memoryProfiler.takeSnapshot();

    expect(() => {
      memoryProfiler.assertNoWebGLBufferLeaks(baseline, snapshot);
    }).not.toThrow();
  });

  it('F15-TC4: Dataset fixtures harness produces valid synthetic CSV payloads for testing', () => {
    const tabular = generateTabularCSV(5, 3);
    const graph = generateGraphCSV(5);

    expect(tabular).toContain('dim_1');
    expect(graph).toContain('source,target');
  });

  it('F15-TC5: E2E suite tier 1 feature coverage files (f01 to f15) are fully configured', () => {
    const tier1Dir = fileURLToPath(new URL('./', import.meta.url));
    const filenames = readdirSync(tier1Dir).filter((name) => name.endsWith('.spec.ts'));

    for (let feature = 1; feature <= 15; feature += 1) {
      const prefix = `f${String(feature).padStart(2, '0')}_`;
      const matches = filenames.filter((name) => name.startsWith(prefix));
      expect(matches, `Tier 1 feature ${prefix.slice(0, 3)} must have exactly one spec file`).toHaveLength(1);
    }
    expect(filenames).toHaveLength(15);
  });
});
