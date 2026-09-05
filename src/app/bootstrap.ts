/**
 * Application Bootstrap & Composition Root.
 *
 * Coordinates initialization of the presentation layer, input subsystem, and dev tools.
 */

import { World } from '../vr/World.ts';
import { allSampleDatasets } from '../data/SampleDatasets.ts';
import { WorldTopics } from '../utils/EventBus.ts';
import '../ui/components/index.ts';
import { resolveDatasetCycleCursor } from './dataset/DatasetCycleCursor.ts';
import { SemanticDetailTransition } from './dataset/SemanticDetailTransition.ts';
import { mountSemanticDetailReturnControl } from './dataset/SemanticDetailReturnControl.ts';
import { mountSemanticDatumInspector } from './dataset/SemanticDatumInspector.ts';
import {
  setupDevTraceRecorder,
  type DevTraceBindings,
} from './devTrace.ts';
import { assessAnalystRepresentation } from './AnalystRepresentationAssessment.ts';
import {
  mountInvestigationShell,
  type InvestigationActions,
  type InvestigationShellHandle,
} from './InvestigationShell.ts';
import {
  mountDesktopSelectionTaskRail,
  type DesktopSelectionTaskActions,
} from './DesktopSelectionTaskRail.ts';
import {
  DiscoveryReasoningService,
} from './investigation/DiscoveryReasoningService.ts';
import {
  mountDesktopReasoningRail,
  type DesktopReasoningRailActions,
} from './investigation/DesktopReasoningRail.ts';
import {
  RepresentationReviewService,
} from './investigation/RepresentationReviewService.ts';
import {
  mountDesktopReviewRecoveryRail,
  type DesktopReviewRecoveryActions,
} from './investigation/DesktopReviewRecoveryRail.ts';
import {
  createApplicationIntentDispatcher,
  type ApplicationDispatchIntentDispatcher,
  type ApplicationIntentDispatcher,
} from './intents/ApplicationIntent.ts';
import { bindInputCallbacksToApplicationIntents } from './intents/InputIntentBindings.ts';
import { FunctionalWorldObjectsPresenter } from '../vr/presentation/epistemic/FunctionalWorldObjectsPresenter.ts';
import { InvestigationStatePresenter } from '../vr/presentation/investigation/InvestigationStatePresenter.ts';
import type { SemanticEmbodimentPresentationStatus } from '../moneta/embodiment/SemanticEmbodimentStatus.ts';

export interface AppInstance {
  world: World;
  dispatchIntent: ApplicationDispatchIntentDispatcher;
  investigationShell: InvestigationShellHandle;
}

const SEMANTIC_STATUS_VALUES = new Set<SemanticEmbodimentPresentationStatus>([
  'PENDING',
  'REFUSED',
  'INVALID',
  'UNAVAILABLE',
  'READY',
]);

/**
 * Keep the legacy sample-cycle cursor aligned with the dataset that is actually
 * active before a semantic cycle intent. Restore/import paths may omit the
 * built-in sample key while retaining a human label or Dataset.name, so the
 * resolver matches all governed identity forms before advancing.
 */
function synchronizeDatasetCycleCursor(world: World, step: number): void {
  world._datasetCycleIndex = resolveDatasetCycleCursor(
    allSampleDatasets,
    {
      key: world.currentEntry?.key,
      name: world.currentEntry?.name,
      label: world.currentEntry?.label,
      datasetName: world.currentEntry?.dataset?.name ?? world.atlas.dataset?.name ?? null,
    },
    step,
  );
}

function applicationIntentDispatcher(world: World): ApplicationDispatchIntentDispatcher {
  return createApplicationIntentDispatcher({
    cycleDataset: (step) => {
      synchronizeDatasetCycleCursor(world, step);
      world._cycleDataset(step);
    },
    applyAnalysis: (operation) => world.dataOperationController.applyAsync(operation),
    resetAnalysis: () => world.resetDataOperation(),
    undoHistory: () => world.undoAnalysis(),
    redoHistory: () => world.redoAnalysis(),
    toggleStatisticalLens: () => world._toggleStatisticalLens(),
    openSettings: () => world.uiManager.settingsPanel.show(),
  });
}

