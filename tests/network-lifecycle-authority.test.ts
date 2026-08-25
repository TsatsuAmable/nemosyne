import { describe, expect, it, vi } from 'vitest';
import { NetworkManager } from '../src/network/NetworkManager.ts';
import { createRoomRegistry, type SignallingSocket } from '../src/network/SignallingServerCore.ts';

// SignallingSocket intentionally models transport callbacks with untyped payloads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketListener = (...args: any[]) => void;

interface TestSocket extends SignallingSocket {
  listeners: Record<string, SocketListener[]>;
  sent: string[];
  closeCode?: number;
  closeReason?: string;
}

function makeSocket(): TestSocket {
  const listeners: Record<string, SocketListener[]> = {};
  const socket: TestSocket = {
    readyState: 1,
    listeners,
    sent: [],
    send(data: string) {
      socket.sent.push(data);
    },
    close(code?: number, reason?: string) {
      socket.readyState = 3;
      socket.closeCode = code;
      socket.closeReason = reason;
      for (const listener of listeners.close ?? []) listener();
    },
    on(event: string, listener: SocketListener) {
      (listeners[event] ??= []).push(listener);
    },
  };
  return socket;
}

function sendPeerSignal(socket: TestSocket, payload: unknown): void {
  const listener = socket.listeners.message?.[0];
  expect(listener).toBeDefined();
  listener?.(JSON.stringify(payload));
}

describe('collaboration lifecycle authority', () => {
  it('keeps join and leave server-owned so observers cannot forge lifecycle or role changes', () => {
    const registry = createRoomRegistry({
      authToken: 'participant-secret',
      observerAuthToken: 'observer-secret',
    });
    const observer = makeSocket();
    const participant = makeSocket();

    registry.handleConnection(observer, 'room-authority', 'observer-peer', 'observer-secret', 'participant');
    registry.handleConnection(
      participant,
      'room-authority',
      'participant-peer',
      'participant-secret',
      'participant'
    );

    const serverAdmission = participant.sent
      .map((message) => JSON.parse(message) as { from?: string; data?: { type?: string; role?: string } })
      .find((message) => message.from === 'observer-peer' && message.data?.type === 'join');
    expect(serverAdmission?.data?.role).toBe('observer');

    participant.sent.length = 0;

    sendPeerSignal(observer, {
      to: '*',
      data: { type: 'join', role: 'participant' },
    });
    sendPeerSignal(observer, {
      to: 'participant-peer',
      data: { type: 'leave' },
    });

    expect(participant.sent).toEqual([]);
    expect(observer.readyState).toBe(1);
  });

  it('fails closed on malformed join roles without overwriting established signalling authority', () => {
    const manager = new NetworkManager({
      peerId: 'participant-local',
      role: 'participant',
      iceServers: [],
    });
    const initiate = vi.spyOn(manager, '_initiateConnection').mockResolvedValue(undefined);

    manager._onSignal({
      from: 'observer-remote',
      data: { type: 'join', role: 'observer' },
    });

    expect(manager.peerRoles.get('observer-remote')).toBe('observer');
    expect(initiate).toHaveBeenCalledTimes(1);
    expect(initiate).toHaveBeenCalledWith('observer-remote', 'observer');

    manager._onSignal({
      from: 'observer-remote',
      data: { type: 'join' },
    });
    manager._onSignal({
      from: 'observer-remote',
      data: { type: 'join', role: 'administrator' },
    });

    expect(manager.peerRoles.get('observer-remote')).toBe('observer');
    expect(initiate).toHaveBeenCalledTimes(1);
  });
});
