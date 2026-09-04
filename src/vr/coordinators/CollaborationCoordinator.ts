import * as THREE from 'three';
import { NetworkManager } from '../../network/NetworkManager.ts';
import { PeerAvatarManager } from '../../network/PeerAvatarManager.ts';
import {
  readSignallingBrowserConfig,
  type BrowserSignallingRuntimeConfig,
} from '../../network/SignallingRuntimeConfig.ts';
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
  available?: boolean;
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
  /** Override for tests or an explicit composition root. Undefined resolves import.meta.env. */
  signallingConfig?: BrowserSignallingRuntimeConfig | null;
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
 * Production composition is capability-gated by a configured signalling URL.
 * Local Vite development retains its same-origin /__signal endpoint, while an
 * ordinary production bundle never guesses that a signalling service exists.
 */
export class CollaborationCoordinator {
  private readonly presence: CollaborationPresencePort;
  private readonly presentation: CollaborationPresentationPort;
  private readonly signallingConfig: BrowserSignallingRuntimeConfig | null;
  private generation = 0;
  networkManager: NetworkManagerLike | null;
  peerAvatarManager: PeerAvatarManager | null = null;
  desktopCompanion: AsymmetricDesktopCompanion | null = null;

  constructor({ presence, presentation, signallingConfig }: CollaborationCoordinatorOptions) {
    this.presence = presence;
    this.presentation = presentation;
    this.signallingConfig =
      signallingConfig === undefined
        ? readSignallingBrowserConfig(
            import.meta.env,
            typeof location === 'undefined' ? undefined : location.href
          )
        : signallingConfig;
    this.networkManager = null;
  }

  isAvailable(): boolean {
    return this.signallingConfig !== null;
  }

  _defaultSignallingUrl(): string {
    if (!this.signallingConfig) {
      throw new Error('collaboration signalling service is not configured');
    }
    return this.signallingConfig.url;
  }

  async joinCollaborationRoom(roomId: string | null = null): Promise<void> {
    if (this.networkManager?.isConnected) return;
    if (!this.signallingConfig) {
      const message = 'Collaboration unavailable: signalling service is not configured';
      this.presentation.setStatus({
        roomId: '-',
        connected: false,
        available: false,
        peers: [],
        lastEvent: message,
      });
      this.presentation.log(message);
      this.presentation.recordInteraction('Join room', {
        result: 'unavailable',
        reason: 'signalling-unconfigured',
      });
      return;
    }
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
      signallingUrl: this.signallingConfig.url,
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
      available: true,
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
      available: this.isAvailable(),
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
        available: true,
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
        available: true,
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
