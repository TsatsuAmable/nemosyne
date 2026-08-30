/**
 * Application Bootstrap & Composition Root.
 *
 * Coordinates initialization of the presentation layer, input subsystem, and dev tools.
 */

import { World } from '../vr/World.ts';
import { allSampleDatasets } from '../data/SampleDatasets.ts';
import { WorldTopics } from '../utils/EventBus.ts';
import { resolveDatasetCycleCursor } from './dataset/DatasetCycleCursor.ts';
import {
  setupDevTraceRecorder,
  type DevTraceBindings,
} from './devTrace.ts';
import { assessAnalystRepresentation } from './AnalystRepresentationAssessment.ts';
import {
  mountAnalystJourneyControls,
  type AnalystJourneyActions,
  type AnalystJourneyControlsHandle,
} from './AnalystJourneyControls.ts';
import {
  createApplicationIntentDispatcher,
  type ApplicationIntentDispatcher,
} from './intents/ApplicationIntent.ts';
import { bindInputCallbacksToApplicationIntents } from './intents/InputIntentBindings.ts';

export interface AppInstance {
  world: World;
  dispatchIntent: ApplicationIntentDispatcher;
  analystJourneyControls: AnalystJourneyControlsHandle;
}

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

function applicationIntentDispatcher(world: World): ApplicationIntentDispatcher {
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
  });
}

function analystJourneyActions(
  world: World,
  dispatchIntent: ApplicationIntentDispatcher,
): AnalystJourneyActions {
  return {
    dispatchIntent,
    currentDatasetName: () =>
      world.currentEntry?.name ?? world.currentEntry?.label ?? world.currentEntry?.key ?? null,
    subscribeDatasetContext: (handler) =>
      world.eventBus.on(WorldTopics.DATASET_LOADED, () => {
        // LoadDatasetUseCase publishes the logical transition synchronously;
        // World assigns currentEntry immediately after it returns. Refresh on
        // the next microtask so the shell reads the completed facade state.
        queueMicrotask(handler);
      }),
    assessRepresentation: (maxRenderedElements) =>
      assessAnalystRepresentation(world.atlas, world.session, maxRenderedElements),
    analysisResultCount: () => world.atlas.results.length,
    markMoment: (note) => world.markMoment(note).id,
    replayPortableInvestigation: (bytes) => world.replayPortableInvestigation(bytes),
    exportPortableInvestigation: () =>
      world.session.exportPortablePackage({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        webxrSupported: 'xr' in navigator,
      }),
    setDatasetPickerVisible: (visible) => {
      if (visible) world.loader.show();
      else world.loader.hide();
    },
    isDatasetPickerVisible: () => world.loader.container.style.display !== 'none',
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

/**
 * P1-UV1 composition policy for the normal analyst path.
 *
 * Existing diagnostic surfaces stay constructed/registered so the explicit
 * developer route and evidence harnesses retain them, but they no longer
 * dominate first use. This is deliberately a composition-root policy rather
 * than another UI coordinator or a change to analytical owners.
 */
function applyNormalAnalystShell(world: World): void {
  if (world.uiManager.panelRolesManager.uiMode === 'DEVELOPER') return;

  world.uiManager.panelManager.hidePanel(world.uiManager.telemetryPanel);
  world.uiManager.panelManager.hidePanel(world.uiManager.vrConsole);
  world.uiManager.dashboard.wallGroup.visible = false;
  world.uiManager.peerPresenceHUD.setEnabled(false);
  world.diagnostic?.hide();
}

export async function bootstrapApp(): Promise<AppInstance> {
  const world = new World();
  await world.start();

  const dispatchIntent = applicationIntentDispatcher(world);
  bindInputCallbacksToApplicationIntents(world.inputCoordinator.callbacks, dispatchIntent, {
    onUnsupportedOperation: (operation) =>
      console.warn(`[ApplicationIntent] unsupported input operation: ${operation}`),
    onDispatchError: (error) =>
      console.error('[ApplicationIntent] input dispatch failed:', error),
  });
  // Expose the canonical dispatcher to the XR wheel and World-side operation
  // funnels (CTS/VRMenu callbacks) so every mutating command shares one
  // command authority instead of a shadow analysis path.
  world.dispatchIntent = dispatchIntent;

  applyNormalAnalystShell(world);

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
    setupDevTraceRecorder(devTraceBindings(world));
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

  if (import.meta.env.VITE_NEMOSYNE_Q3D_BROWSER_PROBE === '1') {
    const { installBrowserEnvelopeDiagnosticHook } = await import('./browserEnvelopeDiagnostics.ts');
    installBrowserEnvelopeDiagnosticHook(world);
  }

  const telemetry = document.getElementById('telemetry');
  if (telemetry) {
    if (world.bootState === 'KERNEL_UNAVAILABLE') {
      telemetry.textContent = 'analytical kernel unavailable — run npm run wasm:dev';
    } else {
      telemetry.textContent = 'ready — point and select to inspect';
    }
    // P1-UV1: runtime telemetry remains alive for diagnostics/tests, but it is
    // not part of the normal analyst information hierarchy.
    telemetry.hidden = import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS !== '1';
  }

  // The static title is a boot affordance, not permanent chrome over the data.
  const bootOverlay = document.getElementById('overlay');
  if (bootOverlay) bootOverlay.hidden = true;

  // Dataset import is a first-class task summoned from the investigation shell,
  // not an always-open engineering panel competing with the scene.
  world.loader.hide();

  // P1-UV0 instrumentation is a compile-time opt-in. Ordinary production
  // bundles are built without VITE_NEMOSYNE_UV0_EVIDENCE, so Rollup can remove
  // both this branch and the dynamic helper chunk. The dedicated UV0 evidence
  // job enables the flag and still requires the exact query parameter before
  // installing the runtime handle.
  if (import.meta.env.VITE_NEMOSYNE_UV0_EVIDENCE === '1') {
    const uv0 = new URL(window.location.href).searchParams.get('nemosyne-uv0');
    if (uv0 === '1') {
      const { installUv0TestHandle, UV0_TEST_HANDLE_KEY } = await import('./uv0TestHandle.ts');
      window[UV0_TEST_HANDLE_KEY] = installUv0TestHandle(world);
    }
  }

  return {
    world,
    dispatchIntent,
    analystJourneyControls: mountAnalystJourneyControls(
      analystJourneyActions(world, dispatchIntent),
    ),
  };
}
