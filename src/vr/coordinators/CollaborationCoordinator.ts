import * as THREE from 'three';
import { NetworkManager } from '../../network/NetworkManager.ts';
import { PeerAvatarManager } from '../../network/PeerAvatarManager.ts';
import { AsymmetricDesktopCompanion } from '../ui/AsymmetricDesktopCompanion.ts';
import type { SharedAnnotationManager, SpatialBookmark } from '../interactions/SharedAnnotationManager.ts';
import type { LooseOptions, NetworkEvent, NetworkManagerLike, WorldFacadeForCollaboration } from './types.ts';

/**
 * Owns WebRTC/WebSocket collaboration state, avatar meshes, spectator companion,
 * and network-panel updates.
 *
 * This coordinator keeps World.js free of connection-event wiring and reduces
 * the monolithic surface area for the future Rust/WASM networking port.
 */
export class CollaborationCoordinator {
  world: WorldFacadeForCollaboration;
  networkManager: NetworkManagerLike | null;
  peerAvatarManager: PeerAvatarManager | null = null;
  desktopCompanion: AsymmetricDesktopCompanion | null = null;

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
    const settings = (this.world.uiManager?.settingsPanel?.getAllSettings?.() ?? {}) as Record<string, unknown>;
    const targetRoom = (roomId ?? (settings.collabRoom as string | undefined) ?? 'default') as string;
    this.networkManager = new NetworkManager({
      signallingUrl: this._defaultSignallingUrl(),
      roomId: targetRoom,
      peerName: (settings.collabName as string | undefined) ?? 'Analyst',
    } as LooseOptions) as unknown as NetworkManagerLike;

    if (this.world.scene) {
      this.peerAvatarManager = new PeerAvatarManager(this.world.scene as unknown as THREE.Scene);
    }

    this.desktopCompanion = new AsymmetricDesktopCompanion({
      networkManager: this.networkManager as unknown as NetworkManager,
      annotationManager: this.world.annotationManager as unknown as SharedAnnotationManager,
      onFollowPeer: (peerId: string | null) => {
        if (peerId && this.peerAvatarManager) {
          const avatar = this.peerAvatarManager.getOrCreateAvatar(peerId);
          if (avatar && this.world.engine?.cameraGroup) {
            this.world.engine.cameraGroup.position.copy(avatar.headGroup.position);
          }
        }
      },
      onJumpToBookmark: (bm: SpatialBookmark) => {
        if (bm && bm.cameraPosition && this.world.engine?.cameraGroup) {
          const [x, y, z] = bm.cameraPosition;
          this.world.engine.cameraGroup.position.set(x, y, z);
        }
      },
    });

    this.world.uiManager?.networkPanel?.setStatus?.({
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

    if (this.peerAvatarManager) {
      this.peerAvatarManager.dispose();
      this.peerAvatarManager = null;
    }

    if (this.desktopCompanion) {
      this.desktopCompanion.render();
    }

    this.world.uiManager?.networkPanel?.setStatus?.({
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

  kickPeer(peerId: string): void {
    if (!this.networkManager) return;
    this.networkManager.kickPeer?.(peerId);
    this.peerAvatarManager?.removePeer(peerId);
    this.desktopCompanion?.render();
    this.world.uiManager?.vrConsole?.log?.('log', [`Peer removed: ${peerId}`]);
    this.world._logInteraction('Kick peer', { result: peerId });
  }

  update(): void {
    if (!this.networkManager?.isConnected || !this.world.engine?.camera) return;

    this.world.engine.camera.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    this.world.engine.camera.getWorldPosition(pos);
    this.world.engine.camera.getWorldQuaternion(rot);

    const posArray: [number, number, number] = [pos.x, pos.y, pos.z];
    const rotArray: [number, number, number, number] = [rot.x, rot.y, rot.z, rot.w];

    const groupPos = this.world.engine.cameraGroup?.position ?? pos;

    this.networkManager.broadcastCameraPose?.(posArray, rotArray);
    this.networkManager.setLocalState({
      position: { x: groupPos.x, y: groupPos.y, z: groupPos.z },
      rotationY: this.world.engine.cameraGroup?.rotation.y ?? 0,
      dataset: this.world.currentEntry?.name ?? this.world.currentEntry?.label ?? '-',
    });
  }

  _wireNetworkEvents(): void {
    if (!this.networkManager) return;
    this.networkManager.addEventListener('connected', (e: NetworkEvent) => {
      const roomId = String(e.detail?.roomId ?? this.networkManager!.roomId);
      this.world.uiManager?.networkPanel?.setStatus?.({
        roomId,
        connected: true,
        lastEvent: `Connected to ${roomId}`,
      });
      this.world.uiManager?.vrConsole?.log?.('log', [`Collaboration: joined ${roomId}`]);
      this.world.telemetryCollector?.recordOperation?.('network-connect');
      this.world._buildWheelMenu();
      this.desktopCompanion?.render();
    });
    this.networkManager.addEventListener('disconnected', () => {
      this.world.uiManager?.networkPanel?.setStatus?.({ connected: false, lastEvent: 'Disconnected' });
      this.world.uiManager?.vrConsole?.log?.('log', ['Collaboration: left room']);
      this.world.telemetryCollector?.recordOperation?.('network-disconnect');
      this.world._buildWheelMenu();
      this.desktopCompanion?.render();
    });
    this.networkManager.addEventListener('peerJoined', (e: NetworkEvent) => {
      const peers = this.networkManager!.room.getRemoteSnapshot();
      const peerName = String(e.detail?.name ?? e.detail?.peerId ?? '');
      const peerId = String(e.detail?.peerId ?? '');
      if (peerId && this.peerAvatarManager) {
        this.peerAvatarManager.getOrCreateAvatar(peerId);
      }
      this.world.uiManager?.networkPanel?.setStatus?.({
        peers,
        lastEvent: `${peerName} joined`,
      });
      this.world.uiManager?.vrConsole?.log?.('log', [`Peer joined: ${peerName}`]);
      this.world._logInteraction('Peer joined', { result: peerName });
      this.desktopCompanion?.render();
    });
    this.networkManager.addEventListener('peerLeft', (e: NetworkEvent) => {
      const peers = this.networkManager!.room.getRemoteSnapshot();
      const peerId = String(e.detail?.peerId ?? '');
      if (peerId && this.peerAvatarManager) {
        this.peerAvatarManager.removePeer(peerId);
      }
      this.world.uiManager?.networkPanel?.setStatus?.({ peers, lastEvent: `${peerId} left` });
      this.world.uiManager?.vrConsole?.log?.('log', [`Peer left: ${peerId}`]);
      this.world._logInteraction('Peer left', { result: peerId });
      this.desktopCompanion?.render();
    });
    this.networkManager.addEventListener('peerState', () => {
      this.world.telemetryCollector?.recordOperation?.('peer-state');
      this.desktopCompanion?.render();
    });
    this.networkManager.addEventListener('remoteCameraPose', (e: NetworkEvent) => {
      const detail = e.detail as {
        peerId?: string;
        position?: [number, number, number];
        rotation?: [number, number, number, number];
      } | undefined;
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
}
