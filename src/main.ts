import { remoteDebugStreamer } from './utils/RemoteDebugStreamer.ts';
// The remote-debug console streamer patches console.* and ships logs to the
// Vite dev-only `/__remote-logs` endpoint. It must never run in a production
// build: the endpoint doesn't exist there, so every flush would 404-retry and
// the patched console would route user output into a dead queue.
if (import.meta.env.DEV) {
  remoteDebugStreamer.init();
}

import { World } from './vr/World.ts';
import { UXTraceRecorder } from './vr/trace/UXTraceRecorder.ts';

const telemetry = document.getElementById('telemetry');

function logStartupError(err: unknown): void {
  console.error('[Nemosyne] startup error:', err);
  if (telemetry) {
    const message = err instanceof Error ? err.message : String(err);
    telemetry.textContent = `ERROR: ${message}`;
    telemetry.style.color = '#ff0055';
  }
}

window.addEventListener('error', (e: ErrorEvent) => {
  logStartupError(e.error ?? e.message);
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  logStartupError(e.reason);
});

(async () => {
  try {
    const world = new World();
    await world.start();

    // Dev-only UX trace recorder: correlates hand input with head-gaze
    // context and streams it to the dev server (`logs/ux-trace.jsonl`).
    if (import.meta.env.DEV) {
      const recorder = new UXTraceRecorder({
        engine: world.engine,
        eventBus: world.eventBus,
        getUIState: () => ({
          wheel: world.handWheelMenu?.isVisible?.() ?? false,
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
          world.guidedTour?.isActive ? [world.guidedTour.cardMesh] : [],
      });
      world.engine.input.onHandPinchEdge = (hand, phase, gating) =>
        recorder.recordPinch(hand, phase, gating);
      const previousDispatch = world.engine.input.dispatcher.onDispatch;
      world.engine.input.dispatcher.onDispatch = (info) => {
        previousDispatch?.(info);
        recorder.recordSelection(info);
      };
      world.engine.input.systemDetector.onTrace = (info) => recorder.recordSystemGesture(info);
      world.handWheelMenu.onVisibility = (visible, via) => recorder.recordWheel(visible, via);
    }

    if (telemetry) {
      telemetry.textContent = 'ready — point and select to inspect';
    }
  } catch (err) {
    logStartupError(err);
  }
})();
