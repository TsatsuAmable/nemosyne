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
    const selectedName = this.selectedMesh?.name || null;

    this.disposeCurrent();
    this.currentNode = nextNode;
    this.dependencies.addUpdatable(nextNode);
    this.bindNodeInteractions(nextNode);

    const diagnostic = this.createDiagnostic(this.dependencies, nextNode);
    this.diagnostic = diagnostic;
    this.dependencies.addDiagnosticPanel(diagnostic);
    this.dependencies.analystAnchor.add(diagnostic.mesh);

    if (selectedName && nextNode.artifact?.nodeMeshes) {
      this.selectedMesh =
        nextNode.artifact.nodeMeshes.find((mesh) => mesh.name === selectedName) ?? null;
    }
    return nextNode;
  }

  setSelectedMesh(mesh: Mesh | null): void {
    this.selectedMesh = mesh;
  }

  findMeshByName(name: string): Mesh | null {
    return this.currentNode?.artifact?.nodeMeshes?.find((mesh) => mesh.name === name) ?? null;
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
