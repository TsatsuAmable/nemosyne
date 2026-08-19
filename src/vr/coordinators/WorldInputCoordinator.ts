import * as THREE from 'three';
import { HandGestureRecognizer } from '../interactions/HandGestureRecognizer.ts';
import { GestureIntelligenceAdapter } from '../input/GestureIntelligenceAdapter.ts';
import {
  spawnPinchFilterHalo,
  spawnScoopLensHalo,
  spawnSliceWavePlane,
  spawnResetPulseSphere,
} from '../interactions/GestureParticleFeedback.ts';
import { getGestureMeta } from '../../utils/GestureMapping.ts';
import { WorldEventBus, WorldTopics } from '../../utils/EventBus.ts';
import {
  InteractionModeController,
  type InteractionMode,
  type FocusState,
} from '../input/InteractionModeController.ts';
import { GestureOwnershipManager } from '../input/GestureOwnershipManager.ts';
import type { Engine } from '../Engine.ts';
import type {
  ArtifactRef,
  EngineLike,
  GestureContext,
  HandLike,
  HandWheelMenuLike,
  InputCallbacks,
  LooseOptions,
  WorldEventBusLike,
  WorldInputOptions,
} from './types.ts';

export class WorldInputCoordinator {
  engine: Engine | EngineLike;
  eventBus: WorldEventBusLike;
  getSetting: (key: string) => unknown;
  getDracoGroup: () => THREE.Object3D | null;
  getArtifact: () => ArtifactRef | null;
  getHandWheelMenu: () => HandWheelMenuLike | null;
  callbacks: InputCallbacks;

  _inputPaused: boolean;
  private _handNearArtefact: boolean;
  private _handNearWheelMenu: boolean;

  gestureRecognizer: HandGestureRecognizer;
  gestureAdapter: GestureIntelligenceAdapter;
  interactionModeController: InteractionModeController;
  gestureOwnershipManager: GestureOwnershipManager;

