import { describe, it, expect } from 'vitest';
import { SpatialTweenManager } from '../src/vr/animation/SpatialTween.ts';

describe('Spatial Animation Engine (@tweenjs/tween.js)', () => {
  it('animates 3D coordinates deterministically with cubic easing', () => {
    const manager = new SpatialTweenManager();
    const object = { position: { x: 0, y: 0, z: 0 } };

    let completed = false;
    manager.animatePosition(
      object,
      { x: 10, y: 20, z: 30 },
      {
        durationMs: 1000,
        startTimeMs: 0,
        onComplete: () => {
          completed = true;
        },
      }
    );

    expect(manager.activeCount).toBe(1);

    // Step at 0ms
    manager.update(0);
    expect(object.position.x).toBe(0);

    // Step halfway at 500ms
    manager.update(500);
    expect(object.position.x).toBeGreaterThan(0);
    expect(object.position.x).toBeLessThan(10);

    // Step to completion at 1000ms
    manager.update(1000);
    expect(object.position.x).toBe(10);
    expect(object.position.y).toBe(20);
    expect(object.position.z).toBe(30);
    expect(completed).toBe(true);
  });

  it('animates scalar numbers smoothly', () => {
    const manager = new SpatialTweenManager();
    const target = { value: 0 };

    manager.animateScalar(target, 1.0, { durationMs: 500, startTimeMs: 0 });
    manager.update(0);
    expect(target.value).toBe(0);

    manager.update(500);
    expect(target.value).toBe(1.0);
  });
});
