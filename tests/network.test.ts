import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignallingChannel } from '../src/network/SignallingChannel.ts';
import { Room } from '../src/network/Room.ts';
import { NetworkManager } from '../src/network/NetworkManager.ts';
import { createRoomRegistry } from '../src/network/SignallingServerCore.ts';

class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number;
  lastSent?: string;

  constructor(url: string) {
    super();
    this.url = url;
    this.readyState = 0;
  }

  send(data: string) {
    this.lastSent = data;
  }

  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }

  _open() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  _message(data: any) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

describe('SignallingChannel', () => {
  let channel: SignallingChannel;
  let originalWebSocket: any;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
    channel = new SignallingChannel('ws://test', 'room1', 'peerA');
  });

  afterEach(() => {
    channel.disconnect();
    globalThis.WebSocket = originalWebSocket;
  });

  it('opens and flushes queued signals', async () => {
    const connectPromise = channel.connect();
    channel.sendSignal('peerB', { type: 'offer' });
    const mockWs = channel._ws as unknown as MockWebSocket;
    mockWs._open();
    await connectPromise;

    expect(channel.isOpen).toBe(true);
    expect(mockWs.lastSent).toBeTruthy();
    const sent = JSON.parse(mockWs.lastSent!);
    expect(sent.to).toBe('peerB');
    expect(sent.data.type).toBe('offer');
  });

  it('dispatches signal events', async () => {
    const handler = vi.fn();
    channel.addEventListener('signal', handler);
    const connectPromise = channel.connect();
    const mockWs = channel._ws as unknown as MockWebSocket;
    mockWs._open();
    await connectPromise;

    mockWs._message({ roomId: 'room1', from: 'peerB', data: { type: 'answer' } });

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.data.type).toBe('answer');
  });

  it('broadcasts to all', async () => {
    const connectPromise = channel.connect();
    channel.broadcastSignal({ type: 'join' });
    const mockWs = channel._ws as unknown as MockWebSocket;
    mockWs._open();
    await connectPromise;

    const sent = JSON.parse(mockWs.lastSent!);
    expect(sent.to).toBe('*');
  });
});

describe('Room', () => {
  it('tracks local and remote peers', () => {
    const room = new Room('room1', 'peerA', 'Alice');
    expect(room.localPeerId).toBe('peerA');

    const peer = room.addPeer('peerB', 'Bob');
    expect(peer?.name).toBe('Bob');
    expect(room.getPeerIds()).toContain('peerB');

    room.updatePeerState('peerB', { position: [1, 2, 3] });
    expect(room.peers.get('peerB')?.state.position).toEqual([1, 2, 3]);

    room.removePeer('peerB');
    expect(room.getPeerIds()).not.toContain('peerB');
  });

  it('does not add the local peer', () => {
    const room = new Room('room1', 'peerA');
    expect(room.addPeer('peerA')).toBeNull();
  });

  it('serializes to JSON', () => {
    const room = new Room('room1', 'peerA', 'Alice');
    room.addPeer('peerB', 'Bob');
    room.updatePeerState('peerB', { x: 1 });
    const json = room.toJSON();
    expect(json.roomId).toBe('room1');
    expect(json.peers[0].peerId).toBe('peerB');
  });
});

