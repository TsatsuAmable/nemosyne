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
