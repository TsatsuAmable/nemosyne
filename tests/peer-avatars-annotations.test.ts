// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PeerAvatarManager } from '../src/network/PeerAvatarManager.ts';
import { SharedAnnotationManager } from '../src/network/SharedAnnotationManager.ts';

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

  it('adds and manages shared 3D spatial pin drop annotations', () => {
    const scene = new THREE.Scene();
    const annotMgr = new SharedAnnotationManager(scene);

    const pin = annotMgr.addAnnotation([0.2, 1.5, -0.8], 'Investigate Outlier Cluster', 'peer-analyst-1');

    expect(pin.text).toBe('Investigate Outlier Cluster');
    expect(annotMgr.getAnnotations().length).toBe(1);

    annotMgr.clearAnnotations();
    expect(annotMgr.getAnnotations().length).toBe(0);
  });
});
