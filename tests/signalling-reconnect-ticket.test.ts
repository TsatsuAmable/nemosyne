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

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
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

  it('fails closed instead of replaying a consumed signed ticket when no renewal authority exists', async () => {
    const channel = new SignallingChannel(
      'ws://test',
      'room1',
      'peerA',
      'payload.signature'
    );
    channels.push(channel);

    const initialConnect = channel.connect();
    let socket = channel._ws as unknown as MockWebSocket;
    socket.open();
    await initialConnect;

    expect(JSON.parse(socket.lastSent ?? '{}').data?.token).toBe('payload.signature');

    const failures: string[] = [];
    channel.addEventListener('reconnect-failed', (event: Event) => {
      failures.push((event as CustomEvent<{ reason: string }>).detail.reason);
    });

    socket.close();
    const reconnect = channel.connect();
    socket = channel._ws as unknown as MockWebSocket;
    socket.open();

    await expect(reconnect).rejects.toThrow('fresh signed ticket required');
    expect(failures).toContain('fresh-ticket-required');
    expect(socket.lastSent).toBeUndefined();
    expect(channel.isOpen).toBe(false);
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