function investigationActions(
  world: World,
  dispatchIntent: ApplicationDispatchIntentDispatcher,
  functionalWorldObjects: FunctionalWorldObjectsPresenter,
): InvestigationActions {
  return {
    dispatchIntent,
    currentDatasetName: () =>
      world.currentEntry?.name ?? world.currentEntry?.label ?? world.currentEntry?.key ?? null,
    subscribeDatasetContext: (handler) =>
      world.eventBus.on(WorldTopics.DATASET_LOADED, () => {
        queueMicrotask(() => {
          functionalWorldObjects.noteAssessmentOutcome('decision');
          functionalWorldObjects.syncNow();
          handler();
        });
      }),
    assessRepresentation: (maxRenderedElements) => {
      const outcome = assessAnalystRepresentation(world.atlas, world.session, maxRenderedElements);
      functionalWorldObjects.noteAssessmentOutcome(outcome.kind);
      return outcome;
    },
    analysisResultCount: () => world.atlas.results.length,
    markMoment: (note) => {
      const observation = world.markMoment(note);
      functionalWorldObjects.syncNow();
      return observation.id;
    },
    replayPortableInvestigation: async (bytes) => {
      const result = await world.replayPortableInvestigation(bytes);
      functionalWorldObjects.noteAssessmentOutcome('decision');
      functionalWorldObjects.syncNow();
      return result;
    },
    exportPortableInvestigation: () =>
      world.session.exportPortablePackage({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        webxrSupported: 'xr' in navigator,
      }),
  };
}

function desktopSelectionTaskActions(world: World): DesktopSelectionTaskActions {
  const surface = world.uiManager.contextualTaskSurface;
  return {
    getSelection: () => {
      const data = surface.activeData;
      if (!data) return null;
      const rawLabel = data.name ?? data.label ?? data.id ?? surface.activeNode?.name ?? 'Selected object';
      return {
        label: String(rawLabel).slice(0, 80),
        data,
      };
    },
    dispatchTask: (intent, data) => surface.dispatchTask(intent, data),
    taskAvailability: (intent, data) => surface.taskAvailability(intent, data),
    subscribeSelectionContext: (handler) => {
      const refreshAfterSelectionSettles = () => queueMicrotask(handler);
      const unsubscribeSelection = world.representationSurface.subscribeSelection(
        refreshAfterSelectionSettles,
      );
      const unsubscribeDataset = world.eventBus.on(
        WorldTopics.DATASET_LOADED,
        refreshAfterSelectionSettles,
      );
      return () => {
        unsubscribeSelection();
        unsubscribeDataset();
      };
    },
  };
}

function desktopReasoningRailActions(
  world: World,
  reasoning: DiscoveryReasoningService,
  functionalWorldObjects: FunctionalWorldObjectsPresenter,
): DesktopReasoningRailActions {
  const syncPresentation = (): void => functionalWorldObjects.syncNow();
  return {
    snapshot: () => reasoning.snapshot(),
    start: (input) => {
      const episode = reasoning.start(input);
      syncPresentation();
      return { discoveryId: episode.discoveryId };
    },
    recordTest: (input) => {
      const episode = reasoning.recordTest(input);
      syncPresentation();
      return {
        discoveryId: episode.discoveryId,
        validationStatus: episode.validationStatus,
      };
    },
    branch: (input) => {
      const node = reasoning.branch(input);
      syncPresentation();
      return { id: node.id };
    },
    returnToConclusion: (discoveryId) => {
      const node = reasoning.returnToConclusion(discoveryId);
      syncPresentation();
      return { id: node.id };
    },
    subscribeContext: (handler) => {
      const refresh = () => queueMicrotask(handler);
      const unsubscribeDataset = world.eventBus.on(WorldTopics.DATASET_LOADED, refresh);
      const unsubscribeOperation = world.eventBus.on(WorldTopics.OPERATION_APPLIED, refresh);
      const unsubscribeInteraction = world.eventBus.on(WorldTopics.INTERACTION_LOG, (payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'action' in payload &&
          payload.action === 'Mark moment'
        ) {
          refresh();
        }
      });
      return () => {
        unsubscribeDataset();
        unsubscribeOperation();
        unsubscribeInteraction();
      };
    },
  };
}

