/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

  it('tracks participant and observer roles', () => {
    const room = new Room('room1', 'peerA', 'Alice', 'observer');
    const peer = room.addPeer('peerB', 'Bob', 'participant');

    expect(room.localRole).toBe('observer');
    expect(peer?.role).toBe('participant');
    expect(room.canMutateSharedState()).toBe(false);
    expect(room.canMutateSharedState('participant')).toBe(true);
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

  it('broadcasts state delta, dataset operation, selection, and throttled camera pose', async () => {
    const promise = manager.connect();
    const mockWs = manager.signalling!._ws as unknown as MockWebSocket;
    mockWs._open();
    await promise;

    mockWs._message({ roomId: 'room1', from: 'peerB', data: { type: 'join' } });
    const channel = manager.channels.get('peerB') as unknown as MockDataChannel;
    channel.readyState = 'open';
    channel.dispatchEvent(new Event('open'));

    // 1. broadcastStateDelta
    manager.broadcastStateDelta('theme', { mode: 'dark' });
    const deltaMsg = JSON.parse(channel.messages[channel.messages.length - 1]);
    expect(deltaMsg.type).toBe('delta');
    expect(deltaMsg.topic).toBe('theme');
    expect(deltaMsg.data).toEqual({ mode: 'dark' });

    // 2. broadcastDatasetOperation
    manager.broadcastDatasetOperation({ type: 'filter', column: 'price', min: 10 });
    const opMsg = JSON.parse(channel.messages[channel.messages.length - 1]);
    expect(opMsg.type).toBe('datasetOperation');
    expect(opMsg.op.type).toBe('filter');
    expect(opMsg.role).toBe('participant');

    // 3. broadcastSelection
    manager.broadcastSelection(['row-1', 'row-2']);
    const selMsg = JSON.parse(channel.messages[channel.messages.length - 1]);
    expect(selMsg.type).toBe('selectionSync');
    expect(selMsg.selectedIds).toEqual(['row-1', 'row-2']);

    // 4. broadcastCameraPose (throttled)
    manager.broadcastCameraPose([0, 1.6, 0], [0, 0, 0, 1], 0);
    const poseMsg = JSON.parse(channel.messages[channel.messages.length - 1]);
    expect(poseMsg.type).toBe('cameraPose');
    expect(poseMsg.position).toEqual([0, 1.6, 0]);
  });

  it('does not broadcast dataset operations from an observer', () => {
    const observer = new NetworkManager({
      signallingUrl: 'ws://test',
      roomId: 'room1',
      peerId: 'observer',
      role: 'observer',
    });

    expect(observer.broadcastDatasetOperation({ type: 'filter' })).toBe(false);
    observer.disconnect();
  });

  it('does not broadcast shared state deltas from an observer', () => {
    const observer = new NetworkManager({ role: 'observer' });
    expect(observer.broadcastStateDelta('annotations_add', { id: 'blocked' })).toBe(false);
    observer.disconnect();
  });

  it('dispatches incoming stateDelta, remoteDatasetOperation, remoteSelection, and remoteCameraPose events', async () => {
    const promise = manager.connect();
    const mockWs = manager.signalling!._ws as unknown as MockWebSocket;
    mockWs._open();
    await promise;

    mockWs._message({ roomId: 'room1', from: 'peerB', data: { type: 'join' } });
    const channel = manager.channels.get('peerB') as unknown as MockDataChannel;
    channel.readyState = 'open';
    channel.dispatchEvent(new Event('open'));

    const onDelta = vi.fn();
    const onOp = vi.fn();
    const onSel = vi.fn();
    const onPose = vi.fn();

    manager.addEventListener('stateDelta', onDelta);
    manager.addEventListener('remoteDatasetOperation', onOp);
    manager.addEventListener('remoteSelection', onSel);
    manager.addEventListener('remoteCameraPose', onPose);

    // Simulate incoming messages from peerB over data channel
    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'delta', peerId: 'peerB', topic: 'layout', data: { grid: true } }),
      })
    );
    expect(onDelta).toHaveBeenCalled();
    expect(onDelta.mock.calls[0][0].detail.topic).toBe('layout');

    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'datasetOperation', peerId: 'peerB', op: { type: 'sort', column: 'name' } }),
      })
    );
    expect(onOp).toHaveBeenCalled();
    expect(onOp.mock.calls[0][0].detail.op.type).toBe('sort');

    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'selectionSync', peerId: 'peerB', selectedIds: ['item-42'] }),
      })
    );
    expect(onSel).toHaveBeenCalled();
    expect(onSel.mock.calls[0][0].detail.selectedIds).toEqual(['item-42']);

    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'cameraPose', peerId: 'peerB', position: [1, 2, 3], rotation: [0, 0, 0, 1] }),
      })
    );
    expect(onPose).toHaveBeenCalled();
    expect(onPose.mock.calls[0][0].detail.position).toEqual([1, 2, 3]);
  });

  it('does not let an observer elevate through a state role claim', async () => {
    const promise = manager.connect();
    const mockWs = manager.signalling!._ws as unknown as MockWebSocket;
    mockWs._open();
    await promise;

    mockWs._message({ roomId: 'room1', from: 'peer-observer', data: { type: 'join', role: 'observer' } });
    const channel = manager.channels.get('peer-observer') as unknown as MockDataChannel;
    channel.readyState = 'open';
    channel.dispatchEvent(new Event('open'));

    const onDelta = vi.fn();
    manager.addEventListener('stateDelta', onDelta);
    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'state',
          peerId: 'peer-observer',
          role: 'participant',
          state: {},
        }),
      })
    );
    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'delta',
          peerId: 'peer-observer',
          topic: 'annotations_add',
          data: { id: 'spoofed' },
        }),
      })
    );

    expect(manager.room.peers.get('peer-observer')?.role).toBe('observer');
    expect(onDelta).not.toHaveBeenCalled();
  });

  it('rejects a delta whose claimed peer ID differs from its channel peer', async () => {
    const promise = manager.connect();
    const mockWs = manager.signalling!._ws as unknown as MockWebSocket;
    mockWs._open();
    await promise;

    mockWs._message({ roomId: 'room1', from: 'peerB', data: { type: 'join', role: 'participant' } });
    const channel = manager.channels.get('peerB') as unknown as MockDataChannel;
    channel.readyState = 'open';
    channel.dispatchEvent(new Event('open'));

    const onDelta = vi.fn();
    manager.addEventListener('stateDelta', onDelta);
    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'delta',
          peerId: 'victim-peer',
          topic: 'annotations_add',
          data: { id: 'spoofed' },
        }),
      })
    );

    expect(onDelta).not.toHaveBeenCalled();
  });
});

