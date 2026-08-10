import { describe, it, expect } from 'vitest';
import { WorldEventBus, WorldTopics } from '../../../src/utils/EventBus.js';
import { getUnhandledRejections, clearUnhandledRejections } from '../setup.js';

describe('Feature 13: 0 Unhandled Rejections & Memory Leak Traps', () => {
  it('F13-TC1: WorldEventBus catches errors in subscriber handlers without breaking execution', () => {
    const eventBus = new WorldEventBus();
    let secondHandlerFired = false;

    eventBus.on(WorldTopics.INTERACTION, () => {
      throw new Error('Failing handler test');
    });

    eventBus.on(WorldTopics.INTERACTION, () => {
      secondHandlerFired = true;
    });

    expect(() => {
      eventBus.emit(WorldTopics.INTERACTION, { type: 'click' });
    }).not.toThrow();

    expect(secondHandlerFired).toBe(true);
  });

  it('F13-TC2: Async promise rejections handled in try/catch return empty rejection list', async () => {
    clearUnhandledRejections();

    const safeAsync = async () => {
      try {
        await Promise.reject(new Error('Handled error'));
      } catch {
        // Handled
      }
    };

    await safeAsync();
    expect(getUnhandledRejections().length).toBe(0);
  });

  it('F13-TC3: EventBus listener unsubscription removes handler cleanly', () => {
    const eventBus = new WorldEventBus();
    let callCount = 0;
    const unsub = eventBus.on('test:topic', () => {
      callCount++;
    });

    eventBus.emit('test:topic');
    expect(callCount).toBe(1);

    unsub();
    eventBus.emit('test:topic');
    expect(callCount).toBe(1);
    expect(eventBus.listenerCount('test:topic')).toBe(0);
  });

  it('F13-TC4: WorldEventBus.removeAll() purges all registered handlers', () => {
    const eventBus = new WorldEventBus();
    eventBus.on('topic:a', () => {});
    eventBus.on('topic:b', () => {});

    eventBus.removeAll();
    expect(eventBus.listenerCount('topic:a')).toBe(0);
    expect(eventBus.listenerCount('topic:b')).toBe(0);
  });

  it('F13-TC5: Repeated error emissions do not corrupt bus state or swallow subsequent events', () => {
    const eventBus = new WorldEventBus();
    let receivedPayload: any = null;

    eventBus.on('test:resilience', () => {
      throw new Error('Err');
    });
    eventBus.on('test:resilience', (p) => {
      receivedPayload = p;
    });

    for (let i = 0; i < 5; i++) {
      eventBus.emit('test:resilience', { run: i });
    }

    expect(receivedPayload).toEqual({ run: 4 });
  });
});
