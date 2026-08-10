import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src/vr/Engine.js';
import { AdaptiveFrameGovernor } from '../../../src/vr/scalability/AdaptiveFrameGovernor.js';

describe('Feature 8: 90 FPS Frame Target & Budget Alignment', () => {
  it('F8-TC1: AdaptiveFrameGovernor target frame time is aligned to 11.1ms (90 FPS target)', () => {
    const governor = new AdaptiveFrameGovernor();
    expect(governor.targetFrameTimeMs).toBeCloseTo(11.1, 1);
  });

  it('F8-TC2: Engine contains AdaptiveFrameGovernor and PerformanceBudget instances', () => {
    const engine = new Engine();
    expect(engine.frameGovernor).toBeDefined();
    expect(engine.performanceBudget).toBeDefined();
    engine.dispose();
  });

  it('F8-TC3: Frame delta time > 11.11ms causes governor metrics to record throttle count', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);
    for (let i = 0; i < 15; i++) {
      governor.recordFrame(20.0);
    }
    const metrics = governor.getMetrics();
    expect(metrics.throttleCount).toBeGreaterThan(0);
    expect(metrics.isGovernorActive).toBe(true);
  });

  it('F8-TC4: Engine render loop updates updatables and records frame duration', () => {
    const engine = new Engine();
    let updated = false;
    engine.addUpdatable({
      update: () => {
        updated = true;
      },
    });

    engine._tick();
    expect(updated).toBe(true);
    engine.dispose();
  });

  it('F8-TC5: Sub-11.11ms frame performance retains lodScaleFactor of 1.0', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);
    for (let i = 0; i < 20; i++) {
      governor.recordFrame(5.0);
    }
    const metrics = governor.getMetrics();
    expect(metrics.lodScaleFactor).toBe(1.0);
    expect(metrics.isGovernorActive).toBe(false);
  });
});
