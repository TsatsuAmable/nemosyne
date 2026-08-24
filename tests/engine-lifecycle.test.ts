// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Engine } from '../src/vr/Engine.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';

describe('Engine Lifecycle & Invariant Hardening', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('cleans up all window resize and WebGL context listeners on dispose()', () => {
    const engine = new Engine();
    expect(engine.state).toBe('running');

    // Verify window.resize listener was registered
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    engine.dispose();
    expect(engine.state).toBe('disposed');

    // Verify window.resize listener was removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('satisfies disposal invariant across multiple sequential instantiation cycles without leaking DOM elements', () => {
    const initialDomCount = document.body.children.length;

    for (let i = 0; i < 5; i++) {
      const engine = new Engine();
      engine.start();
      expect(engine.state).toBe('running');
      engine.dispose();
      expect(engine.state).toBe('disposed');
    }

    // Dom elements appended by renderer should be cleanly removed
    expect(document.body.children.length).toBe(initialDomCount);
  });

  it('manages explicit engine state transitions on WebGL context loss and restoration', () => {
    const engine = new Engine();
    engine.start();
    expect(engine.state).toBe('running');

    // Context loss
    const preventDefaultSpy = vi.fn();
    engine._contextLost({ preventDefault: preventDefaultSpy } as unknown as Event);
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(engine.state).toBe('context_lost');

    // Context restoration
    engine._contextRestored();
    expect(engine.state).toBe('running');

    engine.dispose();
    expect(engine.state).toBe('disposed');
  });

  it('uses a Set for updatables, deduplicating registrations and clearing on dispose', () => {
    const engine = new Engine();
    let tickCount = 0;
    const task = () => {
      tickCount++;
    };

    engine.addUpdatable(task);
    engine.addUpdatable(task); // duplicate

    expect(engine.updatables.size).toBe(1);

    engine._tick();
    expect(tickCount).toBe(1);

    engine.removeUpdatable(task);
    expect(engine.updatables.size).toBe(0);

    engine.addUpdatable(task);
    engine.dispose();
    expect(engine.updatables.size).toBe(0);
  });

  it('start() is idempotent: repeated calls do not re-register the sessionstart listener', () => {
    const engine = new Engine();
    const xrAddSpy = vi.spyOn(engine.renderer.xr, 'addEventListener');
    const setLoopSpy = vi.spyOn(engine.renderer, 'setAnimationLoop');

    engine.start();
    const firstSessionStartCount = xrAddSpy.mock.calls.filter(
      (c) => c[0] === 'sessionstart'
    ).length;
    expect(firstSessionStartCount).toBe(1);

    // Repeated start() must be a no-op: no new sessionstart registration.
    engine.start();
    engine.start();
    const repeatedSessionStartCount = xrAddSpy.mock.calls.filter(
      (c) => c[0] === 'sessionstart'
    ).length;
    expect(repeatedSessionStartCount).toBe(1);

    // setAnimationLoop may be called again but the listener must not duplicate.
    setLoopSpy.mockRestore();
    xrAddSpy.mockRestore();
    engine.dispose();
  });

  it('pause() is idempotent and a resumed start does not duplicate XR listeners', () => {
    const engine = new Engine();
    const xrAddSpy = vi.spyOn(engine.renderer.xr, 'addEventListener');
    const setLoopSpy = vi.spyOn(engine.renderer, 'setAnimationLoop');

    engine.start();
    engine.pause();
    engine.pause();

    expect(engine.state).toBe('paused');
    expect(setLoopSpy).toHaveBeenLastCalledWith(null);

    engine.start();
    expect(engine.state).toBe('running');
    expect(xrAddSpy.mock.calls.filter((call) => call[0] === 'sessionstart')).toHaveLength(1);
    engine.dispose();
  });

  it('dispose() is idempotent and releases renderer resources once', () => {
    const engine = new Engine();
    const rendererDispose = vi.spyOn(engine.renderer, 'dispose');
    const themeDispose = vi.spyOn(engine.theme, 'dispose');

    engine.dispose();
    engine.dispose();

    expect(rendererDispose).toHaveBeenCalledOnce();
    expect(themeDispose).toHaveBeenCalledOnce();
    expect(engine.state).toBe('disposed');
  });

  it('_contextRestored() is a no-op after dispose() and cannot resurrect the engine', () => {
    const engine = new Engine();
    engine.start();
    const setLoopSpy = vi.spyOn(engine.renderer, 'setAnimationLoop');

    engine.dispose();
    expect(engine.state).toBe('disposed');

    // A late context-restored event must not un-dispose the engine or restart
    // the animation loop.
    setLoopSpy.mockClear();
    engine._contextRestored();
    expect(engine.state).toBe('disposed');
    expect(setLoopSpy).not.toHaveBeenCalled();

    setLoopSpy.mockRestore();
  });

  it('exitVR() resolves to true on clean exit and false on session.end() failure', async () => {
    const engine = new Engine();
    // No active session → treated as already-exited.
    vi.spyOn(engine.renderer.xr, 'getSession').mockReturnValue(null);
    await expect(engine.exitVR()).resolves.toBe(true);

    // Active session ending cleanly → true.
    const okSession = { end: vi.fn().mockResolvedValue(undefined) };
    engine.renderer.xr.getSession.mockReturnValue(okSession);
    await expect(engine.exitVR()).resolves.toBe(true);
    expect(okSession.end).toHaveBeenCalledTimes(1);

    // Active session whose end() rejects → false (caller can surface failure).
    const failSession = { end: vi.fn().mockRejectedValue(new Error('boom')) };
    engine.renderer.xr.getSession.mockReturnValue(failSession);
    await expect(engine.exitVR()).resolves.toBe(false);

    engine.dispose();
  });

  it('retains the XR visibilitychange handler and detaches it on dispose()', () => {
    const engine = new Engine();
    const removeSpies: ReturnType<typeof vi.fn>[] = [];
    const mockSession = {
      addEventListener: vi.fn((_type: string, handler: (e: unknown) => void) => {
        // stash a remove spy keyed off the handler so we can assert detach.
        const remove = vi.fn();
        (mockSession as unknown as { _lastHandler: unknown })._lastHandler = handler;
        removeSpies.push(remove);
      }),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    };
    vi.spyOn(engine.renderer.xr, 'getSession').mockReturnValue(mockSession as unknown as XRSession);

    // Trigger sessionstart → _handleSessionStart installs a retained handler.
    engine['_handleSessionStart']();
    expect(mockSession.addEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
    const visibilityHandler = mockSession.addEventListener.mock.calls.find(
      (c) => c[0] === 'visibilitychange'
    )?.[1];

    engine.dispose();
    // dispose() must detach the retained visibility handler from the session.
    expect(mockSession.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      visibilityHandler
    );
  });
});

describe('Typed WorldEventBus', () => {
  it('correctly dispatches and unsubscribes typed event handlers', () => {
    const bus = new WorldEventBus();
    const mockHandler = vi.fn();

    const unsubscribe = bus.on(WorldTopics.PERFORMANCE_THROTTLE, mockHandler);
    expect(bus.listenerCount(WorldTopics.PERFORMANCE_THROTTLE)).toBe(1);

    bus.emit(WorldTopics.PERFORMANCE_THROTTLE, { fps: 45, budgetMs: 11.11 });
    expect(mockHandler).toHaveBeenCalledWith({ fps: 45, budgetMs: 11.11 });

    unsubscribe();
    expect(bus.listenerCount(WorldTopics.PERFORMANCE_THROTTLE)).toBe(0);

    bus.emit(WorldTopics.PERFORMANCE_THROTTLE, { fps: 60, budgetMs: 11.11 });
    expect(mockHandler).toHaveBeenCalledOnce();
  });
});
