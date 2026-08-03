import * as THREE from 'three';
import { SelectionFeedback } from './audio/SelectionFeedback.js';

/**
 * Routes WebXR controller and hand pointer input.
 * Maintains a list of interactable meshes and a hovered/active state.
 * Provides a unified pointer ray each frame and visual feedback on the
 * active pointer line.
 *
 * Selection is detected by polling controller trigger buttons and hand pinch
 * state each frame. Event-based selection is kept as a fallback, but some
 * Meta Quest Browser builds do not dispatch 'selectstart' on the controller
 * Object3D, so polling is the primary path.
 *
 * Panels registered with addPanel() take precedence over scene objects and
 * can be dragged or minimized. A controller grip or two-hand pinch can be
 * wired to a system-level callback (e.g. recalling hidden panels).
 */
export class InputRouter {
  constructor(engine) {
    this.engine = engine;
    this.raycaster = new THREE.Raycaster();
    this.tempRay = new THREE.Ray();

    this.controllers = [];
    this.hands = [];

    this.interactables = []; // { mesh, onEnter, onLeave, onSelect, data }
    this.hudObjects = []; // objects with handlePointerClick(raycaster)
    this.panels = []; // MovablePanels

    this.hovered = null;
    this.activePointer = null; // controller or hand that triggered latest selection

    this.onSelectCallback = null;
    this.onSystemToggle = null;

    this.feedback = new SelectionFeedback();

    // Hand-attached radial wheel menu (Meta Quest-native control).
    this.handWheelMenu = null;

    // Polled pointer state.
    this.controllerTriggerPressed = new Map(); // ControllerPointer -> boolean
    this.controllerGripPressed = new Map(); // ControllerPointer -> boolean
    this.lastHandPinched = new Map(); // HandPointer -> boolean
    this.lastBothPinched = false;

    // Active drag/click state.
    this.downPointer = null;
    this.capturedPanel = null;
    this.capturedMode = null;

    // Motor accessibility: dwell selection for hands/controllers.
    this.dwellSelection = false;
    this._dwellTimer = null;
    this._dwellTarget = null;

    // Track whether the controller grip system-toggle gesture is active so it
    // only fires once per press.
    this._lastGripSystemToggle = false;
  }

  addController(controller) {
    this.controllers.push(controller);
    this.controllerTriggerPressed.set(controller, false);
    this.controllerGripPressed.set(controller, false);

    // Fallback path when polling misses a select event.
    controller.onSelect = (pointer) => {
      this.activePointer = pointer;
      this._triggerSelect();
      this.activePointer = null;
    };
  }

  addHand(hand) {
    this.hands.push(hand);
    this.lastHandPinched.set(hand, false);

    // Fallback path when polling misses a pinch.
    hand.onPinchStart = (pointer) => this._handlePinchStart(pointer);
  }

  addInteractable(mesh, handlers = {}) {
    this.interactables.push({ mesh, ...handlers });
  }

  removeInteractable(mesh) {
    const idx = this.interactables.findIndex((i) => i.mesh === mesh);
    if (idx >= 0) this.interactables.splice(idx, 1);
  }

  addHudObject(obj) {
    this.hudObjects.push(obj);
  }

  addPanel(panel) {
    this.panels.push(panel);
  }

  setPanelManager(manager) {
    this.panelManager = manager;
  }

  setHandWheelMenu(menu) {
    this.handWheelMenu = menu;
  }

  setControllerGestureMapper(mapper) {
    this.controllerGestureMapper = mapper;
  }

  setSuppressSceneSelection(enabled) {
    this._suppressSceneSelection = enabled;
  }

  /** Return the pointer object that triggered the most recent selection. */
  getActivePointer() {
    return this.activePointer;
  }

