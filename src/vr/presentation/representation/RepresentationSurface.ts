import type { Group, Mesh, Object3D, Scene } from 'three';
import { MonetaTopologyNode } from '../../../moneta/MonetaTopologyNode.ts';
import type { FactProvider, MonetaDataInput } from '../../../moneta/types.ts';
import type { RepresentationDecision } from '../../../moneta/representation/RepresentationDecision.ts';
import { disposeObject } from '../../../utils/Dispose.ts';
import type { ResourceIdentity } from '../../scalability/ResourceLifecycleGovernor.ts';
import { ResourceLifecycleGovernor } from '../../scalability/ResourceLifecycleGovernor.ts';
import { MonetaDiagnosticHUD } from '../../ui/MonetaDiagnosticHUD.ts';
import { PANEL_LAYOUT } from '../../ui/panelLayout.ts';
import { createRepresentationResourceAdapter } from './RepresentationResourceLifecycle.ts';

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

export type RepresentationSelectionListener = (mesh: Mesh | null) => void;

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
  resourceLifecycle?: ResourceLifecycleGovernor;
  createResourceIdentity?: (
    decision: RepresentationDecision | null,
    projectionOrdinal: number
  ) => ResourceIdentity | null;
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
  private projectionOrdinal = 0;
  private currentResourceIdentity: ResourceIdentity | null = null;
  private readonly selectionListeners = new Set<RepresentationSelectionListener>();
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
    let nextDiagnostic: MonetaDiagnosticHUD;
    try {
      nextDiagnostic = this.createDiagnostic(this.dependencies, nextNode);
    } catch (error) {
      this.disposeUnboundCandidate(nextNode, null);
      throw error;
    }

    const selectedIdentity = semanticSelectionIdentity(this.selectedMesh);
    const governor = this.dependencies.resourceLifecycle;
    const createResourceIdentity = this.dependencies.createResourceIdentity;
    if (governor && createResourceIdentity) {
      return this.replaceGoverned(
        nextNode,
        nextDiagnostic,
        representationDecision,
        selectedIdentity,
        governor,
        createResourceIdentity
      );
    }

    this.disposeCurrentImmediate();
    this.activateCandidate(nextNode, nextDiagnostic, selectedIdentity);
    return nextNode;
  }

  /**
   * Clears any promoted representation without constructing a replacement.
   * Used for scientific ABSTAIN: the dataset/investigation remains active, but
   * no near-miss or fallback representation is promoted into the scene.
   */
  clear(): void {
    if (this.disposed) throw new Error('RepresentationSurface is disposed');
    this.retireCurrent();
  }

  subscribeSelection(listener: RepresentationSelectionListener): () => void {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  setSelectedMesh(mesh: Mesh | null): void {
    this.selectedMesh = mesh;
    this.publishSelection(mesh);
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
    try {
      this.retireCurrent();
    } finally {
      this.selectionListeners.clear();
    }
  }

  private publishSelection(mesh: Mesh | null): void {
    for (const listener of this.selectionListeners) listener(mesh);
  }

  private replaceGoverned(
    nextNode: MonetaTopologyNode,
    nextDiagnostic: MonetaDiagnosticHUD,
    representationDecision: RepresentationDecision | null,
    selectedIdentity: SemanticSelectionIdentity | null,
    governor: ResourceLifecycleGovernor,
    createResourceIdentity: NonNullable<RepresentationSurfaceDependencies['createResourceIdentity']>
  ): MonetaTopologyNode {
    const ordinal = this.projectionOrdinal + 1;
    let identity: ResourceIdentity | null;
    try {
      identity = createResourceIdentity(representationDecision, ordinal);
    } catch (error) {
      this.disposeUnboundCandidate(nextNode, nextDiagnostic);
      throw error;
    }
    if (!identity) {
      this.disposeUnboundCandidate(nextNode, nextDiagnostic);
      throw new Error('Representation lifecycle identity is unavailable');
    }

    const declaration = { identity, desired: 'ACTIVE', priority: 'FOCUS' } as const;
    let admission;
    try {
      admission = governor.validateWorkingSet([declaration]);
    } catch (error) {
      this.disposeUnboundCandidate(nextNode, nextDiagnostic);
      throw error;
    }
    if (!admission.accepted) {
      this.disposeUnboundCandidate(nextNode, nextDiagnostic);
      throw new Error(
        `Representation lifecycle admission refused${admission.reason ? `: ${admission.reason}` : ''}`
      );
    }

    try {
      governor.register({
        identity,
        runtime: {
          identity,
          node: nextNode,
          diagnostic: nextDiagnostic,
          disposalStack: nextNode.group ? [nextNode.group] : [],
          diagnosticDisposed: false,
        },
        adapter: createRepresentationResourceAdapter(this.dependencies),
      });
    } catch (error) {
      this.disposeUnboundCandidate(nextNode, nextDiagnostic);
      throw error;
    }

    const previousSelection = this.selectedMesh;
    if (previousSelection) {
      this.selectedMesh = null;
      this.publishSelection(null);
    }

    let reconciliation;
    try {
      reconciliation = governor.reconcile([declaration]);
    } catch (error) {
      this.rollbackRegisteredCandidate(
        governor,
        identity,
        nextNode,
        nextDiagnostic,
        previousSelection
      );
      throw error;
    }
    if (!reconciliation.accepted) {
      this.rollbackRegisteredCandidate(
        governor,
        identity,
        nextNode,
        nextDiagnostic,
        previousSelection
      );
      throw new Error(
        `Representation lifecycle swap refused${reconciliation.reason ? `: ${reconciliation.reason}` : ''}`
      );
    }

    this.currentResourceIdentity = identity;
    this.activateCandidate(nextNode, nextDiagnostic, selectedIdentity);
    this.projectionOrdinal = ordinal;
    return nextNode;
  }

  private rollbackRegisteredCandidate(
    governor: ResourceLifecycleGovernor,
    identity: ResourceIdentity,
    node: MonetaTopologyNode,
    diagnostic: MonetaDiagnosticHUD,
    previousSelection: Mesh | null
  ): void {
    node.cancelPendingSemanticEmbodiment();
    if (node.group?.parent) node.group.parent.remove(node.group);
    if (diagnostic.mesh.parent) diagnostic.mesh.parent.remove(diagnostic.mesh);

    let discard;
    try {
      discard = governor.discardUnclaimedWarm(identity);
    } finally {
      this.selectedMesh = previousSelection;
      if (previousSelection) this.publishSelection(previousSelection);
    }
    if (!discard.accepted) {
      throw new Error(
        `Representation lifecycle candidate rollback refused${discard.reason ? `: ${discard.reason}` : ''}`
      );
    }
  }

  private activateCandidate(
    node: MonetaTopologyNode,
    diagnostic: MonetaDiagnosticHUD,
    selectedIdentity: SemanticSelectionIdentity | null
  ): void {
    this.currentNode = node;
    this.diagnostic = diagnostic;
    this.dependencies.addUpdatable(node);
    this.bindNodeInteractions(node);
    this.dependencies.addDiagnosticPanel(diagnostic);
    this.dependencies.analystAnchor.add(diagnostic.mesh);

    this.selectedMesh =
      selectedIdentity && node.artifact?.nodeMeshes
        ? (node.artifact.nodeMeshes.find((mesh) =>
            matchesSemanticSelection(mesh, selectedIdentity)
          ) ?? null)
        : null;
    if (this.selectedMesh) this.publishSelection(this.selectedMesh);
  }

  private retireCurrent(): void {
    if (this.currentResourceIdentity && this.dependencies.resourceLifecycle) {
      if (this.selectedMesh) this.publishSelection(null);
      this.currentNode = null;
      this.diagnostic = null;
      this.selectedMesh = null;
      this.currentResourceIdentity = null;
      const reconciliation = this.dependencies.resourceLifecycle.reconcile([]);
      if (!reconciliation.accepted) {
        throw new Error(
          `Representation lifecycle retirement refused${reconciliation.reason ? `: ${reconciliation.reason}` : ''}`
        );
      }
      return;
    }

    this.disposeCurrentImmediate();
  }

  private disposeCurrentImmediate(): void {
    const node = this.currentNode;
    const diagnostic = this.diagnostic;
    this.dependencies.clearStructureHandles();

    if (this.selectedMesh) this.publishSelection(null);
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
    this.currentResourceIdentity = null;
  }

  private disposeUnboundCandidate(
    node: MonetaTopologyNode,
    diagnostic: MonetaDiagnosticHUD | null
  ): void {
    node.cancelPendingSemanticEmbodiment();
    if (node.group) disposeObject(node.group);
    if (diagnostic?.mesh.parent) diagnostic.mesh.parent.remove(diagnostic.mesh);
    diagnostic?.dispose();
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
                  : mesh.userData.representationKind === 'RELATIONSHIP_GRAPH'
                    ? mesh.userData.provenance
                      ? mesh.userData.semanticRole === 'edge'
                        ? 'graph-edge'
                        : 'graph-node'
                      : 'presentation-graph'
                    : 'observation';
        this.dependencies.addInteractable(mesh, {
          semantic: { kind: semanticKind },
          onEnter: (object) => node.artifact?.interactions?.onHover?.(object as Mesh),
          onLeave: (object) => node.artifact?.interactions?.onUnhover?.(object as Mesh),
          onSelect: (object) => {
            const selected = object as Mesh;
            node.artifact?.interactions?.onSelect?.(selected);
            this.selectedMesh = selected;
            this.publishSelection(selected);
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
