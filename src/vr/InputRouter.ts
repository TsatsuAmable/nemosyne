import * as THREE from 'three';
import { PointerRegistry } from './input/PointerRegistry.ts';
import {
  InteractableRegistry,
  type InteractableEntry,
  type HudObject,
  type SceneHit,
} from './input/InteractableRegistry.ts';
import { PointerEventMachine } from './input/PointerEventMachine.ts';
import { SystemGestureDetector } from './input/SystemGestureDetector.ts';
import { SelectionDispatcher } from './input/SelectionDispatcher.ts';
import { ControllerGestureBridge } from './input/ControllerGestureBridge.ts';
import { SemanticTargetResolver } from './input/SemanticTargetResolver.ts';
import {
  IWSDKXRInputProvider,
  type XRInputProvider,
} from './input/XRInputProvider.ts';
import { FocusContextController, type FocusLevel } from './interactions/FocusContextController.ts';
import { NearFieldInteractor } from './interactions/near/NearFieldInteractor.ts';
import type {
  ControllerGestureMapperLike,
  EngineLike,
  FeedbackLike,
  HandWheelMenuLike,
  PanelLike,
  PanelManagerLike,
  PointerLike,
} from './coordinators/types.ts';

/**
 * Routes WebXR controller and hand pointer input.
 *
 * Commodity XR button/profile normalization is delegated to XRInputProvider
 * (IWSDK by default). Nemosyne continues to own semantic routing, interaction
 * modes, suppression policy, tracing and explicit legacy fallbacks.
 */
export class InputRouter {
  engine: EngineLike;

  pointers: PointerRegistry;
  registry: InteractableRegistry;
  dispatcher: SelectionDispatcher;
  machine: PointerEventMachine;
  systemDetector: SystemGestureDetector;
  gestureBridge: ControllerGestureBridge;
  nearInteractor: NearFieldInteractor;
  xrInputProvider: XRInputProvider;

  // Legacy public aliases so existing callers and tests continue to work.
  controllers: PointerLike[];
  hands: PointerLike[];
  interactables: InteractableEntry[];
  hudObjects: HudObject[];
  panels: PanelLike[];
  raycaster: THREE.Raycaster;
  feedback: FeedbackLike;
  hovered: InteractableEntry | null;

  panelManager: PanelManagerLike | null;
  handWheelMenu: HandWheelMenuLike | null;
  controllerGestureMapper: ControllerGestureMapperLike | null;

  /**
   * RF-025: optional semantic targeting layer. When installed, the per-frame
   * picking path resolves the full scene hit list through the resolver (with
   * coercion + hysteresis) instead of using the bare nearest hit, and a
   * structure-kind selection drives the focus/context controller.
   */
  semanticResolver: SemanticTargetResolver | null = null;
  focusContext: FocusContextController | null = null;
  onFocusChange: ((state: { currentLevel: FocusLevel; focusedStructureId: string | null }) => void) | null = null;

  activePointer: PointerLike | null;
  /** Last completed poll suppression verdict for the true out-of-band fallback path. */
  private _lastSuppressSelection = false;
  /** True while updateHands is producing callbacks that the poll pass owns. */
  private _pollOwnsHandCallbacks = false;
  private _onSelectCallback: ((ray: THREE.Ray) => void) | null = null;

  get onSelectCallback(): ((ray: THREE.Ray) => void) | null {
    return this._onSelectCallback;
  }

  set onSelectCallback(cb: ((ray: THREE.Ray) => void) | null) {
    this._onSelectCallback = cb;
    this.dispatcher.setOnSelectCallback(cb ? (ray) => cb(ray) : null);
  }

  onSystemToggle: (() => void) | null;
  onHandPinchEdge:
    | ((
        hand: PointerLike,
        phase: 'start' | 'end',
        gating:
          | 'select'
          | 'select-release'
          | 'passive-release'
          | 'wheel-toggle'
          | 'wheel-release'
          | 'system-suppressed'
      ) => void)
    | null = null;

