// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { AdaptiveFrameGovernor } from '../src/vr/scalability/AdaptiveFrameGovernor.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';

/** Helper: record N frames at the given renderTimeMs to fill the 10-sample minimum. */
function fillFrames(governor: AdaptiveFrameGovernor, renderTimeMs: number, count = 12): void {
  for (let i = 0; i < count; i++) {
    governor.recordFrame(renderTimeMs);
  }
}

describe('Sprint 19.2: Governor Event Loop — PERFORMANCE_THROTTLE dispatch', () => {
  it('emits PERFORMANCE_THROTTLE when average frame time exceeds 115% of target', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);
    const handler = vi.fn();
    bus.on(WorldTopics.PERFORMANCE_THROTTLE, handler);

    // 14ms > 11.1 * 1.15 = 12.765ms → should throttle
    fillFrames(governor, 14);

    expect(handler).toHaveBeenCalled();
  });

  it('throttle event payload contains lodScaleFactor and averageFrameTimeMs', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);
    const handler = vi.fn();
    bus.on(WorldTopics.PERFORMANCE_THROTTLE, handler);

    fillFrames(governor, 14);

    const payload = handler.mock.calls[0][0] as { lodScaleFactor: number; averageFrameTimeMs: number };
    expect(payload).toHaveProperty('lodScaleFactor');
    expect(payload).toHaveProperty('averageFrameTimeMs');
    expect(typeof payload.lodScaleFactor).toBe('number');
    expect(typeof payload.averageFrameTimeMs).toBe('number');
    // LOD should have decreased from 1.0
    expect(payload.lodScaleFactor).toBeLessThan(1.0);
    expect(payload.averageFrameTimeMs).toBeGreaterThan(0);
  });

  it('emits PERFORMANCE_THROTTLE on recovery when frame times improve back below threshold', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);
    const handler = vi.fn();
    bus.on(WorldTopics.PERFORMANCE_THROTTLE, handler);

    // Phase 1: throttle the governor
    fillFrames(governor, 14, 15);
    const throttleCallCount = handler.mock.calls.length;
    expect(throttleCallCount).toBeGreaterThan(0);

    handler.mockClear();

    // Phase 2: recover — frames well below 75% of target (11.1 * 0.75 = 8.325ms)
    // Need lodScaleFactor < 1.0 at this point (it was throttled)
    fillFrames(governor, 5, 15);

    // Recovery events should have been emitted
    expect(handler).toHaveBeenCalled();
    const recoveryPayload = handler.mock.calls[0][0] as { lodScaleFactor: number };
    // lodScaleFactor should have increased compared to fully throttled state
    expect(recoveryPayload.lodScaleFactor).toBeGreaterThan(0.40);
  });

  it('does NOT emit any event when no eventBus is provided (backward compatibility)', () => {
    // No eventBus passed — governor must not throw and must not emit anything
    const governor = new AdaptiveFrameGovernor(11.1, 30);
    expect(() => fillFrames(governor, 14)).not.toThrow();

    const metrics = governor.getMetrics();
    expect(metrics.throttleCount).toBeGreaterThan(0);
    // No error = backward compat maintained
  });

  it('does not emit an event when frame time stays within the normal range', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.1, 30, bus);
    const handler = vi.fn();
    bus.on(WorldTopics.PERFORMANCE_THROTTLE, handler);

    // 11ms < 12.765ms threshold and lod is already 1.0 so no recovery needed
    fillFrames(governor, 11);

    expect(handler).not.toHaveBeenCalled();
  });
});
