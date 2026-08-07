import * as THREE from 'three';
import type { Updatable } from '../coordinators/types.ts';

export interface IceVaultEncodingOptions {
  color?: number;
  emissive?: number;
  coreColor?: number;
  pulseSpeed?: number;
  rotationSpeed?: number;
}

export interface IceVaultNodeOptions {
  position?: [number, number, number];
  color?: number;
  emissive?: number;
  scale?: number;
}

/**
 * A Gibson-style ICE vault glyph used as a data artifact metaphor.
 * Visual state can be driven by data encodings (color, pulse, rotation).
 */
export class IceVaultNode implements Updatable {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  shell: THREE.Mesh;
  coreMaterial: THREE.MeshBasicMaterial;
  core: THREE.Mesh;

  hovered: boolean;
  breached: boolean;
  data: Record<string, unknown> | null;

  pulseSpeed: number;
  rotationSpeed: number;

  constructor({ position = [0, 1.5, -3], color = 0xff0033, emissive = 0x550011, scale = 1 }: IceVaultNodeOptions = {}) {
    this.group = new THREE.Group();
    this.group.position.set(...position);
    this.group.scale.setScalar(scale);

    const geom = new THREE.IcosahedronGeometry(0.6, 1);
    this.material = new THREE.MeshStandardMaterial({
      color,
      wireframe: true,
      emissive,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.shell = new THREE.Mesh(geom, this.material);
    this.group.add(this.shell);

    const coreGeom = new THREE.SphereGeometry(0.25, 16, 16);
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    this.core = new THREE.Mesh(coreGeom, this.coreMaterial);
    this.group.add(this.core);

    this.hovered = false;
    this.breached = false;
    this.data = null;

    this.pulseSpeed = 5;
    this.rotationSpeed = 1;
  }

  setData(data: Record<string, unknown> | null): void {
    this.data = data;
  }

  setEncoding({ color, emissive, coreColor, pulseSpeed = 5, rotationSpeed = 1 }: IceVaultEncodingOptions = {}): void {
    if (color !== undefined) this.material.color.setHex(color);
    if (emissive !== undefined) this.material.emissive.setHex(emissive);
    if (coreColor !== undefined) this.coreMaterial.color.setHex(coreColor);
    this.pulseSpeed = pulseSpeed;
    this.rotationSpeed = rotationSpeed;
  }

  onEnter(): void {
    this.hovered = true;
    this.material.emissiveIntensity = 2.0;
  }

  onLeave(): void {
    this.hovered = false;
    this.material.emissiveIntensity = 1.0;
  }

  update(delta: number, time: number): void {
    const speed = this.hovered ? this.rotationSpeed * 0.3 : this.rotationSpeed;
    this.shell.rotation.x += delta * speed * 0.5;
    this.shell.rotation.y += delta * speed * 0.8;
    const pulse = this.hovered ? 8 : (this.pulseSpeed ?? 5);
    this.core.scale.setScalar(1 + Math.sin(time * pulse) * 0.12);
  }
}
