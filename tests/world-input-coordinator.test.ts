// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { WorldInputCoordinator } from '../src/vr/coordinators/WorldInputCoordinator.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';
import { Engine } from '../src/vr/Engine.ts';
import { ControllerGestureMapper } from '../src/vr/interactions/ControllerGestureMapper.ts';

class YPathControllerPointer {
  constructor(handedness) {
    this.handedness = handedness;
    this.position = new THREE.Vector3();
    this.gamepad = null;
  }

  getRay(targetRay) {
    targetRay.origin.copy(this.position);
    targetRay.direction.set(0, 0, -1);
    return targetRay;
  }
}

function pressYThroughMapper(
  coordinator,
  { pressed = [false, false, false, false, false, true] } = {}
) {
  const right = new YPathControllerPointer('right');
  right.gamepad = { buttons: pressed.map(() => ({ pressed: false })), axes: [0, 0, 0, 0] };
  const left = new YPathControllerPointer('left');
  left.gamepad = { buttons: pressed.map((p) => ({ pressed: p })), axes: [0, 0, 0, 0] };
  const session = {
    inputSources: [
      { handedness: 'right', gamepad: right.gamepad },
      { handedness: 'left', gamepad: left.gamepad },
    ],
  };
  const mapper = new ControllerGestureMapper({
    onGesture: (name, ctx) => coordinator.onGesture(name, ctx),
    cooldown: 0,
  });
  mapper.update([right, left], session, 1);
}

