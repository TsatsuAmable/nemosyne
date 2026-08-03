/**
 * Routes gesture and controller input to the right world action while
 * inferring intent from the current scene context. Owns pause/resume state,
 * hand proximity checks, and the mapping from gesture names to high-level
 * commands.
 */

import * as THREE from 'three';
import { HandGestureRecognizer } from '../interactions/HandGestureRecognizer.js';
import { getGestureMeta } from '../../utils/GestureMapping.js';
import { WorldEventBus, WorldTopics } from '../../utils/EventBus.js';

export class WorldInputCoordinator {
  /**
   * @param {import('../Engine.js').Engine} engine
   * @param {import('../../utils/EventBus.js').WorldEventBus} eventBus
   * @param {object} options
   * @param {(key: string) => any} options.getSetting
   * @param {() => import('three').Object3D | null} options.getDracoGroup
   * @param {() => { nodeMeshes: THREE.Mesh[] } | null} options.getArtifact
   * @param {() => import('../ui/HandWheelMenu.js').HandWheelMenu | null} options.getHandWheelMenu
   * @param {object} options.callbacks
   */
  constructor(engine, eventBus, options) {
    this.engine = engine;
    this.eventBus = eventBus ?? new WorldEventBus();
    this.getSetting = options.getSetting ?? (() => undefined);
    this.getDracoGroup = options.getDracoGroup ?? (() => null);
    this.getArtifact = options.getArtifact ?? (() => null);
    this.getHandWheelMenu = options.getHandWheelMenu ?? (() => null);
    this.callbacks = options.callbacks ?? {};

    this._inputPaused = false;
    this._handNearArtefact = false;
    this._handNearWheelMenu = false;

    this.gestureRecognizer = new HandGestureRecognizer({
      cooldown: 0.65,
      onGesture: (name, ctx) => this.onGesture(name, ctx),
    });

    this.engine.addUpdatable({
      update: (delta, time) => this.update(delta, time),
    });
  }

  /** @returns {boolean} */
  get inputPaused() {
    return this._inputPaused;
  }

  /** @returns {boolean} */
  get handNearArtefact() {
    return this._handNearArtefact;
  }

  /** @returns {boolean} */
  get handNearWheelMenu() {
    return this._handNearWheelMenu;
  }

  update(delta, time) {
    if (this.getSetting('gesturesEnabled') === false) return;
    this._updateInputContext();
    if (this._handNearArtefact) return;
    this.gestureRecognizer.setHands(this.engine.input.hands);
    this.gestureRecognizer.update(delta, time);
  }

  /**
   * Handle a recognized gesture or controller-mapped gesture. Emits a
   * `gesture:recognized` event and dispatches to the matching callback.
   * @param {string} name
   * @param {object} [ctx]
   */
  onGesture(name, ctx = {}) {
    if (this._inputPaused && name !== 'pauseResume') {
      this.callbacks.onLog?.('Input paused — gesture ignored');
      return;
    }

    this.eventBus.emit(WorldTopics.GESTURE_RECOGNIZED, { name, ctx });

    // Multi-modal feedback so gesture recognition is perceptible.
    this.engine.input.feedback?.playGestureTone?.(name);
    this.engine.input.feedback?.playHaptic?.(0.6, 50);

    const source = ctx.source === 'controller' ? 'controller' : 'hand';
    const meta = getGestureMeta(name);
    const input =
      source === 'controller'
        ? ctx.button
          ? `Controller ${ctx.button}`
          : ctx.input
            ? `Controller ${ctx.input}`
            : meta?.controller
        : meta?.hand;

    this.eventBus.emit(WorldTopics.INTERACTION, {
      action: meta?.action ?? name,
      gesture: name,
      controller: source === 'controller' ? input : null,
    });

    // Route the intent to the matching World action.
    switch (name) {
      case 'pinchTogether':
        this.callbacks.onApplyOperation?.('filter');
        break;
      case 'pinchApart':
        this.callbacks.onApplyOperation?.('aggregate');
        break;
      case 'swipeRight':
        this.callbacks.onCycleDataset?.(1);
        break;
      case 'swipeLeft':
        this.callbacks.onCycleDataset?.(-1);
        break;
      case 'sliceUp':
        this.callbacks.onApplyOperation?.('sort');
        break;
      case 'sliceDown':
        this.callbacks.onApplyOperation?.('timeSlice');
        break;
      case 'scoopUp':
        if (this.engine.locomotion.flightMode) {
          this.engine.locomotion.ascend();
          this.callbacks.onLog?.('Flight: ascend');
        } else {
          this.callbacks.onToggleStatisticalLens?.();
        }
        break;
      case 'scoopDown':
        if (this.engine.locomotion.flightMode) {
          this.engine.locomotion.descend();
          this.callbacks.onLog?.('Flight: descend');
        }
        break;
      case 'pushForward':
        // Infer intent from hand state: open hands reset the view, pinched hands
        // reset the data operations.
        if (ctx.openHands) {
          this.resetView();
        } else {
          this.callbacks.onResetData?.();
        }
        break;
      case 'rotateCW':
        this.callbacks.onRedo?.();
        break;
      case 'rotateCCW':
        this.callbacks.onUndo?.();
        break;
      case 'okSign':
        this.callbacks.onToggleSettingsPanel?.();
        break;
      case 'pauseResume':
        this.togglePauseInput();
        break;
      // 'bothPinched' is reserved for the system launcher toggle.
      default:
        break;
    }
  }

