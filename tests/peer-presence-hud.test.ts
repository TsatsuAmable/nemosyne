// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { PeerPresenceHUD, type PeerInfo } from '../src/vr/ui/PeerPresenceHUD.ts';

function makeCameraGroup(x = 0, z = 0): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 1.6, z);
  group.lookAt(x, 1.6, z - 1);
  group.updateMatrixWorld();
  return group;
}

describe('PeerPresenceHUD', () => {
  let cameraGroup: THREE.Group;
  let hud: PeerPresenceHUD;

  beforeEach(() => {
    cameraGroup = makeCameraGroup();
  });

  afterEach(() => {
    if (hud?.mesh) {
      const mat = hud.mesh.material as THREE.MeshBasicMaterial;
      mat.map?.dispose?.();
      mat.dispose?.();
      hud.mesh.geometry.dispose?.();
    }
  });

  it('creates a canvas-texture mesh attached to the follow anchor', () => {
    hud = new PeerPresenceHUD(cameraGroup, {
      getPeers: () => [],
      getLocalPeerId: () => null,
    });

    expect(hud.mesh).toBeTruthy();
    expect((hud.mesh.material as THREE.MeshBasicMaterial).map).toBeInstanceOf(THREE.CanvasTexture);
    expect(hud.mesh.parent).toBe(cameraGroup);
  });

  it('draws peer names when peers are present', () => {
    hud = new PeerPresenceHUD(cameraGroup, {
      getPeers: (): PeerInfo[] => [{ peerId: 'p1', name: 'Alice', state: {} }],
      getLocalPeerId: () => null,
    });

    hud.update();

    expect(hud._peerHash).not.toBe('');
  });

  it('marks the local peer as "You"', () => {
    hud = new PeerPresenceHUD(cameraGroup, {
      getPeers: (): PeerInfo[] => [{ peerId: 'me', name: 'Analyst', state: {} }],
      getLocalPeerId: () => 'me',
    });

    hud.update();

    expect(hud._peerHash).toContain('me');
  });

  it('does not update when hidden', () => {
    let calls = 0;
    hud = new PeerPresenceHUD(cameraGroup, {
      getPeers: (): PeerInfo[] => {
        calls++;
        return [];
      },
      getLocalPeerId: () => null,
    });

    hud.setEnabled(false);
    hud.update();
    expect(calls).toBe(0);
  });

  it('toggles visibility with setEnabled', () => {
    hud = new PeerPresenceHUD(cameraGroup, {
      getPeers: () => [],
      getLocalPeerId: () => null,
    });

    expect(hud.mesh.visible).toBe(true);
    hud.setEnabled(false);
    expect(hud.mesh.visible).toBe(false);
    hud.setEnabled(true);
    expect(hud.mesh.visible).toBe(true);
  });

  it('redraws when peer positions change', () => {
    const peers: PeerInfo[] = [{ peerId: 'p1', name: 'Alice', state: { position: { x: 1, y: 1.6, z: -2 } } }];
    hud = new PeerPresenceHUD(cameraGroup, {
      getPeers: () => peers,
      getLocalPeerId: () => null,
    });

    hud.update();
    const firstHash = hud._peerHash;

    peers[0].state!.position!.x = 5;
    hud.update();

    expect(hud._peerHash).not.toBe(firstHash);
  });
});
