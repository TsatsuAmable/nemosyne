import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src/vr/Engine.ts';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';

describe('Feature 9: Stable Body-Frame Heading & Position', () => {
  it('F9-TC1: WorldSceneComposer creates analystAnchor inside engine cameraGroup', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    expect(composer.analystAnchor).toBeDefined();
    expect(composer.analystAnchor.name).toBe('analystAnchor');
    expect(engine.cameraGroup.children).toContain(composer.analystAnchor);
    engine.dispose();
  });

  it('F9-TC2: analystAnchor derives torso height from the current viewer eye height', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    engine.camera.position.set(0, 1.8, 0);
    composer.update(0.016);

    expect(composer.analystAnchor.position.y).toBeCloseTo(1.55, 2);
    engine.dispose();
  });

  it('F9-TC3: initial body heading aligns with viewer yaw while ignoring pitch and roll', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    engine.camera.rotation.set(0.5, 1.2, 0.1);

    composer.update(0.016);
    expect(composer.analystAnchor.rotation.y).toBeCloseTo(1.2, 1);
    expect(composer.analystAnchor.rotation.x).toBe(0);
    expect(composer.analystAnchor.rotation.z).toBe(0);
    engine.dispose();
  });

  it('F9-TC4: rapid gaze micro-rotations inside the deadband do not swim the workspace', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    composer.update(1 / 72);
    const baseline = composer.analystAnchor.rotation.y;

    for (let i = 0; i < 120; i++) {
      engine.camera.rotation.set(
        Math.sin(i) * 0.2,
        Math.sin(i * 0.3) * 0.15,
        Math.cos(i) * 0.2
      );
      composer.update(1 / 72);
      expect(composer.analystAnchor.rotation.x).toBe(0);
      expect(composer.analystAnchor.rotation.z).toBe(0);
    }

    expect(composer.analystAnchor.rotation.y).toBeCloseTo(baseline, 5);
    engine.dispose();
  });

  it('F9-TC5: physical headset X/Z translation does not translate the body frame', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);
    engine.camera.position.set(0, 1.6, 0);
    composer.update(0.016);

    engine.camera.position.set(5, 1.6, -5);
    composer.update(0.016);

    expect(composer.analystAnchor.position.x).toBeCloseTo(0, 6);
    expect(composer.analystAnchor.position.z).toBeCloseTo(0, 6);
    engine.dispose();
  });

  it('F9-TC6: accepted heading damping is approximately frame-rate independent', () => {
    const engine72 = new Engine();
    const engine36 = new Engine();
    const composer72 = new WorldSceneComposer(engine72);
    const composer36 = new WorldSceneComposer(engine36);
    composer72.update(1 / 72);
    composer36.update(1 / 36);

    engine72.camera.rotation.y = 1.2;
    engine36.camera.rotation.y = 1.2;
    for (let i = 0; i < 72; i++) composer72.update(1 / 72);
    for (let i = 0; i < 36; i++) composer36.update(1 / 36);

    expect(composer72.analystAnchor.rotation.y).toBeGreaterThan(0.8);
    expect(composer36.analystAnchor.rotation.y).toBeGreaterThan(0.8);
    expect(composer72.analystAnchor.rotation.y).toBeCloseTo(
      composer36.analystAnchor.rotation.y,
      2
    );
    engine72.dispose();
    engine36.dispose();
  });
});
