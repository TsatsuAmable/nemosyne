import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NetworkPanel } from '../src/vr/ui/NetworkPanel.ts';
import { WorkspaceSurfaceManager } from '../src/vr/ui/WorkspaceSurfaceManager.ts';

describe('NetworkPanel UXR1 UIKit migration', () => {
  it('uses SpatialPanel-compatible lifecycle without legacy canvas rendering', () => {
    const anchor = new THREE.Group();
    const panel = new NetworkPanel(anchor, { roomId: 'alpha' });
    expect(panel.parent).toBe(anchor);
    expect(panel.mesh).toBe(panel);
    expect(panel.title).toBe('COLLABORATION');
    expect(panel.status.roomId).toBe('alpha');
    expect(panel.visible).toBe(true);

    panel.hide();
    expect(panel.visible).toBe(false);
    panel.show();
    expect(panel.visible).toBe(true);
  });

  it('preserves collaboration status updates and accessibility mutation', () => {
    const panel = new NetworkPanel(new THREE.Group());
    panel.setStatus({
      connected: true,
      roomId: 'research-room',
      peers: [{ peerId: 'abcdef123456', name: 'Peer A' }],
      lastEvent: 'joined',
    });
    expect(panel.status.connected).toBe(true);
    expect(panel.status.peers).toHaveLength(1);
    expect(() =>
      panel.applyAccessibility({
        textScale: 1.25,
        highContrast: true,
        colorblindMode: 'deuteranopia',
        reducedMotion: false,
      })
    ).not.toThrow();
  });

  it('uses the same workspace-surface lifecycle as legacy panels', () => {
    const cameraGroup = new THREE.Group();
    const anchor = new THREE.Group();
    cameraGroup.add(anchor);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    cameraGroup.add(camera);
    const manager = new WorkspaceSurfaceManager(cameraGroup, camera);
    const panel = new NetworkPanel(anchor);

    manager.registerPanel('network', panel);
    expect(manager.panels).toContain(panel);
    manager.hide('network');
    expect(panel.visible).toBe(false);
    manager.show('network');
    expect(panel.visible).toBe(true);

    const moved = panel.defaultPosition.clone().add(new THREE.Vector3(0.2, 0.1, 0));
    panel.position.copy(moved);
    manager.hide('network');
    manager.show('network');
    expect(panel.position.toArray()).toEqual(moved.toArray());

    manager.recenterAll();
    expect(panel.position.toArray()).toEqual(panel.defaultPosition.toArray());

    manager.dispose();
    panel.dispose();
  });
});
