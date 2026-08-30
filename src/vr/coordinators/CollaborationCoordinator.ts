import * as THREE from 'three';
import { NetworkManager } from '../../network/NetworkManager.ts';
import { PeerAvatarManager } from '../../network/PeerAvatarManager.ts';
import { AsymmetricDesktopCompanion } from '../ui/AsymmetricDesktopCompanion.ts';
import type {
  SharedAnnotationManager,
  SpatialBookmark,
} from '../interactions/SharedAnnotationManager.ts';
import type { LooseOptions } from './types.ts';

export interface CollaborationPresencePort {
  scene: THREE.Scene;
  camera: THREE.Camera;
  cameraGroup: THREE.Group;
  annotationManager: SharedAnnotationManager | null;
  getDatasetLabel(): string;
}

export interface CollaborationStatus {
  roomId?: string;
  connected?: boolean;
  peers?: Array<{ peerId: string; name?: string }>;
  lastEvent?: string | null;
}

export interface CollaborationPresentationPort {
  getSettings(): Record<string, unknown>;
  setStatus(status: CollaborationStatus): void;
  log(message: string): void;
  recordInteraction(action: string, details: Record<string, unknown>): void;
  recordTelemetry(operation: string): void;
}

export interface CollaborationCoordinatorOptions {
  presence: CollaborationPresencePort;
  presentation: CollaborationPresentationPort;
}

export interface NetworkEvent {
  type: string;
  peerId?: string;
  name?: string;
  detail?: Record<string, unknown>;
  data?: unknown;
  [key: string]: unknown;
}

export interface NetworkManagerLike {
  isConnected: boolean;
  roomId: string;
  room: {
    getRemoteSnapshot(): Array<{ peerId: string; name?: string }>;
    getPeerIds?(): string[];
    peers?: Map<string, unknown>;
  };
  peerId: string;
  addEventListener(type: string, handler: (event: NetworkEvent) => void): void;
  connect(roomId?: string): Promise<void>;
  disconnect(): void;
  setLocalState(state: Record<string, unknown>): void;
  broadcastCameraPose?(
    position: [number, number, number],
    rotation: [number, number, number, number]
  ): void;
  kickPeer?(peerId: string): void;
}

/**
 * Owns WebRTC/WebSocket collaboration state, avatar meshes, spectator companion,
 * and network-panel updates.
 *
 * This coordinator keeps World.js free of connection-event wiring and reduces
 * the monolithic surface area for the future Rust/WASM networking port.
 */
export class CollaborationCoordinator {
  private readonly presence: CollaborationPresencePort;
  private readonly presentation: CollaborationPresentationPort;
  private generation = 0;
  networkManager: NetworkManagerLike | null;
  peerAvatarManager: PeerAvatarManager | null = null;
  desktopCompanion: AsymmetricDesktopCompanion | null = null;

  constructor({ presence, presentation }: CollaborationCoordinatorOptions) {
    this.presence = presence;
    this.presentation = presentation;
    this.networkManager = null;
  }

