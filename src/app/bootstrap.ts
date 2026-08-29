/**
 * Application Bootstrap & Composition Root.
 *
 * Coordinates initialization of the presentation layer, input subsystem, and dev tools.
 */

import { World } from '../vr/World.ts';
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

function applicationIntentDispatcher(world: World): ApplicationIntentDispatcher {
  return createApplicationIntentDispatcher({
    cycleDataset: (step) => world._cycleDataset(step),
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
    currentDatasetName: () => world.currentEntry?.name ?? null,
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

  if (import.meta.env.DEV) {
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
  }

  return {
    world,
    dispatchIntent,
    analystJourneyControls: mountAnalystJourneyControls(
      analystJourneyActions(world, dispatchIntent),
    ),
  };
}
