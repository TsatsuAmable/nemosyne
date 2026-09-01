import type { RepresentationDecision } from '../../../moneta/representation/RepresentationDecision.ts';
import type { RepresentationDecisionStatus } from '../../../moneta/representation/DecisionPolicy.ts';
import type { SemanticEmbodimentPresentationStatus } from '../../../moneta/embodiment/SemanticEmbodimentStatus.ts';
import type {
  InvestigationEdge,
  InvestigationNode,
} from '../../../atlas/domain/InvestigationGraph.ts';
import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import type {
  InvestigationAnalyticalStatus,
  InvestigationDecisionState,
  InvestigationStatusProjection,
  RepresentationCommitState,
  StatusStripController,
} from '../../ui/StatusStripController.ts';

interface UpdatableOwner {
  addUpdatable(node: { update(delta?: number): void }): void;
  removeUpdatable(node: { update(delta?: number): void }): void;
}

export interface InvestigationStateGraphSnapshot {
  activeNodeId: string | null;
  currentDatasetFingerprint: string | null;
  nodes: readonly InvestigationNode[];
  edges: readonly InvestigationEdge[];
  observationCount: number;
  findingCount: number;
}

export interface InvestigationStatePresenterHost {
  engine: UpdatableOwner;
  eventBus: WorldEventBusLike;
  statusStrip: StatusStripController;
  isAnalyticalReady(): boolean;
  getSemanticEmbodimentState(): {
    status: SemanticEmbodimentPresentationStatus;
    message: string | null;
  } | null;
  getDecisionState(): RepresentationDecisionStatus | null;
  getFencedPreviewDecision(): RepresentationDecision | null;
  getFocusState(): { currentLevel: string; focusedStructureId: string | null };
  getHistoryState(): { canUndo: boolean; canRedo: boolean };
  getArchiveCount(): number;
  getGraphSnapshot(): InvestigationStateGraphSnapshot;
}

interface OperationPreviewEvent {
  operation?: string;
}