describe('NetworkManager', () => {
  let manager: NetworkManager;
  let originalWebSocket: any;
  let originalRTCPeerConnection: any;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;

    const channels: MockDataChannel[] = [];
    originalRTCPeerConnection = globalThis.RTCPeerConnection;
    (globalThis as any).RTCPeerConnection = class {
      iceCandidates: any[] = [];
      remoteDescription: any = null;
      connectionState = 'new';
      localDescription: any = null;
      _iceHandler: any = null;

      createDataChannel(label: string, options: any) {
        const channel = new MockDataChannel();
        channels.push(channel);
        return channel;
      }

      async createOffer() {
        return { type: 'offer', sdp: 'offer-sdp' };
      }

      async createAnswer() {
        return { type: 'answer', sdp: 'answer-sdp' };
      }

      async setLocalDescription(desc: any) {
        this.localDescription = desc;
      }

      async setRemoteDescription(desc: any) {
        this.remoteDescription = desc;
      }

      addEventListener(type: string, fn: any) {
        if (type === 'icecandidate') this._iceHandler = fn;
      }
    };

    manager = new NetworkManager({
      signallingUrl: 'ws://test',
      roomId: 'room1',
      peerId: 'peerA',
      peerName: 'Alice',
    });
  });

  afterEach(() => {
    manager.disconnect();
    globalThis.WebSocket = originalWebSocket;
    globalThis.RTCPeerConnection = originalRTCPeerConnection;
  });

  it('connects through signalling and emits connected event', async () => {
    const connected = vi.fn();
    manager.addEventListener('connected', connected);
    const promise = manager.connect();
    const mockWs = manager.signalling!._ws as unknown as MockWebSocket;
    mockWs._open();
    await promise;

    expect(manager.isConnected).toBe(true);
    expect(connected).toHaveBeenCalled();
  });

  it('initiates a connection when receiving a join signal', async () => {
    const promise = manager.connect();
    const mockWs = manager.signalling!._ws as unknown as MockWebSocket;
    mockWs._open();
    await promise;

    mockWs._message({ roomId: 'room1', from: 'peerB', data: { type: 'join' } });

    expect(manager.connections.has('peerB')).toBe(true);
  });

  it('broadcasts local state to open channels', async () => {
    const peerJoined = vi.fn();
    manager.addEventListener('peerJoined', peerJoined);
    const promise = manager.connect();
    const mockWs = manager.signalling!._ws as unknown as MockWebSocket;
    mockWs._open();
    await promise;

    mockWs._message({ roomId: 'room1', from: 'peerB', data: { type: 'join' } });
    const channel = manager.channels.get('peerB') as unknown as MockDataChannel;
    channel.readyState = 'open';
    channel.dispatchEvent(new Event('open'));

    manager.setLocalState({ camera: [1, 2, 3] });
    expect(channel.messages.length).toBeGreaterThan(0);
    const last = JSON.parse(channel.messages[channel.messages.length - 1]);
    expect(last.state.camera).toEqual([1, 2, 3]);
  });
});

describe('SignallingServerCore', () => {
  function makeSocket() {
    const socket = new EventTarget() as any;
    socket.readyState = 1;
    socket.sent = [];
    socket.send = (data: string) => socket.sent.push(data);
    socket.close = () => {
      socket.readyState = 3;
      socket.listeners?.close?.forEach?.((fn: any) => fn());
    };
    socket.listeners = {};
    socket.on = (type: string, fn: any) => {
      (socket.listeners[type] ||= []).push(fn);
    };
    return socket;
  }

  it('relays a direct message between peers', () => {
    const registry = createRoomRegistry();
    const a = makeSocket();
    const b = makeSocket();

    registry.handleConnection(a, 'room1', 'peerA');
    registry.handleConnection(b, 'room1', 'peerB');

    b.sent.length = 0;
    a.listeners.message[0](JSON.stringify({ to: 'peerB', data: { type: 'offer' } }));

    expect(b.sent.length).toBe(1);
    const payload = JSON.parse(b.sent[0]);
    expect(payload.from).toBe('peerA');
    expect(payload.data.type).toBe('offer');
  });

  it('broadcasts to all room peers', () => {
    const registry = createRoomRegistry();
    const a = makeSocket();
    const b = makeSocket();
    const c = makeSocket();

    registry.handleConnection(a, 'room2', 'peerA');
    registry.handleConnection(b, 'room2', 'peerB');
    registry.handleConnection(c, 'room2', 'peerC');

    a.listeners.message[0](JSON.stringify({ to: '*', data: { type: 'ping' } }));

    expect(b.sent.length).toBeGreaterThan(0);
    expect(c.sent.length).toBeGreaterThan(0);
    const lastB = JSON.parse(b.sent[b.sent.length - 1]);
    expect(lastB.data.type).toBe('ping');
  });

  it('notifies existing peers on join and leaves', () => {
    const registry = createRoomRegistry();
    const a = makeSocket();
    const b = makeSocket();

    registry.handleConnection(a, 'room3', 'peerA');
    registry.handleConnection(b, 'room3', 'peerB');

    const joinMessages = a.sent.filter((m: string) => JSON.parse(m).data.type === 'join');
    expect(joinMessages.length).toBe(1);
    expect(JSON.parse(joinMessages[0]).from).toBe('peerB');

    b.listeners.close[0]();

    const leaveMessages = a.sent.filter((m: string) => JSON.parse(m).data.type === 'leave');
    expect(leaveMessages.length).toBe(1);
    expect(JSON.parse(leaveMessages[0]).from).toBe('peerB');
  });
});

class MockDataChannel extends EventTarget {
  readyState: string;
  messages: string[];

  constructor() {
    super();
    this.readyState = 'connecting';
    this.messages = [];
  }

  send(data: string) {
    this.messages.push(data);
  }
}
