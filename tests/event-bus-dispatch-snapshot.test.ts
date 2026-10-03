import { describe, expect, it, vi } from 'vitest';

import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';

describe('WorldEventBus dispatch topology', () => {
  it('delivers to a later handler even when an earlier once handler retires itself', () => {
    const bus = new WorldEventBus();
    const once = vi.fn();
    const later = vi.fn();
    bus.once(WorldTopics.INTERACTION_LOG, once);
    bus.on(WorldTopics.INTERACTION_LOG, later);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(once).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(once).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(2);
  });

  it('delivers to the successor of a handler that unsubscribes mid-dispatch', () => {
    const bus = new WorldEventBus();
    const first = vi.fn();
    const successor = vi.fn();
    const off = bus.on(WorldTopics.INTERACTION_LOG, () => {
      first();
      off();
    });
    bus.on(WorldTopics.INTERACTION_LOG, successor);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(first).toHaveBeenCalledTimes(1);
    expect(successor).toHaveBeenCalledTimes(1);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(first).toHaveBeenCalledTimes(1);
    expect(successor).toHaveBeenCalledTimes(2);
  });

  it('does not skip a successor when an unrelated earlier handler is removed by a third handler', () => {
    const bus = new WorldEventBus();
    const victim = vi.fn();
    const successor = vi.fn();
    const offVictim = bus.on(WorldTopics.INTERACTION_LOG, victim);
    bus.on(WorldTopics.INTERACTION_LOG, () => {
      offVictim();
    });
    bus.on(WorldTopics.INTERACTION_LOG, successor);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(victim).toHaveBeenCalledTimes(1);
    expect(successor).toHaveBeenCalledTimes(1);
  });

  it('applies removals from the next emit, not the in-flight one', () => {
    const bus = new WorldEventBus();
    const removed = vi.fn();
    const survivor = vi.fn();
    const off = bus.on(WorldTopics.INTERACTION_LOG, removed);
    bus.on(WorldTopics.INTERACTION_LOG, () => {
      off();
    });
    bus.on(WorldTopics.INTERACTION_LOG, survivor);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(removed).toHaveBeenCalledTimes(1);
    expect(survivor).toHaveBeenCalledTimes(1);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(removed).toHaveBeenCalledTimes(1);
    expect(survivor).toHaveBeenCalledTimes(2);
  });

  it('defers handlers registered during a dispatch to the next emit', () => {
    const bus = new WorldEventBus();
    const late = vi.fn();
    bus.on(WorldTopics.INTERACTION_LOG, () => {
      bus.on(WorldTopics.INTERACTION_LOG, late);
    });

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(late).toHaveBeenCalledTimes(0);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect handlers removed by removeAll during a dispatch', () => {
    const bus = new WorldEventBus();
    const doomed = vi.fn();
    const after = vi.fn();
    bus.on(WorldTopics.INTERACTION_LOG, () => {
      bus.removeAll(WorldTopics.INTERACTION_LOG);
      bus.on(WorldTopics.INTERACTION_LOG, after);
    });
    bus.on(WorldTopics.INTERACTION_LOG, doomed);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(doomed).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(0);

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(doomed).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('keeps isolating throwing handlers and preserves registration order', () => {
    const bus = new WorldEventBus();
    const order: string[] = [];
    bus.on(WorldTopics.INTERACTION_LOG, () => {
      order.push('a');
    });
    bus.on(WorldTopics.INTERACTION_LOG, () => {
      throw new Error('boom');
    });
    bus.on(WorldTopics.INTERACTION_LOG, () => {
      order.push('c');
    });

    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(order).toEqual(['a', 'c']);
  });
});