import { describe, expect, it } from 'vitest';

import {
  createRoomRegistry,
  type SignallingSocket,
} from '../src/network/SignallingServerCore.ts';
import { createSignedTicket, SignedTicketReplayGuard } from '../src/network/SignedTicket.ts';

const SECRET = 'rdo-007-shared-nonce-secret';
const ROOM = 'nonce-room';

interface MockSocket extends SignallingSocket {
  closeCode?: number;
  closeReason?: string;
}

function makeSocket(): MockSocket {
  const socket: MockSocket = {
    readyState: 1,
    send() {},
    on() {},
    close(code?: number, reason?: string) {
      socket.readyState = 3;
      socket.closeCode = code;
      socket.closeReason = reason;
    },
  };
  return socket;
}

function participantTicket(room: string = ROOM): string {
  return createSignedTicket({ room, role: 'participant', exp: Date.now() + 60_000 }, SECRET);
}

describe('RDO-007 shared ticket nonce store across signalling replicas', () => {
  it('consumes each nonce exactly once with expiry-bounded eviction at the store level', () => {
    const store = new SignedTicketReplayGuard();
    expect(store.consume('nonce-a', Date.now() + 60_000)).toBe(true);
    expect(store.consume('nonce-a', Date.now() + 60_000)).toBe(false);
    expect(store.consume('', Date.now() + 60_000)).toBe(false);
    expect(store.size).toBe(1);

    store.consume('nonce-expired', Date.now() - 1_000);
    expect(store.size).toBe(2);
    store.clearExpired(Date.now());
    expect(store.size).toBe(1);
    // Eviction releases the nonce name; a fresh ticket reusing it admits again.
    expect(store.consume('nonce-expired', Date.now() + 60_000)).toBe(true);
  });

  it('rejects a one-use ticket replayed on a second replica sharing the store', () => {
    const shared = new SignedTicketReplayGuard();
    const replicaA = createRoomRegistry({ authToken: SECRET, replayNonceStore: shared });
    const replicaB = createRoomRegistry({ authToken: SECRET, replayNonceStore: shared });
    const ticket = participantTicket();

    const first = makeSocket();
    replicaA.handleConnection(first, ROOM, 'peer-a', ticket, 'participant');
    expect(first.closeCode).toBeUndefined();
    expect(first.readyState).toBe(1);

    const replay = makeSocket();
    replicaB.handleConnection(replay, ROOM, 'peer-b', ticket, 'participant');
    expect(replay.closeCode).toBe(4001);
    expect(replay.closeReason).toBe('ticket replay detected (nonce already consumed)');
  });

  it('keeps per-instance replay scope when no store is shared (default unchanged)', () => {
    const replicaA = createRoomRegistry({ authToken: SECRET });
    const replicaB = createRoomRegistry({ authToken: SECRET });
    const ticket = participantTicket();

    const first = makeSocket();
    replicaA.handleConnection(first, ROOM, 'peer-a', ticket, 'participant');
    expect(first.closeCode).toBeUndefined();

    // Without a shared store the second instance has no knowledge of the
    // first admission: per-instance scope, exactly as before this tranche.
    const second = makeSocket();
    replicaB.handleConnection(second, ROOM, 'peer-b', ticket, 'participant');
    expect(second.closeCode).toBeUndefined();
  });

  it('admits distinct nonces independently on every replica sharing the store', () => {
    const shared = new SignedTicketReplayGuard();
    const replicaA = createRoomRegistry({ authToken: SECRET, replayNonceStore: shared });
    const replicaB = createRoomRegistry({ authToken: SECRET, replayNonceStore: shared });

    const socketA = makeSocket();
    replicaA.handleConnection(socketA, ROOM, 'peer-a', participantTicket(), 'participant');
    expect(socketA.closeCode).toBeUndefined();

    const socketB = makeSocket();
    replicaB.handleConnection(socketB, ROOM, 'peer-b', participantTicket(), 'participant');
    expect(socketB.closeCode).toBeUndefined();

    expect(shared.size).toBe(2);
  });
});
