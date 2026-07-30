import * as THREE from 'three';
import { ConstraintEngine } from './ConstraintEngine.js';
import { VRTopologyTranslator } from './VRTopologyTranslator.js';
import { disposeObject } from '../utils/Dispose.js';

/**
 * Manages the lifecycle of a Draco-recommended spatial data artifact:
 * solving, synthesizing, updating, raycast interaction, and live re-solve.
 */
export class DracoTopologyNode {
  constructor(scene, dataInput, position = [0, 2.0, -8.0]) {
    this.scene = scene;
    this.dataInput = dataInput;
    this.position = position;
    this.engine = new ConstraintEngine();
    this.reSolveAndSynthesize();
  }

  adjustWeight(ruleName, delta) {
    this.engine.adjustWeight(ruleName, delta);
    this.reSolveAndSynthesize();
  }

  reSolveAndSynthesize() {
    this.solverResult = this.engine.solve(this.dataInput);
    console.log('[Draco] spec:', this.solverResult.spec, 'cost:', this.solverResult.cost);

    if (this.artifact) {
      this.scene.remove(this.artifact.group);
      disposeObject(this.artifact.group);
    }

    this.artifact = VRTopologyTranslator.synthesizeArtifact(this.solverResult, this.dataInput);
    this.group = this.artifact.group;
    this.group.position.set(...this.position);
    this.scene.add(this.group);
  }

  update(delta, time) {
    if (this.artifact?.update) {
      this.artifact.update(delta, time);
    }
  }

  /** Raycast against the artifact node meshes and return the hit mesh if any. */
  interactWithRay(raycaster) {
    if (!this.artifact?.nodeMeshes?.length) return null;
    const hits = raycaster.intersectObjects(this.artifact.nodeMeshes, false);
    if (hits.length > 0) return hits[0].object;
    return null;
  }

  /**
   * Append new rows to the underlying dataset and try an incremental update.
   * If incremental update is not supported for the current layout, the full
   * palace is re-solved.
   * @returns {boolean} true if incremental update succeeded
   */
  appendRows(newRows, options = {}) {
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
