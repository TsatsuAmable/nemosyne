import { afterEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '../src/vr/Engine.ts';

interface EngineInternals {
  _lastFrameStartedAt: number;
  _handleSessionStart(): void;
}

class FakeXrSession extends EventTarget {
  visibilityState: XRVisibilityState = 'hidden';
  inputSources: XRInputSource[] = [];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Engine resume timing baseline', () => {
  it('resets timer and wall-frame baseline before resuming after WebGL context restoration', () => {
    const engine = new Engine();
    const internals = engine as unknown as EngineInternals;
    const reset = vi.spyOn(engine.timer, 'reset');
    internals._lastFrameStartedAt = 1234;
    engine.frameIntervalMs = 88;

    engine._contextLost(new Event('webglcontextlost', { cancelable: true }));
    reset.mockClear();
    engine._contextRestored();

    expect(reset).toHaveBeenCalledOnce();
    expect(internals._lastFrameStartedAt).toBe(0);
    expect(engine.frameIntervalMs).toBe(0);
    expect(engine.state).toBe('running');
    engine.dispose();
  });

  it('resets timer when an XR compositor session becomes visible again', () => {
    const engine = new Engine();
    const internals = engine as unknown as EngineInternals;
    const session = new FakeXrSession();
    vi.spyOn(engine.renderer.xr, 'getSession').mockReturnValue(session as unknown as XRSession);
    const reset = vi.spyOn(engine.timer, 'reset');

    internals._handleSessionStart();
    reset.mockClear();
    internals._lastFrameStartedAt = 4321;
    engine.frameIntervalMs = 77;

    session.visibilityState = 'visible';
    session.dispatchEvent(new Event('visibilitychange'));

    expect(reset).toHaveBeenCalledOnce();
    expect(internals._lastFrameStartedAt).toBe(0);
    expect(engine.frameIntervalMs).toBe(0);
    engine.dispose();
  });
});
