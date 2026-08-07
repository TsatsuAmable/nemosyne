/**
 * Recognizes Meta Quest controller equivalents of the hand-gesture vocabulary.
 *
 * The Quest controller has triggers (index), grips (middle), A/B/Y/X buttons,
 * and two thumbsticks. This mapper translates simple controller actions into
 * the same gesture names produced by `HandGestureRecognizer`, so the rest of the
 * application does not need to know whether the input came from hands or
 * controllers.
 *
 * Detected controller gestures:
 *   - Thumbstick flick right/left → swipeRight / swipeLeft
 *   - Thumbstick flick up/down    → sliceUp / sliceDown
 *   - A button                    → rotateCCW (undo)
 *   - B button                    → rotateCW (redo)
 *   - Y button                    → okSign (settings panel)
 *   - Both triggers + controllers moving together/apart → pinchTogether / pinchApart
 *   - Both triggers + controllers moving up/down        → scoopUp / scoopDown
 *   - Both triggers + controllers pushed forward        → pushForward
 *   - Both grips pressed together                       → bothPinched (system toggle)
 *
 * The mapper is intentionally conservative: it uses cooldowns and requires
 * clear controller motion so resting poses do not spam commands.
 */

import * as THREE from 'three';
import type { ControllerGestureMapperLike, PointerLike } from '../coordinators/types.ts';

interface ControllerPointerWithEngine extends PointerLike {
  engine?: {
    renderer?: {
      xr?: {
        getSession?: () => XRSession | null;
      };
    };
  };
}

interface ButtonState {
  primary: boolean;
  secondary: boolean;
}

interface StickRest {
  x: number;
  y: number;
}

export class ControllerGestureMapper implements ControllerGestureMapperLike {
  onGesture: (name: string, detail: Record<string, unknown>) => void;
  cooldown: number;
  flickThreshold: number;

  private _lastGestureTime = 0;

  // Previous controller poses for motion-based two-hand gestures.
  private _prevPositions = new Map<PointerLike, THREE.Vector3>();
  private _bothTriggersPrev = false;

  // Thumbstick state for flick detection.
  private _stickRest = new Map<PointerLike, StickRest>();
  private _stickFired = new Map<PointerLike, boolean>();

  // Button state.
  private _buttonPrev = new Map<PointerLike, ButtonState>();

  private _tempVec = new THREE.Vector3();

  constructor({
    onGesture = () => {},
    cooldown = 0.65,
    flickThreshold = 0.65,
  }: {
    onGesture?: (name: string, detail: Record<string, unknown>) => void;
    cooldown?: number;
    flickThreshold?: number;
  } = {}) {
    this.onGesture = onGesture;
    this.cooldown = cooldown;
    this.flickThreshold = flickThreshold;
  }

  update(controllers: PointerLike[], session: XRSession | null, time: number) {
    if (controllers.length === 0) return;

    const fallback = controllers[0] as unknown as ControllerPointerWithEngine;
    const activeSession = session ?? fallback.engine?.renderer?.xr?.getSession?.();
    if (!activeSession || !activeSession.inputSources) return;

    const sources = Array.from(activeSession.inputSources);
    const rightController =
      controllers.find((c) => c.handedness === 'right') ?? controllers[0];
    const leftController =
      controllers.find((c) => c.handedness === 'left') ?? controllers[1] ?? rightController;

    const rightSource = this._findSource(rightController, sources);
    const leftSource = this._findSource(leftController, sources);

    if (rightSource) this._updateThumbstick(rightController, rightSource, time);
    if (rightSource) this._updateButtons(rightController, rightSource, time);

    if (rightSource && leftSource) {
      this._updateTwoHandMotion(
        rightController,
        leftController,
        rightSource,
        leftSource,
        time
      );
    }

    // Update previous pose snapshots for motion-based gestures.
    for (const controller of controllers) {
      const ray = new THREE.Ray();
      controller.getRay(ray);
      if (!this._prevPositions.has(controller)) {
        this._prevPositions.set(controller, ray.origin.clone());
      } else {
        this._prevPositions.get(controller)!.copy(ray.origin);
      }
    }
  }

  private _canFire(time: number) {
    if (time - this._lastGestureTime < this.cooldown) return false;
    return true;
  }

  private _fire(gesture: string, time: number, detail: Record<string, unknown> = {}) {
    if (!this._canFire(time)) return;
    this._lastGestureTime = time;
    this.onGesture(gesture, { source: 'controller', ...detail });
  }

  private _findSource(controller: PointerLike, sources: XRInputSource[]) {
    return sources.find(
      (s) => s.handedness === controller.handedness && !!s.gamepad
    );
  }

