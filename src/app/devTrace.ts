/**
 * Dev-Only Instrumentation & UX Trace Recorder.
 *
 * Hooks into the input coordinator and gaze tracker to stream UX trace data in development.
 */

import type { World } from '../vr/World.ts';
import { UXTraceRecorder } from '../vr/trace/UXTraceRecorder.ts';

export function setupDevTraceRecorder(world: World): UXTraceRecorder {
  const recorder = new UXTraceRecorder({
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
  });

  world.engine.input.onHandPinchEdge = (hand, phase, gating) =>
    recorder.recordPinch(hand, phase, gating);

  const previousDispatch = world.engine.input.dispatcher.onDispatch;
  world.engine.input.dispatcher.onDispatch = (info) => {
    previousDispatch?.(info);
    recorder.recordSelection(info);
  };

  world.engine.input.systemDetector.onTrace = (info) => recorder.recordSystemGesture(info);

  if (world.uiManager?.handWheelMenu) {
    world.uiManager.handWheelMenu.onVisibility = (visible: boolean, via: 'toggle' | 'show' | 'hide') =>
      recorder.recordWheel(visible, via);
  }

  return recorder;
}