describe('SignallingServerCore', () => {
  function makeSocket() {
    const socket = new EventTarget() as any;
    socket.readyState = 1;
    socket.sent = [];
    socket.closeCode = undefined;
    socket.closeReason = undefined;
    socket.send = (data: string) => socket.sent.push(data);
    socket.close = (code?: number, reason?: string) => {
      socket.closeCode = code;
      socket.closeReason = reason;
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

  it('overwrites spoofed sender identities on direct messages', () => {
    const registry = createRoomRegistry();
    const a = makeSocket();
    const b = makeSocket();

    registry.handleConnection(a, 'room1', 'peerA');
    registry.handleConnection(b, 'room1', 'peerB');

    b.sent.length = 0;
    a.listeners.message[0](
      JSON.stringify({ to: 'peerB', from: 'victim-peer', data: { type: 'offer' } })
    );

    expect(JSON.parse(b.sent[0]).from).toBe('peerA');
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

  it('overwrites spoofed sender identities on broadcasts', () => {
    const registry = createRoomRegistry();
    const a = makeSocket();
    const b = makeSocket();

    registry.handleConnection(a, 'room2-spoof', 'peerA');
    registry.handleConnection(b, 'room2-spoof', 'peerB');

    b.sent.length = 0;
    a.listeners.message[0](
      JSON.stringify({ to: '*', from: 'victim-peer', data: { type: 'ping' } })
    );

    expect(JSON.parse(b.sent[b.sent.length - 1]).from).toBe('peerA');
  });

  it('blocks observer direct relays except WebRTC negotiation messages', () => {
    const registry = createRoomRegistry();
    const observer = makeSocket();
    const participant = makeSocket();

    registry.handleConnection(observer, 'room-observer-direct', 'observer', undefined, 'observer');
    registry.handleConnection(participant, 'room-observer-direct', 'participant');
    participant.sent.length = 0;

    observer.listeners.message[0](
      JSON.stringify({ to: 'participant', data: { type: 'datasetOperation', op: { type: 'delete' } } })
    );
    expect(participant.sent).toHaveLength(0);

    observer.listeners.message[0](
      JSON.stringify({ to: 'participant', data: { type: 'answer', sdp: 'observer-answer' } })
    );
    expect(participant.sent).toHaveLength(1);
    expect(JSON.parse(participant.sent[0]).data.type).toBe('answer');
  });

  it('blocks observer broadcasts except WebRTC negotiation messages', () => {
    const registry = createRoomRegistry();
    const observer = makeSocket();
    const participant = makeSocket();

    registry.handleConnection(observer, 'room-observer-broadcast', 'observer', undefined, 'observer');
    registry.handleConnection(participant, 'room-observer-broadcast', 'participant');
    observer.sent.length = 0;
    participant.sent.length = 0;

    observer.listeners.message[0](JSON.stringify({ to: '*', data: { type: 'state', state: { x: 1 } } }));
    expect(observer.sent).toHaveLength(0);
    expect(participant.sent).toHaveLength(0);

    observer.listeners.message[0](JSON.stringify({ to: '*', data: { type: 'ice', candidate: {} } }));
    expect(participant.sent).toHaveLength(1);
    expect(JSON.parse(participant.sent[0]).data.type).toBe('ice');
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

  it('rejects a join with the wrong token (close 4001) and does not admit it', () => {
    const registry = createRoomRegistry({ authToken: 'secret' });
    const a = makeSocket();
    const b = makeSocket();

    // a supplies the wrong token -> rejected before being admitted.
    registry.handleConnection(a, 'room1', 'peerA', 'wrong');
    expect(a.closeCode).toBe(4001);
    expect(a.readyState).toBe(3);

    // b supplies the correct token -> admitted. a (rejected) must not be in the
    // room, so b receives no join notification from a.
    registry.handleConnection(b, 'room1', 'peerB', 'secret');
    expect(b.closeCode).toBeUndefined();
    expect(b.readyState).toBe(1);
    const joinsFromA = b.sent.filter((m: string) => JSON.parse(m).from === 'peerA');
    expect(joinsFromA.length).toBe(0);
  });

  it('rejects a join with no token when a token is required (close 4001)', () => {
    const registry = createRoomRegistry({ authToken: 'secret' });
    const a = makeSocket();
    registry.handleConnection(a, 'room1', 'peerA'); // no token arg
    expect(a.closeCode).toBe(4001);
  });

  it('admits a join with the correct token and relays between peers', () => {
    const registry = createRoomRegistry({ authToken: 'secret' });
    const a = makeSocket();
    const b = makeSocket();

    registry.handleConnection(a, 'room1', 'peerA', 'secret');
    registry.handleConnection(b, 'room1', 'peerB', 'secret');
    expect(a.closeCode).toBeUndefined();
    expect(b.closeCode).toBeUndefined();

    // a should have been notified of b joining.
    const joinMessages = a.sent.filter((m: string) => JSON.parse(m).data.type === 'join');
    expect(joinMessages.length).toBe(1);
    expect(JSON.parse(joinMessages[0]).from).toBe('peerB');

    // Direct relay still works for token-gated peers.
    b.sent.length = 0;
    a.listeners.message[0](JSON.stringify({ to: 'peerB', data: { type: 'offer' } }));
    expect(b.sent.length).toBe(1);
  });

  it('rejects a duplicate peerId (close 4002) and keeps the existing peer', () => {
    const registry = createRoomRegistry();
    const a = makeSocket();
    const a2 = makeSocket();

    registry.handleConnection(a, 'room1', 'peerA');
    expect(a.closeCode).toBeUndefined();
    expect(a.readyState).toBe(1);

    // A second connection claiming the same live peerId is rejected.
    registry.handleConnection(a2, 'room1', 'peerA');
    expect(a2.closeCode).toBe(4002);
    expect(a2.readyState).toBe(3);
    // The original peer is unaffected.
    expect(a.readyState).toBe(1);
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
