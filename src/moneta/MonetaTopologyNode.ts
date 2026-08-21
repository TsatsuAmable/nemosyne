import * as THREE from 'three';
import { ConstraintEngine } from './ConstraintEngine.ts';
import { VRTopologyTranslator } from './VRTopologyTranslator.ts';
import { MeshPool } from '../utils/ObjectPool.ts';
import { solveMoneta, solveDraco } from '../wasm/RuntimeBridge.ts';
import type {
  Artifact,
  MonetaDataInput,
  MonetaSpec,
  FactProvider,
  SolverResult,
  VRTranslatorOptions,
} from './types.ts';
import type { RepresentationDecision } from './representation/RepresentationDecision.ts';

export class MonetaTopologyNode {
  scene: THREE.Scene;
  dataInput: MonetaDataInput;
  position: [number, number, number];
  translatorOptions: VRTranslatorOptions;
  engine: ConstraintEngine;
  useRustSolver: boolean;
  representationDecision: RepresentationDecision | null;
  solverResult!: SolverResult;
  artifact: Artifact | undefined;
  group: THREE.Group | undefined;

  constructor(
    scene: THREE.Scene,
    dataInput: MonetaDataInput,
    position: [number, number, number] = [0, 2.0, -8.0],
    translatorOptions: VRTranslatorOptions = {},
    factProvider: FactProvider | null = null,
    useRustSolver = false,
    representationDecision: RepresentationDecision | null = null
  ) {
    this.scene = scene;
    this.dataInput = dataInput;
    this.position = position;
    this.translatorOptions = translatorOptions;
    this.engine = new ConstraintEngine({ factProvider: factProvider ?? undefined });
    this.useRustSolver = useRustSolver;
    this.representationDecision = representationDecision;
    this.reSolveAndSynthesize();
  }

  setRepresentationDecision(decision: RepresentationDecision | null): void {
    this.representationDecision = decision;
    this.reSolveAndSynthesize();
  }

  adjustWeight(ruleName: string, delta: number): void {
    if (this.useRustSolver) {
      throw new Error(
        'MonetaTopologyNode: per-weight tuning is not exposed through the Rust draco_solve ABI (moneta_solve). ' +
          'Use the TS solver (useRustSolver=false) for weight tuning.'
      );
    }
    const current = this.engine.getWeight(ruleName) ?? 0;
    this.engine.setWeight(ruleName, current + delta);
    this.reSolveAndSynthesize();
  }

  reSolveAndSynthesize(): void {
    if (this.representationDecision) {
      const facts = this.engine.factProvider?.facts(this.dataInput);
      if (!facts) {
        throw new Error(
          'MonetaTopologyNode: no facts provided (supply a FactProvider to use representationDecision)'
        );
      }
      const emb = this.representationDecision.embodiment;
      this.solverResult = {
        facts,
        spec: {
          layout: emb?.primaryLayout ?? this.representationDecision.chosenLayout ?? 'GRID_3D',
          geometry: emb?.primaryGeometry ?? 'CUBE_MATRIX',
          behavior: emb?.primaryBehavior ?? 'STATIC',
          interaction: emb?.primaryInteraction ?? 'INSPECT_CELL',
        },
        // SolverResult still calls this value "cost" for historical reasons.
        // Do not derive it from confidence: Moneta V3 exposes explicit utility.
        cost: this.representationDecision.utilityScore,
      };
    } else {
      this.solverResult = this.useRustSolver ? this.solveWithRust() : this.engine.solve(this.dataInput);
    }

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

  private solveWithRust(): SolverResult {
    const facts = this.engine.factProvider?.facts(this.dataInput) ?? null;
    if (!facts) {
      throw new Error(
        'MonetaTopologyNode: no facts provided (supply a FactProvider to use the Rust solver)'
      );
    }
    const solverFn = solveDraco || solveMoneta;
    const rust = solverFn(facts as unknown as Record<string, unknown>);
    if (!rust) {
      throw new Error(
        'MonetaTopologyNode: Rust draco_solve returned null — the WASM runtime is not initialised. ' +
          'Initialise the kernel before opting into useRustSolver, or use the TS solver (useRustSolver=false).'
      );
    }
    const spec = rust.spec as MonetaSpec;
    const cost = typeof rust.cost === 'number' ? rust.cost : Number(rust.cost) || 0;
    return { facts, spec, cost };
  }

  update(delta: number, time: number): void {
    if (
      this.artifact &&
      (this.artifact as unknown as { update?: (d: number, t: number) => void }).update
    ) {
      (this.artifact as unknown as { update: (d: number, t: number) => void }).update(delta, time);
    }
    if (this.artifact?.behaviors) {
      this.artifact.behaviors.forEach((b) => b(delta, time));
    }
  }

  interactWithRay(raycaster: THREE.Raycaster): THREE.Object3D | null {
    if (!this.artifact?.nodeMeshes?.length) return null;
    const hits = raycaster.intersectObjects(this.artifact.nodeMeshes, false);
    if (hits.length > 0) return hits[0].object;
    return null;
  }

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

export { MonetaTopologyNode as DracoTopologyNode };