async function waitForProductState(
  predicate: () => boolean,
  failureMessage: string,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error(failureMessage);
}

function desktopReviewRecoveryActions(
  world: World,
  review: RepresentationReviewService,
  functionalWorldObjects: FunctionalWorldObjectsPresenter,
): DesktopReviewRecoveryActions {
  const syncPresentation = (): void => functionalWorldObjects.syncNow();
  return {
    representationSnapshot: () => review.snapshot(),
    previewRemediation: (remediationId) => {
      const state = review.preview(remediationId);
      syncPresentation();
      return state;
    },
    commitRemediation: (remediationId) => {
      const state = review.commit(remediationId);
      syncPresentation();
      return state;
    },
    rejectPreview: () => {
      const state = review.rejectPreview();
      syncPresentation();
      return state;
    },
    revertLastRepresentationChange: () => {
      const state = review.revertLastChange();
      syncPresentation();
      return state;
    },
    archives: () => world.uiManager.vaultPanel.archives,
    freezeCurrent: async () => {
      const before = world.uiManager.vaultPanel.archives.length;
      const freeze = world.uiManager.vaultPanel.onFreeze;
      if (!freeze) throw new Error('Evidence Vault freeze action is unavailable.');
      freeze();
      await waitForProductState(
        () => world.uiManager.vaultPanel.archives.length > before,
        'Evidence Vault did not publish the frozen investigation.',
      );
      syncPresentation();
    },
    restoreLatest: async () => {
      const latest = world.uiManager.vaultPanel.archives.at(-1) ?? null;
      if (!latest) throw new Error('No frozen investigation is available to restore.');
      const restore = world.uiManager.vaultPanel.onRestore;
      if (!restore) throw new Error('Evidence Vault restore action is unavailable.');
      restore(latest.archiveId);
      await waitForProductState(
        () =>
          world.atlas.datasetFingerprint === latest.datasetFingerprint &&
          world.atlas.ledger.length === latest.eventCount,
        'The latest frozen investigation did not restore to its recorded analytical state.',
        15_000,
      );
      syncPresentation();
    },
    subscribeContext: (handler) => {
      const refresh = () => queueMicrotask(handler);
      const unsubscribeDataset = world.eventBus.on(WorldTopics.DATASET_LOADED, refresh);
      const unsubscribeOperation = world.eventBus.on(WorldTopics.OPERATION_APPLIED, refresh);
      return () => {
        unsubscribeDataset();
        unsubscribeOperation();
      };
    },
  };
}

function devTraceBindings(world: World): DevTraceBindings {
  return {
    recorderOptions: {
      engine: world.engine,
      eventBus: world.eventBus,
      getUIState: () => ({
        wheel: world.uiManager?.handWheelMenu?.isVisible?.() ?? false,
        tour: world.guidedTour
          ? {
              active: world.guidedTour.isActive,
              step: world.guidedTour.stepIndex,
              total: world.guidedTour.stepCount,
            }
          : null,
        lens: world._statisticalLensEnabled,
        paused: world.inputCoordinator.inputPaused,
      }),
      extraGazeTargets: () =>
        world.guidedTour?.isActive && world.guidedTour.cardMesh ? [world.guidedTour.cardMesh] : [],
    },
    bind: (recorder) => {
      world.engine.input.onHandPinchEdge = (hand, phase, gating) =>
        recorder.recordPinch(hand, phase, gating);

      const previousDispatch = world.engine.input.dispatcher.onDispatch;
      world.engine.input.dispatcher.onDispatch = (info) => {
        previousDispatch?.(info);
        recorder.recordSelection(info);
      };

      world.engine.input.systemDetector.onTrace = (info) => recorder.recordSystemGesture(info);

      if (world.uiManager?.handWheelMenu) {
        world.uiManager.handWheelMenu.onVisibility = (visible, via) =>
          recorder.recordWheel(visible, via);
      }
    },
  };
}

