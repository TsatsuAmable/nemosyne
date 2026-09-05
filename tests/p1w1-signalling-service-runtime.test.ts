import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { type RawData } from 'ws';
import {
  createSignallingService,
  readSignallingServiceConfig,
} from '../src/network/SignallingServer.mjs';
import { createSignedTicket } from '../src/network/SignedTicket.ts';

type Service = ReturnType<typeof createSignallingService>;
type WireMessage = {
  type?: string;
  roomId?: string;
  from?: string;
  data?: { type?: string; [key: string]: unknown };
};

const services: Service[] = [];
const sockets: WebSocket[] = [];
const ORIGIN = 'https://nemosyne.example';

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('websocket open timeout')), 2000);
    socket.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForMessage(
  socket: WebSocket,
  predicate: (message: WireMessage) => boolean
): Promise<WireMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('websocket message timeout'));
    }, 2000);
    const onMessage = (raw: RawData) => {
      let message: WireMessage;
      try {
        message = JSON.parse(raw.toString()) as WireMessage;
      } catch {
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

function waitForClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('websocket close timeout')), 2000);
    socket.once('close', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

async function connectWithSignedTicket(
  port: number,
  roomId: string,
  peerId: string,
  ticket: string
): Promise<WebSocket> {
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}/__signal?room=${encodeURIComponent(roomId)}&peer=${encodeURIComponent(peerId)}&role=participant`,
    { origin: ORIGIN }
  );
  sockets.push(socket);
  await waitForOpen(socket);
  const admitted = waitForMessage(
    socket,
    (message) => message.type === 'admitted' && message.roomId === roomId
  );
  socket.send(
    JSON.stringify({
      roomId,
      from: peerId,
      to: '*',
      data: { type: 'auth', token: ticket, role: 'participant' },
    })
  );
  await admitted;
  return socket;
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
  }
  await Promise.all(services.splice(0).map((service) => service.stop()));
});

describe('P1-W1 production signalling service runtime', () => {
  it('defaults the standalone service to fail-closed Production', () => {
    const config = readSignallingServiceConfig([], {});
    expect(config.securityProfile).toBe('Production');
    expect(config.allowOpen).toBe(false);
    expect(() => createSignallingService(config)).toThrow(/unsafe signalling configuration/u);
  });

  it('rejects open mode outside the Development profile', () => {
    expect(() =>
      readSignallingServiceConfig(['--allow-open', '--profile=Production'], {})
    ).toThrow(/permitted only with the Development profile/u);
  });

  it('serves liveness and security-aware readiness on the real HTTP runtime', async () => {
    const config = readSignallingServiceConfig([], {
      NEMOSYNE_SIGNAL_PROFILE: 'Production',
      NEMOSYNE_SIGNAL_HOST: '127.0.0.1',
      NEMOSYNE_SIGNAL_PORT: '0',
      NEMOSYNE_SIGNAL_TOKEN: 'participant-secret',
      NEMOSYNE_OBSERVER_TOKEN: 'observer-secret',
      NEMOSYNE_ALLOWED_ORIGINS: ORIGIN,
    });
    const service = createSignallingService(config);
    services.push(service);
    const address = await service.start();
    expect(address && typeof address === 'object').toBe(true);
    const port = (address as { port: number }).port;

    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({
      status: 'ready',
      profile: 'Production',
      originEnforcement: true,
      authenticationConfigured: true,
    });

    const missing = await fetch(`http://127.0.0.1:${port}/not-a-service-route`);
    expect(missing.status).toBe(404);
  });

  it('admits one-use signed tickets through the real WebSocket service and relays signalling', async () => {
    const secret = 'participant-secret';
    const roomId = 'preview-room';
    const config = readSignallingServiceConfig([], {
      NEMOSYNE_SIGNAL_PROFILE: 'Production',
      NEMOSYNE_SIGNAL_HOST: '127.0.0.1',
      NEMOSYNE_SIGNAL_PORT: '0',
      NEMOSYNE_SIGNAL_TOKEN: secret,
      NEMOSYNE_OBSERVER_TOKEN: 'observer-secret',
      NEMOSYNE_ALLOWED_ORIGINS: ORIGIN,
    });
    const service = createSignallingService(config);
    services.push(service);
    const address = await service.start();
    const port = (address as { port: number }).port;
    const now = Date.now();
    const ticketA = createSignedTicket(
      { room: roomId, role: 'participant', issuedAt: now, exp: now + 60_000 },
      secret
    );
    const ticketB = createSignedTicket(
      { room: roomId, role: 'participant', issuedAt: now, exp: now + 60_000 },
      secret
    );

    const peerA = await connectWithSignedTicket(port, roomId, 'peer-a', ticketA);
    const peerBJoin = waitForMessage(
      peerA,
      (message) => message.from === 'peer-b' && message.data?.type === 'join'
    );
    const peerB = await connectWithSignedTicket(port, roomId, 'peer-b', ticketB);
    await peerBJoin;

    const relayedOffer = waitForMessage(
      peerB,
      (message) => message.from === 'peer-a' && message.data?.type === 'offer'
    );
    peerA.send(
      JSON.stringify({
        roomId,
        from: 'spoofed-peer',
        to: 'peer-b',
        data: { type: 'offer', sdp: 'preview-offer' },
      })
    );
    expect(await relayedOffer).toMatchObject({
      roomId,
      from: 'peer-a',
      data: { type: 'offer', sdp: 'preview-offer' },
    });

    const replay = new WebSocket(
      `ws://127.0.0.1:${port}/__signal?room=${roomId}&peer=peer-replay&role=participant`,
      { origin: ORIGIN }
    );
    sockets.push(replay);
    await waitForOpen(replay);
    const replayClosed = waitForClose(replay);
    replay.send(
      JSON.stringify({
        roomId,
        from: 'peer-replay',
        to: '*',
        data: { type: 'auth', token: ticketB, role: 'participant' },
      })
    );
    expect(await replayClosed).toBe(4001);
  });
});
