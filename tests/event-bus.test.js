import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.js';

describe('WorldEventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new WorldEventBus();
  });

  it('emits to registered handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(WorldTopics.OPERATION_APPLIED, h1);
    bus.on(WorldTopics.OPERATION_APPLIED, h2);

    bus.emit(WorldTopics.OPERATION_APPLIED, { operation: 'filter' });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h1).toHaveBeenCalledWith({ operation: 'filter' });
    expect(h2).toHaveBeenCalledWith({ operation: 'filter' });
  });

  it('unsubscribes via returned function', () => {
    const h = vi.fn();
    const unsubscribe = bus.on(WorldTopics.SETTINGS_CHANGED, h);

    unsubscribe();
    bus.emit(WorldTopics.SETTINGS_CHANGED, { key: 'theme' });

    expect(h).not.toHaveBeenCalled();
  });

  it('unsubscribes via off', () => {
    const h = vi.fn();
    bus.on(WorldTopics.GESTURE_RECOGNIZED, h);
    bus.off(WorldTopics.GESTURE_RECOGNIZED, h);
    bus.emit(WorldTopics.GESTURE_RECOGNIZED, { name: 'pinch' });

    expect(h).not.toHaveBeenCalled();
  });

  it('removes all handlers when removeAll is called with no topic', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(WorldTopics.OPERATION_APPLIED, h1);
    bus.on(WorldTopics.DATASET_LOADED, h2);

    bus.removeAll();
    bus.emit(WorldTopics.OPERATION_APPLIED);
    bus.emit(WorldTopics.DATASET_LOADED);

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('removes only handlers for the given topic', () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on(WorldTopics.OPERATION_APPLIED, a);
    bus.on(WorldTopics.DATASET_LOADED, b);

    bus.removeAll(WorldTopics.OPERATION_APPLIED);
    bus.emit(WorldTopics.OPERATION_APPLIED);
    bus.emit(WorldTopics.DATASET_LOADED);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('once handlers only fire once', () => {
    const h = vi.fn();
    bus.once(WorldTopics.HISTORY_SEEK, h);

    bus.emit(WorldTopics.HISTORY_SEEK, { index: 1 });
    bus.emit(WorldTopics.HISTORY_SEEK, { index: 2 });

    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith({ index: 1 });
  });

  it('reports listener count', () => {
    bus.on(WorldTopics.OPERATION_APPLIED, () => {});
    bus.on(WorldTopics.OPERATION_APPLIED, () => {});

    expect(bus.listenerCount(WorldTopics.OPERATION_APPLIED)).toBe(2);
    expect(bus.listenerCount(WorldTopics.DATASET_LOADED)).toBe(0);
  });

  it('does not break when emitting an unknown topic', () => {
    expect(() => bus.emit('unknown-topic', 42)).not.toThrow();
  });

  it('does not let one handler crash the others', () => {
    const bad = vi.fn().mockImplementation(() => {
      throw new Error('boom');
    });
    const good = vi.fn();

    bus.on(WorldTopics.OPERATION_APPLIED, bad);
    bus.on(WorldTopics.OPERATION_APPLIED, good);

    expect(() => bus.emit(WorldTopics.OPERATION_APPLIED)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid topics', () => {
    expect(() => bus.on('', () => {})).toThrow();
    expect(() => bus.on(123, () => {})).toThrow();
    expect(() => bus.emit('', {})).toThrow();
  });

  it('rejects non-function handlers', () => {
    expect(() => bus.on(WorldTopics.OPERATION_APPLIED, null)).toThrow();
    expect(() => bus.on(WorldTopics.OPERATION_APPLIED, 'not-a-function')).toThrow();
  });
});