  /** Called each frame by the engine. */
  update(frame, referenceSpace, session, time = 0) {
    // Update hand tracking.
    for (const hand of this.hands) {
      hand.update(frame, referenceSpace, session);
    }

    // Hide controller placeholder rays when hand tracking is active. Quest
    // Browser reports both hand and controller input sources for the same
    // tracked hands, which would otherwise show two lasers.
    const activeHand = this._getBestHand();
    for (const c of this.controllers) {
      if (c.setRayVisible) c.setRayVisible(!activeHand);
    }

    const ray = this._getBestPointerRay();
    if (!ray) {
      this._clearHover();
      this._pollSelection();
      return;
    }

    this.raycaster.ray.copy(ray);

    // Panels are world-space UI and must take precedence over scene objects,
    // even when the visual laser appears to pass "through" them because they
    // are rendered without depth testing.
    const panelHit = this._raycastPanels();
    const sceneHits = this._suppressSceneSelection
      ? []
      : this.raycaster.intersectObjects(
          this.interactables.map((i) => i.mesh),
          false
        );

    const pointer = this._getActivePointerObject();
    if (panelHit) {
      if (pointer) pointer.setRayLength(panelHit.distance);
      this._clearHover();
    } else if (sceneHits.length > 0) {
      if (pointer) pointer.setRayLength(sceneHits[0].distance);
      const hit = sceneHits[0].object;
      const entry = this.interactables.find((i) => i.mesh === hit);
      if (entry) {
        if (this.hovered !== entry) {
          if (this.hovered?.onLeave) this.hovered.onLeave(this.hovered.mesh);
          this.hovered = entry;
          if (entry.onEnter) entry.onEnter(entry.mesh);
          this.feedback.playHover();
        }
      }
    } else {
      if (pointer) pointer.setRayLength(8);
      this._clearHover();
    }

    // Route drag movement for captured panels every frame.
    if (this.capturedPanel && this.downPointer) {
      const dragRay = this.downPointer.getRay(new THREE.Ray());
      this.raycaster.ray.copy(dragRay);
      this.capturedPanel.handlePointerMove(this.raycaster, this.downPointer);
    }

    if (this.dwellSelection) this._updateDwellSelection(panelHit, sceneHits[0] ?? null);

    this._pollSelection();

    // Controller gesture equivalents: emit the same gesture names as hand
    // tracking so the rest of the application only sees one input vocabulary.
    if (this.controllerGestureMapper && session) {
      this.controllerGestureMapper.update(this.controllers, session, time);
    }
  }

  setDwellSelection(enabled, thresholdMs = 1200) {
    this.dwellSelection = !!enabled;
    this._dwellThreshold = thresholdMs;
    if (!enabled) {
      this._dwellTarget = null;
      if (this._dwellTimer) {
        clearTimeout(this._dwellTimer);
        this._dwellTimer = null;
      }
    }
  }

  _updateDwellSelection(panelHit, sceneHit) {
    if (!this.dwellSelection || this.downPointer) return;

    const target = panelHit
      ? { type: 'panel', value: panelHit.panel }
      : sceneHit
        ? { type: 'scene', value: this.interactables.find((i) => i.mesh === sceneHit.object) }
        : null;

    const targetId = target ? `${target.type}:${target.value?.mesh?.uuid ?? target.value}` : null;
    if (targetId !== this._dwellTarget) {
      this._dwellTarget = targetId;
      if (this._dwellTimer) clearTimeout(this._dwellTimer);
      if (!targetId) return;
      this._dwellTimer = setTimeout(() => {
        if (target.type === 'panel') {
          const pointer = this._getActivePointerObject();
          if (pointer) target.value.handlePointerDown?.(this.raycaster, pointer);
        } else if (target?.value?.onSelect) {
          this.activePointer = this._getActivePointerObject();
          target.value.onSelect(target.value.mesh, target.value.data);
          this.activePointer = null;
        }
      }, this._dwellThreshold ?? 1200);
    }
  }

  _raycastPanels() {
    let nearest = null;
    for (const panel of this.panels) {
      if (!panel.mesh.visible) continue;
      const hits = this.raycaster.intersectObject(panel.mesh, false);
      if (hits.length > 0) {
        if (!nearest || hits[0].distance < nearest.distance) {
          nearest = { panel, distance: hits[0].distance };
        }
      }
    }
    return nearest;
  }