  private _updateButtons(controller: PointerLike, source: XRInputSource, time: number) {
    const buttons = source.gamepad!.buttons;
    const isRight = controller.handedness === 'right';

    // Standard Quest controller face-button layout: lower button is A/X,
    // upper button is B/Y. Menu is only on the left controller and is ignored
    // here to avoid collisions with system gestures.
    const primaryPressed = !!buttons[3]?.pressed;
    const secondaryPressed = !!buttons[4]?.pressed;

    const prev = this._buttonPrev.get(controller) ?? { primary: false, secondary: false };

    if (isRight) {
      if (primaryPressed && !prev.primary) this._fire('rotateCCW', time, { button: 'A' });
      if (secondaryPressed && !prev.secondary) this._fire('rotateCW', time, { button: 'B' });
    } else {
      if (secondaryPressed && !prev.secondary) this._fire('okSign', time, { button: 'Y' });
    }

    this._buttonPrev.set(controller, {
      primary: primaryPressed,
      secondary: secondaryPressed,
    });
  }

  private _updateThumbstick(controller: PointerLike, source: XRInputSource, time: number) {
    const axes = source.gamepad!.axes;
    if (!axes || axes.length < 2) return;

    // WebXR gamepad mappings differ between browsers. The right thumbstick is
    // usually axes[2]/axes[3]; fall back to axes[0]/axes[1] if only two axes.
    const x = axes.length >= 4 ? axes[2] : (axes[0] ?? 0);
    const y = axes.length >= 4 ? axes[3] : (axes[1] ?? 0);

    if (!this._stickRest.has(controller)) {
      this._stickRest.set(controller, { x, y });
      this._stickFired.set(controller, false);
      return;
    }

    const rest = this._stickRest.get(controller)!;
    const dx = x - rest.x;
    const dy = y - rest.y;
    const fired = this._stickFired.get(controller)!;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!fired && Math.max(absX, absY) > this.flickThreshold) {
      if (absX > absY * 1.2) {
        this._fire(dx > 0 ? 'swipeRight' : 'swipeLeft', time, { stick: 'right', axis: 'x' });
      } else if (absY > absX * 1.2) {
        this._fire(dy > 0 ? 'sliceUp' : 'sliceDown', time, { stick: 'right', axis: 'y' });
      }
      this._stickFired.set(controller, true);
    }

    if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15 && fired) {
      // Stick returned to center; reset for next flick.
      this._stickRest.set(controller, { x, y });
      this._stickFired.set(controller, false);
    }
  }

  private _updateTwoHandMotion(
    rightController: PointerLike,
    leftController: PointerLike,
    rightSource: XRInputSource,
    leftSource: XRInputSource,
    time: number
  ) {
    const rightButtons = rightSource.gamepad!.buttons;
    const leftButtons = leftSource.gamepad!.buttons;

    const rightTrigger = !!rightButtons[0]?.pressed;
    const leftTrigger = !!leftButtons[0]?.pressed;

    const bothTriggers = rightTrigger && leftTrigger;

    if (!bothTriggers) {
      this._bothTriggersPrev = false;
      return;
    }

    const rightRay = new THREE.Ray();
    const leftRay = new THREE.Ray();
    rightController.getRay(rightRay);
    leftController.getRay(leftRay);

    const prevRight = this._prevPositions.get(rightController);
    const prevLeft = this._prevPositions.get(leftController);
    if (!prevRight || !prevLeft) {
      this._bothTriggersPrev = true;
      return;
    }

    const dNow = rightRay.origin.distanceTo(leftRay.origin);
    const dPrev = prevRight.distanceTo(prevLeft);
    const delta = dNow - dPrev;

    if (!this._bothTriggersPrev) {
      this._bothTriggersPrev = true;
      return;
    }

    const moveThreshold = 0.08;
    if (Math.abs(delta) > moveThreshold) {
      this._fire(delta < 0 ? 'pinchTogether' : 'pinchApart', time, {
        input: 'both-triggers',
        delta,
      });
      return;
    }

    const dyR = rightRay.origin.y - prevRight.y;
    const dyL = leftRay.origin.y - prevLeft.y;
    if (dyR > moveThreshold && dyL > moveThreshold) {
      this._fire('scoopUp', time, { input: 'both-triggers' });
      return;
    }
    if (dyR < -moveThreshold && dyL < -moveThreshold) {
      this._fire('scoopDown', time, { input: 'both-triggers' });
      return;
    }

    const dzR = rightRay.origin.z - prevRight.z;
    const dzL = leftRay.origin.z - prevLeft.z;
    if (dzR < -moveThreshold && dzL < -moveThreshold) {
      this._fire('pushForward', time, { input: 'both-triggers' });
      return;
    }
  }
}
