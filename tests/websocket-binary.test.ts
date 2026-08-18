// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketAdapter } from '../src/data/connectors/WebSocketAdapter.ts';

const CONNECTING = 0;
const OPEN = 1;

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
}

describe('WebSocketAdapter binary frames', () => {
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it('uses a binaryParser for ArrayBuffer frames', () => {
    const binaryParser = vi.fn().mockReturnValue({
      name: 'Binary Test',
      rows: [{ time: '2026-07-28T00:00:00Z', value: 42 }],
    });

    const adapter = new WebSocketAdapter({
      url: 'wss://test/stream',
      binaryParser,
    });

    let update = null;
    adapter.onUpdate((u) => (update = u));
    adapter.connect();
    adapter._ws.open();

    adapter._ws.dispatchMessage(new ArrayBuffer(8));

    expect(binaryParser).toHaveBeenCalledOnce();
    expect(update).not.toBeNull();
    expect(update.dataset.rowCount).toBe(1);
  });

  it('reports an error when a binary frame arrives without a binaryParser', () => {
    const adapter = new WebSocketAdapter({ url: 'wss://test/stream' });

    let status = null;
    adapter.onStatus((s) => (status = s));
    adapter.connect();
    adapter._ws.open();

    adapter._ws.dispatchMessage(new ArrayBuffer(8));
    expect(status).toBe('error');
  });

  it('sends in-band auth message on open without appending token to the URL', () => {
    const adapter = new WebSocketAdapter({
      url: 'wss://test/stream',
      authToken: 'secret_token_123',
    });

    adapter.connect();
    expect(adapter._ws.url).toBe('wss://test/stream');

    adapter._ws.send = vi.fn();
    adapter._ws.open();

    expect(adapter._ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth', token: 'secret_token_123' }));
  });
});
