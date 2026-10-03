// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { InstancedPointCloud } from '../src/vr/scalability/InstancedPointCloud.ts';
import { MonetaTopologyNode as DracoTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeFactProvider } from './helpers/dracoFactsHelper.ts';

// Note: the former 'bypasses MovablePanel GPU texture updates when UI content
// state signature is static' its died with the retired canvas substrate
// (FM4-UI-CLEAN); the texture-cache helper it exercised was reachable only
// through the legacy panel class.

describe('Sprint 20.1 & 20.2: Zero-Allocation Instanced GPU Buffer Pipeline', () => {
  it('enables depthWrite: true and depthTest: true on InstancedPointCloud for Early-Z culling', () => {
    const cloud = new InstancedPointCloud(100);
    expect(cloud.material.depthWrite).toBe(true);
    expect(cloud.material.depthTest).toBe(true);
    expect(cloud.material.transparent).toBe(false);
  });

  it('safely handles DracoTopologyNode mesh pool release without double-disposal', () => {
    const scene = new THREE.Scene();
    const ds = new Dataset(
      'PoolTest',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 10 }]
    );

    const node = new DracoTopologyNode(scene, { dataset: ds }, undefined, undefined, makeFactProvider());
    expect(node.artifact).toBeDefined();

    // Trigger re-solve & synthesis to test mesh pool release path
    node.reSolveAndSynthesize();
    expect(node.artifact).toBeDefined();
  });

  it('reuses the same instanceColor InstancedBufferAttribute across setPoints calls (zero allocation)', () => {
    const cloud = new InstancedPointCloud(100);
    const itemsA = [
      { position: [0, 0, 0] as [number, number, number], color: 0xff0000, scale: 1 },
      { position: [1, 0, 0] as [number, number, number], color: 0x00ff00, scale: 1 },
    ];
    const itemsB = [
      { position: [2, 0, 0] as [number, number, number], color: 0x0000ff, scale: 1 },
      { position: [3, 0, 0] as [number, number, number], color: 0xffff00, scale: 1 },
    ];

    cloud.setPoints(itemsA);
    const colorAttrA = cloud.mesh.instanceColor;
    expect(colorAttrA).toBeInstanceOf(THREE.InstancedBufferAttribute);

    cloud.setPoints(itemsB);
    const colorAttrB = cloud.mesh.instanceColor;

    // Same attribute object reference — no reallocation.
    expect(colorAttrB).toBe(colorAttrA);
  });

  it('dispose() disposes the InstancedMesh (frees instanced GPU buffers) and forwards to attributes', () => {
    const cloud = new InstancedPointCloud(50);
    cloud.setPoints([
      { position: [0, 0, 0] as [number, number, number], color: 0xff0000, scale: 1 },
    ]);

    const colorAttr = cloud.mesh.instanceColor!;
    const matrixAttr = cloud.mesh.instanceMatrix;
    const colorSpy = vi.fn();
    const matrixSpy = vi.fn();
    colorAttr.dispose = colorSpy;
    matrixAttr.dispose = matrixSpy;

    const geomSpy = vi.fn();
    const matSpy = vi.fn();
    cloud.geometry.dispose = geomSpy;
    cloud.material.dispose = matSpy;

    // mesh.dispose() is the real three r168 path that triggers the renderer's
    // onInstancedMeshDispose to free instanceMatrix/instanceColor GPU buffers.
    const meshSpy = vi.spyOn(cloud.mesh, 'dispose');

    cloud.dispose();

    expect(meshSpy).toHaveBeenCalled();
    expect(colorSpy).toHaveBeenCalled();
    expect(matrixSpy).toHaveBeenCalled();
    expect(geomSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
  });
});