  /**
   * Infer input context from hand poses and scene widgets. Used to suppress
   * conflicting commands when the user is interacting with an artefact or the
   * wheel menu.
   */
  _updateInputContext() {
    const hands = this.engine.input.hands;
    if (!hands?.length) {
      this._handNearArtefact = false;
      this._handNearWheelMenu = false;
      this.engine.input.setSuppressSceneSelection?.(false);
      this.engine.locomotion?.setEnabled?.(true);
      return;
    }

    // Dominant hand position in world space.
    const handPos = new THREE.Vector3();
    const dominant = hands[this.gestureRecognizer?.dominantHandIndex ?? 0] ?? hands[0];
    if (dominant.getHandTransform) {
      const q = new THREE.Quaternion();
      dominant.getHandTransform(handPos, q);
    } else if (dominant.rayOrigin) {
      handPos.copy(dominant.rayOrigin);
    }

    // Check proximity to the palace centre / node bounding sphere.
    let artefactCenter = null;
    let artefactRadius = 0;
    const dracoGroup = this.getDracoGroup();
    const artifact = this.getArtifact();
    const nodeMeshes = artifact?.nodeMeshes ?? [];
    if (dracoGroup && nodeMeshes.length > 0) {
      const box = new THREE.Box3().setFromObject(dracoGroup);
      artefactCenter = new THREE.Vector3();
      box.getCenter(artefactCenter);
      artefactRadius = box.getBoundingSphere(new THREE.Sphere()).radius;
    }
    this._handNearArtefact =
      artefactCenter != null &&
      handPos.distanceToSquared(artefactCenter) < artefactRadius * artefactRadius;

    // Check proximity to the hand-attached wheel menu.
    const wheelWorldPos = new THREE.Vector3();
    const handWheelMenu = this.getHandWheelMenu();
    handWheelMenu?.group?.getWorldPosition(wheelWorldPos);
    const wheelVisible = handWheelMenu?.isVisible?.() ?? false;
    let nearWheel = false;
    if (wheelVisible) {
      for (const hand of hands) {
        const pos = new THREE.Vector3();
        if (hand.getHandTransform) {
          const q = new THREE.Quaternion();
          hand.getHandTransform(pos, q);
        } else if (hand.rayOrigin) {
          pos.copy(hand.rayOrigin);
        }
        if (pos.distanceToSquared(wheelWorldPos) < 0.25) {
          nearWheel = true;
          break;
        }
      }
    }
    this._handNearWheelMenu = nearWheel;

    const paused = !!this._inputPaused;
    this.engine.input.setSuppressSceneSelection?.(this._handNearWheelMenu || paused);
    this.engine.locomotion?.setEnabled?.(!this._handNearArtefact && !paused);
  }

  /** Toggle global input pause/resume. */
  togglePauseInput() {
    this._inputPaused = !this._inputPaused;
    this.callbacks.onLog?.(`Input ${this._inputPaused ? 'paused' : 'resumed'}`);
    this.eventBus.emit(WorldTopics.INTERACTION, {
      action: 'Pause input',
      result: this._inputPaused ? 'paused' : 'resumed',
    });
  }

  /**
   * Return the camera to a default overview anchor without undoing analysis
   * history. This is the spatial equivalent of a "reset view" command.
   */
  resetView() {
    this.engine.locomotion.teleportToAnchor('overview');
    this.callbacks.onLog?.('View reset to overview');
    this.eventBus.emit(WorldTopics.INTERACTION, {
      action: 'Reset view',
      result: 'overview',
    });
    this.eventBus.emit(WorldTopics.VIEW_RESET);
    this.callbacks.onCaptureSession?.();
  }
}
