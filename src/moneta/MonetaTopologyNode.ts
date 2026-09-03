import * as THREE from 'three';
import { ConstraintEngine, isNoFeasibleConstraintResult } from './ConstraintEngine.ts';
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
import type { RepresentationGraph } from './representation/RepresentationGraph.ts';
import type { ProductionSemanticEmbodimentEnvelopeV1 } from './representation/ClusterEmbodimentPayload.ts';
import { representationGraphToRuntimeSpec } from './representation/RepresentationGraphRuntimeAdapter.ts';
import {
  setSemanticEmbodimentPresentationStatus,
  type SemanticEmbodimentPresentationCandidateId,
} from './embodiment/SemanticEmbodimentStatus.ts';

type SemanticMonetaDataInput = MonetaDataInput & {
  semanticEmbodiment?: ProductionSemanticEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<ProductionSemanticEmbodimentEnvelopeV1 | null>;
  semanticEmbodimentCandidateId?: 'CLUSTER_REGIONS' | 'RELATIONSHIP_GRAPH';
};

function usesSemanticEmbodiment(
  candidateId: string | undefined
): candidateId is SemanticEmbodimentPresentationCandidateId {
  return (
    candidateId === 'AGGREGATE_VOLUME' ||
    candidateId === 'DISTRIBUTION_FIELD' ||
    candidateId === 'DENSITY_FIELD' ||
    candidateId === 'CLUSTER_REGIONS' ||
    candidateId === 'RELATIONSHIP_GRAPH'
  );
}

export class MonetaTopologyNode {
  scene: THREE.Scene;
  dataInput: MonetaDataInput;
  position: [number, number, number];
  translatorOptions: VRTranslatorOptions;
  engine: ConstraintEngine;
  useRustSolver: boolean;
  representationDecision: RepresentationDecision | null;
  representationGraph: RepresentationGraph | null;
  solverResult!: SolverResult;
  artifact: Artifact | undefined;
  group: THREE.Group | undefined;
  private _semanticEmbodimentToken = 0;

  constructor(
    scene: THREE.Scene,
    dataInput: MonetaDataInput,
    position: [number, number, number] = [0, 2.0, -8.0],
    translatorOptions: VRTranslatorOptions = {},
    factProvider: FactProvider | null = null,
    useRustSolver = false,
    representationDecision: RepresentationDecision | null = null,
    representationGraph: RepresentationGraph | null = null
  ) {
    this.scene = scene;
    this.dataInput = dataInput;
    this.position = position;
    this.translatorOptions = translatorOptions;
    this.engine = new ConstraintEngine({ factProvider: factProvider ?? undefined });
    this.useRustSolver = useRustSolver;
    this.representationDecision = representationGraph ? null : representationDecision;
    this.representationGraph = representationGraph;
    this.reSolveAndSynthesize();
    this._subscribeSemanticEmbodiment();
  }

  setRepresentationDecision(decision: RepresentationDecision | null): void {
    this.representationGraph = null;
    this.representationDecision = decision;
    this.reSolveAndSynthesize();
    this._subscribeSemanticEmbodiment();
  }

  setRepresentationGraph(graph: RepresentationGraph | null): void {
    this.representationDecision = null;
    this.representationGraph = graph;
    this.reSolveAndSynthesize();
  }

  /** Invalidate any late semantic payload before this node is removed/replaced. */
  cancelPendingSemanticEmbodiment(): void {
    this._semanticEmbodimentToken += 1;
  }

  private _syncSemanticEmbodimentCandidate(): void {
    const input = this.dataInput as SemanticMonetaDataInput;
    if (this.representationDecision?.chosenCandidateId === 'CLUSTER_REGIONS') {
      input.semanticEmbodimentCandidateId = 'CLUSTER_REGIONS';
    } else if (this.representationDecision?.chosenCandidateId === 'RELATIONSHIP_GRAPH') {
      input.semanticEmbodimentCandidateId = 'RELATIONSHIP_GRAPH';
    } else {
      delete input.semanticEmbodimentCandidateId;
    }
  }

  private _subscribeSemanticEmbodiment(): void {
    const input = this.dataInput as SemanticMonetaDataInput;
    const promise = input.semanticEmbodimentPromise;
    const candidateId = this.representationDecision?.chosenCandidateId;
    if (!promise || !usesSemanticEmbodiment(candidateId)) return;
    const token = ++this._semanticEmbodimentToken;
    void promise.then((envelope) => {
      if (
        token !== this._semanticEmbodimentToken ||
        input.semanticEmbodimentPromise !== promise ||
        this.representationDecision?.chosenCandidateId !== candidateId
      ) {
        return;
      }
      if (!envelope) {
        if (this.group) {
          setSemanticEmbodimentPresentationStatus(
            this.group,
            'UNAVAILABLE',
            undefined,
            candidateId
          );
        }
        return;
      }
      input.semanticEmbodiment = envelope;
      this.reSolveAndSynthesize();
    });
  }

  adjustWeight(ruleName: string, delta: number): void {
    if (this.representationGraph || this.representationDecision) {
      throw new Error(
        'MonetaTopologyNode: cannot mutate solver weights while rendering an authoritative representation decision/graph. ' +
          'Adjust Moneta/FitnessModel upstream and provide a new representation.'
      );
    }
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
    this._syncSemanticEmbodimentCandidate();

    if (this.representationGraph) {
      const facts = this.engine.factProvider?.facts(this.dataInput);
      if (!facts) {
        throw new Error(
          'MonetaTopologyNode: no facts provided (supply a FactProvider to render RepresentationGraph)'
        );
      }
      const runtime = representationGraphToRuntimeSpec(this.representationGraph);
      this.solverResult = {
        facts,
        spec: runtime.spec,
        cost: runtime.utilityScore,
      };
    } else if (this.representationDecision) {
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
        cost: this.representationDecision.utilityScore,
      };
    } else {
      const result = this.useRustSolver ? this.solveWithRust() : this.engine.solve(this.dataInput);
      if (isNoFeasibleConstraintResult(result)) {
        throw new Error(
          `MonetaTopologyNode: ${result.reason}; refusing to synthesize fabricated fallback geometry`
        );
      }
      this.solverResult = result;
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

    // A source mutation supersedes any governed graph payload: the resident
    // topology describes the dataset as loaded, so a re-synthesis must render
    // the pending state rather than reuse a stale graph as current truth.
    // The incremental fast-path is skipped entirely for governed graphs — an
    // incremental artifact update could keep rendering the pre-mutation
    // topology even after the envelope above was invalidated.
    const semanticInput = this.dataInput as SemanticMonetaDataInput;
    if (semanticInput.semanticEmbodimentCandidateId === 'RELATIONSHIP_GRAPH') {
      delete semanticInput.semanticEmbodiment;
      this.reSolveAndSynthesize();
      return false;
    }

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
