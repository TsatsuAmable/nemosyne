import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  CommandApplier,
  COMMAND_MAGIC,
  COMMAND_VERSION,
  OP_CREATE_NODE,
  OP_UPDATE_TRANSFORM,
  OP_DESTROY_NODE,
  OP_SET_COLOR,
  OP_UPDATE_INSTANCES,
} from '../src/wasm/CommandApplier.js';

describe('CommandApplier', () => {
  let scene: THREE.Scene;
  let applier: CommandApplier;

  beforeEach(() => {
    scene = new THREE.Scene();
    applier = new CommandApplier(scene);
  });

  it('ignores buffers shorter than 8 bytes', () => {
    const buf = new ArrayBuffer(4);
    const parsed = applier.applyCommandBuffer(buf, 0, 4);
    expect(parsed).toEqual([]);
  });

  it('rejects buffers with invalid magic or version', () => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, 0x12345678, true); // Bad magic
    view.setUint16(4, COMMAND_VERSION, true);
    view.setUint16(6, 0, true);

    const parsed = applier.applyCommandBuffer(buf, 0, 8);
    expect(parsed).toEqual([]);
  });

  it('parses OP_CREATE_NODE commands', () => {
    const buf = new ArrayBuffer(17);
    const view = new DataView(buf);
    view.setUint32(0, COMMAND_MAGIC, true);
    view.setUint16(4, COMMAND_VERSION, true);
    view.setUint16(6, 1, true); // 1 command

    view.setUint8(8, OP_CREATE_NODE);
    view.setUint32(9, 101, true); // Entity 101
    view.setUint8(13, 2); // Geometry 2
    view.setUint8(14, 3); // Material 3
    view.setUint16(15, 0, true); // Flags 0

    const parsed = applier.applyCommandBuffer(buf, 0, 17);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      op: OP_CREATE_NODE,
      entity: 101,
      data: { geometryType: 2, materialType: 3, flags: 0 },
    });
  });

  it('applies OP_UPDATE_TRANSFORM to registered THREE.Object3D entities', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    applier.registerEntity(42, mesh);
    scene.add(mesh);

    const buf = new ArrayBuffer(8 + 45);
    const view = new DataView(buf);
    view.setUint32(0, COMMAND_MAGIC, true);
    view.setUint16(4, COMMAND_VERSION, true);
    view.setUint16(6, 1, true);

    let offset = 8;
    view.setUint8(offset, OP_UPDATE_TRANSFORM);
    view.setUint32(offset + 1, 42, true);
    view.setFloat32(offset + 5, 10.0, true); // pos x
    view.setFloat32(offset + 9, 20.0, true); // pos y
    view.setFloat32(offset + 13, 30.0, true); // pos z

    view.setFloat32(offset + 17, 0.0, true); // rot x
    view.setFloat32(offset + 21, 0.0, true); // rot y
    view.setFloat32(offset + 25, 0.0, true); // rot z
    view.setFloat32(offset + 29, 1.0, true); // rot w

    view.setFloat32(offset + 33, 2.0, true); // scale x
    view.setFloat32(offset + 37, 2.0, true); // scale y
    view.setFloat32(offset + 41, 2.0, true); // scale z

    const parsed = applier.applyCommandBuffer(buf, 0, 8 + 45);
    expect(parsed).toHaveLength(1);

    expect(mesh.position.x).toBeCloseTo(10.0);
    expect(mesh.position.y).toBeCloseTo(20.0);
    expect(mesh.position.z).toBeCloseTo(30.0);
    expect(mesh.scale.x).toBeCloseTo(2.0);
  });

  it('handles OP_DESTROY_NODE and unregisters entity from scene', () => {
    const mesh = new THREE.Mesh();
    applier.registerEntity(99, mesh);
    scene.add(mesh);
    expect(applier.getEntity(99)).toBe(mesh);

    const buf = new ArrayBuffer(8 + 5);
    const view = new DataView(buf);
    view.setUint32(0, COMMAND_MAGIC, true);
    view.setUint16(4, COMMAND_VERSION, true);
    view.setUint16(6, 1, true);

    view.setUint8(8, OP_DESTROY_NODE);
    view.setUint32(9, 99, true);

    const parsed = applier.applyCommandBuffer(buf, 0, 13);
    expect(parsed).toHaveLength(1);
    expect(applier.getEntity(99)).toBeUndefined();
  });

  it('updates material RGB and opacity on OP_SET_COLOR', () => {
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);
    applier.registerEntity(15, mesh);

    const buf = new ArrayBuffer(8 + 21);
    const view = new DataView(buf);
    view.setUint32(0, COMMAND_MAGIC, true);
    view.setUint16(4, COMMAND_VERSION, true);
    view.setUint16(6, 1, true);

    let offset = 8;
    view.setUint8(offset, OP_SET_COLOR);
    view.setUint32(offset + 1, 15, true);
    view.setFloat32(offset + 5, 1.0, true); // r
    view.setFloat32(offset + 9, 0.0, true); // g
    view.setFloat32(offset + 13, 0.0, true); // b
    view.setFloat32(offset + 17, 0.5, true); // a

    applier.applyCommandBuffer(buf, 0, 29);
    expect(mat.color.r).toBeCloseTo(1.0);
    expect(mat.color.g).toBeCloseTo(0.0);
    expect(mat.opacity).toBeCloseTo(0.5);
  });
});
