import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { DataCard } from '../src/vr/artifacts/DataCard.js';

describe('DataCard', () => {
  let camera;
  let card;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
    camera.position.set(0, 1.6, 0);
    card = new DataCard(camera);
  });

  it('is hidden by default', () => {
    expect(card.mesh.visible).toBe(false);
    expect(card.active).toBe(false);
  });

  it('shows at the target position plus an offset', () => {
    const pos = new THREE.Vector3(1, 2, -3);
    const data = { id: 'A', value: 42 };
    card.show(pos, data, 'NODE');

    expect(card.mesh.visible).toBe(true);
    expect(card.active).toBe(true);
    expect(card.mesh.position.x).toBe(1);
    expect(card.mesh.position.y).toBe(2.8);
    expect(card.mesh.position.z).toBe(-3);
  });

  it('hides and becomes inactive', () => {
    card.show(new THREE.Vector3(0, 0, 0), {}, 'X');
    card.hide();
    expect(card.mesh.visible).toBe(false);
    expect(card.active).toBe(false);
  });

  it('faces the camera each update', () => {
    card.show(new THREE.Vector3(1, 2, -3), { id: 'A' }, 'NODE');
    camera.position.set(5, 5, 5);
    card.update(0, 0);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(card.mesh.quaternion);
    const toCamera = new THREE.Vector3()
      .subVectors(camera.position, card.mesh.position)
      .normalize();
    expect(forward.dot(toCamera)).toBeGreaterThan(0.99);
  });

  it('renders data fields into the canvas', () => {
    const data = { id: 'A', value: 42, category: 'test' };
    const versionBefore = card.texture.version;
    card.render(data, 'NODE');

    // The texture is marked for update after rendering.
    expect(card.texture.version).toBeGreaterThan(versionBefore);
  });

  it('truncates long field lists to fit the card', () => {
    const data = {};
    for (let i = 0; i < 30; i++) {
      data[`field_${i}`] = i;
    }
    card.show(new THREE.Vector3(0, 0, 0), data, 'NODE');
    expect(card.active).toBe(true);
  });
});
