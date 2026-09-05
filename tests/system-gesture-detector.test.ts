// @ts-nocheck
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

/** Hands carrying fingertip heights, exercising the reach-zone (y > 1.5) branch. */
function registryWithHeights(
  heights: Array<{ y: number; pinched: boolean }>,
  isBestPointerOverPanel = false
) {
  const handPointers = heights.map((hand) => ({
    isPinched: () => hand.pinched,
    rayOrigin: { y: hand.y },
  }));
  return {
    hands: handPointers,
    controllers: [],
    lastBothPinched: false,
    controllerGripPressed: new Map(),
    isBestPointerOverPanel: vi.fn(() => isBestPointerOverPanel),
    findSourceForController: vi.fn(() => null),
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

describe('SystemGestureDetector reach-zone suppression (y > 1.5)', () => {
  it('withholds the toggle and traces suppression while either hand is high', () => {
    let now = 0;
    const pointers = registryWithHeights([
      { y: 1.58, pinched: true },
      { y: 1.08, pinched: true },
    ]);
    const detector = new SystemGestureDetector(pointers, {
      bothPinchHoldMs: 400,
      toggleCooldownMs: 0,
      now: () => now,
    });
    const toggle = vi.fn();
    const traces: Array<{ kind: string }> = [];
    const hints: string[] = [];
    detector.onSystemToggle = toggle;
    detector.onTrace = (info) => traces.push(info);
    detector.onSuppressedHint = (hint) => hints.push(hint);

    // Hold past the both-pinch hold time: toggle must still be withheld.
    detector.update(null);
    now = 500;
    const result = detector.update(null);

    expect(toggle).not.toHaveBeenCalled();
    expect(result.suppressSelection).toBe(false);
    expect(result.bothPinched).toBe(false);
    expect(traces).toEqual([{ kind: 'both-pinch-suppressed', y0: 1.58, y1: 1.08 }]);
    expect(hints).toHaveLength(1);
  });

  it('treats the 1.5 boundary as strictly greater (no suppression at exactly 1.5)', () => {
    let now = 0;
    const pointers = registryWithHeights([
      { y: 1.5, pinched: true },
      { y: 1.5, pinched: true },
    ]);
    const detector = new SystemGestureDetector(pointers, {
      bothPinchHoldMs: 0,
      toggleCooldownMs: 0,
      now: () => now,
    });
    const toggle = vi.fn();
    detector.onSystemToggle = toggle;

    detector.update(null);
    now = 1;
    const result = detector.update(null);

    expect(result.bothPinched).toBe(true);
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('latches suppression until release: lowering mid-hold does not arm the toggle', () => {
    let now = 0;
    const heights = [
      { y: 1.6, pinched: true },
      { y: 1.1, pinched: true },
    ];
    const pointers = registryWithHeights(heights);
    const detector = new SystemGestureDetector(pointers, {
      bothPinchHoldMs: 400,
      toggleCooldownMs: 0,
      now: () => now,
    });
    const toggle = vi.fn();
    detector.onSystemToggle = toggle;
    const hands = (pointers as unknown as { hands: Array<{ rayOrigin: { y: number } }> }).hands;

    detector.update(null);
    expect(toggle).not.toHaveBeenCalled();

    // Both hands lower while STILL holding: the suppressed start latches the
    // attempt invalid until release, so no toggle arms.
    hands[0].rayOrigin.y = 1.2;
    now = 500;
    detector.update(null);
    expect(toggle).not.toHaveBeenCalled();

    // Release and re-pinch low: the fresh attempt holds and fires.
    heights[0].pinched = false;
    heights[1].pinched = false;
    now = 600;
    detector.update(null);
    heights[0].pinched = true;
    heights[1].pinched = true;
    now = 700;
    detector.update(null);
    expect(toggle).not.toHaveBeenCalled();
    now = 1100;
    detector.update(null);
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('requires both hands present before zone suppression can engage', () => {
    const pointers = registryWithHeights([{ y: 1.9, pinched: true }]);
    const detector = new SystemGestureDetector(pointers, {
      bothPinchHoldMs: 0,
      toggleCooldownMs: 0,
      now: () => 0,
    });
    const traces: Array<{ kind: string }> = [];
    detector.onTrace = (info) => traces.push(info);

    const result = detector.update(null);

    expect(result.suppressSelection).toBe(false);
    expect(result.bothPinched).toBe(false);
    expect(traces).toEqual([]);
  });
});
