import type { Group, Mesh, Object3D, Scene } from 'three';
import { MonetaTopologyNode } from '../../../moneta/MonetaTopologyNode.ts';
import type { FactProvider, MonetaDataInput } from '../../../moneta/types.ts';
import type { RepresentationDecision } from '../../../moneta/representation/RepresentationDecision.ts';
import { disposeObject } from '../../../utils/Dispose.ts';
import { MonetaDiagnosticHUD } from '../../ui/MonetaDiagnosticHUD.ts';
import { PANEL_LAYOUT } from '../../ui/panelLayout.ts';

export interface RepresentationInteractableOptions {
  semantic?: { kind: string };
  onEnter?: (object: Object3D) => void;
  onLeave?: (object: Object3D) => void;
  onSelect?: (object: Object3D) => void;
}

export interface SemanticSelectionIdentity {
  semanticId: string;
  datasetFingerprint: string | null;
  decisionId: string | null;
}

export interface RepresentationSurfaceDependencies {
  scene: Scene;
  cameraGroup: Group;
  analystAnchor: Group;
  getColorblindMode(): unknown;
  getFactProvider(): FactProvider;
  addUpdatable(node: MonetaTopologyNode): void;
  removeUpdatable(node: MonetaTopologyNode): void;
  addInteractable(mesh: Mesh, options: RepresentationInteractableOptions): void;
  removeInteractable(mesh: Mesh): void;
  addDiagnosticPanel(panel: MonetaDiagnosticHUD): void;
  removeDiagnosticPanel(panel: MonetaDiagnosticHUD): void;
  setTooltipTargets(meshes: Mesh[]): void;
  clearStructureHandles(): void;
  rebuildStructureHandles(node: MonetaTopologyNode): void;
  onSelectNode(mesh: Mesh): void;
}

export interface RepresentationSurfaceFactories {
  createNode?: (
    scene: Scene,
    dataInput: MonetaDataInput,
    decision: RepresentationDecision | null,
    dependencies: RepresentationSurfaceDependencies
  ) => MonetaTopologyNode;
  createDiagnostic?: (
    dependencies: RepresentationSurfaceDependencies,
    node: MonetaTopologyNode
  ) => MonetaDiagnosticHUD;
}

function semanticSelectionIdentity(mesh: Mesh | null): SemanticSelectionIdentity | null {
  if (!mesh) return null;
  const semanticId =
    typeof mesh.userData.semanticId === 'string' && mesh.userData.semanticId.length > 0
      ? mesh.userData.semanticId
      : mesh.name;
  if (!semanticId) return null;
  return {
    semanticId,
    datasetFingerprint:
      typeof mesh.userData.datasetFingerprint === 'string'
        ? mesh.userData.datasetFingerprint
        : null,
    decisionId:
      typeof mesh.userData.provenance?.decisionId === 'string' &&
      mesh.userData.provenance.decisionId.length > 0
        ? mesh.userData.provenance.decisionId
        : null,
  };
}

function matchesSemanticSelection(mesh: Mesh, identity: SemanticSelectionIdentity): boolean {
  const candidate = semanticSelectionIdentity(mesh);
  return (
    candidate !== null &&
    candidate.semanticId === identity.semanticId &&
    candidate.datasetFingerprint === identity.datasetFingerprint &&
    candidate.decisionId === identity.decisionId
  );
}

/** Owns the resources that constitute the currently rendered Moneta representation. */
export class RepresentationSurface {
  currentNode: MonetaTopologyNode | null = null;
  diagnostic: MonetaDiagnosticHUD | null = null;
  selectedMesh: Mesh | null = null;

  private disposed = false;
  private readonly createNode: NonNullable<RepresentationSurfaceFactories['createNode']>;
  private readonly createDiagnostic: NonNullable<
    RepresentationSurfaceFactories['createDiagnostic']
  >;

  constructor(
    private readonly dependencies: RepresentationSurfaceDependencies,
    factories: RepresentationSurfaceFactories = {}
  ) {
    this.createNode =
      factories.createNode ??
      ((scene, dataInput, decision, deps) =>
        new MonetaTopologyNode(
          scene,
          dataInput,
          [0, 1.4, -3.5],
          { colorblindMode: deps.getColorblindMode() as never },
          deps.getFactProvider(),
          false,
          decision
        ));
    this.createDiagnostic =
      factories.createDiagnostic ??
      ((deps, node) =>
        new MonetaDiagnosticHUD(deps.cameraGroup, node, [...PANEL_LAYOUT.monetaDiagnosticHUD]));
  }

