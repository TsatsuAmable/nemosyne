import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../../../src/vr/World.js';
import {
  getWebGLMockStats,
  getWebGLMockCalls,
  resetWebGLMockStats,
} from '../harness/webgl_mock.js';

// Importing setup.ts activates the harness WebGL/WebXR mocks (overriding the
// global no-op mock from tests/setup.js) and resets mock stats — exactly the
// f13/f15 pattern. This is the only test lane that drives a real renderer.render()
// frame through the populated default scene.
import '../setup.js';

describe('Feature 16: Render-Loop GL Introspection (jsdom tripwire)', () => {
  let world: World | null = null;

  afterEach(() => {
    world?.dispose();
    world = null;
    resetWebGLMockStats();
  });

  it('F16-TC1: a real renderer.render() frame through the populated default scene drives GL program/buffer creation and a non-zero draw call', () => {
    // new World() auto-loads the default supply-chain hierarchy dataset, so the
    // scene contains Draco artefact meshes (geometry + materials) at boot.
    world = new World();
    const engine = world.engine;

    // Attribute GL activity to the render frame rather than construction.
    resetWebGLMockStats();

    // Drive one frame through the real three.js render path (the f08 pattern).
    // We call _tick() directly instead of world.start() because requestAnimationFrame
    // does not fire in jsdom without fake timers, making the setAnimationLoop path
    // flaky. _tick() calls renderer.render(scene, camera) unconditionally.
    expect(() => engine._tick()).not.toThrow();

    // (1) The renderer traversed the scene: materials "compiled" (programs) and
    //     geometry "uploaded" (buffers) through the mock. createdPrograms is the
    //     stronger signal — buffers can be reused/cached across frames.
    const stats = getWebGLMockStats();
    expect(stats.createdPrograms).toBeGreaterThan(0);
    expect(stats.createdBuffers).toBeGreaterThan(0);

    // (2) A non-zero draw fired — trips "render loop ran but drew nothing"
    //     regressions (e.g. a future frustum/visibility bug that empties the
    //     boot scene). count is the vertex/index count of the draw.
    const calls = getWebGLMockCalls();
    const drawNames = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'];
    const drawCalls = calls.filter((c) => drawNames.includes(c.name));
    expect(drawCalls.length).toBeGreaterThan(0);
    expect(drawCalls.some((c) => (c.count ?? 0) > 0)).toBe(true);
  });
});