  constructor(engine: EngineLike, options: { xrInputProvider?: XRInputProvider } = {}) {
    this.engine = engine;

    this.pointers = new PointerRegistry(engine);
    this.registry = new InteractableRegistry();
    this.dispatcher = new SelectionDispatcher(this.registry);
    this.machine = new PointerEventMachine(this.registry, {
      onTriggerSelect: (pointer) => {
        this._dispatchSelect(pointer);
      },
    });
    this.xrInputProvider = options.xrInputProvider ?? new IWSDKXRInputProvider();
    this.systemDetector = new SystemGestureDetector(this.pointers, {
      inputProvider: this.xrInputProvider,
    });
    this.gestureBridge = new ControllerGestureBridge();
    this.nearInteractor = new NearFieldInteractor();

    this.controllers = this.pointers.controllers;
    this.hands = this.pointers.hands;
    this.interactables = this.registry.interactables;
    this.hudObjects = this.registry.hudObjects;
    this.panels = this.registry.panels;
    this.raycaster = this.registry.raycaster;
    this.feedback = this.dispatcher.feedback;
    this.hovered = this.registry.hovered;

    Object.defineProperty(this, 'panels', {
      get: () => this.registry.panels,
      set: (value: PanelLike[]) => {
        this.registry.panels = value;
      },
      configurable: true,
    });
    Object.defineProperty(this, 'interactables', {
      get: () => this.registry.interactables,
      set: (value: InteractableEntry[]) => {
        this.registry.interactables = value;
      },
      configurable: true,
    });
    Object.defineProperty(this, 'hudObjects', {
      get: () => this.registry.hudObjects,
      set: (value: HudObject[]) => {
        this.registry.hudObjects = value;
      },
      configurable: true,
    });
    Object.defineProperty(this, 'hovered', {
      get: () => this.registry.hovered,
      set: (value: InteractableEntry | null) => {
        this.registry.hovered = value;
      },
      configurable: true,
    });

    this.panelManager = null;
    this.handWheelMenu = null;
    this.controllerGestureMapper = null;
    this.activePointer = null;
    this.onSelectCallback = null;
    this.onSystemToggle = null;

    this.systemDetector.onSystemToggle = () => this.onSystemToggle?.();
  }

  addController(controller: PointerLike): void {
    this.pointers.addController(controller);
    controller.onSelect = (pointer) => {
      this._dispatchSelect(pointer);
    };
  }

  addHand(hand: PointerLike): void {
    this.pointers.addHand(hand);

    // HandPointer callbacks are synchronous. During a pollable XR frame the
    // provider + poll pass own edges after both hands have reached final state.
    hand.onPinchStart = (pointer) => {
      if (this._pollOwnsHandCallbacks) return;
      if (this.pointers.lastHandPinched.get(pointer)) return;
      this.pointers.lastHandPinched.set(pointer, true);
      const gating = this._classifyPinchStart(pointer, this._lastSuppressSelection);
      this.onHandPinchEdge?.(pointer, 'start', gating);
      if (gating === 'system-suppressed') return;
      if (this.handWheelMenu && pointer === this.handWheelMenu.hand) {
        this.handWheelMenu.toggle();
        return;
      }
      this._dispatchSelect(pointer);
    };

    hand.onPinchEnd = (pointer) => {
      if (this._pollOwnsHandCallbacks) return;
      this.pointers.lastHandPinched.set(pointer, false);
    };
  }

  addInteractable(mesh: THREE.Object3D, handlers: Partial<InteractableEntry> = {}): void {
    this.registry.addInteractable(mesh, handlers);
  }

  removeInteractable(mesh: THREE.Object3D): void {
    this.registry.removeInteractable(mesh);
  }

  invalidateSpatialAcceleration(): void {
    this.registry.invalidateSpatialAcceleration();
  }

