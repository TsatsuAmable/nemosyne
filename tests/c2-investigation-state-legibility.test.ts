import { describe, expect, it, vi } from 'vitest';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';
import { StatusStripController } from '../src/vr/ui/StatusStripController.ts';
import { InvestigationStatePresenter } from '../src/vr/presentation/investigation/InvestigationStatePresenter.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import type { InvestigationEdge, InvestigationNode } from '../src/atlas/domain/InvestigationGraph.ts';

function makeHarness() {
  const eventBus = new WorldEventBus();
  const statusStrip = new StatusStripController();
  const engine = {
    addUpdatable: vi.fn(),
    removeUpdatable: vi.fn(),
  };
  let analyticalReady = true;
  let semanticState: { status: 'PENDING' | 'REFUSED' | 'INVALID' | 'UNAVAILABLE' | 'READY'; message: string | null } | null = {
    status: 'READY',
    message: null,
  };
  let decisionState: 'DECISIVE' | 'AMBIGUOUS' | 'INFEASIBLE' | 'UNDERDETERMINED' | null = 'DECISIVE';
  let previewDecision: RepresentationDecision | null = null;
  let focus = { currentLevel: 'dataset', focusedStructureId: null as string | null };
  let history = { canUndo: false, canRedo: false };
  let archiveCount = 0;
  let nodes: InvestigationNode[] = [];
  let edges: InvestigationEdge[] = [];
  let activeNodeId: string | null = null;
  let currentDatasetFingerprint: string | null = 'fp';
  let observationCount = 0;
  let findingCount = 0;

  const presenter = new InvestigationStatePresenter({
    engine,
    eventBus,
    statusStrip,
    isAnalyticalReady: () => analyticalReady,
    getSemanticEmbodimentState: () => semanticState,
    getDecisionState: () => decisionState,
    getFencedPreviewDecision: () => previewDecision,
    getFocusState: () => focus,
    getHistoryState: () => history,
    getArchiveCount: () => archiveCount,
    getGraphSnapshot: () => ({
      activeNodeId,
      currentDatasetFingerprint,
      nodes,
      edges,
      observationCount,
      findingCount,
    }),
  });

  return {
    eventBus,
    statusStrip,
    engine,
    presenter,
    setAnalyticalReady: (value: boolean) => { analyticalReady = value; },
    setSemanticState: (value: typeof semanticState) => { semanticState = value; },
    setDecisionState: (value: typeof decisionState) => { decisionState = value; },
    setPreviewDecision: (value: RepresentationDecision | null) => { previewDecision = value; },
    setFocus: (value: typeof focus) => { focus = value; },
    setHistory: (value: typeof history) => { history = value; },
    setArchiveCount: (value: number) => { archiveCount = value; },
    setCurrentDatasetFingerprint: (value: string | null) => { currentDatasetFingerprint = value; },
    setGraph: (value: {
      activeNodeId: string | null;
      nodes: InvestigationNode[];
      edges: InvestigationEdge[];
      observationCount?: number;
      findingCount?: number;
    }) => {
      activeNodeId = value.activeNodeId;
      nodes = value.nodes;
      edges = value.edges;
      observationCount = value.observationCount ?? 0;
      findingCount = value.findingCount ?? 0;
    },
  };
}

