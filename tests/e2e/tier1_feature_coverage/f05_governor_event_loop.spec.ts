import { describe, it, expect } from 'vitest';
import { AdaptiveFrameGovernor, PerformanceThrottlePayload } from '../../../src/vr/scalability/AdaptiveFrameGovernor.js';
import { WorldEventBus, WorldTopics } from '../../../src/utils/EventBus.js';

describe('Feature 5: Governor Event Loop', () => {
  it('F5-TC1: AdaptiveFrameGovernor records frame times and computes average frame duration', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);
    for (let i = 0; i < 15; i++) {
      governor.recordFrame(10.0);
    }
    expect(governor.getAverageFrameTime()).toBeCloseTo(10.0, 1);
  });

  it('F5-TC2: Frame time exceeding 11.11ms threshold triggers PERFORMANCE_THROTTLE event on EventBus', () => {
    const eventBus = new WorldEventBus();
    let eventFired = false;
    let eventPayload: PerformanceThrottlePayload | undefined;

    eventBus.on(WorldTopics.PERFORMANCE_THROTTLE, (payload: any) => {
      eventFired = true;
      eventPayload = payload;
    });

    const governor = new AdaptiveFrameGovernor(11.1, 30, eventBus);

    // Record heavy frame times (> 11.11ms * 1.15)
    for (let i = 0; i < 15; i++) {
      governor.recordFrame(20.0);
    }

    expect(eventFired).toBe(true);
    expect(eventPayload).toBeDefined();
    expect(eventPayload?.lodScaleFactor).toBeLessThan(1.0);
  });

  it('F5-TC3: PERFORMANCE_THROTTLE payload contains accurate average frame time and LOD scale factor', () => {
    const eventBus = new WorldEventBus();
    let capturedPayload: PerformanceThrottlePayload | null = null;

    eventBus.on(WorldTopics.PERFORMANCE_THROTTLE, (payload: any) => {
      capturedPayload = payload;
    });

    const governor = new AdaptiveFrameGovernor(11.1, 30, eventBus);
    for (let i = 0; i < 12; i++) {
      governor.recordFrame(25.0);
    }

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload!.averageFrameTimeMs).toBeGreaterThan(11.1);
    expect(capturedPayload!.lodScaleFactor).toBeLessThan(1.0);
  });

  it('F5-TC4: Fast frame times allow recovery of lodScaleFactor back towards 1.0', () => {
    const eventBus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, eventBus);

    // Cause initial throttle
    for (let i = 0; i < 15; i++) {
      governor.recordFrame(25.0);
    }
    const throttledScale = governor.getMetrics().lodScaleFactor;
    expect(throttledScale).toBeLessThan(1.0);

    // Record 60 fast frames so 30-frame window is completely filled with 5.0ms
    for (let i = 0; i < 60; i++) {
      governor.recordFrame(5.0);
    }
    const recoveredScale = governor.getMetrics().lodScaleFactor;
    expect(recoveredScale).toBeGreaterThan(throttledScale);
  });

  it('F5-TC5: Governor reset clears frame history and resets LOD scale to 1.0', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);
    for (let i = 0; i < 15; i++) {
      governor.recordFrame(30.0);
    }
    governor.reset();
    const metrics = governor.getMetrics();
    expect(metrics.lodScaleFactor).toBe(1.0);
    expect(metrics.averageFrameTimeMs).toBe(0);
  });
});
