import { describe, it, expect } from 'vitest';

/**
 * Contract test for the GLOBAL WebGL mock in tests/setup.js (installed via
 * vitest config setupFiles, so every test in the suite runs under it).
 *
 * Locks the additive-only invariant established by the Option 3c fix:
 *   - getExtension stays null — this is what keeps three.js capability branches
 *     (instanced rendering, float render targets) OFF under a semantics-free
 *     mock. The single most important assertion in this file: a future PR that
 *     flips getExtension non-null would activate those branches under a mock
 *     with no GL semantics to validate them, and this test catches it.
 *   - the backfilled GL constants three.js reads from gl.<NAME> are present
 *     with correct hex values.
 *   - getParameter(gl.MAX_*) resolves to realistic numbers (needs both the
 *     named constant and the params entry).
 *   - ctx.canvas is the canvas (or null), NOT globalThis — the `canvas: this`
 *     bug fix (makeWebGLContext used to be a bare call so `this` was globalThis).
 *
 * Pure contract test on the mock — no three.js, no World.
 */
describe('tests/setup.js global WebGL mock contract', () => {
  function makeCtx() {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2');
  }

  it('keeps getExtension null (capability-branch-off invariant)', () => {
    const gl = makeCtx();
    // These are the extensions whose presence would activate three.js capability
    // branches with real behavioural consequences under a mock with no semantics.
    expect(gl.getExtension('ANGLE_instanced_arrays')).toBeNull();
    expect(gl.getExtension('OES_texture_float')).toBeNull();
    expect(gl.getExtension('EXT_color_buffer_float')).toBeNull();
    expect(gl.getSupportedExtensions()).toEqual([]);
  });

  it('exposes the backfilled GL enums three.js reads from gl.<NAME>', () => {
    const gl = makeCtx();
    // three.js reads these directly off the context object.
    expect(gl.FRAGMENT_SHADER).toBe(0x8b30);
    expect(gl.VERTEX_SHADER).toBe(0x8b31);
    expect(gl.COMPILE_STATUS).toBe(0x8b81);
    expect(gl.LINK_STATUS).toBe(0x8b82);
    expect(gl.UNPACK_FLIP_Y_WEBGL).toBe(0x9240);
    expect(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL).toBe(0x9241);
    expect(gl.RGBA).toBe(0x1908);
    expect(gl.RGB).toBe(0x1907);
    // Cosmetic parity with the harness mock (three.js uses its own StaticDrawUsage
    // module constant, not gl.STATIC_DRAW, but presence is harmless).
    expect(gl.STATIC_DRAW).toBe(0x88e4);
    expect(gl.DYNAMIC_DRAW).toBe(0x88e8);
    expect(gl.STREAM_DRAW).toBe(0x88e0);
  });

  it('resolves getParameter(gl.MAX_*) to realistic numbers (constant + params entry)', () => {
    const gl = makeCtx();
    // Both the named constant AND the params[hex] entry are required so
    // getParameter(gl.MAX_*) resolves the enum and returns a number, not
    // getParameter(undefined) -> 0.
    expect(gl.MAX_VARYING_VECTORS).toBe(0x8b4c);
    expect(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS).toBe(0x8871);
    expect(gl.MAX_RENDERBUFFER_SIZE).toBe(0x8f41);
    expect(gl.getParameter(gl.MAX_VARYING_VECTORS)).toBe(1024);
    expect(gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)).toBe(16);
    expect(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)).toBe(2048);
  });

  it('does not leak globalThis as ctx.canvas (the canvas: this bug fix)', () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    // The old `canvas: this` made ctx.canvas === globalThis (bare function call,
    // non-strict). The fix passes the real canvas through; it must be the canvas
    // element or null, never the global object.
    expect(gl.canvas).not.toBe(globalThis);
    expect(gl.canvas === canvas || gl.canvas === null).toBe(true);
  });
});