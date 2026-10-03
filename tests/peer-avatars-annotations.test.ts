// @ts-nocheck
// CMS-4: the legacy network SharedAnnotationManager `it` retired with the
// superseded surface. The canonical annotation authority keeps its dedicated
// 12-test suite in tests/shared-annotations.test.ts (src/vr/interactions) plus
// tests/asymmetric-desktop-companion.test.ts; the avatar `it` pins the
// production PeerAvatarManager transform path.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PeerAvatarManager } from '../src/network/PeerAvatarManager.ts';

describe('Sprint 15.2 & 15.3: Peer Avatars & Shared Annotations Suite', () => {
  it('creates and updates peer avatar head/hand transforms in Three.js scene', () => {
    const scene = new THREE.Scene();
    const avatarMgr = new PeerAvatarManager(scene);

    avatarMgr.updatePeerTransforms({
      peerId: 'peer-remote-100',
      cameraPose: { position: [0.5, 1.6, -1.0], rotation: [0, 0, 0, 1] },
      lastUpdatedMs: Date.now(),
    });

    expect(avatarMgr.getAvatarCount()).toBe(1);
    expect(scene.children.length).toBe(3); // head + leftHand + rightHand

    avatarMgr.removePeer('peer-remote-100');
    expect(avatarMgr.getAvatarCount()).toBe(0);
    expect(scene.children.length).toBe(0);
  });
});