  _pollSelection() {
    const session = this.engine.renderer.xr.getSession();
    if (!session || !session.inputSources) return;

    // XRInputSourceArray is array-like but may not implement Array.prototype
    // methods in every runtime (Quest Browser included). Convert once.
    const sources = Array.from(session.inputSources);

    // System gesture: both hands pinched simultaneously toggles panels.
    const bothPinched =
      this.hands.length >= 2 && this.hands[0].isPinched() && this.hands[1].isPinched();
    if (bothPinched && !this.lastBothPinched && this.onSystemToggle) {
      this.onSystemToggle();
    }
    this.lastBothPinched = bothPinched;

    // Controller buttons: trigger for pointer actions, both grips for system toggle.
    // Match each controller to its XRInputSource by handedness because the
    // browser is free to order inputSources however it likes.
    const gripStates = [];
    for (const controller of this.controllers) {
      const source = this._findSourceForController(controller, sources);
      if (!source || !source.gamepad || !source.gamepad.buttons) {
        gripStates.push(false);
        continue;
      }

      const triggerPressed = !!source.gamepad.buttons[0]?.pressed;
      const gripPressed = !!source.gamepad.buttons[1]?.pressed;
      const wasTriggerPressed = this.controllerTriggerPressed.get(controller);

      if (triggerPressed && !wasTriggerPressed) {
        this._onPointerDown(controller);
      } else if (!triggerPressed && wasTriggerPressed) {
        this._onPointerUp(controller);
      }

      this.controllerTriggerPressed.set(controller, triggerPressed);
      this.controllerGripPressed.set(controller, gripPressed);
      gripStates.push(gripPressed);
    }

    // System gesture on controllers: both grips pressed together ( Quest has two
    // controllers). When only one controller is available, a single grip still
    // works as a fallback.
    const bothGrips = gripStates.length >= 2 && gripStates.every(Boolean);
    const singleGrip = gripStates.length === 1 && gripStates[0];
    if ((bothGrips || singleGrip) && !this._lastGripSystemToggle && this.onSystemToggle) {
      this.onSystemToggle();
    }
    this._lastGripSystemToggle = bothGrips || singleGrip;

    // Hand pinches.
    for (const hand of this.hands) {
      const pinched = hand.isPinched();
      const wasPinched = this.lastHandPinched.get(hand);

      if (bothPinched) {
        // Two-hand pinch is reserved for the system gesture; do not fire
        // per-hand selection while it is held.
        this.lastHandPinched.set(hand, pinched);
        continue;
      }

      // The hand holding the radial wheel toggles the menu on pinch.
      if (this.handWheelMenu && hand === this.handWheelMenu.hand) {
        if (pinched && !wasPinched) {
          this.handWheelMenu.toggle();
        }
        this.lastHandPinched.set(hand, pinched);
        continue;
      }

      if (pinched && !wasPinched) {
        this._onPointerDown(hand);
      } else if (!pinched && wasPinched && this.downPointer === hand) {
        this._onPointerUp(hand);
      }

      this.lastHandPinched.set(hand, pinched);
    }
  }

  _handlePinchStart(pointer) {
    // The hand holding the wheel uses pinch to open/close it; it does not fire
    // a normal selection.
    if (this.handWheelMenu && pointer === this.handWheelMenu.hand) {
      this.handWheelMenu.toggle();
      return;
    }

    this.activePointer = pointer;
    this._triggerSelect();
    this.activePointer = null;
  }

