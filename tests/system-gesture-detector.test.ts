import { describe, expect, it, vi } from 'vitest';
import { SystemGestureDetector } from '../src/vr/input/SystemGestureDetector.ts';

function registry(hands: Array<{ pinched: boolean }>, grips: boolean[] = []) {
  const handPointers = hands.map((hand) => ({ isPinched: () => hand.pinched }));
  const controllers = grips.map(() => ({ handedness: 'none', rayOrigin: { y: 1 }, getRay: () => ({ origin: { x: 0 }, direction: { lengthSq: () => 1 } }) }));
  return {
    hands: handPointers,
    controllers,
    lastBothPinched: false,
    controllerGripPressed: new Map(),
    isBestPointerOverPanel: vi.fn(() => false),
    findSourceForController: vi.fn((_controller: unknown, sources: XRInputSource[]) => sources[0] ?? null),
  } as never;
}

describe('SystemGestureDetector unified gate', () => {
  it('fires controller grips once until release', () => {
    const now = 0;
    const detector = new SystemGestureDetector(registry([], [true, true]), {
      bothPinchHoldMs: 400,
      toggleCooldownMs: 0,
      now: () => now,
    });
    const toggle = vi.fn();
    detector.onSystemToggle = toggle;
    const session = {
      inputSources: [
        { gamepad: { buttons: [{}, { pressed: true }] } },
        { gamepad: { buttons: [{}, { pressed: true }] } },
      ],
    } as unknown as XRSession;

    detector.update(session);
    detector.update(session);
    detector.update(session);
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('gives a panel-targeted controller grip precedence to panel interaction', () => {
    const pointers = registry([], [true, true]) as unknown as {
      isBestPointerOverPanel: ReturnType<typeof vi.fn>;
    };
    pointers.isBestPointerOverPanel.mockReturnValue(true);
    const detector = new SystemGestureDetector(pointers as never, { toggleCooldownMs: 0, now: () => 0 });
    const toggle = vi.fn();
    detector.onSystemToggle = toggle;
    const session = {
      inputSources: [
        { gamepad: { buttons: [{}, { pressed: true }] } },
        { gamepad: { buttons: [{}, { pressed: true }] } },
      ],
    } as unknown as XRSession;

    const result = detector.update(session);

    expect(result.suppressSelection).toBe(false);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('suppresses hand selection only for an un-targeted both-hand pinch', () => {
    let now = 0;
    const pointers = registry([{ pinched: true }, { pinched: true }]) as unknown as {
      isBestPointerOverPanel: ReturnType<typeof vi.fn>;
    };
    const detector = new SystemGestureDetector(pointers as never, {
      bothPinchHoldMs: 0,
      toggleCooldownMs: 0,
      now: () => now,
    });

    expect(detector.update(null).suppressSelection).toBe(true);
    pointers.isBestPointerOverPanel.mockReturnValue(true);
    now = 1;
    expect(detector.update(null).suppressSelection).toBe(false);
  });

  it('does not re-fire when a held grip crosses a panel boundary', () => {
    let now = 0;
    const pointers = registry([], [true, true]) as unknown as {
      isBestPointerOverPanel: ReturnType<typeof vi.fn>;
    };
    pointers.isBestPointerOverPanel.mockReturnValue(false);
    const detector = new SystemGestureDetector(pointers as never, {
      toggleCooldownMs: 0,
      now: () => now,
    });
    const toggle = vi.fn();
    detector.onSystemToggle = toggle;
    const session = {
      inputSources: [
        { gamepad: { buttons: [{}, { pressed: true }] } },
        { gamepad: { buttons: [{}, { pressed: true }] } },
      ],
    } as unknown as XRSession;

    // Press begins off-panel -> fires once.
    detector.update(session);
    expect(toggle).toHaveBeenCalledOnce();

    // Ray drifts over a HUD panel while the grip stays held -> no fire.
    now = 5;
    pointers.isBestPointerOverPanel.mockReturnValue(true);
    detector.update(session);

    // Cooldown has long elapsed and the ray leaves the panel while the grip is
    // still held -> must NOT re-fire from the same single held press.
    now = 2000;
    pointers.isBestPointerOverPanel.mockReturnValue(false);
    detector.update(session);

    expect(toggle).toHaveBeenCalledOnce();
  });
});
