import { NetworkManager } from '../../src/network/NetworkManager.ts';

type HarnessRole = 'participant' | 'observer';

type EventName =
  | 'connected'
  | 'disconnected'
  | 'peerJoined'
  | 'peerLeft'
  | 'peerState'
  | 'stateDelta'
  | 'remoteDatasetOperation';

interface ConnectOptions {
  roomId: string;
  peerId: string;
  role: HarnessRole;
}

interface HarnessSnapshot {
  peerId: string;
  role: HarnessRole;
  connected: boolean;
  remotePeers: ReturnType<NetworkManager['room']['getRemoteSnapshot']>;
  channels: Array<{ peerId: string; readyState: RTCDataChannelState }>;
  eventCounts: Record<EventName, number>;
}

interface CollaborationHarnessApi {
  connect(options: ConnectOptions): Promise<HarnessSnapshot>;
  snapshot(): HarnessSnapshot;
  setLocalState(state: Record<string, unknown>): HarnessSnapshot;
  broadcastStateDelta(topic: string, data: Record<string, unknown>): boolean;
  broadcastDatasetOperation(op: Record<string, unknown>): boolean;
  sendRawDatasetOperation(op: Record<string, unknown>): number;
  sendRawStateDelta(topic: string, data: Record<string, unknown>): number;
  partition(): void;
  disconnect(): void;
}

declare global {
  interface Window {
    __nemosyneCollaborationHarness: CollaborationHarnessApi;
  }
}

const eventNames: EventName[] = [
  'connected',
  'disconnected',
  'peerJoined',
  'peerLeft',
  'peerState',
  'stateDelta',
  'remoteDatasetOperation',
];

let manager: NetworkManager | null = null;
const eventCounts = new Map<EventName, number>(eventNames.map((name) => [name, 0]));

function requireManager(): NetworkManager {
  if (!manager) throw new Error('collaboration harness is not connected');
  return manager;
}

function snapshot(): HarnessSnapshot {
  const current = requireManager();
  return {
    peerId: current.peerId,
    role: current.role,
    connected: current.isConnected,
    remotePeers: current.room.getRemoteSnapshot(),
    channels: [...current.channels.entries()].map(([peerId, channel]) => ({
      peerId,
      readyState: channel.readyState,
    })),
    eventCounts: Object.fromEntries(
      eventNames.map((name) => [name, eventCounts.get(name) ?? 0])
    ) as Record<EventName, number>,
  };
}

function sendRaw(payload: Record<string, unknown>): number {
  const current = requireManager();
  const encoded = JSON.stringify({ ...payload, peerId: current.peerId, timestamp: Date.now() });
  let sent = 0;
  for (const channel of current.channels.values()) {
    if (channel.readyState !== 'open') continue;
    channel.send(encoded);
    sent++;
  }
  return sent;
}

window.__nemosyneCollaborationHarness = {
  async connect({ roomId, peerId, role }: ConnectOptions): Promise<HarnessSnapshot> {
    if (manager) throw new Error('collaboration harness already has a manager');
    eventCounts.clear();
    for (const name of eventNames) eventCounts.set(name, 0);

    const signallingProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    manager = new NetworkManager({
      signallingUrl: `${signallingProtocol}//${location.host}/__signal`,
      roomId,
      peerId,
      peerName: peerId,
      role,
      // Keep the browser campaign deterministic and independent of public STUN.
      // Two Chromium contexts on one runner can negotiate through host candidates.
      iceServers: [],
    });

    for (const name of eventNames) {
      manager.addEventListener(name, () => {
        eventCounts.set(name, (eventCounts.get(name) ?? 0) + 1);
      });
    }

    await manager.connect(roomId);
    return snapshot();
  },

  snapshot,

  setLocalState(state: Record<string, unknown>): HarnessSnapshot {
    requireManager().setLocalState(state);
    return snapshot();
  },

  broadcastStateDelta(topic: string, data: Record<string, unknown>): boolean {
    return requireManager().broadcastStateDelta(topic, data);
  },

  broadcastDatasetOperation(op: Record<string, unknown>): boolean {
    return requireManager().broadcastDatasetOperation(op);
  },

  sendRawDatasetOperation(op: Record<string, unknown>): number {
    return sendRaw({ type: 'datasetOperation', op });
  },

  sendRawStateDelta(topic: string, data: Record<string, unknown>): number {
    return sendRaw({ type: 'delta', topic, data });
  },

  partition(): void {
    const current = requireManager();

    // Drop the data plane first so recovery has to rebuild WebRTC rather than
    // merely reconnecting signalling while an old data channel survives.
    for (const channel of current.channels.values()) {
      try {
        channel.close();
      } catch {
        // A simultaneous remote close is an equivalent partition outcome.
      }
    }

    // Force a transient signalling failure. SignallingChannel owns the retry
    // policy; this harness only injects the transport fault.
    const socket = current.signalling?._ws;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(4000, 'playwright collaboration partition');
    }
  },

  disconnect(): void {
    if (!manager) return;
    manager.disconnect();
    manager = null;
  },
};