function countBounded(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function semanticStatus(
  host: InvestigationStatePresenterHost,
  decisionState: InvestigationDecisionState,
): { status: InvestigationAnalyticalStatus; message: string | null } {
  const exact = host.getSemanticEmbodimentState();
  if (exact) return exact;
  if (!host.isAnalyticalReady()) {
    return { status: 'UNAVAILABLE', message: 'Analytical kernel unavailable.' };
  }
  if (decisionState === 'INFEASIBLE') {
    return { status: 'REFUSED', message: 'No representation satisfies the governed constraints.' };
  }
  if (decisionState !== 'PENDING') return { status: 'READY', message: null };
  return { status: 'IDLE', message: null };
}

function isDatasetStateNode(node: InvestigationNode): boolean {
  if (node.kind === 'dataset_version') return true;

  // Compatibility for investigation roots created before the initial dataset
  // node was explicitly typed. InvestigationGraph historically normalized an
  // omitted kind to `operation`; only a parentless canonical `:vN` node is
  // eligible here. Fingerprint matching remains mandatory in the caller, so an
  // ordinary operation cannot be promoted to dataset-state origin by shape alone.
  return node.parentId === null && /:v\d+$/.test(node.id);
}

/**
 * InvestigationGraph.activeNodeId records graph construction/navigation state,
 * while undo/redo may restore an older analytical dataset without rewinding the
 * graph's insertion cursor. Never present that stale cursor as the current
 * investigation origin. Prefer the active node only while its fingerprint
 * agrees with the current analytical dataset; otherwise accept exactly one
 * matching dataset-state node. Ambiguous/no matches fail closed to no origin.
 */
function resolveCurrentOriginNode(graph: InvestigationStateGraphSnapshot): InvestigationNode | null {
  const activeNode = graph.activeNodeId
    ? graph.nodes.find((node) => node.id === graph.activeNodeId) ?? null
    : null;
  const currentFingerprint = graph.currentDatasetFingerprint;

  if (!currentFingerprint) return activeNode;
  if (activeNode?.datasetFingerprint === currentFingerprint) return activeNode;

  const matches = graph.nodes.filter(
    (node) => isDatasetStateNode(node) && node.datasetFingerprint === currentFingerprint,
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * C2 presentation-only projection of authoritative investigation state.
 *
 * It is intentionally a reader. It does not classify scientific evidence,
 * modify Atlas/Moneta state, activate the dormant branch manager, or construct
 * a second recovery/history authority.
 */
export class InvestigationStatePresenter {
  private readonly host: InvestigationStatePresenterHost;
  private readonly unsubscribers: Array<() => void> = [];
  private elapsed = 0;
  private operationPreview: string | null = null;
  private lastRepresentationState: RepresentationCommitState | null = null;
  private disposed = false;

  constructor(host: InvestigationStatePresenterHost) {
    this.host = host;
    this.unsubscribers.push(
      host.eventBus.on(WorldTopics.OPERATION_PREVIEW, (payload: unknown) => {
        const event = payload as OperationPreviewEvent | null;
        this.operationPreview = event?.operation?.trim() || 'operation';
        host.statusStrip.recordAction(
          `Preview ${this.operationPreview}`,
          'Commit or cancel preview',
        );
        this.syncNow();
      }),
      host.eventBus.on(WorldTopics.OPERATION_CLEAR_PREVIEW, () => {
        this.operationPreview = null;
        // Reconcile representation state first. A PREVIEW -> COMMITTED transition
        // may emit the generic "Preview ended" action; the explicit operation
        // event is more informative, so preserve it as the final visible action.
        this.syncNow();
        host.statusStrip.recordAction('Operation preview ended', 'Continue investigation');
      }),
      host.eventBus.on(WorldTopics.OPERATION_APPLIED, () => {
        this.operationPreview = null;
        host.statusStrip.setNextAffordance('Inspect result or undo');
        this.syncNow();
      }),
      host.eventBus.on(WorldTopics.HISTORY_SEEK, () => {
        this.operationPreview = null;
        host.statusStrip.setNextAffordance('Inspect restored analytical state');
        this.syncNow();
      }),
      host.eventBus.on(WorldTopics.DATASET_LOADED, () => {
        this.operationPreview = null;
        host.statusStrip.setNextAffordance('Inspect representation or focus a structure');
        queueMicrotask(() => this.syncNow());
      }),
    );
    host.engine.addUpdatable(this);
    this.syncNow();
  }

  update(delta = 0): void {
    this.elapsed += delta;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    this.syncNow();
  }

  syncNow(): InvestigationStatusProjection | null {
    if (this.disposed) return null;

    const focus = this.host.getFocusState();
    const decisionState: InvestigationDecisionState = this.host.getDecisionState() ?? 'PENDING';
    const previewDecision = this.host.getFencedPreviewDecision();
    const representationState: RepresentationCommitState =
      previewDecision || this.operationPreview ? 'PREVIEW' : 'COMMITTED';
    const analytical = semanticStatus(this.host, decisionState);
    const history = this.host.getHistoryState();
    const graph = this.host.getGraphSnapshot();
    const originNode = resolveCurrentOriginNode(graph);
    const originNodeId = originNode?.id ?? null;

    let supports = 0;
    let refutes = 0;
    let branchSourceId: string | null = null;
    if (originNodeId) {
      for (const edge of graph.edges) {
        const incident = edge.source === originNodeId || edge.target === originNodeId;
        if (!incident) continue;
        if (edge.relationship === 'supports') supports += 1;
        else if (edge.relationship === 'refutes') refutes += 1;
        else if (
          edge.relationship === 'branches_from' &&
          edge.target === originNodeId &&
          branchSourceId === null
        ) {
          branchSourceId = edge.source;
        }
      }
    }

    const projection: InvestigationStatusProjection = {
      focusLevel: focus.currentLevel,
      focusTarget: focus.focusedStructureId,
      analyticalStatus: analytical.status,
      analyticalMessage: analytical.message,
      decisionState,
      representationState,
      previewDecisionId: previewDecision?.id ?? null,
      evidence: {
        supports,
        refutes,
        observations: countBounded(graph.observationCount),
        findings: countBounded(graph.findingCount),
      },
      recovery: {
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        archiveCount: countBounded(this.host.getArchiveCount()),
      },
      origin: {
        activeNodeId: originNodeId,
        parentNodeId: originNode?.parentId ?? null,
        branchSourceId,
      },
    };

    this.host.statusStrip.setInvestigationState(projection);

    if (representationState !== this.lastRepresentationState) {
      if (representationState === 'PREVIEW') {
        if (!this.operationPreview) {
          this.host.statusStrip.recordAction('Representation preview', 'Commit or cancel preview');
        }
      } else if (this.lastRepresentationState === 'PREVIEW') {
        this.host.statusStrip.recordAction('Preview ended', 'Inspect committed state or undo');
      }
      this.lastRepresentationState = representationState;
    }

    if (analytical.status === 'REFUSED' || analytical.status === 'INVALID') {
      this.host.statusStrip.setNextAffordance('Inspect TechnoCore constraints');
    } else if (analytical.status === 'UNAVAILABLE') {
      this.host.statusStrip.setNextAffordance('Restore analytical runtime or reload');
    }

    return projection;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.host.engine.removeUpdatable(this);
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
  }
}