  _defaultSignallingUrl(): string {
    if (typeof location === 'undefined') return 'wss://localhost:5173/__signal';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__signal`;
  }

  async joinCollaborationRoom(roomId: string | null = null): Promise<void> {
    if (this.networkManager?.isConnected) return;
    if (this.networkManager) {
      this.generation += 1;
      this.teardown(this.networkManager);
    }
    const generation = ++this.generation;
    const settings = this.presentation.getSettings();
    const targetRoom = (roomId ??
      (settings.collabRoom as string | undefined) ??
      'default') as string;
    const networkManager = new NetworkManager({
      signallingUrl: this._defaultSignallingUrl(),
      roomId: targetRoom,
      peerName: (settings.collabName as string | undefined) ?? 'Analyst',
    } as LooseOptions) as unknown as NetworkManagerLike;
    this.networkManager = networkManager;

    this.peerAvatarManager = new PeerAvatarManager(this.presence.scene);

    this.desktopCompanion = new AsymmetricDesktopCompanion({
      networkManager: networkManager as unknown as NetworkManager,
      annotationManager: this.presence.annotationManager,
      onFollowPeer: (peerId: string | null) => {
        if (peerId && this.peerAvatarManager) {
          const avatar = this.peerAvatarManager.getOrCreateAvatar(peerId);
          if (avatar) this.presence.cameraGroup.position.copy(avatar.headGroup.position);
        }
      },
      onJumpToBookmark: (bm: SpatialBookmark) => {
        if (bm?.cameraPosition) {
          const [x, y, z] = bm.cameraPosition;
          this.presence.cameraGroup.position.set(x, y, z);
        }
      },
    });

    this.presentation.setStatus({
      roomId: targetRoom,
      connected: false,
      peers: [],
      lastEvent: 'Joining...',
    });
    this._wireNetworkEvents(networkManager, generation);
    this.presentation.recordInteraction('Join room', { result: targetRoom });
    try {
      await networkManager.connect(targetRoom);
    } catch (error) {
      if (this.isCurrent(networkManager, generation)) this.teardown(networkManager);
      throw error;
    }
  }

  leaveCollaborationRoom(): void {
    const networkManager = this.networkManager;
    if (!networkManager) return;
    const roomId = networkManager.roomId;
    this.generation += 1;
    this.teardown(networkManager);
    this.presentation.setStatus({
      roomId: '-',
      connected: false,
      peers: [],
      lastEvent: 'Left room',
    });
    this.presentation.recordInteraction('Leave room', { result: roomId });
  }

  isConnected(): boolean {
    return this.networkManager?.isConnected ?? false;
  }

  dispose(): void {
    this.leaveCollaborationRoom();
  }

  kickPeer(peerId: string): void {
    if (!this.networkManager) return;
    this.networkManager.kickPeer?.(peerId);
    this.peerAvatarManager?.removePeer(peerId);
    this.desktopCompanion?.render();
    this.presentation.log(`Peer removed: ${peerId}`);
    this.presentation.recordInteraction('Kick peer', { result: peerId });
  }

  update(): void {
    if (!this.networkManager?.isConnected) return;

    this.presence.camera.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    this.presence.camera.getWorldPosition(pos);
    this.presence.camera.getWorldQuaternion(rot);

    const posArray: [number, number, number] = [pos.x, pos.y, pos.z];
    const rotArray: [number, number, number, number] = [rot.x, rot.y, rot.z, rot.w];

    const groupPos = this.presence.cameraGroup.position;

    this.networkManager.broadcastCameraPose?.(posArray, rotArray);
    this.networkManager.setLocalState({
      position: { x: groupPos.x, y: groupPos.y, z: groupPos.z },
      rotationY: this.presence.cameraGroup.rotation.y,
      dataset: this.presence.getDatasetLabel(),
    });
  }

  private _wireNetworkEvents(networkManager: NetworkManagerLike, generation: number): void {
    networkManager.addEventListener('connected', (e: NetworkEvent) => {
      if (!this.isCurrent(networkManager, generation)) return;
      const roomId = String(e.detail?.roomId ?? networkManager.roomId);
      this.presentation.setStatus({
        roomId,
        connected: true,
        lastEvent: `Connected to ${roomId}`,
      });
      this.presentation.log(`Collaboration: joined ${roomId}`);
      this.presentation.recordTelemetry('network-connect');
      this.desktopCompanion?.render();
    });
    networkManager.addEventListener('disconnected', () => {
      if (!this.isCurrent(networkManager, generation)) return;
      this.presentation.setStatus({
        connected: false,
        lastEvent: 'Disconnected',
      });
      this.presentation.log('Collaboration: left room');
      this.presentation.recordTelemetry('network-disconnect');
      this.desktopCompanion?.render();
    });
    networkManager.addEventListener('peerJoined', (e: NetworkEvent) => {
      if (!this.isCurrent(networkManager, generation)) return;
      const peers = networkManager.room.getRemoteSnapshot();
      const peerName = String(e.detail?.name ?? e.detail?.peerId ?? '');
      const peerId = String(e.detail?.peerId ?? '');
      if (peerId && this.peerAvatarManager) {
        this.peerAvatarManager.getOrCreateAvatar(peerId);
      }
      this.presentation.setStatus({
        peers,
        lastEvent: `${peerName} joined`,
      });
      this.presentation.log(`Peer joined: ${peerName}`);
      this.presentation.recordInteraction('Peer joined', { result: peerName });
      this.desktopCompanion?.render();
    });
    networkManager.addEventListener('peerLeft', (e: NetworkEvent) => {
      if (!this.isCurrent(networkManager, generation)) return;
      const peers = networkManager.room.getRemoteSnapshot();
      const peerId = String(e.detail?.peerId ?? '');
      if (peerId && this.peerAvatarManager) {
        this.peerAvatarManager.removePeer(peerId);
      }
      this.presentation.setStatus({ peers, lastEvent: `${peerId} left` });
      this.presentation.log(`Peer left: ${peerId}`);
      this.presentation.recordInteraction('Peer left', { result: peerId });
      this.desktopCompanion?.render();
    });
    networkManager.addEventListener('peerState', () => {
      if (!this.isCurrent(networkManager, generation)) return;
      this.presentation.recordTelemetry('peer-state');
      this.desktopCompanion?.render();
    });
    networkManager.addEventListener('remoteCameraPose', (e: NetworkEvent) => {
      if (!this.isCurrent(networkManager, generation)) return;
      const detail = e.detail as
        | {
            peerId?: string;
            position?: [number, number, number];
            rotation?: [number, number, number, number];
          }
        | undefined;
      if (detail?.peerId && detail.position && detail.rotation && this.peerAvatarManager) {
        this.peerAvatarManager.updatePeerTransforms({
          peerId: detail.peerId,
          cameraPose: {
            position: detail.position,
            rotation: detail.rotation,
          },
          lastUpdatedMs: Date.now(),
        });
      }
    });
  }

  private isCurrent(networkManager: NetworkManagerLike, generation: number): boolean {
    return this.networkManager === networkManager && this.generation === generation;
  }

  private teardown(networkManager: NetworkManagerLike): void {
    networkManager.disconnect();
    if (this.networkManager === networkManager) this.networkManager = null;
    this.peerAvatarManager?.dispose();
    this.peerAvatarManager = null;
    this.desktopCompanion?.dispose();
    this.desktopCompanion = null;
  }
}
