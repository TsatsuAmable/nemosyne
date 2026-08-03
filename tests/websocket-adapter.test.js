// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketAdapter } from '../src/data/connectors/WebSocketAdapter.js';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = CONNECTING;
    this.listeners = {};
    this.sent = [];
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  dispatch(type, event = {}) {
    (this.listeners[type] || []).forEach((fn) => fn(event));
  }

  dispatchMessage(data) {
    this.dispatch('message', { data });
  }

  open() {
    this.readyState = OPEN;
    this.dispatch('open', {});
  }

  close() {
    this.readyState = CLOSED;
    this.dispatch('close', {});
  }

  error(message) {
    this.dispatch('error', { message });
  }

  send(data) {
    this.sent.push(data);
  }
}

describe('WebSocketAdapter', () => {
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it('requires a url', () => {
    expect(() => new WebSocketAdapter()).toThrow('url');
  });

  it('connects and emits statuses', () => {
    const adapter = new WebSocketAdapter({ url: 'wss://example.com/stream' });
    const statusSpy = vi.fn();
    adapter.onStatus(statusSpy);

    adapter.connect();
    expect(statusSpy).toHaveBeenLastCalledWith('connecting', undefined);

    adapter._ws.open();
    expect(statusSpy).toHaveBeenLastCalledWith('connected', undefined);
    expect(adapter.isConnected()).toBe(true);
  });

  it('normalizes a rows-only message into a dataset update', () => {
    const adapter = new WebSocketAdapter({ url: 'wss://example.com/stream' });
    const updateSpy = vi.fn();
    adapter.onUpdate(updateSpy);

    adapter.connect();
    adapter._ws.open();
    adapter._ws.dispatchMessage(
      JSON.stringify({
        topology: 'TIME_SERIES',
        rows: [{ time: '2026-07-28T12:00:00Z', sensorId: 'alpha', temperature: 22.5 }],
      })
    );

    expect(updateSpy).toHaveBeenCalledOnce();
    const update = updateSpy.mock.calls[0][0];
    expect(update.topology).toBe('TIME_SERIES');
    expect(update.mode).toBe('window');
    expect(update.dataset.rows.length).toBe(1);
    expect(update.dataset.columns.map((c) => c.name)).toContain('temperature');
  });

  it('emits an error for invalid JSON', () => {
    const adapter = new WebSocketAdapter({ url: 'wss://example.com/stream' });
    const statusSpy = vi.fn();
    adapter.onStatus(statusSpy);

    adapter.connect();
    adapter._ws.open();
    adapter._ws.dispatchMessage('not-json');

    expect(statusSpy).toHaveBeenLastCalledWith('error', expect.stringContaining('Invalid JSON'));
  });

  it('disconnects and prevents reconnect', () => {
    vi.useFakeTimers();
    const adapter = new WebSocketAdapter({ url: 'wss://example.com/stream', reconnect: true });

    adapter.connect();
    adapter._ws.open();
    expect(adapter.isConnected()).toBe(true);

    adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);

    // Reconnect timer should not fire because disconnect() disables it.
    vi.advanceTimersByTime(5000);
    expect(adapter.isConnected()).toBe(false);

    vi.useRealTimers();
  });

  it('auto-reconnects after a server close', () => {
    vi.useFakeTimers();
    const adapter = new WebSocketAdapter({
      url: 'wss://example.com/stream',
      reconnect: true,
      reconnectDelay: 100,
    });

    adapter.connect();
    adapter._ws.open();
    expect(adapter.isConnected()).toBe(true);

    adapter._ws.close();
    expect(adapter.isConnected()).toBe(false);

    vi.advanceTimersByTime(150);
    expect(adapter._ws).not.toBeNull();
    expect(adapter._ws.readyState).toBe(CONNECTING);

    adapter._ws.open();
    expect(adapter.isConnected()).toBe(true);

    adapter.disconnect();
    vi.useRealTimers();
  });

  it('sends subscription messages on open', () => {
    const adapter = new WebSocketAdapter({
      url: 'wss://example.com/stream',
      subscriptions: [{ event: 'subscribe', channel: 'ticker' }, 'raw-string'],
    });

    adapter.connect();
    adapter._ws.open();

    expect(adapter._ws.sent.length).toBe(2);
    expect(adapter._ws.sent[0]).toBe(JSON.stringify({ event: 'subscribe', channel: 'ticker' }));
    expect(adapter._ws.sent[1]).toBe('raw-string');
  });

  it('uses a custom parseMessage function', () => {
    const adapter = new WebSocketAdapter({
      url: 'wss://example.com/stream',
      parseMessage: (payload) =>
        payload?.type === 'trade' ? { rows: [{ price: Number(payload.price) }] } : null,
    });
    const updateSpy = vi.fn();
    adapter.onUpdate(updateSpy);

    adapter.connect();
    adapter._ws.open();
    adapter._ws.dispatchMessage(JSON.stringify({ type: 'trade', price: '123.45' }));

    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][0].dataset.rows[0].price).toBe(123.45);

    // Non-trade messages are ignored.
    adapter._ws.dispatchMessage(JSON.stringify({ type: 'heartbeat' }));
    expect(updateSpy).toHaveBeenCalledOnce();
  });

  it('emits an error when parseMessage throws', () => {
    const adapter = new WebSocketAdapter({
      url: 'wss://example.com/stream',
      parseMessage: () => {
        throw new Error('bad parser');
      },
    });
    const statusSpy = vi.fn();
    adapter.onStatus(statusSpy);

    adapter.connect();
    adapter._ws.open();
    adapter._ws.dispatchMessage(JSON.stringify({ type: 'trade' }));

    expect(statusSpy).toHaveBeenLastCalledWith('error', expect.stringContaining('Parse failed'));
  });

  it('emits an error when a message lacks rows or dataset', () => {
    const adapter = new WebSocketAdapter({ url: 'wss://example.com/stream' });
    const statusSpy = vi.fn();
    adapter.onStatus(statusSpy);

    adapter.connect();
    adapter._ws.open();
    adapter._ws.dispatchMessage(JSON.stringify({ type: 'heartbeat' }));

    expect(statusSpy).toHaveBeenLastCalledWith('error', 'Message missing rows or dataset');
  });

  it('emits an error when a subscription send fails', () => {
    const adapter = new WebSocketAdapter({
      url: 'wss://example.com/stream',
      subscriptions: ['hello'],
    });
    const statusSpy = vi.fn();
    adapter.onStatus(statusSpy);

    adapter.connect();
    adapter._ws.send = () => {
      throw new Error('send failed');
    };
    adapter._ws.open();

    expect(statusSpy).toHaveBeenLastCalledWith(
      'error',
      expect.stringContaining('Subscription send failed')
    );
  });
});
