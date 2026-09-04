// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignallingChannel } from '../src/network/SignallingChannel.ts';

class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  lastSent: string | undefined;

  constructor(public readonly url: string) {
    super();
  }

  send(data: string): void {
    this.lastSent = data;
  }

  close(code = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new Event('close');
    Object.defineProperty(event, 'code', { value: code });
    this.dispatchEvent(event);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  message(payload: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

describe('signed-ticket signalling reconnect', () => {
  let originalWebSocket: typeof WebSocket;
  const channels: SignallingChannel[] = [];

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    for (const channel of channels) channel.disconnect();
    channels.length = 0;
    globalThis.WebSocket = originalWebSocket;
  });

  it('does not report a signed-ticket connection before admission and fails closed on reconnect without renewal', async () => {
    const channel = new SignallingChannel(
      'ws://test',
      'room1',
      'peerA',
      'payload.signature'
    );
    channels.push(channel);

    let resolved = false;
    const initialConnect = channel.connect().then(() => {
      resolved = true;
    });
    let socket = channel._ws as unknown as MockWebSocket;
    socket.open();
    await Promise.resolve();

    expect(JSON.parse(socket.lastSent ?? '{}').data?.token).toBe('payload.signature');
    expect(resolved).toBe(false);
    expect(channel.isOpen).toBe(false);

    socket.message({ type: 'admitted', roomId: 'room1' });
    await initialConnect;
    expect(channel.isOpen).toBe(true);

    const failures: string[] = [];
    const reconnecting: number[] = [];
    channel.addEventListener('reconnect-failed', (event: Event) => {
      failures.push((event as CustomEvent<{ reason: string }>).detail.reason);
    });
    channel.addEventListener('reconnecting', (event: Event) => {
      reconnecting.push((event as CustomEvent<{ attempt: number }>).detail.attempt);
    });

    socket.close();
    expect(reconnecting).toHaveLength(1);

    const reconnect = channel.connect();
    socket = channel._ws as unknown as MockWebSocket;
    socket.open();

    await expect(reconnect).rejects.toThrow('fresh signed ticket required');
    expect(failures).toContain('fresh-ticket-required');
    expect(socket.lastSent).toBeUndefined();
    expect(channel.isOpen).toBe(false);
    // The deterministic credential failure must not create a second automatic
    // reconnect schedule. A later explicit connect() may still retry after a
    // renewal provider has been installed.
    expect(reconnecting).toHaveLength(1);
  });

  it('does not auto-retry a signed ticket rejected after the transport opens', async () => {
    const channel = new SignallingChannel('ws://test', 'room1', 'peerA', 'payload.signature');
    channels.push(channel);
    const reconnecting: number[] = [];
    channel.addEventListener('reconnecting', (event: Event) => {
      reconnecting.push((event as CustomEvent<{ attempt: number }>).detail.attempt);
    });

    const connect = channel.connect();
    const socket = channel._ws as unknown as MockWebSocket;
    socket.open();
    socket.close(4001);

    await expect(connect).rejects.toThrow('signalling admission rejected');
    expect(channel.isOpen).toBe(false);
    expect(reconnecting).toHaveLength(0);
  });

  it('allows reusable non-ticket development credentials to reconnect without a renewal callback', async () => {
    const channel = new SignallingChannel('ws://test', 'room1', 'peerA', 'shared-secret');
    channels.push(channel);

    const initialConnect = channel.connect();
    let socket = channel._ws as unknown as MockWebSocket;
    socket.open();
    await initialConnect;
    expect(JSON.parse(socket.lastSent ?? '{}').data?.token).toBe('shared-secret');

    socket.close();
    const reconnect = channel.connect();
    socket = channel._ws as unknown as MockWebSocket;
    socket.open();
    await reconnect;

    expect(JSON.parse(socket.lastSent ?? '{}').data?.token).toBe('shared-secret');
    expect(channel.isOpen).toBe(true);
  });
});
