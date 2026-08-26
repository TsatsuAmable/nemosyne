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
 * This class is now a thin facade that delegates pointer bookkeeping to focused
 * state-machine classes:
 *
 *   - PointerRegistry          – controllers, hands, pointer rays, XR source mapping
 *   - InteractableRegistry     – interactables, panels, HUD objects, hover state
 *   - PointerEventMachine      – press / move / release state machine for pointers
 *   - SystemGestureDetector    – both-hands pinch / both-grips system toggle
 *   - SelectionDispatcher      – selection feedback, callbacks, and dwell selection
 *   - ControllerGestureBridge  – controller gesture vocabulary bridge
 *
 * Selection is detected by polling controller trigger buttons and hand pinch
 * state each frame. Event-based selection is kept as a fallback, but some Meta
 * Quest Browser builds do not dispatch 'selectstart' on the controller Object3D,
 * so polling is the primary path.
 *
 * Panels registered with addPanel() take precedence over scene objects and can be
 * dragged or minimized. A controller grip or two-hand pinch can be wired to a
 * system-level callback (e.g. recalling hidden panels).
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
   * structure-kind selection drives the focus/context controller. Both fields
   * default to `null` so the legacy nearest-hit picking path is unchanged when
   * the layer is not installed.
   */
  semanticResolver: SemanticTargetResolver | null = null;
  focusContext: FocusContextController | null = null;
  /** Notified whenever the focus/context state changes so the World/session can navigate + persist. */
  onFocusChange: ((state: { currentLevel: FocusLevel; focusedStructureId: string | null }) => void) | null = null;

  activePointer: PointerLike | null;
  onSelectCallback: ((ray: THREE.Ray) => void) | null;
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

  constructor(engine: EngineLike) {
    this.engine = engine;

    this.pointers = new PointerRegistry(engine);
    this.registry = new InteractableRegistry();
    this.dispatcher = new SelectionDispatcher(this.registry);
    this.machine = new PointerEventMachine(this.registry, {
      onTriggerSelect: (pointer) => {
        this._dispatchSelect(pointer);
      },
    });
    this.systemDetector = new SystemGestureDetector(this.pointers);
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

    // Facade properties that keep external array mutations in sync with the
    // focused registries they delegate to.
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

    // Forward callbacks to the focused subsystems.
    this.systemDetector.onSystemToggle = () => this.onSystemToggle?.();
    this.dispatcher.setOnSelectCallback((ray) => this.onSelectCallback?.(ray));
  }

  addController(controller: PointerLike): void {
    this.pointers.addController(controller);

    // Fallback path when polling misses a select event.
    controller.onSelect = (pointer) => {
      this._dispatchSelect(pointer);
    };
  }

  addHand(hand: PointerLike): void {
    this.pointers.addHand(hand);

    // Fallback path when polling misses a pinch.
    hand.onPinchStart = (pointer) => {
      if (this.pointers.lastHandPinched.get(pointer)) return;
      this.pointers.lastHandPinched.set(pointer, true);
      if (this.handWheelMenu && pointer === this.handWheelMenu.hand) {
        this.handWheelMenu.toggle();
        return;
      }
      this._dispatchSelect(pointer);
    };

    hand.onPinchEnd = (pointer) => {
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

  /**
   * RF-025: install the semantic targeting + focus/context layer. Pass `null`
   * to revert to the legacy nearest-hit picking path. Installing a resolver
   * does not remove the precision escape hatch — the resolver only re-ranks
   * the existing hit list; when it returns no target the nearest hit is used.
   */
  setSemanticTargeting(
    resolver: SemanticTargetResolver | null,
    focusController: FocusContextController | null
  ): void {
    this.semanticResolver = resolver;
    this.focusContext = focusController;
  }

  /**
   * RF-025: resolve the scene hit for the current ray. When a semantic resolver
   * is installed, rank ALL scene hits and coerce structure targets over raw
   * observations with hysteresis; otherwise fall back to the bare nearest hit.
   * Returns `null` when nothing is hit.
   */
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

  /**
   * RF-025: trigger selection and propagate any structure-kind selection into
   * the focus/context controller, notifying subscribers so the World/session
   * can navigate to the focused structure and persist the state.
   */
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

    // Only structure-kind selections advance focus; observations stay at the
    // current context so data-node inspection does not hijack Memory Palace navigation.
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

  /** Return the pointer object that triggered the most recent selection. */
  getActivePointer(): PointerLike | null {
    return this.activePointer;
  }

  setDwellSelection(enabled: boolean, thresholdMs = 1200): void {
    this.dispatcher.setDwellSelection(enabled, thresholdMs);
  }

  /**
   * Desktop / synthetic pointer press entry point. Delegates to the pointer
   * event machine so mouse clicks produce the same selection/drag path as
   * controller trigger pulls.
   */
  _onPointerDown(pointer: PointerLike): void {
    this.machine.press(pointer);
  }

  /**
   * Desktop / synthetic pointer release entry point.
   */
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
    // Update hand tracking.
    this.pointers.updateHands(frame, referenceSpace, session);

    // Hide controller placeholder rays when hand tracking is active.
    this.pointers.updateControllerRayVisibilities();

    // Update near field direct touch interactor
    const activePointers: PointerLike[] = [];
    for (const hand of this.pointers.hands) {
      if (hand.jointsValid) activePointers.push(hand);
    }
    for (const ctrl of this.pointers.controllers) {
      if (ctrl.handedness !== 'none') activePointers.push(ctrl);
    }
    this.nearInteractor.update(activePointers, this.registry.panels);

    // Apply near-field ray suppression overrides on top of standard registry visibility rules
    const activeHand = this.pointers.getBestHand();
    for (const ctrl of this.pointers.controllers) {
      const touchState = this.nearInteractor.getTouchState(ctrl);
      const isNear = touchState && touchState.phase !== 'FAR';
      ctrl.setRayVisible?.(!activeHand && !isNear);
      if (isNear && touchState) {
        ctrl.setRayLength?.(touchState.distance);
      }
    }
    for (const hand of this.pointers.hands) {
      const touchState = this.nearInteractor.getTouchState(hand);
      const isNear = touchState && touchState.phase !== 'FAR';
      hand.setRayVisible?.(!isNear);
      if (isNear && touchState) {
        hand.setRayLength?.(touchState.distance);
      }
    }

    const ray = this.pointers.getBestPointerRay();
    if (!ray) {
      this.registry.clearHover();
      this._pollSelection(session);
      return;
    }

    this.registry.raycaster.ray.copy(ray);
    if (this.engine?.camera) {
      this.registry.raycaster.camera = this.engine.camera;
    }

    // Determine if active pointer is in near touch mode to suppress far raycasting
    const pointer = this.pointers.getActivePointerObject();
    const touchState = pointer ? this.nearInteractor.getTouchState(pointer) : undefined;
    const isNear = touchState && touchState.phase !== 'FAR';

    // Panels take precedence over scene objects.
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

    // Route drag movement for captured panels every frame.
    if (this.machine.downPointer) {
      this.machine.move(this.machine.downPointer);
    }

    if (!this.machine.downPointer) {
      this.dispatcher.updateDwell(panelHit, sceneHit, pointer);
    }

    const pollSession = session ?? this.engine.renderer?.xr?.getSession?.() ?? null;
    this._pollSelection(pollSession);

    // Controller gesture equivalents: emit the same gesture names as hand
    // tracking so the rest of the application only sees one input vocabulary.
    this.gestureBridge.update(this.pointers.controllers, pollSession, time);
  }

  /**
   * Poll controllers and hands for trigger/pinch edges and feed them into the
   * pointer event state machine.
   */
  _pollSelection(session: XRSession | null): void {
    if (!session || !session.inputSources) return;
    const sources = Array.from(session.inputSources);

    const { suppressSelection } = this.systemDetector.update(session);

    // Controller buttons.
    for (const controller of this.pointers.controllers) {
      const source = this.pointers.findSourceForController(controller, sources);
      const wasTriggerPressed = this.pointers.controllerTriggerPressed.get(controller);

      if (!source || !source.gamepad || !source.gamepad.buttons) {
        if (wasTriggerPressed && this.machine.downPointer === controller) {
          this.machine.release(controller);
        }
        this.pointers.controllerTriggerPressed.set(controller, false);
        continue;
      }

      const triggerPressed = !!source.gamepad.buttons[0]?.pressed;

      if (triggerPressed && !wasTriggerPressed) {
        this.machine.press(controller);
      } else if (!triggerPressed && wasTriggerPressed) {
        this.machine.release(controller);
      }

      this.pointers.controllerTriggerPressed.set(controller, triggerPressed);
    }

    // Hand pinches.
    for (const hand of this.pointers.hands) {
      const pinched = hand.isPinched?.() ?? false;
      const wasPinched = this.pointers.lastHandPinched.get(hand);

      if (suppressSelection) {
        // Two-hand pinch is reserved for the system gesture; do not fire
        // per-hand selection while it is held.
        if (pinched && !wasPinched) {
          this.onHandPinchEdge?.(hand, 'start', 'system-suppressed');
        } else if (!pinched && wasPinched) {
          this.onHandPinchEdge?.(hand, 'end', 'system-suppressed');
        }
        this.pointers.lastHandPinched.set(hand, pinched);
        continue;
      }

      // The hand holding the radial wheel toggles the menu on pinch.
      if (this.handWheelMenu && hand === this.handWheelMenu.hand) {
        if (pinched && !wasPinched) {
          this.onHandPinchEdge?.(hand, 'start', 'wheel-toggle');
          this.handWheelMenu.toggle();
        } else if (!pinched && wasPinched) {
          this.onHandPinchEdge?.(hand, 'end', 'wheel-release');
        }
        this.pointers.lastHandPinched.set(hand, pinched);
        continue;
      }

      if (pinched && !wasPinched) {
        this.onHandPinchEdge?.(hand, 'start', 'select');
        this.machine.press(hand);
      } else if (!pinched && wasPinched && this.machine.downPointer === hand) {
        this.onHandPinchEdge?.(hand, 'end', 'select-release');
        this.machine.release(hand);
      } else if (!pinched && wasPinched) {
        this.onHandPinchEdge?.(hand, 'end', 'passive-release');
      }

      this.pointers.lastHandPinched.set(hand, pinched);
    }
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
