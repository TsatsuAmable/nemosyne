// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { DataConnector } from '../src/data/connectors/DataConnector.ts';

describe('DataConnector base', () => {
  it('emits updates to all registered listeners', () => {
    const conn = new DataConnector();
    const a = vi.fn();
    const b = vi.fn();

    conn.onUpdate(a);
    conn.onUpdate(b);
    conn._emitUpdate({ dataset: { rows: [] } });

    expect(a).toHaveBeenCalledWith({ dataset: { rows: [] } });
    expect(b).toHaveBeenCalledWith({ dataset: { rows: [] } });
  });

  it('unsubscribing removes a listener', () => {
    const conn = new DataConnector();
    const fn = vi.fn();
    const unsub = conn.onUpdate(fn);

    unsub();
    conn._emitUpdate({ dataset: { rows: [] } });

    expect(fn).not.toHaveBeenCalled();
  });

  it('tracks status and notifies listeners', () => {
    const conn = new DataConnector();
    const fn = vi.fn();
    conn.onStatus(fn);

    conn._setStatus('connecting');
    expect(conn.getStatus()).toBe('connecting');
    expect(fn).toHaveBeenCalledWith('connecting', undefined);

    conn._setStatus('error', 'boom');
    expect(conn.getStatus()).toBe('error');
    expect(fn).toHaveBeenLastCalledWith('error', 'boom');
  });

  it('requires subclasses to implement connect/disconnect', () => {
    const conn = new DataConnector();
    expect(() => conn.connect()).toThrow();
    expect(() => conn.disconnect()).toThrow();
  });
});
