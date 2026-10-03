import { describe, expect, it, vi } from 'vitest';

import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';

describe('RFL cycle 11: event-bus dispatch-order topology', () => {
  it('control: multiple persistent handlers all fire on the same emit', () => {
    const bus = new WorldEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on(WorldTopics.INTERACTION_LOG, a);
    bus.on(WorldTopics.INTERACTION_LOG, b);
    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('control: once fires and is removed only after its first emit', () => {
    const bus = new WorldEventBus();
    const once = vi.fn();
    bus.once(WorldTopics.INTERACTION_LOG, once);
    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(once).toHaveBeenCalledTimes(1);
  });

  // Skipped while RFL-0007 is an open candidate finding. A once wrapper
  // removes itself (splice) for every emit, shifting indices of the live
  // list the dispatch loop is iterating - so a once handler registered
  // before a later persistent handler suppresses that later handler on the
  // first emit. Self-unsubscribe mid-dispatch does the same to its
  // successors. Unskip to re-verify after snapshot-based dispatch lands.
  it.skip('once does not suppress a later handler on the first emit', () => {
    const bus = new WorldEventBus();
    const once = vi.fn();
    const later = vi.fn();
    bus.once(WorldTopics.INTERACTION_LOG, once);
    bus.on(WorldTopics.INTERACTION_LOG, later);
    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(once).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it.skip('a mid-dispatch off does not skip the handler registered after it', () => {
    const bus = new WorldEventBus();
    const offEarly = vi.fn();
    const successor = vi.fn();
    const off = bus.on(WorldTopics.INTERACTION_LOG, () => {
      offEarly();
      off();
    });
    bus.on(WorldTopics.INTERACTION_LOG, successor);
    bus.emit(WorldTopics.INTERACTION_LOG, 'x');
    expect(offEarly).toHaveBeenCalledTimes(1);
    expect(successor).toHaveBeenCalledTimes(1);
  });
});
