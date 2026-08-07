import { NetworkManager } from '../../network/NetworkManager.ts';
import type { LooseOptions, NetworkEvent, NetworkManagerLike, WorldFacadeForCollaboration } from './types.ts';

/**
 * Owns WebRTC/WebSocket collaboration state and network-panel updates.
 *
 * This coordinator keeps World.js free of connection-event wiring and reduces
 * the monolithic surface area for the future Rust/WASM networking port.
 */
export class CollaborationCoordinator {
  world: WorldFacadeForCollaboration;
  networkManager: NetworkManagerLike | null;

  constructor({ world }: { world: WorldFacadeForCollaboration }) {
    this.world = world;
    this.networkManager = null;
  }

  _defaultSignallingUrl(): string {
    if (typeof location === 'undefined') return 'wss://localhost:5173/__signal';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__signal`;
  }

  async joinCollaborationRoom(roomId: string | null = null): Promise<void> {
    if (this.networkManager?.isConnected) return;
    const settings = this.world.settingsPanel!.getAllSettings();
    const targetRoom = (roomId ?? (settings.collabRoom as string | undefined) ?? 'default') as string;
    this.networkManager = new NetworkManager({
      signallingUrl: this._defaultSignallingUrl(),
      roomId: targetRoom,
      peerName: (settings.collabName as string | undefined) ?? 'Analyst',
    } as LooseOptions) as unknown as NetworkManagerLike;
    this.world.networkPanel!.setStatus({
      roomId: targetRoom,
      connected: false,
      peers: [],
      lastEvent: 'Joining...',
    });
    this._wireNetworkEvents();
    this.world._logInteraction('Join room', { result: targetRoom });
    return this.networkManager.connect(targetRoom);
  }

  leaveCollaborationRoom(): void {
    if (!this.networkManager) return;
    const roomId = this.networkManager.roomId;
    this.networkManager.disconnect();
    this.networkManager = null;
    this.world.networkPanel!.setStatus({
      roomId: '-',
      connected: false,
      peers: [],
      lastEvent: 'Left room',
    });
    this.world._logInteraction('Leave room', { result: roomId });
  }

  isConnected(): boolean {
    return this.networkManager?.isConnected ?? false;
  }

  _wireNetworkEvents(): void {
    if (!this.networkManager) return;
    this.networkManager.addEventListener('connected', (e: NetworkEvent) => {
      const roomId = String(e.detail?.roomId ?? this.networkManager!.roomId);
      this.world.networkPanel!.setStatus({
        roomId,
        connected: true,
        lastEvent: `Connected to ${roomId}`,
      });
      this.world.vrConsole?.log?.('log', [`Collaboration: joined ${roomId}`]);
      this.world.telemetryCollector?.recordOperation?.('network-connect');
      this.world._buildWheelMenu();
    });
    this.networkManager.addEventListener('disconnected', () => {
      this.world.networkPanel!.setStatus({ connected: false, lastEvent: 'Disconnected' });
      this.world.vrConsole?.log?.('log', ['Collaboration: left room']);
      this.world.telemetryCollector?.recordOperation?.('network-disconnect');
      this.world._buildWheelMenu();
    });
    this.networkManager.addEventListener('peerJoined', (e: NetworkEvent) => {
      const peers = this.networkManager!.room.getRemoteSnapshot();
      const peerName = String(e.detail?.name ?? e.detail?.peerId ?? '');
      this.world.networkPanel!.setStatus({
        peers,
        lastEvent: `${peerName} joined`,
      });
      this.world.vrConsole?.log?.('log', [`Peer joined: ${peerName}`]);
      this.world._logInteraction('Peer joined', { result: peerName });
    });
    this.networkManager.addEventListener('peerLeft', (e: NetworkEvent) => {
      const peers = this.networkManager!.room.getRemoteSnapshot();
      const peerId = String(e.detail?.peerId ?? '');
      this.world.networkPanel!.setStatus({ peers, lastEvent: `${peerId} left` });
      this.world.vrConsole?.log?.('log', [`Peer left: ${peerId}`]);
      this.world._logInteraction('Peer left', { result: peerId });
    });
    this.networkManager.addEventListener('peerState', () => {
      this.world.telemetryCollector?.recordOperation?.('peer-state');
    });
  }
}
