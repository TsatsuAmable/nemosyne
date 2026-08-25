import { describe, expect, it } from 'vitest';
import { CaptureRecorder, serializeRawJsonl, type RawInstance } from '../../src/gesture/capture.ts';
import type { HandSample } from '../../src/gesture/contracts.ts';

function sample(hand: 'left' | 'right', i: number, pinched = false): HandSample {
  return {
    hand,
    position: { x: hand === 'left' ? 0 : 0.4, y: 1 + i * 0.01, z: 0 },
    pinched,
    timestamp: i * (1000 / 60),
  };
}

describe('CaptureRecorder', () => {
  it('mirrors left/right samples into a labeled raw instance on stop', () => {
    const rec = new CaptureRecorder();
    expect(rec.isArmed()).toBe(false);
    rec.arm('scoopUp');
    expect(rec.isArmed()).toBe(true);
    for (let i = 0; i < 20; i++) {
      rec.record(sample('left', i));
      rec.record(sample('right', i));
    }
    const inst = rec.stop();
    expect(inst).not.toBeNull();
    expect(inst!.label).toBe('scoopUp');
    expect(inst!.left.length).toBe(20);
    expect(inst!.right.length).toBe(20);
    expect(inst!.left[0].t).toBe(0);
    expect(inst!.right[19].y).toBeCloseTo(1 + 19 * 0.01, 5);
    expect(rec.isArmed()).toBe(false);
  });

  it('ignores samples when not armed', () => {
    const rec = new CaptureRecorder();
    for (let i = 0; i < 5; i++) rec.record(sample('left', i));
    expect(rec.stop()).toBeNull();
  });

  it('stop with only one hand recorded returns null', () => {
    const rec = new CaptureRecorder();
    rec.arm('pinchTogether');
    for (let i = 0; i < 5; i++) rec.record(sample('left', i));
    expect(rec.stop()).toBeNull();
  });

  it('arm resets any in-progress capture', () => {
    const rec = new CaptureRecorder();
    rec.arm('scoopUp');
    for (let i = 0; i < 5; i++) rec.record(sample('left', i));
    rec.arm('pinchApart');
    expect(rec.stop()).toBeNull();
  });

  it('serializeRawJsonl produces the raw_*.jsonl schema', () => {
    const rec = new CaptureRecorder();
    rec.arm('bothPinched');
    for (let i = 0; i < 3; i++) {
      rec.record(sample('left', i, true));
      rec.record(sample('right', i, true));
    }
    const inst = rec.stop() as RawInstance;
    const text = serializeRawJsonl([inst]);
    const line = text.trim().split('\n')[0];
    const parsed = JSON.parse(line) as { left: unknown[]; right: unknown[]; label: string };
    expect(parsed.label).toBe('bothPinched');
    expect(parsed.left.length).toBe(3);
    expect(parsed.right.length).toBe(3);
    expect(parsed.left[0]).toMatchObject({ x: 0, y: 1, z: 0, pinched: true, t: 0 });
  });
});