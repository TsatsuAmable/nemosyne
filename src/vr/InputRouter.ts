import * as THREE from 'three';
import { PointerRegistry } from './input/PointerRegistry.ts';
import { InteractableRegistry, type InteractableEntry, type HudObject } from './input/InteractableRegistry.ts';
import { PointerEventMachine } from './input/PointerEventMachine.ts';
import { SystemGestureDetector } from './input/SystemGestureDetector.ts';
import { SelectionDispatcher } from './input/SelectionDispatcher.ts';
import { ControllerGestureBridge } from './input/ControllerGestureBridge.ts';
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

  activePointer: PointerLike | null;
  onSelectCallback: ((ray: THREE.Ray) => void) | null;
  onSystemToggle: (() => void) | null;

  constructor(engine: EngineLike) {
    this.engine = engine;

    this.pointers = new PointerRegistry(engine);
    this.registry = new InteractableRegistry();
    this.dispatcher = new SelectionDispatcher(this.registry);
    this.machine = new PointerEventMachine(this.registry, {
      onTriggerSelect: (pointer) => {
        this.activePointer = pointer;
        this.dispatcher.triggerSelect(pointer);
        this.activePointer = null;
      },
    });
    this.systemDetector = new SystemGestureDetector(this.pointers);
    this.gestureBridge = new ControllerGestureBridge();

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
      this.activePointer = pointer;
      this.dispatcher.triggerSelect(pointer);
      this.activePointer = null;
    };
  }

  addHand(hand: PointerLike): void {
    this.pointers.addHand(hand);

    // Fallback path when polling misses a pinch.
    hand.onPinchStart = (pointer) => {
      if (this.handWheelMenu && pointer === this.handWheelMenu.hand) {
        this.handWheelMenu.toggle();
        return;
      }
      this.activePointer = pointer;
      this.dispatcher.triggerSelect(pointer);
      this.activePointer = null;
    };
  }

  addInteractable(mesh: THREE.Object3D, handlers: Partial<InteractableEntry> = {}): void {
    this.registry.addInteractable(mesh, handlers);
  }

  removeInteractable(mesh: THREE.Object3D): void {
    this.registry.removeInteractable(mesh);
  }

  addHudObject(obj: HudObject): void {
    this.registry.addHudObject(obj);
  }

  addPanel(panel: PanelLike): void {
    this.registry.addPanel(panel);
  }

  setPanelManager(manager: PanelManagerLike): void {
    this.panelManager = manager;
    this.machine.panelManager = manager;
  }

  setHandWheelMenu(menu: HandWheelMenuLike): void {
    this.handWheelMenu = menu;
  }

  setControllerGestureMapper(mapper: ControllerGestureMapperLike | null): void {
    this.controllerGestureMapper = mapper;
    this.gestureBridge.setMapper(mapper);
  }

  setSuppressSceneSelection(enabled: boolean): void {
    this.registry.setSuppressSceneSelection(enabled);
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

    const ray = this.pointers.getBestPointerRay();
    if (!ray) {
      this.registry.clearHover();
      this._pollSelection(session);
      return;
    }

    this.registry.raycaster.ray.copy(ray);

    // Panels take precedence over scene objects.
    const panelHit = this.registry.raycastPanels();
    const sceneHit = this.registry.raycastScene();

    const pointer = this.pointers.getActivePointerObject();
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

    const { bothPinched } = this.systemDetector.update(session);

    // Controller buttons.
    for (const controller of this.pointers.controllers) {
      const source = this.pointers.findSourceForController(controller, sources);
      if (!source || !source.gamepad || !source.gamepad.buttons) {
        this.pointers.controllerTriggerPressed.set(controller, false);
        continue;
      }

      const triggerPressed = !!source.gamepad.buttons[0]?.pressed;
      const wasTriggerPressed = this.pointers.controllerTriggerPressed.get(controller);

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

      if (bothPinched) {
        // Two-hand pinch is reserved for the system gesture; do not fire
        // per-hand selection while it is held.
        this.pointers.lastHandPinched.set(hand, pinched);
        continue;
      }

      // The hand holding the radial wheel toggles the menu on pinch.
      if (this.handWheelMenu && hand === this.handWheelMenu.hand) {
        if (pinched && !wasPinched) {
          this.handWheelMenu.toggle();
        }
        this.pointers.lastHandPinched.set(hand, pinched);
        continue;
      }

      if (pinched && !wasPinched) {
        this.machine.press(hand);
      } else if (!pinched && wasPinched && this.machine.downPointer === hand) {
        this.machine.release(hand);
      }

      this.pointers.lastHandPinched.set(hand, pinched);
    }
  }

  _clearHover(): void {
    this.registry.clearHover();
  }

  _triggerSelect(): void {
    this.dispatcher.triggerSelect(this.activePointer);
  }
}
