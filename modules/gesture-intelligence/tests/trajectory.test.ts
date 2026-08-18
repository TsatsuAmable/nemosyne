import { describe, expect, it } from 'vitest';
import { TrajectoryBuffer } from '../src/trajectory.ts';
import type { HandSample } from '../src/contracts.ts';

function sample(hand: string, x: number, t: number, pinched = false): HandSample {
  return { hand, position: { x, y: 0, z: 0 }, pinched, timestamp: t };
}

describe('TrajectoryBuffer', () => {
  it('computes velocity from consecutive frames', () => {
    const buf = new TrajectoryBuffer();
    buf.push(sample('left', 0, 0));
    buf.push(sample('left', 0.1, 100));
    const frames = buf.frames('left');
    expect(frames[1].speed.x).toBeCloseTo(1.0, 5);
  });

  it('zeroes speed when dt <= 1ms', () => {
    const buf = new TrajectoryBuffer();
    buf.push(sample('left', 0, 0));
    buf.push(sample('left', 0.1, 1));
    expect(buf.frames('left')[1].speed.x).toBe(0);
  });

  it('bounds capacity per hand', () => {
    const buf = new TrajectoryBuffer(10);
    for (let i = 0; i < 50; i++) buf.push(sample('left', i, i * 100));
    expect(buf.frames('left').length).toBe(10);
    expect(buf.frames('left')[0].position.x).toBe(40);
  });

  it('tracks pinch flags and keeps hands separate', () => {
    const buf = new TrajectoryBuffer();
    buf.push(sample('left', 0, 0, true));
    buf.push(sample('right', 1, 0, false));
    expect(buf.frames('left')[0].pinched).toBe(true);
    expect(buf.frames('right')[0].pinched).toBe(false);
    expect(buf.hands()).toEqual(['left', 'right']);
  });

  it('clear empties all hands', () => {
    const buf = new TrajectoryBuffer();
    buf.push(sample('left', 0, 0));
    buf.clear();
    expect(buf.frames('left').length).toBe(0);
    expect(buf.hands().length).toBe(0);
  });
});