describe('P1-UV C2 investigation-state legibility', () => {
  it('projects exact focus, semantic status and decision category without reclassification', () => {
    const h = makeHarness();
    h.setFocus({ currentLevel: 'structure', focusedStructureId: 'cluster:7' });
    h.setSemanticState({ status: 'REFUSED', message: 'Authority refused payload.' });
    h.setDecisionState('UNDERDETERMINED');

    const snapshot = h.presenter.syncNow();

    expect(snapshot?.focusLevel).toBe('structure');
    expect(snapshot?.focusTarget).toBe('cluster:7');
    expect(snapshot?.analyticalStatus).toBe('REFUSED');
    expect(snapshot?.analyticalMessage).toBe('Authority refused payload.');
    expect(snapshot?.decisionState).toBe('UNDERDETERMINED');
    expect(h.statusStrip.state.nextAffordance).toBe('Inspect TechnoCore constraints');
  });

  it('uses analytical readiness only as a fallback when no governed embodiment status exists', () => {
    const h = makeHarness();
    h.setSemanticState(null);
    h.setAnalyticalReady(false);

    expect(h.presenter.syncNow()?.analyticalStatus).toBe('UNAVAILABLE');

    h.setAnalyticalReady(true);
    h.setDecisionState('DECISIVE');
    expect(h.presenter.syncNow()?.analyticalStatus).toBe('READY');
  });

  it('counts only explicit support/refute edges incident to the current origin node', () => {
    const h = makeHarness();
    const nodes: InvestigationNode[] = [
      { id: 'root', parentId: null, datasetVersion: 1, datasetFingerprint: 'fp', label: 'root', timestamp: 1 },
      { id: 'active', kind: 'dataset_version', parentId: 'root', datasetVersion: 1, datasetFingerprint: 'fp', label: 'active', timestamp: 2 },
      { id: 'other', parentId: 'root', datasetVersion: 1, datasetFingerprint: 'fp-other', label: 'other', timestamp: 3 },
    ];
    const edges: InvestigationEdge[] = [
      { id: 'support-active', source: 'root', target: 'active', relationship: 'supports' },
      { id: 'refute-active', source: 'active', target: 'other', relationship: 'refutes' },
      { id: 'unrelated-support', source: 'root', target: 'other', relationship: 'supports' },
      { id: 'motivation', source: 'root', target: 'active', relationship: 'motivates' },
    ];
    h.setGraph({ activeNodeId: 'active', nodes, edges, observationCount: 4, findingCount: 2 });

    const snapshot = h.presenter.syncNow();

    expect(snapshot?.evidence).toEqual({ supports: 1, refutes: 1, observations: 4, findings: 2 });
    expect(snapshot?.origin.parentNodeId).toBe('root');
  });

  it('projects branch origin only from an explicit incoming branches_from edge', () => {
    const h = makeHarness();
    const nodes: InvestigationNode[] = [
      { id: 'source', parentId: null, datasetVersion: 1, datasetFingerprint: 'source-fp', label: 'source', timestamp: 1 },
      { id: 'branch', kind: 'dataset_version', parentId: 'source', datasetVersion: 1, datasetFingerprint: 'fp', label: 'branch', timestamp: 2 },
    ];
    h.setGraph({
      activeNodeId: 'branch',
      nodes,
      edges: [{ id: 'branch-edge', source: 'source', target: 'branch', relationship: 'branches_from' }],
    });

    expect(h.presenter.syncNow()?.origin.branchSourceId).toBe('source');

    h.setGraph({ activeNodeId: 'branch', nodes, edges: [] });
    expect(h.presenter.syncNow()?.origin.branchSourceId).toBeNull();
  });

  it('does not present a stale graph insertion cursor as current origin after undo/seek', () => {
    const h = makeHarness();
    const nodes: InvestigationNode[] = [
      { id: 'v1', kind: 'dataset_version', parentId: null, datasetVersion: 1, datasetFingerprint: 'fp-v1', label: 'v1', timestamp: 1 },
      { id: 'op2', kind: 'operation', parentId: 'v1', datasetVersion: 2, datasetFingerprint: 'fp-v2', label: 'sort', timestamp: 2 },
      { id: 'v2', kind: 'dataset_version', parentId: 'op2', datasetVersion: 2, datasetFingerprint: 'fp-v2', label: 'v2', timestamp: 3 },
    ];
    h.setGraph({ activeNodeId: 'v2', nodes, edges: [] });
    h.setCurrentDatasetFingerprint('fp-v1');

    const restored = h.presenter.syncNow();
    expect(restored?.origin.activeNodeId).toBe('v1');
    expect(restored?.origin.parentNodeId).toBeNull();

    // Multiple graph states with the same fingerprint are ambiguous. C2 must
    // fail closed instead of guessing which branch is current.
    h.setGraph({
      activeNodeId: 'v2',
      nodes: [
        ...nodes,
        { id: 'v1-copy', kind: 'dataset_version', parentId: 'other', datasetVersion: 3, datasetFingerprint: 'fp-v1', label: 'v1 copy', timestamp: 4 },
      ],
      edges: [],
    });
    expect(h.presenter.syncNow()?.origin.activeNodeId).toBeNull();
  });

  it('mirrors undo, redo and real archive availability without a synthetic recovery stack', () => {
    const h = makeHarness();
    h.setHistory({ canUndo: true, canRedo: false });
    h.setArchiveCount(3);

    expect(h.presenter.syncNow()?.recovery).toEqual({ canUndo: true, canRedo: false, archiveCount: 3 });
    expect(h.statusStrip.formatInvestigationLines()[2]).toContain('UNDO/ARCHIVE×3');
  });

  it('labels only the currently fenced remediation preview as PREVIEW', () => {
    const h = makeHarness();
    h.setPreviewDecision({ id: 'preview-1' } as RepresentationDecision);

    expect(h.presenter.syncNow()?.representationState).toBe('PREVIEW');
    expect(h.statusStrip.state.previewDecisionId).toBe('preview-1');

    h.setPreviewDecision(null);
    expect(h.presenter.syncNow()?.representationState).toBe('COMMITTED');
    expect(h.statusStrip.state.previewDecisionId).toBeNull();
  });

  it('tracks ordinary operation preview events and clears them without analytical mutation', () => {
    const h = makeHarness();
    h.eventBus.emit(WorldTopics.OPERATION_PREVIEW, { operation: 'filter' });

    expect(h.statusStrip.state.representationState).toBe('PREVIEW');
    expect(h.statusStrip.state.lastAction).toBe('Preview filter');

    h.eventBus.emit(WorldTopics.OPERATION_CLEAR_PREVIEW);
    expect(h.statusStrip.state.representationState).toBe('COMMITTED');
    expect(h.statusStrip.state.lastAction).toBe('Operation preview ended');
  });

  it('preserves the legacy one-line format while exposing the new compact investigation rows', () => {
    const controller = new StatusStripController();
    controller.setDatasetContext('FINANCIAL_FRAUD', 'GRAPH', 18_420);
    controller.setInteractionMode('INTERACT');
    controller.setFocusTarget('COMMUNITY_7');
    controller.recordAction('COMPARE_DISTRIBUTION', 'Filter anomaly subgraphs');

    expect(controller.formatStripText()).toBe(
      'GRAPH / 18,420 items · MODE: INTERACT · FOCUS: COMMUNITY_7 · ACTION: COMPARE_DISTRIBUTION',
    );
    expect(controller.formatInvestigationLines()).toHaveLength(4);
  });

  it('removes its update subscription and event listeners on dispose', () => {
    const h = makeHarness();
    expect(h.engine.addUpdatable).toHaveBeenCalledWith(h.presenter);
    expect(h.eventBus.listenerCount(WorldTopics.OPERATION_PREVIEW)).toBe(1);

    h.presenter.dispose();

    expect(h.engine.removeUpdatable).toHaveBeenCalledWith(h.presenter);
    expect(h.eventBus.listenerCount(WorldTopics.OPERATION_PREVIEW)).toBe(0);
  });
});