  replace(
    dataInput: MonetaDataInput,
    representationDecision: RepresentationDecision | null
  ): MonetaTopologyNode {
    if (this.disposed) throw new Error('RepresentationSurface is disposed');
    const nextNode = this.createNode(
      this.dependencies.scene,
      dataInput,
      representationDecision,
      this.dependencies
    );
    const selectedIdentity = semanticSelectionIdentity(this.selectedMesh);

    this.disposeCurrent();
    this.currentNode = nextNode;
    this.dependencies.addUpdatable(nextNode);
    this.bindNodeInteractions(nextNode);

    const diagnostic = this.createDiagnostic(this.dependencies, nextNode);
    this.diagnostic = diagnostic;
    this.dependencies.addDiagnosticPanel(diagnostic);
    this.dependencies.analystAnchor.add(diagnostic.mesh);

    if (selectedIdentity && nextNode.artifact?.nodeMeshes) {
      this.selectedMesh =
        nextNode.artifact.nodeMeshes.find((mesh) => matchesSemanticSelection(mesh, selectedIdentity)) ??
        null;
    }
    return nextNode;
  }

  setSelectedMesh(mesh: Mesh | null): void {
    this.selectedMesh = mesh;
  }

  getSelectedSemanticIdentity(): SemanticSelectionIdentity | null {
    return semanticSelectionIdentity(this.selectedMesh);
  }

  findMeshByName(name: string): Mesh | null {
    return this.currentNode?.artifact?.nodeMeshes?.find((mesh) => mesh.name === name) ?? null;
  }

  findMeshBySemanticIdentity(identity: SemanticSelectionIdentity): Mesh | null {
    return (
      this.currentNode?.artifact?.nodeMeshes?.find((mesh) =>
        matchesSemanticSelection(mesh, identity)
      ) ?? null
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeCurrent();
  }

  private disposeCurrent(): void {
    const node = this.currentNode;
    const diagnostic = this.diagnostic;
    this.dependencies.clearStructureHandles();

    if (node?.artifact) {
      for (const mesh of node.artifact.nodeMeshes) this.dependencies.removeInteractable(mesh);
    }
    if (node) {
      node.cancelPendingSemanticEmbodiment();
      this.dependencies.removeUpdatable(node);
      if (node.group) disposeObject(node.group);
    }

    if (diagnostic) {
      this.dependencies.removeDiagnosticPanel(diagnostic);
      diagnostic.dispose();
    }

    this.currentNode = null;
    this.diagnostic = null;
    this.selectedMesh = null;
  }

  private bindNodeInteractions(node: MonetaTopologyNode): void {
    const wire = () => {
      if (!node.artifact) return;
      this.dependencies.setTooltipTargets(node.artifact.nodeMeshes);
      for (const mesh of node.artifact.nodeMeshes) {
        const semanticKind =
          mesh.userData.representationKind === 'AGGREGATE_VOLUME'
            ? 'aggregate-group'
            : mesh.userData.representationKind === 'DISTRIBUTION_FIELD'
              ? 'distribution-element'
              : mesh.userData.representationKind === 'DENSITY_FIELD'
                ? 'density-cell'
                : mesh.userData.representationKind === 'CLUSTER_REGIONS'
                  ? mesh.userData.provenance
                    ? 'cluster-region'
                    : 'presentation-cluster'
                  : 'observation';
        this.dependencies.addInteractable(mesh, {
          semantic: { kind: semanticKind },
          onEnter: (object) => node.artifact?.interactions?.onHover?.(object as Mesh),
          onLeave: (object) => node.artifact?.interactions?.onUnhover?.(object as Mesh),
          onSelect: (object) => {
            const selected = object as Mesh;
            node.artifact?.interactions?.onSelect?.(selected);
            this.selectedMesh = selected;
            this.dependencies.onSelectNode(selected);
          },
        });
      }
    };

    const original = node.reSolveAndSynthesize.bind(node);
    node.reSolveAndSynthesize = () => {
      if (node.artifact) {
        for (const mesh of node.artifact.nodeMeshes) this.dependencies.removeInteractable(mesh);
      }
      this.dependencies.clearStructureHandles();
      original();
      wire();
      this.dependencies.rebuildStructureHandles(node);
      this.diagnostic?.render();
    };

    wire();
    this.dependencies.rebuildStructureHandles(node);
  }
}
