// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { HandWheelMenu } from '../src/vr/ui/HandWheelMenu.ts';

function makeEngineWithCamera() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
  camera.position.set(0, 1.6, 0);
  scene.add(camera);
  return { camera, scene };
}

function makeMockHand() {
  const group = new THREE.Group();
  return { group, handedness: 'left' };
}

describe('HandWheelMenu', () => {
  let engine;
  let hand;

  beforeEach(() => {
    engine = makeEngineWithCamera();
    hand = makeMockHand();
  });

  it('is hidden by default and can be toggled', () => {
    const menu = new HandWheelMenu(engine, hand);
    expect(menu.isVisible()).toBe(false);

    menu.toggle();
    expect(menu.isVisible()).toBe(true);

    menu.hide();
    expect(menu.isVisible()).toBe(false);

    menu.show();
    expect(menu.isVisible()).toBe(true);
  });

  it('creates one category node plus one action node per flat action', () => {
    const menu = new HandWheelMenu(engine, hand, {
      actions: [
        { id: 'a', label: 'Alpha', callback: () => {} },
        { id: 'b', label: 'Beta', callback: () => {} },
        { id: 'c', label: 'Gamma', callback: () => {} },
      ],
    });

    expect(menu._categoryMeshes.length).toBe(1);
    expect(menu._actionMeshes.length).toBe(3);
    expect(menu.group.children.length).toBeGreaterThanOrEqual(4);
  });

  it('rebuilds menu when flat actions are replaced', () => {
    const menu = new HandWheelMenu(engine, hand, {
      actions: [{ id: 'a', label: 'A', callback: () => {} }],
    });

    expect(menu._categoryMeshes.length).toBe(1);
    expect(menu._actionMeshes.length).toBe(1);

    menu.setActions([
      { id: 'x', label: 'X', callback: () => {} },
      { id: 'y', label: 'Y', callback: () => {} },
    ]);

    expect(menu._categoryMeshes.length).toBe(1);
    expect(menu._actionMeshes.length).toBe(2);
  });

  it('selects an action when its segment is hit by a ray', () => {
    const calls = [];
    const menu = new HandWheelMenu(engine, hand, {
      actions: [
        { id: 'a', label: 'Alpha', callback: () => calls.push('a') },
        { id: 'b', label: 'Beta', callback: () => calls.push('b') },
      ],
    });
    menu.show();
    menu.update();

    // Select the single category so its actions appear.
    const cat = menu._categoryMeshes[0];
    const catTarget = cat.getWorldPosition(new THREE.Vector3());
    const catOrigin = catTarget.clone().add(new THREE.Vector3(0, 0.05, 0.2));
    menu.handlePointerClick(new THREE.Raycaster(catOrigin, catTarget.sub(catOrigin).normalize()));
    menu.update();

    // Aim at the first action node.
    const target = menu._actionMeshes[0].getWorldPosition(new THREE.Vector3());
    const origin = target.clone().add(new THREE.Vector3(0, 0.05, 0.2));
    const raycaster = new THREE.Raycaster(origin, target.sub(origin).normalize());

    const consumed = menu.handlePointerClick(raycaster);
    expect(consumed).toBe(true);
    expect(calls.length).toBe(1);
    expect(menu.isVisible()).toBe(false);
  });

  it('returns false when no segment is hit', () => {
    const menu = new HandWheelMenu(engine, hand, {
      actions: [{ id: 'a', label: 'A', callback: () => {} }],
    });
    menu.show();

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1, 0, 0));

    expect(menu.handlePointerClick(raycaster)).toBe(false);
    expect(menu.isVisible()).toBe(true);
  });

  it('does not handle clicks while hidden', () => {
    let called = false;
    const menu = new HandWheelMenu(engine, hand, {
      actions: [{ id: 'a', label: 'A', callback: () => (called = true) }],
    });

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));

    expect(menu.handlePointerClick(raycaster)).toBe(false);
    expect(called).toBe(false);
  });

  it('faces the camera when updated', () => {
    const menu = new HandWheelMenu(engine, hand, {
      actions: [{ id: 'a', label: 'A', callback: () => {} }],
    });
    menu.show();
    menu.group.position.set(0.5, 0, -0.5);

    // Before update the wheel keeps its default orientation.
    const before = new THREE.Vector3(0, 0, 1).applyQuaternion(menu.group.quaternion).clone();

    menu.update();

    // After update the wheel's +Z should point toward the camera at (0,1.6,0).
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(menu.group.quaternion);
    const toCamera = engine.camera.position
      .clone()
      .sub(menu.group.getWorldPosition(new THREE.Vector3()))
      .normalize();
    expect(forward.dot(toCamera)).toBeGreaterThan(0.9);
    expect(forward.distanceTo(before)).toBeGreaterThan(0.1);
  });

  it('clears geometry and materials on dispose', () => {
    const menu = new HandWheelMenu(engine, hand, {
      actions: [
        { id: 'a', label: 'A', callback: () => {} },
        { id: 'b', label: 'B', callback: () => {} },
      ],
    });

    menu.dispose();
    expect(menu._categoryMeshes.length).toBe(0);
    expect(menu._actionMeshes.length).toBe(0);
    expect(menu.group.children.length).toBe(0);
  });

  it('body-locks to the camera group by default, not the hand', () => {
    const cameraGroup = new THREE.Group();
    cameraGroup.add(engine.camera);
    const engineWithGroup = { ...engine, cameraGroup };
    const menu = new HandWheelMenu(engineWithGroup, hand);

    expect(menu.group.parent).toBe(cameraGroup);
    expect(hand.group.children).not.toContain(menu.group);
    expect(menu.offset.z).toBe(-0.55);
  });

  it('still supports legacy wrist anchoring via anchorToHand option', () => {
    const menu = new HandWheelMenu(engine, hand, { anchorToHand: true });
    expect(menu.group.parent).toBe(hand.group);
  });

  describe('constellation menu', () => {
    function makeMenu() {
      return new HandWheelMenu(engine, hand, {
        menu: [
          {
            id: 'cat-a',
            label: 'A',
            items: [
              { id: 'a1', label: 'A1', callback: () => 'a1' },
              { id: 'a2', label: 'A2', callback: () => 'a2' },
            ],
          },
          {
            id: 'cat-b',
            label: 'B',
            items: [{ id: 'b1', label: 'B1', callback: () => 'b1' }],
          },
        ],
      });
    }

    it('creates category nodes from setMenu', () => {
      const menu = makeMenu();
      expect(menu._categoryMeshes.length).toBe(2);
      expect(menu._actionMeshes.length).toBe(3);
    });

    it('shows action nodes for the hovered category after update', () => {
      const menu = makeMenu();
      menu.show();
      // Hover the first category by aiming directly at its world position.
      const target = menu._categoryMeshes[0].getWorldPosition(new THREE.Vector3());
      const origin = target.clone().add(new THREE.Vector3(0, 0.05, 0.2));
      const raycaster = new THREE.Raycaster(origin, target.sub(origin).normalize());
      menu.engine.input = { feedback: { playHover: () => {}, playSelect: () => {} } };
      menu.feedback = menu.engine.input.feedback;
      menu.handlePointerClick(raycaster); // select category
      menu.update();

      const activeActions = menu._actionMeshes.filter(
        (m) => m.visible && m.userData.categoryId === 'cat-a'
      );
      expect(activeActions.length).toBe(2);
    });

    it('fires action callback and hides menu when an action is clicked', () => {
      let called = false;
      const menu = new HandWheelMenu(engine, hand, {
        menu: [
          {
            id: 'cat-a',
            label: 'A',
            items: [{ id: 'a1', label: 'A1', callback: () => (called = true) }],
          },
        ],
      });
      menu.show();
      menu.engine.input = { feedback: { playHover: () => {}, playSelect: () => {} } };
      menu.feedback = menu.engine.input.feedback;

      // Select the category first so its action becomes visible.
      const catTarget = menu._categoryMeshes[0].getWorldPosition(new THREE.Vector3());
      const catOrigin = catTarget.clone().add(new THREE.Vector3(0, 0.05, 0.2));
      menu.handlePointerClick(new THREE.Raycaster(catOrigin, catTarget.sub(catOrigin).normalize()));
      menu.update();

      const action = menu._actionMeshes[0];
      const target = action.getWorldPosition(new THREE.Vector3());
      const origin = target.clone().add(new THREE.Vector3(0, 0.05, 0.2));
      const raycaster = new THREE.Raycaster(origin, target.sub(origin).normalize());

      expect(menu.handlePointerClick(raycaster)).toBe(true);
      expect(called).toBe(true);
      expect(menu.isVisible()).toBe(false);
    });

    it('returns to category selection when the selected category is clicked again', () => {
      const menu = makeMenu();
      menu.show();
      menu.engine.input = { feedback: { playHover: () => {}, playSelect: () => {} } };
      menu.feedback = menu.engine.input.feedback;

      const catTarget = menu._categoryMeshes[0].getWorldPosition(new THREE.Vector3());
      const catOrigin = catTarget.clone().add(new THREE.Vector3(0, 0.05, 0.2));
      const raycaster = new THREE.Raycaster(catOrigin, catTarget.sub(catOrigin).normalize());

      menu.handlePointerClick(raycaster);
      expect(menu.selectedCategory).toBe('cat-a');
      menu.handlePointerClick(raycaster);
      expect(menu.selectedCategory).toBe(null);
    });

    it('applies hover scale/opacity to a hovered mesh', () => {
      const menu = makeMenu();
      menu.show();
      menu.engine.input = { feedback: { playHover: () => {}, playSelect: () => {} } };
      menu.feedback = menu.engine.input.feedback;

      const mesh = menu._categoryMeshes[0];
      menu.hoveredCategory = 'cat-a';
      menu._applyHover(mesh, true);
      expect(mesh.scale.x).toBeGreaterThan(1);
      expect(mesh.material.opacity).toBe(1);

      menu._applyHover(mesh, false);
      expect(mesh.material.opacity).toBe(0.85);
    });
  });
});