  raycastScene(
    raycaster?: THREE.Raycaster,
    options?: { ignoreSuppression?: boolean }
  ): SceneHit | null {
    return this.registry.raycastScene(raycaster, options);
  }

  addHudObject(obj: HudObject): void {
    this.registry.addHudObject(obj);
  }

  removeHudObject(obj: HudObject): void {
    this.registry.removeHudObject(obj);
  }

  addPanel(panel: PanelLike): void {
    this.registry.addPanel(panel);
  }

  removePanel(panel: PanelLike): void {
    this.registry.removePanel(panel);
  }

  setPanelManager(manager: PanelManagerLike | null): void {
    this.panelManager = manager;
    this.machine.panelManager = manager;
  }

  setHandWheelMenu(menu: HandWheelMenuLike | null): void {
    this.handWheelMenu = menu;
  }

  setControllerGestureMapper(mapper: ControllerGestureMapperLike | null): void {
    this.controllerGestureMapper = mapper;
    this.gestureBridge.setMapper(mapper);
  }

  setSuppressSceneSelection(enabled: boolean): void {
    this.registry.setSuppressSceneSelection(enabled);
  }

  dispose(): void {
    const pointers = new Set([...this.pointers.controllers, ...this.pointers.hands]);
    for (const pointer of pointers) pointer.dispose?.();
    this.xrInputProvider.reset();
    this.pointers.clear();
    this.feedback.dispose?.();
    this.registry.clear();
    this.panelManager = null;
    this.machine.panelManager = null;
    this.handWheelMenu = null;
    this.setControllerGestureMapper(null);
    this.activePointer = null;
    this.onSelectCallback = null;
    this.onSystemToggle = null;
    this.onHandPinchEdge = null;
    this.semanticResolver?.clearHold();
    this.semanticResolver = null;
    this.focusContext = null;
    this.onFocusChange = null;
  }

  setSemanticTargeting(
    resolver: SemanticTargetResolver | null,
    focusController: FocusContextController | null
  ): void {
    this.semanticResolver = resolver;
    this.focusContext = focusController;
  }

  private _resolveSceneHit(): SceneHit | null {
    if (!this.semanticResolver) {
      return this.registry.raycastScene();
    }
    const allHits = this.registry.raycastSceneAll();
    if (allHits.length === 0) return null;
    const ray = this.registry.raycaster.ray;
    const gazeDir = this.engine?.camera?.getWorldDirection?.(new THREE.Vector3());
    const resolved = this.semanticResolver.rank(allHits, ray, gazeDir ?? undefined, undefined);
    if (!resolved) return allHits[0] ?? null;
    const matched = allHits.find((hit) => hit.entry === resolved.entry);
    return matched ?? { entry: resolved.entry, distance: 0 };
  }

  private _dispatchSelect(pointer: PointerLike): void {
    this.activePointer = pointer;
    this.dispatcher.triggerSelect(pointer);
    this._applyFocusFromHovered();
    this.activePointer = null;
  }

  private _applyFocusFromHovered(): void {
    const focus = this.focusContext;
    if (!focus) return;
    const entry = this.registry.hovered;
    const semantic = entry?.semantic;
    if (!semantic?.structureId) return;

    const isStructure =
      semantic.kind === 'mapper-node' ||
      semantic.kind === 'cluster-region' ||
      semantic.kind === 'persistence-structure' ||
      semantic.kind === 'investigation-artifact';
    if (!isStructure) return;

    const before = focus.exportState();
    focus.focusStructure(semantic.structureId);
    const after = focus.exportState();
    if (
      before.currentLevel !== after.currentLevel ||
      before.focusedStructureId !== after.focusedStructureId
    ) {
      this.onFocusChange?.(after);
    }
  }

  getActivePointer(): PointerLike | null {
    return this.activePointer;
  }

