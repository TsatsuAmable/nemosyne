// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { PeerAvatarManager } from '../src/network/PeerAvatarManager.ts';
import { NetworkManager } from '../src/network/NetworkManager.ts';
import { BinaryPoseSerializer } from '../src/network/BinaryPoseSerializer.ts';
import { sha256Uint31 } from '../src/security/CryptoHash.ts';
import { CollaborationCoordinator } from '../src/vr/coordinators/CollaborationCoordinator.ts';
import { AsymmetricDesktopCompanion } from '../src/vr/ui/AsymmetricDesktopCompanion.ts';

describe('Sprint 22.5 Collaboration Embodied Presence', () => {
  describe('PeerAvatarManager', () => {
    it('creates and manages avatar meshes within three.js scene', () => {
      const scene = new THREE.Scene();
      const manager = new PeerAvatarManager(scene);

      expect(manager.getAvatarCount()).toBe(0);

      const avatar = manager.getOrCreateAvatar('peer-1');
      expect(avatar).toBeDefined();
      expect(avatar.peerId).toBe('peer-1');
      expect(avatar.headGroup).toBeDefined();
      expect(avatar.leftHandMesh).toBeDefined();
      expect(avatar.rightHandMesh).toBeDefined();
      expect(avatar.laserPointer).toBeDefined();
      expect(scene.children).toContain(avatar.headGroup);
      expect(scene.children).toContain(avatar.leftHandMesh);
      expect(scene.children).toContain(avatar.rightHandMesh);
      expect(manager.getAvatarCount()).toBe(1);

      // Update transforms
      manager.updatePeerTransforms({
        peerId: 'peer-1',
        cameraPose: {
          position: [1, 2, 3],
          rotation: [0, 0, 0, 1],
        },
        lastUpdatedMs: Date.now(),
      });

      expect(avatar.headGroup.position.x).toBe(1);
      expect(avatar.headGroup.position.y).toBe(2);
      expect(avatar.headGroup.position.z).toBe(3);

      // Remove peer
      manager.removePeer('peer-1');
      expect(manager.getAvatarCount()).toBe(0);
      expect(scene.children).not.toContain(avatar.headGroup);
    });
  });

  describe('NetworkManager binary pose & moderation', () => {
    it('serializes and broadcasts binary camera pose', () => {
      const nm = new NetworkManager({ peerId: 'test-local-peer' });
      nm._connected = true;

      const mockChannel = {
        readyState: 'open',
        send: vi.fn(),
        addEventListener: vi.fn(),
      } as unknown as RTCDataChannel;

      nm.channels.set('remote-peer-1', mockChannel);

      nm.broadcastCameraPose([1.5, 2.0, -3.0], [0, 0.7071, 0, 0.7071]);

      expect(mockChannel.send).toHaveBeenCalledTimes(1);
      const sentBuffer = vi.mocked(mockChannel.send).mock.calls[0][0] as ArrayBuffer;
      expect(sentBuffer).toBeInstanceOf(ArrayBuffer);
      expect(sentBuffer.byteLength).toBe(40);

      const deserialized = BinaryPoseSerializer.deserialize(sentBuffer);
      expect(deserialized).not.toBeNull();
      expect(deserialized?.position[0]).toBeCloseTo(1.5, 3);
      expect(deserialized?.position[1]).toBeCloseTo(2.0, 3);
      expect(deserialized?.position[2]).toBeCloseTo(-3.0, 3);
      expect(deserialized?.rotation[3]).toBeCloseTo(0.7071, 3);
    });

    it('receives binary pose message and dispatches remoteCameraPose', () => {
      const nm = new NetworkManager({ peerId: 'test-local-peer' });
      const poseListener = vi.fn();
      nm.addEventListener('remoteCameraPose', poseListener);

      const mockChannel = {
        readyState: 'open',
        send: vi.fn(),
        addEventListener: vi.fn(),
      } as unknown as RTCDataChannel;

      // Signalling admission is the role authority: channels wired without an
      // admitted role are rejected and their messages dropped.
      nm.peerRoles.set('remote-peer-2', 'participant');
      nm._wireChannel('remote-peer-2', mockChannel, 'participant');

      // Find the message event listener
      const messageCall = vi.mocked(mockChannel.addEventListener).mock.calls.find(
        (call) => call[0] === 'message'
      );
      expect(messageCall).toBeDefined();
      const messageHandler = messageCall![1] as (e: { data: unknown }) => void;

      // The payload numeric ID must match the channel-bound peer's deterministic
      // digest; mismatched numeric identity fails closed (RF-057).
      const buffer = BinaryPoseSerializer.serialize({
        peerId: sha256Uint31('remote-peer-2'),
        sequence: 1,
        position: [0.5, 1.2, -0.8],
        rotation: [0, 1, 0, 0],
      });

      messageHandler({ data: buffer });

      expect(poseListener).toHaveBeenCalledTimes(1);
      const eventDetail = poseListener.mock.calls[0][0].detail;
      expect(eventDetail.peerId).toBe('remote-peer-2');
      expect(eventDetail.position[0]).toBeCloseTo(0.5, 3);
      expect(eventDetail.position[1]).toBeCloseTo(1.2, 3);
      expect(eventDetail.position[2]).toBeCloseTo(-0.8, 3);
    });

    it('kicks a peer and cleans up connection and room state', () => {
      const nm = new NetworkManager({ peerId: 'host-peer' });
      const peerLeftSpy = vi.fn();
      nm.addEventListener('peerLeft', peerLeftSpy);

      const mockClose = vi.fn();
      const mockConn = { close: mockClose } as unknown as RTCPeerConnection;
      const mockChannel = { close: vi.fn() } as unknown as RTCDataChannel;

      nm.connections.set('troll-peer', mockConn);
      nm.channels.set('troll-peer', mockChannel);
      nm.room.addPeer('troll-peer', 'Troll');

      nm.kickPeer('troll-peer');

      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(nm.connections.has('troll-peer')).toBe(false);
      expect(nm.channels.has('troll-peer')).toBe(false);
      expect(nm.room.peers.has('troll-peer')).toBe(false);
      expect(peerLeftSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: { peerId: 'troll-peer' } }));
    });
  });

  describe('CollaborationCoordinator integration', () => {
    it('instantiates avatars and spectator companion on room join and handles remote poses', async () => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const cameraGroup = new THREE.Group();
      cameraGroup.position.set(0, 1.6, 0);

      const mockWorld = {
        scene,
        engine: {
          camera,
          cameraGroup,
        },
        uiManager: {
          networkPanel: { setStatus: vi.fn() },
          vrConsole: { log: vi.fn() },
          settingsPanel: { getAllSettings: () => ({ collabRoom: 'test-room', collabName: 'Analyst' }) },
        },
        _logInteraction: vi.fn(),
        _buildWheelMenu: vi.fn(),
      };

      const coordinator = new CollaborationCoordinator({ world: mockWorld });
      expect(coordinator.peerAvatarManager).toBeNull();
      expect(coordinator.desktopCompanion).toBeNull();

      // Mock connection
      vi.spyOn(NetworkManager.prototype, 'connect').mockResolvedValue(undefined);

      await coordinator.joinCollaborationRoom('test-room');
      const nm = coordinator.networkManager as unknown as NetworkManager;
      nm._connected = true;

      expect(coordinator.peerAvatarManager).toBeDefined();
      expect(coordinator.desktopCompanion).toBeDefined();
      expect(coordinator.desktopCompanion).toBeInstanceOf(AsymmetricDesktopCompanion);

      // Simulate incoming remoteCameraPose event
      nm.dispatchEvent(
        new CustomEvent('remoteCameraPose', {
          detail: {
            peerId: 'peer-remote',
            position: [2.0, 1.8, -1.0],
            rotation: [0, 0, 0, 1],
          },
        })
      );

      const avatar = coordinator.peerAvatarManager?.getOrCreateAvatar('peer-remote');
      expect(avatar?.headGroup.position.x).toBe(2.0);
      expect(avatar?.headGroup.position.y).toBe(1.8);
      expect(avatar?.headGroup.position.z).toBe(-1.0);

      // Test follow peer via desktop companion callback
      coordinator.desktopCompanion?.onFollowPeer?.('peer-remote');
      expect(cameraGroup.position.x).toBe(2.0);

      // Test jump to bookmark via desktop companion callback
      coordinator.desktopCompanion?.onJumpToBookmark?.({
        id: 'bm-1',
        title: 'Cluster 3 View',
        cameraPosition: [5.0, 4.0, 3.0],
        cameraRotation: [0, 0, 0, 1],
        authorId: 'peer-remote',
        timestamp: Date.now(),
      });
      expect(cameraGroup.position.x).toBe(5.0);
      expect(cameraGroup.position.y).toBe(4.0);
      expect(cameraGroup.position.z).toBe(3.0);

      // Test kick peer
      coordinator.kickPeer('peer-remote');
      expect(mockWorld._logInteraction).toHaveBeenCalledWith('Kick peer', { result: 'peer-remote' });

      // Leave room
      coordinator.leaveCollaborationRoom();
      expect(coordinator.peerAvatarManager).toBeNull();
      expect(coordinator.isConnected()).toBe(false);
    });
  });
});
