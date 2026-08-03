import { NetworkManager } from '../../network/NetworkManager.js';

/**
 * Owns WebRTC/WebSocket collaboration state and network-panel updates.
 *
 * This coordinator keeps World.js free of connection-event wiring and reduces
 * the monolithic surface area for the future Rust/WASM networking port.
 */
export class CollaborationCoordinator {
  constructor({ world }) {
    this.world = world;
    this.networkManager = null;
  }

  _defaultSignallingUrl() {
    if (typeof location === 'undefined') return 'wss://localhost:5173/__signal';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__signal`;
  }

  async joinCollaborationRoom(roomId = null) {
    if (this.networkManager?.isConnected) return;
    const settings = this.world.settingsPanel.getAllSettings();
    const targetRoom = roomId ?? settings.collabRoom ?? 'default';
    this.networkManager = new NetworkManager({
      signallingUrl: this._defaultSignallingUrl(),
      roomId: targetRoom,
      peerName: settings.collabName ?? 'Analyst',
    });
    this.world.networkPanel.setStatus({
      roomId: targetRoom,
      connected: false,
      peers: [],
      lastEvent: 'Joining...',
    });
    this._wireNetworkEvents();
    this.world._logInteraction('Join room', { result: targetRoom });
    return this.networkManager.connect(targetRoom);
  }

  leaveCollaborationRoom() {
    if (!this.networkManager) return;
    const roomId = this.networkManager.roomId;
    this.networkManager.disconnect();
    this.networkManager = null;
    this.world.networkPanel.setStatus({
      roomId: '-',
      connected: false,
      peers: [],
      lastEvent: 'Left room',
    });
    this.world._logInteraction('Leave room', { result: roomId });
  }

  isConnected() {
    return this.networkManager?.isConnected ?? false;
  }

  _wireNetworkEvents() {
    if (!this.networkManager) return;
    this.networkManager.addEventListener('connected', (e) => {
      const roomId = e.detail?.roomId ?? this.networkManager.roomId;
      this.world.networkPanel.setStatus({
        roomId,
        connected: true,
        lastEvent: `Connected to ${roomId}`,
      });
      this.world.vrConsole?.log?.('log', [`Collaboration: joined ${roomId}`]);
      this.world.telemetryCollector?.recordOperation?.('network-connect');
      this.world._buildWheelMenu();
    });
    this.networkManager.addEventListener('disconnected', () => {
      this.world.networkPanel.setStatus({ connected: false, lastEvent: 'Disconnected' });
      this.world.vrConsole?.log?.('log', ['Collaboration: left room']);
      this.world.telemetryCollector?.recordOperation?.('network-disconnect');
      this.world._buildWheelMenu();
    });
    this.networkManager.addEventListener('peerJoined', (e) => {
      const peers = this.networkManager.room.getPeers();
      this.world.networkPanel.setStatus({
        peers,
        lastEvent: `${e.detail?.name ?? e.detail?.peerId} joined`,
      });
      this.world.vrConsole?.log?.('log', [`Peer joined: ${e.detail?.name ?? e.detail?.peerId}`]);
      this.world._logInteraction('Peer joined', { result: e.detail?.name ?? e.detail?.peerId });
    });
    this.networkManager.addEventListener('peerLeft', (e) => {
      const peers = this.networkManager.room.getPeers();
      this.world.networkPanel.setStatus({ peers, lastEvent: `${e.detail?.peerId} left` });
      this.world.vrConsole?.log?.('log', [`Peer left: ${e.detail?.peerId}`]);
      this.world._logInteraction('Peer left', { result: e.detail?.peerId });
    });
    this.networkManager.addEventListener('peerState', () => {
      this.world.telemetryCollector?.recordOperation?.('peer-state');
    });
  }
}