  setDwellSelection(enabled: boolean, thresholdMs = 1200): void {
    this.dispatcher.setDwellSelection(enabled, thresholdMs);
  }

  _onPointerDown(pointer: PointerLike): void {
    this.machine.press(pointer);
  }

  _onPointerUp(pointer: PointerLike): void {
    this.machine.release(pointer);
  }

  /** Called each frame by the engine. */
  update(
    frame: XRFrame | null,
    referenceSpace: XRReferenceSpace | null,
    session: XRSession | null,
    time = 0
  ): void {
    const pollSession = session ?? this.engine.renderer?.xr?.getSession?.() ?? null;

    this._pollOwnsHandCallbacks = Boolean(pollSession?.inputSources);
    try {
      this.pointers.updateHands(frame, referenceSpace, session);
    } finally {
      this._pollOwnsHandCallbacks = false;
    }

    this.pointers.updateControllerRayVisibilities();

    const activePointers: PointerLike[] = [];
    for (const hand of this.pointers.hands) {
      if (hand.jointsValid) activePointers.push(hand);
    }
    for (const ctrl of this.pointers.controllers) {
      if (ctrl.handedness !== 'none') activePointers.push(ctrl);
    }
    this.nearInteractor.update(activePointers, this.registry.panels);

    const activeHand = this.pointers.getBestHand();
    for (const ctrl of this.pointers.controllers) {
      const touchState = this.nearInteractor.getTouchState(ctrl);
      const isNear = touchState && touchState.phase !== 'FAR';
      ctrl.setRayVisible?.(!activeHand && !isNear);
      if (isNear && touchState) ctrl.setRayLength?.(touchState.distance);
    }
    for (const hand of this.pointers.hands) {
      const touchState = this.nearInteractor.getTouchState(hand);
      const isNear = touchState && touchState.phase !== 'FAR';
      hand.setRayVisible?.(!isNear);
      if (isNear && touchState) hand.setRayLength?.(touchState.distance);
    }

    const ray = this.pointers.getBestPointerRay();
    if (!ray) {
      this.registry.clearHover();
      this._pollSelection(pollSession);
      return;
    }

    this.registry.raycaster.ray.copy(ray);
    if (this.engine?.camera) this.registry.raycaster.camera = this.engine.camera;

    const pointer = this.pointers.getActivePointerObject();
    const touchState = pointer ? this.nearInteractor.getTouchState(pointer) : undefined;
    const isNear = touchState && touchState.phase !== 'FAR';

    const panelHit = isNear ? null : this.registry.raycastPanels();
    const sceneHit = isNear ? null : this._resolveSceneHit();

    if (panelHit) {
      pointer?.setRayLength?.(panelHit.distance);
      this.registry.clearHover();
    } else if (sceneHit) {
      pointer?.setRayLength?.(sceneHit.distance);
    } else {
      pointer?.setRayLength?.(8);
      this.registry.clearHover();
    }

    this.registry.updateHover(panelHit, sceneHit, this.dispatcher.feedback);

    if (this.machine.downPointer) this.machine.move(this.machine.downPointer);
    if (!this.machine.downPointer) this.dispatcher.updateDwell(panelHit, sceneHit, pointer);

    this._pollSelection(pollSession);
    this.gestureBridge.update(this.pointers.controllers, pollSession, time);
  }

