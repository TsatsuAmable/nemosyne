// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import { WorkspaceSurfaceManager } from '../src/vr/ui/WorkspaceSurfaceManager.ts';

class TestPanel extends MovablePanel {
  showCalls = 0;

  constructor(parent: THREE.Group, title: string, position: [number, number, number]) {
    super(parent, {
      title,
      width: 400,
      height: 300,
      position,
      worldSize: [0.5, 0.375],
      titleBarHeight: 40,
    });
  }

  override show(): void {
    this.showCalls += 1;
    super.show();
  }
}

function harness() {
  const cameraGroup = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);
  camera.position.set(0, 1.6, 0);
  cameraGroup.add(camera);
  const onChange = vi.fn();
  const manager = new WorkspaceSurfaceManager(cameraGroup, camera, { onChange });
  return { cameraGroup, camera, manager, onChange };
}

describe('WorkspaceSurfaceManager', () => {
  let cameraGroup: THREE.Group;
  let manager: WorkspaceSurfaceManager;

  beforeEach(() => {
    ({ cameraGroup, manager } = harness());
  });

  it('registers surfaces by stable id and unregisters them', () => {
    const panel = new TestPanel(cameraGroup, 'A', [0, 1.5, -1]);
    manager.register('a', panel);

    expect(manager.ids()).toEqual(['a']);
    expect(manager.idFor(panel)).toBe('a');
    expect(manager.panels).toContain(panel);

    manager.unregister('a');
    expect(manager.ids()).toEqual([]);
    expect(manager.idFor(panel)).toBeNull();
  });

  it('uses the panel show lifecycle rather than only flipping mesh visibility', () => {
    const panel = new TestPanel(cameraGroup, 'A', [0, 1.5, -1]);
    panel.hide();
    manager.register('a', panel);

    expect(manager.show('a')).toBe(true);
    expect(panel.showCalls).toBe(1);
    expect(panel.mesh.visible).toBe(true);
  });

  it('toggles surfaces independently', () => {
    const a = new TestPanel(cameraGroup, 'A', [0, 1.5, -1]);
    const b = new TestPanel(cameraGroup, 'B', [0.5, 1.5, -1]);
    manager.register('a', a);
    manager.register('b', b);

    manager.hide('a');
    expect(a.mesh.visible).toBe(false);
    expect(b.mesh.visible).toBe(true);

    manager.toggle('a');
    expect(a.mesh.visible).toBe(true);
    expect(b.mesh.visible).toBe(true);
  });

  it('recovers an off-view panel into its governed default position when opened', () => {
    const panel = new TestPanel(cameraGroup, 'A', [0.2, 1.5, -1]);
    manager.register('a', panel);
    panel.mesh.position.set(0, 1.5, 8);
    panel.hide();

    manager.show('a');

    expect(panel.mesh.position.toArray()).toEqual([0.2, 1.5, -1]);
    const world = new THREE.Vector3();
    const cameraWorld = new THREE.Vector3();
    panel.mesh.getWorldPosition(world);
    const camera = cameraGroup.children.find((child) => child instanceof THREE.Camera) as THREE.Camera;
    camera.getWorldPosition(cameraWorld);
    expect(world.distanceTo(cameraWorld)).toBeLessThan(2.5);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    expect(forward.dot(world.clone().sub(cameraWorld).normalize())).toBeGreaterThan(0);
  });

  it('enforces viewer-relative reachability even when the governed default is too far after anchor translation', () => {
    const local = harness();
    const analystAnchor = new THREE.Group();
    analystAnchor.position.set(0, 1.35, -1);
    local.cameraGroup.add(analystAnchor);
    const panel = new TestPanel(analystAnchor, 'FAR DEFAULT', [0, -0.3, -1.6]);
    local.manager.register('far', panel);
    panel.hide();

    local.manager.show('far');

    const viewer = new THREE.Vector3();
    const surface = new THREE.Vector3();
    local.camera.getWorldPosition(viewer);
    panel.mesh.getWorldPosition(surface);
    expect(surface.distanceTo(viewer)).toBeLessThanOrEqual(2.5);
    expect(surface.distanceTo(viewer)).toBeGreaterThanOrEqual(0.35);
  });

  it('recovers a surface whose persisted pose is implausibly far away', () => {
    const panel = new TestPanel(cameraGroup, 'A', [0, 1.5, -1]);
    manager.register('a', panel);
    panel.hide();

    manager.restorePositions([
      { id: 'a', title: 'A', position: [40, 2, -40], visible: true },
    ]);

    expect(panel.mesh.visible).toBe(true);
    expect(panel.mesh.position.toArray()).toEqual([0, 1.5, -1]);
  });

  it('captures and restores stable-id positions and visibility', () => {
    const a = new TestPanel(cameraGroup, 'A', [0, 1.5, -1]);
    const b = new TestPanel(cameraGroup, 'B', [0.5, 1.5, -1]);
    manager.register('a', a);
    manager.register('b', b);
    a.mesh.position.set(0.1, 1.4, -0.9);
    manager.hide('b');

    const snapshot = manager.capturePositions();
    expect(snapshot.find((entry) => entry.id === 'a')).toMatchObject({
      id: 'a',
      title: 'A',
      position: [0.1, 1.4, -0.9],
      visible: true,
    });
    expect(snapshot.find((entry) => entry.id === 'b')).toMatchObject({
      id: 'b',
      title: 'B',
      visible: false,
    });

    const restoredHarness = harness();
    const restoredA = new TestPanel(restoredHarness.cameraGroup, 'A', [0, 1.5, -1]);
    const restoredB = new TestPanel(restoredHarness.cameraGroup, 'B', [0.5, 1.5, -1]);
    restoredHarness.manager.register('a', restoredA);
    restoredHarness.manager.register('b', restoredB);
    restoredHarness.manager.restorePositions(snapshot);

    expect(restoredA.mesh.position.toArray()).toEqual([0.1, 1.4, -0.9]);
    expect(restoredA.mesh.visible).toBe(true);
    expect(restoredB.mesh.visible).toBe(false);
  });

  it('never restores by display title when a stable surface id is absent or unknown', () => {
    const first = new TestPanel(cameraGroup, 'DUPLICATE', [-0.4, 1.5, -1]);
    const second = new TestPanel(cameraGroup, 'DUPLICATE', [0.4, 1.5, -1]);
    manager.register('first', first);
    manager.register('second', second);

    manager.restorePositions([
      { id: 'missing', title: 'DUPLICATE', position: [0, 1.2, -0.6], visible: false },
    ]);

    expect(first.mesh.position.toArray()).toEqual([-0.4, 1.5, -1]);
    expect(second.mesh.position.toArray()).toEqual([0.4, 1.5, -1]);
    expect(first.mesh.visible).toBe(true);
    expect(second.mesh.visible).toBe(true);
  });

  it('recenters every registered surface using its own lifecycle when supplied', () => {
    const legacy = new TestPanel(cameraGroup, 'A', [0, 1.5, -1]);
    const spatial = new THREE.Group();
    spatial.visible = true;
    spatial.position.set(5, 5, 5);
    const resetSpatial = vi.fn(() => spatial.position.set(0.6, 1.4, -1.1));

    manager.register('legacy', legacy);
    manager.register(
      'spatial',
      { mesh: spatial, title: 'Spatial' },
      { recenter: resetSpatial }
    );
    legacy.mesh.position.set(-8, 3, 4);

    manager.recenterAll();

    expect(legacy.mesh.position.toArray()).toEqual([0, 1.5, -1]);
    expect(resetSpatial).toHaveBeenCalledOnce();
    expect(spatial.position.toArray()).toEqual([0.6, 1.4, -1.1]);
  });

  it('notifies persistence when a panel is directly minimized or dragged', () => {
    const { manager: notifiedManager, onChange } = harness();
    const panel = new TestPanel(cameraGroup, 'A', [0, 1.5, -1]);
    notifiedManager.register('a', panel);

    panel.hide();
    panel.onDragEnd?.();

    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
