import { describe, expect, it } from 'vitest';

import {
  createRoomRegistry,
  type SignallingSocket,
} from '../src/network/SignallingServerCore.ts';
import { createSignedTicket } from '../src/network/SignedTicket.ts';

const SECRET = 'rfl-cycle-2-reaping-secret';

interface MockSocket extends SignallingSocket {
  closeCode?: number;
  closeReason?: string;
}

function makeSocket(): MockSocket {
  const listeners: Record<string, Array<() => void>> = {};
  const socket: MockSocket = {
    readyState: 1,
    send() {},
    on(event: string, listener: () => void) {
      listeners[event] = listeners[event] ?? [];
      listeners[event]?.push(listener);
    },
    close(code?: number, reason?: string) {
      socket.readyState = 3;
      socket.closeCode = code;
      socket.closeReason = reason;
      for (const listener of listeners.close ?? []) listener();
    },
  };
  return socket;
}

function participantTicket(room: string): string {
  return createSignedTicket({ room, role: 'participant', exp: Date.now() + 60_000 }, SECRET);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('RFL cycle 2: unauthenticated-peer reaping and idle-room eviction', () => {
  it('closes an unauthenticated peer after the auth timeout and releases its room', async () => {
    const registry = createRoomRegistry({
      authToken: SECRET,
      authTimeoutMs: 60,
      roomIdleTimeoutMs: 50,
    });
    const socket = makeSocket();
    registry.handleConnection(socket, 'reap-room', 'peer-slow', undefined, 'participant');

    expect(socket.closeCode).toBeUndefined();
    expect(registry.getRoomCount()).toBe(1);
    expect(registry.getTotalPeers()).toBe(0);

    await delay(200);
    expect(socket.closeCode).toBe(4001);
    expect(socket.closeReason).toBe('auth timeout');

    registry.cleanupIdleRooms();
    expect(registry.getRoomCount()).toBe(0);
    expect(registry.getTotalPeers()).toBe(0);
  });

  it('bounds unauthenticated occupants per room and frees the slot on early close', () => {
    const registry = createRoomRegistry({ authToken: SECRET, maxPendingPeersPerRoom: 2 });
    const first = makeSocket();
    const second = makeSocket();
    registry.handleConnection(first, 'pending-room', 'peer-1', undefined, 'participant');
    registry.handleConnection(second, 'pending-room', 'peer-2', undefined, 'participant');
    expect(first.closeCode).toBeUndefined();
    expect(second.closeCode).toBeUndefined();

    const refused = makeSocket();
    registry.handleConnection(refused, 'pending-room', 'peer-3', undefined, 'participant');
    expect(refused.closeCode).toBe(1008);
    expect(refused.closeReason).toBe('too many unauthenticated peers in room');

    first.close();
    const replacement = makeSocket();
    registry.handleConnection(replacement, 'pending-room', 'peer-4', undefined, 'participant');
    expect(replacement.closeCode).toBeUndefined();
  });

  it('evicts an emptied room while a live room survives cleanup', async () => {
    const registry = createRoomRegistry({
      authToken: SECRET,
      authTimeoutMs: 10_000,
      roomIdleTimeoutMs: 50,
    });
    const leaving = makeSocket();
    registry.handleConnection(leaving, 'leaving-room', 'peer-gone', participantTicket('leaving-room'), 'participant');
    expect(leaving.closeCode).toBeUndefined();
    const staying = makeSocket();
    registry.handleConnection(staying, 'staying-room', 'peer-stays', participantTicket('staying-room'), 'participant');
    expect(staying.closeCode).toBeUndefined();
    expect(registry.getTotalPeers()).toBe(2);

    leaving.close();
    expect(registry.getTotalPeers()).toBe(1);
    expect(registry.getRoomCount()).toBe(2);

    await delay(150);
    registry.cleanupIdleRooms();
    expect(registry.getRoomCount()).toBe(1);
    expect(registry.getTotalPeers()).toBe(1);
    expect(staying.closeCode).toBeUndefined();
    staying.close();
  });

  it('leaves an authenticated peer untouched while an unauthenticated peer times out', async () => {
    const registry = createRoomRegistry({
      authToken: SECRET,
      authTimeoutMs: 60,
      roomIdleTimeoutMs: 10_000,
    });
    const authed = makeSocket();
    registry.handleConnection(authed, 'mixed-room', 'peer-authed', participantTicket('mixed-room'), 'participant');
    expect(authed.closeCode).toBeUndefined();
    const slow = makeSocket();
    registry.handleConnection(slow, 'mixed-room', 'peer-slow', undefined, 'participant');
    expect(slow.closeCode).toBeUndefined();

    await delay(200);
    expect(slow.closeCode).toBe(4001);
    expect(authed.closeCode).toBeUndefined();
    expect(registry.getTotalPeers()).toBe(1);
    authed.close();
  });
});