  /**
   * Sample normalized XR state, then route controller/hand select edges into
   * Nemosyne semantics. Legacy raw state is used only when the provider marks a
   * source unavailable.
   */
  _pollSelection(session: XRSession | null): void {
    this.xrInputProvider.update(session);

    if (!session || !session.inputSources) {
      this._lastSuppressSelection = false;
      return;
    }
    const sources = Array.from(session.inputSources);

    const { suppressSelection } = this.systemDetector.update(session);
    this._lastSuppressSelection = suppressSelection;

    for (const controller of this.pointers.controllers) {
      const source = this.pointers.findSourceForController(controller, sources);
      const normalized = this.xrInputProvider.getSelect(source);
      const wasTriggerPressed = this.pointers.controllerTriggerPressed.get(controller) ?? false;

      if (normalized.available) {
        const touchState = this.nearInteractor.getTouchState(controller);
        const isNear = touchState && touchState.phase !== 'FAR';
        if (normalized.down && !isNear) this.machine.press(controller);
        if (normalized.up) this.machine.release(controller);
        this.pointers.controllerTriggerPressed.set(controller, normalized.pressed);
        continue;
      }

      if (!source?.gamepad?.buttons) {
        if (wasTriggerPressed && this.machine.downPointer === controller) {
          this.machine.release(controller);
        }
        this.pointers.controllerTriggerPressed.set(controller, false);
        continue;
      }

      const triggerPressed = !!source.gamepad.buttons[0]?.pressed;
      const touchState = this.nearInteractor.getTouchState(controller);
      const isNear = touchState && touchState.phase !== 'FAR';
      if (triggerPressed && !wasTriggerPressed && !isNear) {
        this.machine.press(controller);
      } else if (!triggerPressed && wasTriggerPressed) {
        this.machine.release(controller);
      }
      this.pointers.controllerTriggerPressed.set(controller, triggerPressed);
    }

    for (const hand of this.pointers.hands) {
      const source = this.pointers.findSourceForHand(hand, sources);
      const normalized = this.xrInputProvider.getSelect(source);
      const pinched = normalized.available ? normalized.pressed : (hand.isPinched?.() ?? false);
      const wasPinched = this.pointers.lastHandPinched.get(hand) ?? false;
      const started = normalized.available ? normalized.down : pinched && !wasPinched;
      const ended = normalized.available ? normalized.up : !pinched && wasPinched;

      if (suppressSelection) {
        if (started) {
          this.onHandPinchEdge?.(hand, 'start', this._classifyPinchStart(hand, suppressSelection));
        } else if (ended) {
          this.onHandPinchEdge?.(hand, 'end', 'system-suppressed');
        }
        this.pointers.lastHandPinched.set(hand, pinched);
        continue;
      }

      if (this.handWheelMenu && hand === this.handWheelMenu.hand) {
        if (started) {
          this.onHandPinchEdge?.(hand, 'start', this._classifyPinchStart(hand, suppressSelection));
          this.handWheelMenu.toggle();
        } else if (ended) {
          this.onHandPinchEdge?.(hand, 'end', 'wheel-release');
        }
        this.pointers.lastHandPinched.set(hand, pinched);
        continue;
      }

      const touchState = this.nearInteractor.getTouchState(hand);
      const isNear = touchState && touchState.phase !== 'FAR';
      if (started) {
        this.onHandPinchEdge?.(hand, 'start', this._classifyPinchStart(hand, suppressSelection));
        if (!isNear) this.machine.press(hand);
      } else if (ended && this.machine.downPointer === hand) {
        this.onHandPinchEdge?.(hand, 'end', 'select-release');
        this.machine.release(hand);
      } else if (ended) {
        this.onHandPinchEdge?.(hand, 'end', 'passive-release');
      }
      this.pointers.lastHandPinched.set(hand, pinched);
    }
  }

  private _classifyPinchStart(
    hand: PointerLike,
    suppressSelection: boolean
  ): 'select' | 'wheel-toggle' | 'system-suppressed' {
    if (suppressSelection) return 'system-suppressed';
    if (this.handWheelMenu && hand === this.handWheelMenu.hand) return 'wheel-toggle';
    return 'select';
  }

  _clearHover(): void {
    this.registry.clearHover();
  }

  _triggerSelect(): void {
    if (this.activePointer) {
      this._dispatchSelect(this.activePointer);
    } else {
      this.dispatcher.triggerSelect(this.activePointer);
    }
  }
}