function applyNormalAnalystShell(world: World): void {
  if (world.uiManager.panelRolesManager.uiMode === 'DEVELOPER') return;

  world.uiManager.panelManager.hidePanel(world.uiManager.telemetryPanel);
  world.uiManager.panelManager.hidePanel(world.uiManager.vrConsole);
  world.uiManager.dashboard.wallGroup.visible = false;
  world.uiManager.peerPresenceHUD.setEnabled(false);
  world.diagnostic?.hide();
}

function semanticEmbodimentState(world: World): {
  status: SemanticEmbodimentPresentationStatus;
  message: string | null;
} | null {
  const data = world.dracoNode?.group?.userData;
  const rawStatus = data?.semanticEmbodimentStatus;
  const rawMessage = data?.semanticEmbodimentStatusMessage;
  if (
    typeof rawStatus !== 'string' ||
    !SEMANTIC_STATUS_VALUES.has(rawStatus as SemanticEmbodimentPresentationStatus)
  ) {
    return null;
  }
  return {
    status: rawStatus as SemanticEmbodimentPresentationStatus,
    message: typeof rawMessage === 'string' ? rawMessage : null,
  };
}

export async function bootstrapApp(): Promise<AppInstance> {
  const world = new World();
  await world.start();

  const dispatchIntent = applicationIntentDispatcher(world);
  const dispatchCanonicalIntent: ApplicationIntentDispatcher = (intent) => dispatchIntent(intent);

  bindInputCallbacksToApplicationIntents(world.inputCoordinator.callbacks, dispatchCanonicalIntent, {
    onUnsupportedOperation: (operation) =>
      console.warn(`[ApplicationIntent] unsupported input operation: ${operation}`),
    onDispatchError: (error) =>
      console.error('[ApplicationIntent] input dispatch failed:', error),
  });
  world.dispatchIntent = dispatchCanonicalIntent;

  const semanticDetailTransition = new SemanticDetailTransition(
    world.representationSurface,
    world.atlas,
  );
  const semanticDetailReturnControl = mountSemanticDetailReturnControl(semanticDetailTransition);
  const semanticDatumInspector = mountSemanticDatumInspector(semanticDetailTransition);
  world.registerExtensionDisposer(() => semanticDatumInspector.dispose());
  world.registerExtensionDisposer(() => semanticDetailReturnControl.dispose());
  world.registerExtensionDisposer(() => semanticDetailTransition.dispose());

  applyNormalAnalystShell(world);

  const functionalWorldObjects = new FunctionalWorldObjectsPresenter({
    engine: world.engine,
    atlas: world.atlas,
    core: world.core,
    iceVault: world.iceVault,
    portalA: world.portalA,
    portalB: world.portalB,
    landmarkController: world.landmarkController,
    panelManager: world.uiManager.panelManager,
    recommendationPanel: world.uiManager.recommendationPanel,
    vaultPanel: world.uiManager.vaultPanel,
    tooltipManager: world.tooltipManager,
    getOutcome: () => world._activeOutcome,
    getPreviewDecision: () => world._previewedDecision,
  });
  world.registerExtensionDisposer(() => functionalWorldObjects.dispose());

  const discoveryReasoning = new DiscoveryReasoningService(world.atlas);
  const representationReview = new RepresentationReviewService({
    atlas: world.atlas,
    getOutcome: () => world._activeOutcome,
    getFencedPreviewDecision: () => world._getCurrentPreviewDecision(),
    previewRemediation: (action) => world._previewRemediation(action),
    commitRemediation: (action) => world._commitRemediation(action),
    cancelRemediationPreview: () => world._cancelRemediationPreview(),
    applyRemediation: (action) => world._applyRemediation(action),
  });

  // P1-UV C2 projects existing authority into the existing persistent Status
  // Strip. WorldUIManager owns its governed torso-locked reference frame and
  // PANEL_LAYOUT slot; the composition root only wires authoritative state.
  const investigationState = new InvestigationStatePresenter({
    engine: world.engine,
    eventBus: world.eventBus,
    statusStrip: world.uiManager.statusStrip,
    isAnalyticalReady: () => world.atlas.isReady(),
    getSemanticEmbodimentState: () => semanticEmbodimentState(world),
    getDecisionState: () =>
      world._activeOutcome?.state ??
      world.atlas.activeRepresentationDecision?.decisionStatus ??
      null,
    getFencedPreviewDecision: () => world._getCurrentPreviewDecision(),
    getFocusState: () => world.focusContext.exportState(),
    getHistoryState: () => ({
      canUndo: world.atlas.analysisHistory.canUndo,
      canRedo: world.atlas.analysisHistory.canRedo,
    }),
    getArchiveCount: () => world.uiManager.vaultPanel.archives.length,
    getGraphSnapshot: () => ({
      activeNodeId: world.atlas.aggregate.graph.activeNodeId,
      currentDatasetFingerprint: world.atlas.datasetFingerprint,
      nodes: world.atlas.aggregate.graph.nodes,
      edges: world.atlas.aggregate.graph.edges,
      observationCount: world.atlas.observations.length,
      findingCount: world.atlas.findings.length,
    }),
  });
  world.registerExtensionDisposer(() => investigationState.dispose());

  if (import.meta.env.DEV) {
    const { installDevEvidence } = await import('./devEvidence.ts');
    const devEvidence = installDevEvidence({
      engine: world.engine,
      eventBus: world.eventBus,
      telemetryCollector: world.telemetryCollector,
      uiManager: world.uiManager,
      loadDataset: (entry) => world.loadDataset(entry),
      getActiveSpecInfo: () => {
        const spec = world.dracoNode?.solverResult?.spec;
        if (!spec) return null;
        const renderedNodeCount = world.dracoNode?.artifact?.nodeMeshes?.reduce((total, mesh) => {
          const candidate = mesh as { isInstancedMesh?: boolean; count?: number };
          return total + (candidate.isInstancedMesh ? (candidate.count ?? 0) : 1);
        }, 0);
        return {
          geometry: String(spec.geometry),
          layout: String(spec.layout),
          renderedNodeCount,
        };
      },
      getWasmMemoryBytes: () => {
        try {
          return world.analyticalRuntime.runtime?.memory?.().buffer.byteLength ?? null;
        } catch {
          return null;
        }
      },
    });
    world.registerExtensionDisposer(() => devEvidence.dispose());
  }

  // UX-trace recorder is constructed in all builds. Recording itself is
  // gated: always on in dev, otherwise only when the investigator opts in
  // via the `prodTraceEnabled` setting (default off). With no dev-server
  // endpoint (production), records accumulate in the bounded in-memory
  // buffer for user-initiated EXPORT TRACE download; nothing transmits.
  {
    const traceRecorder = setupDevTraceRecorder(devTraceBindings(world));
    world.prodTraceRecorder = traceRecorder;
    let prodTraceOn = false;
    try {
      prodTraceOn = world.uiManager.settingsPanel.getSetting('prodTraceEnabled') === true;
    } catch {
      prodTraceOn = false;
    }
    traceRecorder.setEnabled(import.meta.env.DEV || prodTraceOn);
    if (traceRecorder.enabled) traceRecorder.recordSessionManifest(world._prodTraceManifest());
    const unsubscribeDatasetTrace = world.eventBus.on(WorldTopics.DATASET_LOADED, () => {
      if (traceRecorder.enabled) traceRecorder.recordSessionManifest(world._prodTraceManifest());
    });
    world.registerExtensionDisposer(() => {
      try {
        unsubscribeDatasetTrace();
      } catch {
        // Ignore unsubscribe failures during teardown.
      }
      traceRecorder.dispose();
    });
  }

  if (import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS === '1') {
    const { installRuntimeDiagnosticHook } = await import('./diagnostics.ts');
    installRuntimeDiagnosticHook(world);
  }

  if (import.meta.env.VITE_NEMOSYNE_Q3B_RESOURCE_PROBE === '1') {
    const { installResourceEnvelopeDiagnosticHook } = await import(
      './resourceEnvelopeDiagnostics.ts'
    );
    installResourceEnvelopeDiagnosticHook(world);
  }

  if (import.meta.env.VITE_NEMOSYNE_A5_PRODUCT_EVIDENCE === '1') {
    const { installA5ProductEvidenceHook } = await import('./a5ProductEvidenceDiagnostics.ts');
    const disposeA5Evidence = installA5ProductEvidenceHook(world);
    world.registerExtensionDisposer(disposeA5Evidence);
  }

  if (import.meta.env.VITE_NEMOSYNE_GRAPH_B4_EVIDENCE === '1') {
    const { installGraphEvidenceDiagnosticHook } = await import('./graphEvidenceDiagnosticWrapper.ts');
    const disposeGraphEvidence = installGraphEvidenceDiagnosticHook(world);
    world.registerExtensionDisposer(disposeGraphEvidence);
  }

  if (import.meta.env.VITE_NEMOSYNE_C1_PRODUCT_EVIDENCE === '1') {
    const { installC1ProductEvidenceHook } = await import('./c1ProductEvidenceDiagnostics.ts');
    const disposeC1Evidence = installC1ProductEvidenceHook(world, functionalWorldObjects);
    world.registerExtensionDisposer(disposeC1Evidence);
  }

  if (import.meta.env.VITE_NEMOSYNE_C2_PRODUCT_EVIDENCE === '1') {
    const { installC2ProductEvidenceHook } = await import('./c2ProductEvidenceDiagnostics.ts');
    const disposeC2Evidence = installC2ProductEvidenceHook(world, investigationState);
    world.registerExtensionDisposer(disposeC2Evidence);
  }

  if (import.meta.env.VITE_NEMOSYNE_Q3D_BROWSER_PROBE === '1') {
    const { installBrowserEnvelopeDiagnosticHook } = await import('./browserEnvelopeDiagnostics.ts');
    installBrowserEnvelopeDiagnosticHook(world);
  }

  const telemetry = document.getElementById('telemetry');
  if (telemetry) {
    // World owns the healthy per-frame telemetry text. Bootstrap only overrides
    // that surface for a terminal kernel-unavailable state; a second healthy
    // writer can strand the throttled World cache on a stale boot message.
    if (world.bootState === 'KERNEL_UNAVAILABLE') {
      telemetry.textContent = 'analytical kernel unavailable — run npm run wasm:dev';
    }
    telemetry.hidden = import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS !== '1';
  }

  const bootOverlay = document.getElementById('overlay');
  if (bootOverlay) bootOverlay.hidden = true;

  world.loader.hide();

  if (import.meta.env.VITE_NEMOSYNE_UV0_EVIDENCE === '1') {
    const uv0 = new URL(window.location.href).searchParams.get('nemosyne-uv0');
    if (uv0 === '1') {
      const { installUv0TestHandle, UV0_TEST_HANDLE_KEY } = await import('./uv0TestHandle.ts');
      window[UV0_TEST_HANDLE_KEY] = installUv0TestHandle(world);
    }
  }

  const shell = mountInvestigationShell(
    investigationActions(world, dispatchIntent, functionalWorldObjects),
  );
  const desktopSelectionTaskRail = mountDesktopSelectionTaskRail(
    desktopSelectionTaskActions(world),
  );
  const desktopReasoningRail = mountDesktopReasoningRail(
    desktopReasoningRailActions(world, discoveryReasoning, functionalWorldObjects),
  );
  const desktopReviewRecoveryRail = mountDesktopReviewRecoveryRail(
    desktopReviewRecoveryActions(world, representationReview, functionalWorldObjects),
  );
  const investigationShell: InvestigationShellHandle = {
    refreshContext: () => {
      shell.refreshContext();
      desktopSelectionTaskRail.refresh();
      desktopReasoningRail.refresh();
      desktopReviewRecoveryRail.refresh();
    },
    dispose: () => {
      desktopReviewRecoveryRail.dispose();
      desktopReasoningRail.dispose();
      desktopSelectionTaskRail.dispose();
      shell.dispose();
    },
  };

  return {
    world,
    dispatchIntent,
    investigationShell,
  };
}
