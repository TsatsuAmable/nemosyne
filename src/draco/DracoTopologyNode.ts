import * as THREE from 'three';
import { ConstraintEngine } from './ConstraintEngine.ts';
import { VRTopologyTranslator } from './VRTopologyTranslator.ts';
import { disposeObject } from '../utils/Dispose.ts';
import { MeshPool } from '../utils/ObjectPool.ts';
import type { Artifact, DracoDataInput, FactProvider, SolverResult, VRTranslatorOptions } from './types.ts';

/**
 * Manages the lifecycle of a Draco-recommended spatial data artifact:
 * solving, synthesizing, updating, raycast interaction, and live re-solve.
 *
 * Wave 5: Draco performs no dataset-derived statistical computation; facts are
 * supplied by the `factProvider` (AtlasCore in production, a canned helper in
 * tests). If no provider is configured, `reSolveAndSynthesize` throws.
 */
export class DracoTopologyNode {
  scene: THREE.Scene;
  dataInput: DracoDataInput;
  position: [number, number, number];
  translatorOptions: VRTranslatorOptions;
  engine: ConstraintEngine;
  solverResult!: SolverResult;
  artifact: Artifact | undefined;
  group: THREE.Group | undefined;

  constructor(
    scene: THREE.Scene,
    dataInput: DracoDataInput,
    position: [number, number, number] = [0, 2.0, -8.0],
    translatorOptions: VRTranslatorOptions = {},
    factProvider: FactProvider | null = null
  ) {
    this.scene = scene;
    this.dataInput = dataInput;
    this.position = position;
    this.translatorOptions = translatorOptions;
    this.engine = new ConstraintEngine({ factProvider: factProvider ?? undefined });
    this.reSolveAndSynthesize();
  }

  adjustWeight(ruleName: string, delta: number): void {
    this.engine.adjustWeight(ruleName, delta);
    this.reSolveAndSynthesize();
  }

  reSolveAndSynthesize(): void {
    this.solverResult = this.engine.solve(this.dataInput);

    if (this.artifact) {
      this.scene.remove(this.artifact.group);
      MeshPool.instance.releaseGroup(this.artifact.group);
    }

    this.artifact = VRTopologyTranslator.synthesizeArtifact(
      this.solverResult,
      this.dataInput,
      this.translatorOptions
    );
    this.group = this.artifact.group;
    this.group.position.set(...this.position);
    this.scene.add(this.group);
  }

  update(delta: number, time: number): void {
    if (this.artifact?.update) {
      this.artifact.update(delta, time);
    }
  }

  /** Raycast against the artifact node meshes and return the hit mesh if any. */
  interactWithRay(raycaster: THREE.Raycaster): THREE.Object3D | null {
    if (!this.artifact?.nodeMeshes?.length) return null;
    const hits = raycaster.intersectObjects(this.artifact.nodeMeshes, false);
    if (hits.length > 0) return hits[0].object;
    return null;
  }

  /**
   * Append new rows to the underlying dataset and try an incremental update.
   * If incremental update is not supported for the current layout, the full
   * palace is re-solved.
   * @returns true if incremental update succeeded
   */
  appendRows(
    newRows: Record<string, unknown>[],
    options: { mode?: 'append' | 'replace'; limit?: number | null } = {}
  ): boolean {
    if (!this.dataInput.dataset) return false;
    const mode = options.mode || 'append';
    const limit = options.limit ?? null;
    this.dataInput.dataset.updateRows(newRows, mode, limit);

    const incremental = VRTopologyTranslator.appendRowsToArtifact(
      this.artifact,
      newRows,
      this.dataInput
    );
    if (!incremental) {
      this.reSolveAndSynthesize();
    }
    return incremental;
  }
}
