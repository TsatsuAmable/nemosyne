import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkManager } from '../src/network/NetworkManager.ts';

class PartitionableWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: PartitionableWebSocket[] = [];

  readonly url: string;
  readyState = PartitionableWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(url: string) {
    super();
    this.url = url;
    PartitionableWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === PartitionableWebSocket.CLOSED) return;
    this.readyState = PartitionableWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  open(): void {
    this.readyState = PartitionableWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  partition(): void {
    this.readyState = PartitionableWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
}

describe('collaboration partition recovery', () => {
  let originalWebSocket: typeof globalThis.WebSocket;
  let manager: NetworkManager | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    originalWebSocket = globalThis.WebSocket;
    PartitionableWebSocket.instances = [];
    globalThis.WebSocket = PartitionableWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    manager?.disconnect();
    manager = null;
    vi.clearAllTimers();
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  it('reconnects after a transient signalling partition without changing observer authority', async () => {
    manager = new NetworkManager({
      signallingUrl: 'ws://test',
      roomId: 'room-recovery',
      peerId: 'observer-a',
      peerName: 'Observer A',
      role: 'observer',
      token: 'observer-secret',
    });
    const connected = vi.fn();
    const disconnected = vi.fn();
    manager.addEventListener('connected', connected);
    manager.addEventListener('disconnected', disconnected);

    const initialConnect = manager.connect();
    expect(PartitionableWebSocket.instances).toHaveLength(1);
    const first = PartitionableWebSocket.instances[0];
    expect(first.url).toContain('role=observer');
    expect(first.url).not.toContain('observer-secret');
    first.open();
    await initialConnect;

    expect(manager.isConnected).toBe(true);
    expect(connected).toHaveBeenCalledTimes(1);
    const firstAuth = JSON.parse(first.sent[0]);
    expect(firstAuth.data).toEqual({ type: 'auth', token: 'observer-secret', role: 'observer' });

    first.partition();
    expect(manager.isConnected).toBe(false);
    expect(disconnected).toHaveBeenCalledTimes(1);

    manager.signalling?.sendSignal('peer-b', { type: 'offer', sdp: 'queued-during-partition' });
    await vi.advanceTimersByTimeAsync(250);
    expect(PartitionableWebSocket.instances).toHaveLength(2);

    const second = PartitionableWebSocket.instances[1];
    expect(second.url).toContain('role=observer');
    expect(second.url).not.toContain('observer-secret');
    second.open();

    expect(manager.isConnected).toBe(true);
    expect(connected).toHaveBeenCalledTimes(2);
    const secondPayloads = second.sent.map((message) => JSON.parse(message));
    expect(secondPayloads[0].data).toEqual({
      type: 'auth',
      token: 'observer-secret',
      role: 'observer',
    });
    expect(secondPayloads.some((payload) => payload.data?.sdp === 'queued-during-partition')).toBe(true);

    // A delayed event from the superseded socket must not revoke the fresh generation.
    first.dispatchEvent(new Event('close'));
    expect(manager.isConnected).toBe(true);
    expect(disconnected).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect after an explicit leave', async () => {
    manager = new NetworkManager({
      signallingUrl: 'ws://test',
      roomId: 'room-recovery',
      peerId: 'participant-a',
    });
    const initialConnect = manager.connect();
    PartitionableWebSocket.instances[0].open();
    await initialConnect;

    manager.disconnect();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(PartitionableWebSocket.instances).toHaveLength(1);
    expect(manager.isConnected).toBe(false);
  });
});
