import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SemanticTargetResolver } from '../src/vr/input/SemanticTargetResolver.ts';
import type { InteractableEntry, SceneHit } from '../src/vr/input/InteractableRegistry.ts';
import { FocusContextController } from '../src/vr/interactions/FocusContextController.ts';

function createDummyMesh(x: number, y: number, z: number): THREE.Mesh {
  const geom = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const mat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld();
  return mesh;
}

describe('P1-F: Semantic Target Resolution & Focus/Context Contracts', () => {
  it('F1: semantic preference — structure target coerced over raw observation within assistance radius', () => {
    const resolver = new SemanticTargetResolver({}, 0.1); // 10cm assistance radius

    const obsMesh = createDummyMesh(0, 0, 1.0);
    const structMesh = createDummyMesh(0, 0, 1.05);

    const obsEntry: InteractableEntry = {
      mesh: obsMesh,
      data: { row: 42 },
      semantic: { kind: 'observation' },
    };

    const structEntry: InteractableEntry = {
      mesh: structMesh,
      semantic: {
        kind: 'mapper-node',
        structureId: 'struct-mapper-01',
        salience: 0.9,
      },
    };

    const rawHits: SceneHit[] = [
      { entry: obsEntry, distance: 1.0 },
      { entry: structEntry, distance: 1.05 }, // 5cm difference <= 10cm assistance radius
    ];

    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    const resolved = resolver.rank(rawHits, ray);

    expect(resolved).toBeDefined();
    expect(resolved?.kind).toBe('mapper-node');
    expect(resolved?.structureId).toBe('struct-mapper-01');
  });

  it('F2: hysteresis stability — held target requires margin or dwell to switch', () => {
    const resolver = new SemanticTargetResolver({}, 0.05);

    const meshA = createDummyMesh(0, 0, 1.0);
    const meshB = createDummyMesh(0, 0, 1.5);

    const entryA: InteractableEntry = { mesh: meshA, semantic: { kind: 'cluster-region', salience: 0.9 } };
    const entryB: InteractableEntry = { mesh: meshB, semantic: { kind: 'cluster-region', salience: 0.8 } };

    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    const t0 = 1000;

    // Frame 1: Hit A closer and higher salience -> A held
    const hits1: SceneHit[] = [
      { entry: entryA, distance: 1.0 },
      { entry: entryB, distance: 1.5 },
    ];
    const r1 = resolver.rank(hits1, ray, undefined, undefined, t0);
    expect(r1?.entry).toBe(entryA);

    // Frame 2: Hit B is now closer (0.5 vs 1.5), so scoreB > scoreA, but does not beat A by 1.5x margin -> A stays held
    const hits2: SceneHit[] = [
      { entry: entryB, distance: 0.5 },
      { entry: entryA, distance: 1.5 },
    ];
    const r2 = resolver.rank(hits2, ray, undefined, undefined, t0 + 16);
    expect(r2?.entry).toBe(entryA);

    // After 1200ms dwell expiration, B wins cleanly
    const r3 = resolver.rank(hits2, ray, undefined, undefined, t0 + 1300);
    expect(r3?.entry).toBe(entryB);
  });

  it('F3: escape hatch — direct picking bypasses assistance when disabled', () => {
    const obsMesh = createDummyMesh(0, 0, 1.0);
    const structMesh = createDummyMesh(0, 0, 1.05);

    const rawHits: SceneHit[] = [
      { entry: { mesh: obsMesh, semantic: { kind: 'observation' } }, distance: 1.0 },
      { entry: { mesh: structMesh, semantic: { kind: 'mapper-node' } }, distance: 1.05 },
    ];

    // When assistance is disabled (raw picking), first geometric hit is consumed directly
    const rawPick = rawHits[0].entry;
    expect(rawPick.semantic?.kind).toBe('observation');
  });

  it('F4: structure identity — resolved target carries durable structureId from Atlas', () => {
    const resolver = new SemanticTargetResolver();
    const structMesh = createDummyMesh(0, 0, 2.0);

    const hits: SceneHit[] = [
      {
        entry: {
          mesh: structMesh,
          semantic: {
            kind: 'persistence-structure',
            structureId: 'struct_persistence_h0_c1',
          },
        },
        distance: 2.0,
      },
    ];
    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    const target = resolver.rank(hits, ray);

    expect(target?.structureId).toBe('struct_persistence_h0_c1');
  });

  it('F5: focus hierarchy — step transitions and anchor transform preservation', () => {
    const controller = new FocusContextController();
    expect(controller.currentLevel).toBe('dataset');

    // Drill down step by step
    expect(controller.drillDown()).toBe('structure');
    expect(controller.drillDown()).toBe('region');
    expect(controller.drillDown()).toBe('observation');

    // Overview steps up
    expect(controller.overview()).toBe('region');
    expect(controller.overview()).toBe('structure');
    expect(controller.overview()).toBe('dataset');

    // Focus structure with anchor transform
    const anchor = new THREE.Matrix4().makeTranslation(1.5, 0.5, -2.0);
    controller.focusStructure('cluster_alpha', anchor);
    expect(controller.currentLevel).toBe('structure');
    expect(controller.focusedStructureId).toBe('cluster_alpha');
    expect(controller.anchorMatrix).toBeDefined();
    expect(controller.anchorMatrix?.equals(anchor)).toBe(true);

    // Distance band updates
    expect(controller.updateByDistance(4.0)).toBe('dataset');
    expect(controller.updateByDistance(2.0)).toBe('structure');
    expect(controller.updateByDistance(0.8)).toBe('observation');
  });

  it('F6: desktop and XR parity — resolver behaves identically on equal hit lists', () => {
    const resolverDesktop = new SemanticTargetResolver();
    const resolverXR = new SemanticTargetResolver();

    const mesh = createDummyMesh(1, 1, 1);
    const hits: SceneHit[] = [
      {
        entry: { mesh, semantic: { kind: 'mapper-node', structureId: 'm1' } },
        distance: 1.5,
      },
    ];
    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1).normalize());

    const deskTarget = resolverDesktop.rank(hits, ray);
    const xrTarget = resolverXR.rank(hits, ray);

    expect(deskTarget?.kind).toBe(xrTarget?.kind);
    expect(deskTarget?.structureId).toBe(xrTarget?.structureId);
  });

  it('F7: persistence discipline — persists focused structure and level without camera pose', () => {
    const controller = new FocusContextController();
    controller.focusStructure('struct_cluster_beta');

    const state = controller.exportState();
    expect(state.currentLevel).toBe('structure');
    expect(state.focusedStructureId).toBe('struct_cluster_beta');
    expect((state as any).cameraPose).toBeUndefined();

    const restoredController = new FocusContextController();
    restoredController.restoreState(state);
    expect(restoredController.currentLevel).toBe('structure');
    expect(restoredController.focusedStructureId).toBe('struct_cluster_beta');
  });

  it('F8: regression guard — empty hits and clear hold handle safely', () => {
    const resolver = new SemanticTargetResolver();
    const ray = new THREE.Ray();

    expect(resolver.rank([], ray)).toBeNull();
    expect(resolver.heldTarget).toBeNull();
    resolver.clearHold();
  });
});
