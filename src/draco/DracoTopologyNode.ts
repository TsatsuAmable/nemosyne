import * as THREE from 'three';
import { ConstraintEngine } from './ConstraintEngine.ts';
import { VRTopologyTranslator } from './VRTopologyTranslator.ts';
import { MeshPool } from '../utils/ObjectPool.ts';
import { solveDraco } from '../wasm/RuntimeBridge.ts';
import type { Artifact, DracoDataInput, DracoSpec, FactProvider, SolverResult, VRTranslatorOptions } from './types.ts';

/**
 * Manages the lifecycle of a Draco-recommended spatial data artifact:
 * solving, synthesizing, updating, raycast interaction, and live re-solve.
 *
 * Wave 5: Draco performs no dataset-derived statistical computation; facts are
 * supplied by the `factProvider` (AtlasCore in production, a canned helper in
 * tests). If no provider is configured, `reSolveAndSynthesize` throws.
 *
 * Rust solver cutover (staged): pass `useRustSolver: true` to solve via the
 * shipped Rust `draco_solve` ABI (`RuntimeBridge.solveDraco`) instead of the
 * TypeScript `ConstraintEngine`. The flag is **opt-in and default off** — the
 * TS engine remains canonical until the Rust path is validated end-to-end and
 * the cutover is flipped in `docs/ROADMAP.md`. This is an explicit developer
 * switch, not a runtime capability-routing branch (CLAUDE.md: "no production
 * code routes between analytical impls at runtime"). When the flag is on, the
 * WASM runtime MUST be initialised; `solveDraco` returning null throws rather
 * than silently falling back. Per-weight tuning (`adjustWeight`) is not yet
 * exposed through the Rust ABI and throws under the Rust path.
 */
export class DracoTopologyNode {
  scene: THREE.Scene;
  dataInput: DracoDataInput;
  position: [number, number, number];
  translatorOptions: VRTranslatorOptions;
  engine: ConstraintEngine;
  useRustSolver: boolean;
  solverResult!: SolverResult;
  artifact: Artifact | undefined;
  group: THREE.Group | undefined;

  constructor(
    scene: THREE.Scene,
    dataInput: DracoDataInput,
    position: [number, number, number] = [0, 2.0, -8.0],
    translatorOptions: VRTranslatorOptions = {},
    factProvider: FactProvider | null = null,
    useRustSolver = false
  ) {
    this.scene = scene;
    this.dataInput = dataInput;
    this.position = position;
    this.translatorOptions = translatorOptions;
    this.engine = new ConstraintEngine({ factProvider: factProvider ?? undefined });
    this.useRustSolver = useRustSolver;
    this.reSolveAndSynthesize();
  }

  adjustWeight(ruleName: string, delta: number): void {
    if (this.useRustSolver) {
      throw new Error(
        'DracoTopologyNode: per-weight tuning is not exposed through the Rust draco_solve ABI. ' +
          'Use the TS solver (useRustSolver=false) for weight tuning, or track the follow-up to expose weights in the ABI.'
      );
    }
    this.engine.adjustWeight(ruleName, delta);
    this.reSolveAndSynthesize();
  }

  reSolveAndSynthesize(): void {
    this.solverResult = this.useRustSolver ? this.solveWithRust() : this.engine.solve(this.dataInput);

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

  /**
   * Solve via the Rust `draco_solve` ABI. Facts are resolved through the same
   * `FactProvider` the TS engine uses; only the spec+cost come from Rust, so
   * the authoritative TS `DracoFacts` (the richer shape `VRTopologyTranslator`
   * reads) are preserved on the returned `SolverResult`. Throws if no facts
   * are available or the WASM runtime is not initialised.
   */
  private solveWithRust(): SolverResult {
    const facts = this.engine.factProvider?.facts(this.dataInput) ?? null;
    if (!facts) {
      throw new Error('DracoTopologyNode: no facts provided (supply a FactProvider to use the Rust solver)');
    }
    const rust = solveDraco(facts as unknown as Record<string, unknown>);
    if (!rust) {
      throw new Error(
        'DracoTopologyNode: Rust draco_solve returned null — the WASM runtime is not initialised. ' +
          'Initialise the kernel before opting into useRustSolver, or use the TS solver (useRustSolver=false).'
      );
    }
    const spec = rust.spec as DracoSpec;
    const cost = typeof rust.cost === 'number' ? rust.cost : Number(rust.cost) || 0;
    return { facts, spec, cost };
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