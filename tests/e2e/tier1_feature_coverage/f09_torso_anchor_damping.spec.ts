import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src/vr/Engine.ts';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';

describe('Feature 9: Torso Anchor Rotation Damping & Stability', () => {
  it('F9-TC1: WorldSceneComposer creates analystAnchor inside engine cameraGroup', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    expect(composer.analystAnchor).toBeDefined();
    expect(composer.analystAnchor.name).toBe('analystAnchor');
    expect(engine.cameraGroup.children).toContain(composer.analystAnchor);
    engine.dispose();
  });

  it('F9-TC2: analystAnchor updates position based on headset eye height (torso offset)', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    engine.camera.position.set(0, 1.8, 0);
    composer.update(0.016);

    expect(composer.analystAnchor.position.y).toBeCloseTo(1.55, 2); // 1.8 - 0.25
    engine.dispose();
  });

  it('F9-TC3: analystAnchor tracks headset yaw rotation while ignoring pitch and roll', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    engine.camera.rotation.set(0.5, 1.2, 0.1); // Pitch, Yaw, Roll

    // Damped tracking: after a single frame the yaw must move toward but not
    // snap to the target (eliminates micro-rotation jitter).
    composer.update(0.016);
    expect(composer.analystAnchor.rotation.y).toBeGreaterThan(0);
    expect(composer.analystAnchor.rotation.y).toBeLessThan(1.2);
    expect(composer.analystAnchor.rotation.x).toBe(0);
    expect(composer.analystAnchor.rotation.z).toBe(0);

    // After many frames the damped yaw converges to the headset target.
    for (let i = 0; i < 200; i++) composer.update(0.016);
    expect(composer.analystAnchor.rotation.y).toBeCloseTo(1.2, 1);
    expect(composer.analystAnchor.rotation.x).toBe(0);
    expect(composer.analystAnchor.rotation.z).toBe(0);
    engine.dispose();
  });

  it('F9-TC4: Rapid micro-rotation updates do not trigger pitch/roll instability', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);

    for (let i = 0; i < 20; i++) {
      engine.camera.rotation.set(Math.sin(i), i * 0.1, Math.cos(i));
      composer.update(0.016);
      expect(composer.analystAnchor.rotation.x).toBe(0);
      expect(composer.analystAnchor.rotation.z).toBe(0);
    }
    engine.dispose();
  });

  it('F9-TC5: Resetting camera position to origin realigns torso anchor smoothly', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    engine.camera.position.set(5, 1.6, -5);
    composer.update(0.016);

    engine.camera.position.set(0, 1.6, 0);
    composer.update(0.016);

    expect(composer.analystAnchor.position.x).toBe(0);
    expect(composer.analystAnchor.position.z).toBe(0);
    engine.dispose();
  });

  it('F9-TC6: analystAnchor yaw converges toward headset yaw via damped lerp rather than snapping', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    const targetYaw = 0.9;
    engine.camera.rotation.set(0, targetYaw, 0);

    // After one frame the yaw must be partway between the starting value (0)
    // and the target — proving damping, not instant snapping.
    composer.update(0.016);
    const oneFrameYaw = composer.analystAnchor.rotation.y;
    expect(oneFrameYaw).toBeGreaterThan(0);
    expect(oneFrameYaw).toBeLessThan(targetYaw);

    // Subsequent frames monotonically approach the target (no overshoot past it).
    let prev = oneFrameYaw;
    for (let i = 0; i < 50; i++) {
      composer.update(0.016);
      expect(composer.analystAnchor.rotation.y).toBeGreaterThanOrEqual(prev);
      expect(composer.analystAnchor.rotation.y).toBeLessThanOrEqual(targetYaw + 1e-6);
      prev = composer.analystAnchor.rotation.y;
    }

    // After enough frames the damped yaw converges to the headset target.
    for (let i = 0; i < 200; i++) composer.update(0.016);
    expect(composer.analystAnchor.rotation.y).toBeCloseTo(targetYaw, 2);
    engine.dispose();
  });
});
