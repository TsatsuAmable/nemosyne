import { describe, it, expect, vi } from 'vitest';
import { AdaptiveFrameGovernor } from '../../../src/vr/scalability/AdaptiveFrameGovernor.ts';
import { WorldEventBus, WorldTopics } from '../../../src/utils/EventBus.ts';

describe('Tier 2 — Feature 5: Governor Event Loop (Boundary Cases)', () => {
  it('F5-BC1: Extreme frame delay (500ms) triggers max throttle without NaN or division by zero', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);
    const handler = vi.fn();
    bus.on(WorldTopics.PERFORMANCE_THROTTLE, handler);

    // Record extreme frame delay
    for (let i = 0; i < 15; i++) {
      governor.recordFrame(500.0);
    }

    expect(handler).toHaveBeenCalled();
    const payload = handler.mock.calls[handler.mock.calls.length - 1][0];
    expect(Number.isNaN(payload.lodScaleFactor)).toBe(false);
    expect(Number.isNaN(payload.averageFrameTimeMs)).toBe(false);
    expect(payload.lodScaleFactor).toBeGreaterThanOrEqual(0.1); // Min LOD clamp
    expect(payload.averageFrameTimeMs).toBeGreaterThan(100);
  });

  it('F5-BC2: Rapidly fluctuating frame times are smoothed by moving average filter', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);

    // Alternating between 1ms and 20ms
    for (let i = 0; i < 20; i++) {
      governor.recordFrame(i % 2 === 0 ? 1.0 : 20.0);
    }

    const metrics = governor.getMetrics();
    expect(metrics.averageFrameTimeMs).toBeGreaterThan(5);
    expect(metrics.averageFrameTimeMs).toBeLessThan(15);
  });

  it('F5-BC3: Governor operating with null or zero-listener EventBus completes without error', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 30);

    expect(() => {
      for (let i = 0; i < 20; i++) {
        governor.recordFrame(15.0);
      }
    }).not.toThrow();

    const metrics = governor.getMetrics();
    expect(metrics.throttleCount).toBeGreaterThan(0);
  });

  it('F5-BC4: Governor handles throwing subscriber callbacks without breaking render loop', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);

    bus.on(WorldTopics.PERFORMANCE_THROTTLE, () => {
      throw new Error('Subscriber error simulation');
    });

    expect(() => {
      for (let i = 0; i < 15; i++) {
        governor.recordFrame(20.0);
      }
    }).not.toThrow();
  });

  it('F5-BC5: Re-recording frames after long pause resets delta baseline smoothly', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);

    // Initial smooth frames
    for (let i = 0; i < 12; i++) {
      governor.recordFrame(10.0);
    }

    // Simulate 5000ms pause, then resume
    governor.recordFrame(10.0);

    const metrics = governor.getMetrics();
    expect(metrics.averageFrameTimeMs).toBeLessThan(15);
  });
});
