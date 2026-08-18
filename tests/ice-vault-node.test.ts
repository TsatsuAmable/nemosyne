// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { IceVaultNode } from '../src/vr/artifacts/IceVaultNode.ts';

describe('IceVaultNode', () => {
  it('initializes shell and core meshes at specified position', () => {
    const node = new IceVaultNode({ position: [1, 2, -3], scale: 1.5 });
    expect(node.group.position.x).toBe(1);
    expect(node.group.position.y).toBe(2);
    expect(node.group.position.z).toBe(-3);
    expect(node.group.scale.x).toBe(1.5);
    expect(node.shell).toBeDefined();
    expect(node.core).toBeDefined();
  });

  it('updates visual state on hover enter and leave', () => {
    const node = new IceVaultNode();
    expect(node.hovered).toBe(false);
    expect(node.material.emissiveIntensity).toBe(1.0);

    node.onEnter();
    expect(node.hovered).toBe(true);
    expect(node.material.emissiveIntensity).toBe(2.0);

    node.onLeave();
    expect(node.hovered).toBe(false);
    expect(node.material.emissiveIntensity).toBe(1.0);
  });

  it('dynamically adjusts visual encoding parameters', () => {
    const node = new IceVaultNode();
    node.setEncoding({
      color: 0x00ffff,
      emissive: 0x003344,
      coreColor: 0xffaa00,
      pulseSpeed: 10,
      rotationSpeed: 3,
    });

    expect(node.material.color.getHex()).toBe(0x00ffff);
    expect(node.material.emissive.getHex()).toBe(0x003344);
    expect(node.coreMaterial.color.getHex()).toBe(0xffaa00);
    expect(node.pulseSpeed).toBe(10);
    expect(node.rotationSpeed).toBe(3);
  });

  it('animates rotation and pulse on update', () => {
    const node = new IceVaultNode();
    const initRotX = node.shell.rotation.x;
    node.update(0.016, 1.0);
    expect(node.shell.rotation.x).not.toBe(initRotX);
  });

  it('disposes geometries and materials cleanly', () => {
    const node = new IceVaultNode();
    const parent = new THREE.Group();
    parent.add(node.group);
    expect(parent.children.length).toBe(1);

    node.dispose();
    expect(parent.children.length).toBe(0);
  });
});