  _onPointerDown(pointer) {
    this.downPointer = pointer;

    const ray = pointer.getRay(new THREE.Ray());
    this.raycaster.ray.copy(ray);

    // Launcher ring takes precedence when visible.
    if (this.panelManager?.isLauncherVisible?.()) {
      const hit = this.panelManager.handleLauncherHit(this.raycaster);
      if (hit) return;
    }

    // Panels take precedence.
    for (const panel of this.panels) {
      const mode = panel.handlePointerDown(this.raycaster, pointer);
      if (mode) {
        this.capturedPanel = mode === 'drag' ? panel : null;
        this.capturedMode = mode;
        return;
      }
    }

    // Legacy HUD objects.
    for (const hud of this.hudObjects) {
      if (hud.handlePointerClick) {
        const consumed = hud.handlePointerClick(this.raycaster);
        if (consumed) return;
      }
    }

    // Scene selection fires on the down event.
    this.activePointer = pointer;
    this._triggerSelect();
    this.activePointer = null;
  }

  _onPointerUp(pointer) {
    if (this.capturedPanel) {
      const ray = pointer.getRay(new THREE.Ray());
      this.raycaster.ray.copy(ray);
      this.capturedPanel.handlePointerUp(this.raycaster, pointer);
      this.capturedPanel = null;
      this.capturedMode = null;
    }

    if (this.downPointer === pointer) {
      this.downPointer = null;
    }
  }

  /**
   * Match a ControllerPointer to the XRInputSource that represents it.
   * Falls back to index order among non-hand sources if handedness is unknown.
   */
  _findSourceForController(controller, sources) {
    if (controller.handedness && controller.handedness !== 'none') {
      const match = sources.find((s) => !s.hand && s.handedness === controller.handedness);
      if (match) return match;
    }
    const nonHand = sources.filter((s) => !s.hand);
    const idx = this.controllers.indexOf(controller);
    return nonHand[idx] ?? null;
  }

  /** Trigger selection on currently hovered object or HUD under active pointer. */
  _triggerSelect() {
    if (!this.activePointer) return;
    const ray = this.activePointer.getRay(new THREE.Ray());
    this.raycaster.ray.copy(ray);

    this.feedback.playSelect();
    this.feedback.flashPointer(this.activePointer);

    // HUD first.
    for (const hud of this.hudObjects) {
      if (hud.handlePointerClick) {
        const consumed = hud.handlePointerClick(this.raycaster);
        if (consumed) return;
      }
    }

    if (this.hovered?.onSelect) {
      this.hovered.onSelect(this.hovered.mesh, this.hovered.data);
    }

    if (this.onSelectCallback) {
      this.onSelectCallback(ray);
    }
  }

  _getBestPointerRay() {
    // If hand tracking is active, ignore controller rays entirely. Some
    // runtimes (Quest Browser) create placeholder controller input sources for
    // tracked hands, which would otherwise show a second, misaligned laser.
    const activeHand = this._getBestHand();
    if (activeHand) {
      return activeHand.getRay(new THREE.Ray());
    }

    // No hands: fall back to the first controller with a valid pose.
    for (const c of this.controllers) {
      const ray = c.getRay(new THREE.Ray());
      if (Number.isFinite(ray.origin.x) && ray.direction.lengthSq() > 0) {
        return ray;
      }
    }

    return null;
  }

  _getActivePointerObject() {
    const activeHand = this._getBestHand();
    if (activeHand) return activeHand;
    for (const c of this.controllers) {
      const ray = c.getRay(new THREE.Ray());
      if (ray.direction.lengthSq() > 0 && Number.isFinite(ray.origin.x)) return c;
    }
    return null;
  }

  _getBestHand() {
    // Prefer a hand with a usable pose (live or last-known). A transient frame
    // of missing joints should not force the pointer back to a controller
    // fallback that may have no real pose on Quest Browser.
    for (const hand of this.hands) {
      if (
        typeof hand.isPoseValid === 'function'
          ? hand.isPoseValid()
          : hand.jointsValid && hand.ray?.visible
      ) {
        const ray = hand.getRay(new THREE.Ray());
        if (ray.direction.lengthSq() > 0) return hand;
      }
    }
    return null;
  }

  _clearHover() {
    if (this.hovered?.onLeave) {
      this.hovered.onLeave(this.hovered.mesh);
    }
    this.hovered = null;
  }
}
