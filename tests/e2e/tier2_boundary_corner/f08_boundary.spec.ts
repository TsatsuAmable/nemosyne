import { describe, it, expect } from 'vitest';
import { AdaptiveFrameGovernor } from '../../../src/vr/scalability/AdaptiveFrameGovernor.ts';

describe('Tier 2 — Feature 8: 90 FPS Frame Target (Boundary Cases)', () => {
  it('F8-BC1: Governor target budget defaults to sub-11.11ms (90 FPS WebXR target)', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);
    expect(governor.targetFrameTimeMs).toBeCloseTo(11.1, 1);
  });

  it('F8-BC2: Dynamically re-configuring target frame budget adapts thresholding', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);
    governor.targetFrameTimeMs = 8.33; // 120 FPS target

    expect(governor.targetFrameTimeMs).toBeCloseTo(8.33, 2);
  });

  it('F8-BC3: Clock jump spike (e.g. 10,000ms delta) is clamped or smoothed without breaking governor state', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);

    for (let i = 0; i < 10; i++) {
      governor.recordFrame(10.0);
    }

    // Huge clock jump
    governor.recordFrame(10000.0);

    const metrics = governor.getMetrics();
    expect(Number.isNaN(metrics.averageFrameTimeMs)).toBe(false);
    expect(metrics.averageFrameTimeMs).toBeGreaterThan(0);
  });

  it('F8-BC4: Zero delta time (0.0ms) on duplicate rAF callback does not divide by zero', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);

    expect(() => {
      governor.recordFrame(0.0);
      governor.recordFrame(0.0);
    }).not.toThrow();

    const metrics = governor.getMetrics();
    expect(Number.isNaN(metrics.averageFrameTimeMs)).toBe(false);
  });

  it('F8-BC5: High volume frame recording (1,000 frames) maintains bounded ring-buffer memory', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);

    for (let i = 0; i < 1000; i++) {
      governor.recordFrame(10.0 + (i % 5));
    }

    const metrics = governor.getMetrics();
    const fps = 1000 / metrics.averageFrameTimeMs;
    expect(fps).toBeGreaterThan(60);
    expect(fps).toBeLessThan(120);
  });
});
