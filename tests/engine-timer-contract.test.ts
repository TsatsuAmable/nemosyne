import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '../src/vr/Engine.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Engine Timer contract', () => {
  it('keeps elapsed active-simulation time monotonic while excluding a paused wall-clock gap', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const timer = new THREE.Timer();

    timer.update(1100);
    expect(timer.getDelta()).toBeCloseTo(0.1, 6);
    expect(timer.getElapsed()).toBeCloseTo(0.1, 6);

    // Simulate a long pause. reset() moves only the delta baseline; THREE.Timer
    // intentionally preserves elapsed active-simulation time.
    nowSpy.mockReturnValue(5000);
    timer.reset();
    timer.update(5010);

    expect(timer.getDelta()).toBeCloseTo(0.01, 6);
    expect(timer.getElapsed()).toBeCloseTo(0.11, 6);
    timer.dispose();
  });

  it('uses Timer.reset() on initial start and resume, selecting the monotonic active-time contract', () => {
    const engine = new Engine();
    expect(engine.timer).toBeInstanceOf(THREE.Timer);
    const resetSpy = vi.spyOn(engine.timer, 'reset');

    engine.start();
    engine.pause();
    engine.start();

    expect(resetSpy).toHaveBeenCalledTimes(2);
    expect(engine.state).toBe('running');
    engine.dispose();
  });
});