  constructor(engine: Engine | EngineLike, eventBus: WorldEventBusLike, options: WorldInputOptions) {
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
      onGesture: (name: string, ctx: Record<string, unknown>) => this.onGesture(name, ctx),
    } as LooseOptions);

    this.gestureAdapter = new GestureIntelligenceAdapter({
      cooldown: 0.65,
      onGesture: (name: string, ctx: Record<string, unknown>) => this.onGesture(name, ctx),
    });

    this.interactionModeController = new InteractionModeController({
      initialMode: 'INTERACT',
      onModeChange: (event) => {
        this.eventBus.emit(WorldTopics.INTERACTION, {
          action: `mode_transition_${event.to.toLowerCase()}`,
          from: event.from,
          to: event.to,
          reason: event.reason,
        });
        this.callbacks.onModeChanged?.(event.to);
        this.callbacks.onRecordAction?.(`MODE: ${event.to}`, `Switched to ${event.to} mode`);
        this.callbacks.onLog?.(`Interaction Mode: ${event.to} (${event.reason})`);
      },
    });

    this.gestureOwnershipManager = new GestureOwnershipManager();

    this.engine.addUpdatable({
      update: (delta: number, time: number) => this.update(delta, time),
    });
  }

  get inputPaused(): boolean {
    return this._inputPaused;
  }

  get handNearArtefact(): boolean {
    return this._handNearArtefact;
  }

  get handNearWheelMenu(): boolean {
    return this._handNearWheelMenu;
  }

  update(delta: number, time: number): void {
    if (this.getSetting('gesturesEnabled') === false) return;
    this._updateInputContext();
    if (this._handNearArtefact) return;
    const hands = (this.engine.input.hands ?? []) as unknown as HandLike[];
    this.gestureRecognizer.setHands(hands);
    this.gestureRecognizer.update(delta, time);
    this.gestureAdapter.recordHands(hands, time);
    this.gestureAdapter.classify(time);
  }

  /**
   * Handle a recognized gesture or controller-mapped gesture. Emits a
   * `gesture:recognized` event and dispatches to the matching callback.
   */
  onGesture(name: string, ctx: GestureContext = {}): void {
    if (this._inputPaused && name !== 'pauseResume') {
      this.callbacks.onLog?.('Input paused — gesture ignored');
      return;
    }

    this.eventBus.emit(WorldTopics.GESTURE_RECOGNIZED, { name, ctx });

    const confidence = typeof ctx.confidence === 'number' ? (ctx.confidence as number) : 0.85;
    const isMisfire = !!ctx.isMisfire;
    this.engine.telemetry?.recordGestureConfidence?.(name, confidence, isMisfire);

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
    // Spawn transient visual spatial feedback in the scene.
    const origin = new THREE.Vector3(0, 1.2, -1.2);

    switch (name) {
      case 'bothPinched': {
        const resolution = this.gestureOwnershipManager.resolveBothPinch(
          this.interactionModeController.currentMode
        );
        this.callbacks.onLog?.([resolution.hudFeedbackChip]);
        this.callbacks.onRecordAction?.(resolution.hudFeedbackChip);

        switch (resolution.action) {
          case 'world_two_hand_transform':
            this.resetView();
            break;
          case 'commit_selection':
            this.callbacks.onCommitSelection?.();
            break;
          case 'scale_rotate_artifact':
            this.callbacks.onToggleTransformHandle?.();
            break;
          case 'resume_interaction':
            this.interactionModeController.setMode('INTERACT', 'gesture_both_pinch');
            break;
        }
        break;
      }
      case 'pinchTogether':
        if (this.engine?.scene) spawnPinchFilterHalo(this.engine.scene as THREE.Scene, origin);
        this.callbacks.onApplyOperation?.('filter');
        this.callbacks.onRecordAction?.('Filter Slice', 'Inspect filtered clusters');
        break;
      case 'pinchApart':
        if (this.engine?.scene) spawnPinchFilterHalo(this.engine.scene as THREE.Scene, origin, { color: 0xffaa00 });
        this.callbacks.onApplyOperation?.('aggregate');
        this.callbacks.onRecordAction?.('Aggregate Metric', 'Inspect aggregation summary');
        break;
      case 'swipeRight':
        this.callbacks.onCycleDataset?.(1);
        this.callbacks.onRecordAction?.('Cycle Dataset Next');
        break;
      case 'swipeLeft':
        this.callbacks.onCycleDataset?.(-1);
        this.callbacks.onRecordAction?.('Cycle Dataset Previous');
        break;
      case 'sliceUp':
        if (this.engine?.scene) spawnSliceWavePlane(this.engine.scene as THREE.Scene, origin, 'up');
        this.callbacks.onApplyOperation?.('sort');
        this.callbacks.onRecordAction?.('Sort Ascending');
        break;
      case 'sliceDown':
        if (this.engine?.scene) spawnSliceWavePlane(this.engine.scene as THREE.Scene, origin, 'down');
        this.callbacks.onApplyOperation?.('timeSlice');
        this.callbacks.onRecordAction?.('Time Window Slice');
        break;
      case 'scoopUp':
        if (this.engine?.scene) spawnScoopLensHalo(this.engine.scene as THREE.Scene, origin);
        if (this.engine.locomotion.flightMode) {
          this.engine.locomotion.ascend();
          this.callbacks.onLog?.('Flight: ascend');
        } else {
          this.callbacks.onToggleStatisticalLens?.();
          this.callbacks.onRecordAction?.('Statistical Lens Toggle');
        }
        break;
      case 'scoopDown':
        if (this.engine.locomotion.flightMode) {
          this.engine.locomotion.descend();
          this.callbacks.onLog?.('Flight: descend');
        } else {
          this.callbacks.onToggleStatisticalLens?.();
          this.callbacks.onRecordAction?.('Statistical Lens Toggle');
        }
        break;
      case 'pushForward':
        if (this.engine?.scene) spawnResetPulseSphere(this.engine.scene as THREE.Scene, origin);
        if (ctx.openHands) {
          this.resetView();
          this.callbacks.onRecordAction?.('Reset View Anchor');
        } else {
          this.callbacks.onResetData?.();
          this.callbacks.onRecordAction?.('Reset Data Filters');
        }
        break;
      case 'rotateCW':
        this.callbacks.onRedo?.();
        this.callbacks.onRecordAction?.('Redo Operation');
        break;
      case 'rotateCCW':
        this.callbacks.onUndo?.();
        this.callbacks.onRecordAction?.('Undo Operation');
        break;
      case 'okSign':
        this.callbacks.onToggleSettingsPanel?.();
        this.callbacks.onRecordAction?.('Toggle Settings');
        break;
      case 'pauseResume':
        this.togglePauseInput();
        this.callbacks.onRecordAction?.('Toggle Pause Input');
        break;
      default:
        break;
    }
  }

  /**
   * Authoritative Interaction Mode & Focus State Delegation.
   */
  setInteractionMode(mode: InteractionMode, reason = 'user_action'): boolean {
    return this.interactionModeController.setMode(mode, reason);
  }

  revertInteractionMode(): boolean {
    return this.interactionModeController.revertMode();
  }

  getInteractionMode(): InteractionMode {
    return this.interactionModeController.currentMode;
  }

  setFocusState(surfaceId: string, state: FocusState): void {
    this.interactionModeController.setFocusState(surfaceId, state);
  }

  getFocusState(surfaceId: string): FocusState {
    return this.interactionModeController.getFocusState(surfaceId);
  }

  /**
   * Infer input context from hand poses and scene widgets. Used to suppress
   * conflicting commands when the user is interacting with an artefact or the
   * wheel menu.
   */
  _updateInputContext(): void {
    const hands = this.engine.input.hands as unknown as HandLike[];
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
      handPos.copy(dominant.rayOrigin as unknown as THREE.Vector3);
    }

    // Check proximity to the palace centre / node bounding sphere.
    let artefactCenter: THREE.Vector3 | null = null;
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
          pos.copy(hand.rayOrigin as unknown as THREE.Vector3);
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
  togglePauseInput(): void {
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
  resetView(): void {
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
