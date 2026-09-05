import { describe, expect, it, vi } from 'vitest';
import { SystemGestureDetector } from '../src/vr/input/SystemGestureDetector.ts';
import type { PointerRegistry } from '../src/vr/input/PointerRegistry.ts';

function registryWithCoach(log: ReturnType<typeof vi.fn>): PointerRegistry {
  return {
    engine: {
      uiManager: { interactionCoach: { log } },
    },
    hands: [
      { rayOrigin: { y: 1.7 }, isPinched: () => true },
      { rayOrigin: { y: 1.2 }, isPinched: () => true },
    ],
    controllers: [],
    lastBothPinched: false,
    controllerGripPressed: new Map(),
    isBestPointerOverPanel: () => false,
  } as unknown as PointerRegistry;
}

describe('system gesture suppression guidance composition', () => {
  it('surfaces the real reach-zone remedy through the live InteractionCoach path', () => {
    const log = vi.fn();
    const detector = new SystemGestureDetector(registryWithCoach(log), {
      bothPinchHoldMs: 0,
      toggleCooldownMs: 0,
      now: () => 0,
    });

    detector.update(null);

    expect(log).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith({
      action: 'System gesture blocked',
      result: 'Both-pinch unavailable in the upper reach zone. Lower both hands and pinch again.',
    });
  });
});