describe('WorldInputCoordinator', () => {
  let engine;
  let bus;
  let callbacks;
  let coordinator;

  beforeEach(() => {
    globalThis.navigator.xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };

    engine = new Engine();
    bus = new WorldEventBus();
    callbacks = {
      onApplyOperation: vi.fn(),
      onCycleDataset: vi.fn(),
      onResetData: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onToggleStatisticalLens: vi.fn(),
      onToggleSettingsPanel: vi.fn(),
      onCaptureSession: vi.fn(),
      onLog: vi.fn(),
    };

    coordinator = new WorldInputCoordinator(engine, bus, {
      getSetting: () => undefined,
      getDracoGroup: () => null,
      getArtifact: () => null,
      getHandWheelMenu: () => null,
      callbacks,
    });
  });

  afterEach(() => {
    engine.dispose();
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  });

  it('creates a gesture recognizer', () => {
    expect(coordinator.gestureRecognizer).toBeTruthy();
  });

  it('routes pinchTogether to filter operation', () => {
    coordinator.onGesture('pinchTogether');
    expect(callbacks.onApplyOperation).toHaveBeenCalledWith('filter');
  });

  it('routes pinchApart to aggregate operation', () => {
    coordinator.onGesture('pinchApart');
    expect(callbacks.onApplyOperation).toHaveBeenCalledWith('aggregate');
  });

  it('routes swipeRight and swipeLeft to cycle dataset', () => {
    coordinator.onGesture('swipeRight');
    expect(callbacks.onCycleDataset).toHaveBeenCalledWith(1);
    coordinator.onGesture('swipeLeft');
    expect(callbacks.onCycleDataset).toHaveBeenCalledWith(-1);
  });

  it('routes sliceUp to sort and sliceDown to timeSlice', () => {
    coordinator.onGesture('sliceUp');
    expect(callbacks.onApplyOperation).toHaveBeenCalledWith('sort');
    coordinator.onGesture('sliceDown');
    expect(callbacks.onApplyOperation).toHaveBeenCalledWith('timeSlice');
  });

  it('routes rotateCW to redo and rotateCCW to undo', () => {
    coordinator.onGesture('rotateCW');
    expect(callbacks.onRedo).toHaveBeenCalled();
    coordinator.onGesture('rotateCCW');
    expect(callbacks.onUndo).toHaveBeenCalled();
  });

  it('routes okSign to settings panel toggle', () => {
    coordinator.onGesture('okSign');
    expect(callbacks.onToggleSettingsPanel).toHaveBeenCalled();
  });

  it('toggles pause input and ignores gestures while paused', () => {
    coordinator.onGesture('pauseResume');
    expect(coordinator.inputPaused).toBe(true);

    coordinator.onGesture('pinchTogether');
    expect(callbacks.onApplyOperation).not.toHaveBeenCalled();

    coordinator.onGesture('pauseResume');
    expect(coordinator.inputPaused).toBe(false);
  });

  it('resets view on pushForward with open hands', () => {
    engine.locomotion.teleportToAnchor = vi.fn();
    coordinator.onGesture('pushForward', { openHands: true });
    expect(engine.locomotion.teleportToAnchor).toHaveBeenCalledWith('overview');
    expect(callbacks.onCaptureSession).toHaveBeenCalled();
  });

  it('resets data on pushForward with closed hands', () => {
    coordinator.onGesture('pushForward', { openHands: false });
    expect(callbacks.onResetData).toHaveBeenCalled();
  });

  it('emits gesture:recognized and interaction events', () => {
    const gestureSpy = vi.fn();
    const interactionSpy = vi.fn();
    bus.on(WorldTopics.GESTURE_RECOGNIZED, gestureSpy);
    bus.on(WorldTopics.INTERACTION, interactionSpy);

    coordinator.onGesture('pinchTogether', { source: 'hand' });

    expect(gestureSpy).toHaveBeenCalledWith({ name: 'pinchTogether', ctx: { source: 'hand' } });
    expect(interactionSpy).toHaveBeenCalled();
  });

  it('plays gesture feedback tones', () => {
    const toneSpy = vi.spyOn(engine.input.feedback, 'playGestureTone').mockImplementation(() => {});
    const hapticSpy = vi.spyOn(engine.input.feedback, 'playHaptic').mockImplementation(() => {});

    coordinator.onGesture('pinchTogether');

    expect(toneSpy).toHaveBeenCalledWith('pinchTogether');
    expect(hapticSpy).toHaveBeenCalledWith(0.6, 50);
  });

  it('does not run gesture update when gestures are disabled', () => {
    const localCoordinator = new WorldInputCoordinator(engine, bus, {
      getSetting: (key) => (key === 'gesturesEnabled' ? false : undefined),
      getDracoGroup: () => null,
      getArtifact: () => null,
      getHandWheelMenu: () => null,
      callbacks,
    });
    const updateSpy = vi.spyOn(localCoordinator.gestureRecognizer, 'update');

    localCoordinator.update(0.016, 0);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('skips gesture update when a hand is near an artefact', () => {
    coordinator._handNearArtefact = true;
    const updateSpy = vi.spyOn(coordinator.gestureRecognizer, 'update');
    vi.spyOn(coordinator, '_updateInputContext').mockImplementation(() => {});

    coordinator.update(0.016, 0);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('computes input context with no hands tracked', () => {
    engine.input.hands = [];
    coordinator._updateInputContext();

    expect(coordinator.handNearArtefact).toBe(false);
    expect(coordinator.handNearWheelMenu).toBe(false);
  });

  it('detects hand near artefact when inside bounding sphere', () => {
    const group = new THREE.Group();
    group.position.set(0, 1.4, -3.5);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    group.add(mesh);
    engine.scene.add(group);

    const localCoordinator = new WorldInputCoordinator(engine, bus, {
      getSetting: () => undefined,
      getDracoGroup: () => group,
      getArtifact: () => ({ nodeMeshes: [mesh] }),
      getHandWheelMenu: () => null,
      callbacks,
    });

    engine.input.hands = [
      {
        getHandTransform: (pos) => pos.set(0, 1.4, -3.5),
      },
    ];

    localCoordinator._updateInputContext();

    expect(localCoordinator.handNearArtefact).toBe(true);
  });

  it('detects hand near visible wheel menu', () => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 1.4, -1);
    const wheelMenu = { group: wheelGroup, isVisible: () => true };
    engine.scene.add(wheelGroup);

    const localCoordinator = new WorldInputCoordinator(engine, bus, {
      getSetting: () => undefined,
      getDracoGroup: () => null,
      getArtifact: () => null,
      getHandWheelMenu: () => wheelMenu,
      callbacks,
    });

    engine.input.hands = [
      {
        getHandTransform: (pos) => pos.set(0, 1.4, -1),
      },
    ];

    localCoordinator._updateInputContext();

    expect(localCoordinator.handNearWheelMenu).toBe(true);
  });

  function yPathCoordinator({ wheelOpen = false, pointers = [], capturedPanel = null } = {}) {
    // Structural engine: the coordinator reads input.pointers as an array
    // of {isNear} plus machine.capturedPanel; the real mapper and the real
    // coordinator stay in the path.
    const stubEngine = {
      addUpdatable: () => {},
      input: {
        pointers,
        machine: { capturedPanel },
        feedback: { playGestureTone: () => {}, playHaptic: () => {} },
      },
      telemetry: { recordGestureConfidence: () => {} },
    };
    const localCallbacks = { ...callbacks, onToggleSettingsPanel: vi.fn() };
    const localCoordinator = new WorldInputCoordinator(stubEngine, bus, {
      getSetting: () => undefined,
      getDracoGroup: () => null,
      getArtifact: () => null,
      getHandWheelMenu: wheelOpen ? () => ({ isVisible: () => true }) : () => null,
      callbacks: localCallbacks,
    });
    return { localCoordinator, localCallbacks };
  }

  it('routes explicit controller Y with wheel open and near pointer', () => {
    // Live defect: direct-interaction suppression treated the explicit Y
    // button as an inferred hand gesture. The button press must reach the
    // settings toggle even with the wheel open and a near pointer.
    const { localCoordinator, localCallbacks } = yPathCoordinator({
      wheelOpen: true,
      pointers: [{ isNear: true }],
    });
    pressYThroughMapper(localCoordinator);
    expect(localCallbacks.onToggleSettingsPanel).toHaveBeenCalledTimes(1);
  });

  it('still suppresses hand okSign with wheel open', () => {
    const { localCoordinator, localCallbacks } = yPathCoordinator({ wheelOpen: true });
    localCoordinator.onGesture('okSign', {});
    expect(localCallbacks.onToggleSettingsPanel).not.toHaveBeenCalled();
  });

  it('still suppresses hand okSign with near pointer', () => {
    const { localCoordinator, localCallbacks } = yPathCoordinator({
      pointers: [{ isNear: true }],
    });
    localCoordinator.onGesture('okSign', {});
    expect(localCallbacks.onToggleSettingsPanel).not.toHaveBeenCalled();
  });

  it('still suppresses controller Y while a panel capture is active', () => {
    // Toggling must not orphan a captured control's pressed state.
    const { localCoordinator, localCallbacks } = yPathCoordinator({
      wheelOpen: true,
      pointers: [{ isNear: true }],
      capturedPanel: {},
    });
    pressYThroughMapper(localCoordinator);
    expect(localCallbacks.onToggleSettingsPanel).not.toHaveBeenCalled();
  });

  it('still suppresses controller Y while input is paused', () => {
    const { localCoordinator, localCallbacks } = yPathCoordinator({ wheelOpen: true });
    localCoordinator.onGesture('pauseResume');
    expect(localCoordinator.inputPaused).toBe(true);
    pressYThroughMapper(localCoordinator);
    expect(localCallbacks.onToggleSettingsPanel).not.toHaveBeenCalled();
  });

  it('suppresses scene selection when hand is near wheel menu', () => {
    const setSuppressSpy = vi
      .spyOn(engine.input, 'setSuppressSceneSelection')
      .mockImplementation(() => {});
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 1.4, -1);
    const wheelMenu = { group: wheelGroup, isVisible: () => true };
    engine.scene.add(wheelGroup);

    const localCoordinator = new WorldInputCoordinator(engine, bus, {
      getSetting: () => undefined,
      getDracoGroup: () => null,
      getArtifact: () => null,
      getHandWheelMenu: () => wheelMenu,
      callbacks,
    });

    engine.input.hands = [
      {
        getHandTransform: (pos) => pos.set(0, 1.4, -1),
      },
    ];

    localCoordinator._updateInputContext();

    expect(setSuppressSpy).toHaveBeenCalledWith(true);
  });
});
