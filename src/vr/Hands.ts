import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import type { PointerLike } from './coordinators/types.ts';

// WebXR hand-tracking joint names. We use this list to convert the XRHand
// Map-like object (inputSource.hand) into a plain joints lookup.
const HAND_JOINT_NAMES = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip',
] as const;

/** Connection event data shape emitted by three.js hand/controller spaces. */
interface XRConnectionEventData {
  handedness?: string;
  joints?: Record<string, XRJointSpace>;
  hand?: unknown;
}

/**
 * Wraps WebXR hand tracking and renders a hand mesh plus a pointing ray.
 * Detects pinch between thumb tip and index tip, updates `pinched` state for
 * per-frame polling, and calls `onPinchStart`/`onPinchEnd` fallback callbacks
 * (frame-gated). Pinch transitions are console-logged for on-device validation
 * traces (captured by logs/vr-remote-console.log).
 *
 * Robust joint lookup: some runtimes expose `XRHandPrimitive.joints` directly,
 * while others (Quest Browser) expose them on the connected event. We cache
 * whichever is available and validate before calling frame.getJointPose.
 */
export class HandPointer implements PointerLike {
  index: number;
  space: THREE.Group & { joints?: Record<string, XRJointSpace> };
  private factory?: XRHandModelFactory;
  ray: THREE.Line;

  pinched = false;
  pinchThreshold = 0.04; // meters (forgiving for Quest hand tracking)
  releaseThreshold = 0.065; // meters

  rayOrigin: THREE.Vector3;
  rayDirection: THREE.Vector3;
  pinchDistance = Infinity;
  jointsValid = false;
  handedness = 'none';
  private _lastFrame: XRFrame | null = null;
  private _lastRefSpace: XRReferenceSpace | null = null;

  // Keep the last valid pose so transient tracking loss does not snap the
  // pointer back to the origin. The ray is updated from these values even
  // when a single frame is missing joints.
  private _lastValidOrigin: THREE.Vector3;
  private _lastValidDirection: THREE.Vector3;
  private _hasLastValidRay = false;

  // Callbacks avoid relying on three.js Object3D event dispatch, which in
  // some builds rejects custom events with read-only `target`.
  onPinchStart: ((pointer: PointerLike) => void) | null = null;
  onPinchEnd: ((pointer: PointerLike) => void) | null = null;

  joints: Record<string, XRJointSpace> | null = null;
  private _debugFrame = 0;
  private _lastPinchCallbackFrame = -1;
  private _lastJointIssueMsg: string | null = null;
  private _noPoseStreak = 0;
  private _wrapperPosePosition = new THREE.Vector3();
  private _wrapperPose = {
    transform: { position: this._wrapperPosePosition, orientation: {} },
  };
  private static _sourceClaims = new WeakMap<object, HandPointer>();
  private _boundSource: (XRInputSource & { hand?: unknown }) | null = null;
  rayLength = 4;

  constructor(renderer: THREE.WebGLRenderer, index: number) {
    this.index = index;
    this.space = renderer.xr.getHand(index) as unknown as THREE.Group & {
      joints?: Record<string, XRJointSpace>;
    };

    // Hand mesh: 'spheres' is much cheaper than 'mesh' on Quest 3S and is
    // still plenty recognizable. Wrap factory creation so a hand-model load
    // failure cannot crash the whole app.
    try {
      this.factory = new XRHandModelFactory();
      const handModel = this.factory.createHandModel(this.space, 'spheres');
      this.space.add(handModel);
    } catch (factoryErr) {
      console.warn(`[HandPointer ${index}] hand model factory failed:`, factoryErr);
    }

    // Ray line rendered in world space.
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: 0xff00cc,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    this.ray = new THREE.Line(rayGeo, rayMat);
    this.ray.frustumCulled = false;

    this.rayOrigin = new THREE.Vector3();
    this.rayDirection = new THREE.Vector3();

    this._lastValidOrigin = new THREE.Vector3();
    this._lastValidDirection = new THREE.Vector3(0, 0, -1);

    // The three.js hand space emits WebXR events not declared in the
    // Object3DEventMap, so route through a plain EventTarget cast.
    const eventTarget = this.space as unknown as EventTarget;
    eventTarget.addEventListener('connected', this._onConnected);
    eventTarget.addEventListener('disconnected', this._onDisconnected);

    // Also try to grab joints synchronously in case they are already present.
    if (this.space.joints) {
      this.joints = this._normalizeJoints(this.space.joints);
      this.jointsValid = this._validateJoints();
    }
  }

  private _onConnected = (evt: Event) => {
    this._trackingLostAt = 0;
    const data = (evt as unknown as { data?: XRConnectionEventData }).data ?? {};
    this.handedness = data.handedness ?? 'none';

    // Runtimes expose joints in different shapes. Try all known sources in
    // order of preference, then convert to a plain lookup.
    const rawSpaceJoints = this.space.joints;
    const rawDataJoints = data.joints;
    const rawDataHand = data.hand;
    let normalized: Record<string, XRJointSpace> | null = null;

    if (rawSpaceJoints) normalized = this._normalizeJoints(rawSpaceJoints);
    if (!normalized && rawDataJoints) normalized = this._normalizeJoints(rawDataJoints);
    if (!normalized && rawDataHand) normalized = this._normalizeJoints(rawDataHand);

    this.joints = normalized;
    this.jointsValid = this._validateJoints();

    // Keep this log minimal; it is useful the first time a hand connects.
    if (!this.jointsValid || this._debugFrame <= 1) {
      console.warn(`[HandPointer ${this.index}] connected`, {
        handedness: this.handedness,
        jointsValid: this.jointsValid,
        jointCount: this.joints ? Object.keys(this.joints).length : 0,
      });
    }

    if (!this.jointsValid && this.space.joints) {
      // Last resort: if three.js cached a hand-space skeleton, try using the
      // internal joints property names we see in the wild.
      const alternativeNames = this._findJointNamesFromSpace(this.space);
      if (alternativeNames) {
        this.joints = alternativeNames;
        this.jointsValid = this._validateJoints();
        console.warn(`[HandPointer ${this.index}] fallback joint names valid=${this.jointsValid}`);
      }
    }
  };

  private _onDisconnected = () => {
    this._trackingLostAt = 0;
    this.jointsValid = false;
    this.joints = null;
    this.pinched = false;
    this.pinchDistance = Infinity;
    this.ray.visible = false;
    if (this._boundSource) {
      HandPointer._sourceClaims.delete(this._boundSource);
      this._boundSource = null;
    }
    console.warn(`[HandPointer ${this.index}] disconnected`);
  };

  dispose(): void {
    const eventTarget = this.space as unknown as EventTarget;
    try {
      eventTarget.removeEventListener('connected', this._onConnected);
      eventTarget.removeEventListener('disconnected', this._onDisconnected);
    } catch (_) {
      // Ignore if event target removal is unsupported.
    }
    this.ray.geometry?.dispose();
    if (Array.isArray(this.ray.material)) {
      this.ray.material.forEach((m) => m.dispose());
    } else {
      this.ray.material?.dispose();
    }
    if (this.ray.parent) {
      this.ray.parent.remove(this.ray);
    }
    this.onPinchStart = null;
    this.onPinchEnd = null;
  }

  /** Add ray line to scene (not to hand space so we can position it precisely). */
  mount(scene: THREE.Scene): void {
    scene.add(this.ray);
  }

  update(frame: XRFrame | null, referenceSpace: XRReferenceSpace | null, session: XRSession | null): void {
    try {
      this._doUpdate(frame, referenceSpace, session);
    } catch (err) {
      // Isolate hand-tracking failures so one bad hand does not blank the app.
      console.error(`[HandPointer ${this.index}] update error:`, err);
      this.ray.visible = false;
    }
  }

  _doUpdate(frame: XRFrame | null, referenceSpace: XRReferenceSpace | null, session: XRSession | null): void {
    this._lastFrame = frame;
    this._lastRefSpace = referenceSpace;
    this._debugFrame++;

    // If hand tracking is not available for this frame, keep the ray hidden.
    if (!this.jointsValid) {
      // Quest Browser often does not fire the 'connected' event on the hand
      // space. Fall back to scanning session.inputSources for the matching
      // hand input source and extracting its .hand joint map directly.
      if (session?.inputSources) {
        const source = this._findHandSource(session);
        if (source?.hand) {
          const normalized = this._normalizeJoints(source.hand);
          if (normalized) {
            this.joints = normalized;
            this.handedness = source.handedness ?? this.handedness;
            this.jointsValid = this._validateJoints();
            if (this.jointsValid) {
              console.warn(
                `[HandPointer ${this.index}] fallback from inputSource valid=${this.jointsValid} count=${Object.keys(this.joints).length} handedness=${this.handedness}`
              );
            }
          }
        }
      }

      if (!this.jointsValid) {
        if (this._debugFrame % 300 === 0) {
          const handSourceCount = session?.inputSources
            ? Array.from(session.inputSources).filter((s) => s.hand).length
            : -1;
          console.warn(
            `[HandPointer ${this.index}] waiting for joints: handedness=${this.handedness} session=${session ? 'yes' : 'no'} handSources=${handSourceCount} joints=${this.joints ? Object.keys(this.joints).length : 0}`
          );
        }
        this.ray.visible = false;
        this.pinchDistance = Infinity;
        return;
      }
    }

    const tip = this.getJointPose('index-finger-tip', frame, referenceSpace);
    const thumb = this.getJointPose('thumb-tip', frame, referenceSpace);
    const knuckle = this.getJointPose('index-finger-metacarpal', frame, referenceSpace);
    const wrist = this.getJointPose('wrist', frame, referenceSpace);

    if (!tip || !thumb) {
      this._noPoseStreak++;
      if (this._noPoseStreak === 150) {
        console.warn(
          `[HandPointer ${this.index}] joints valid but no pose for 150 frames (hand untracked or joint type rejected)`
        );
      }
      // Cannot detect pinch, but we can still keep the pointer anchored to the
      // last known pose so the laser does not snap back to the world origin
      // during transient tracking loss.
      if (this._hasLastValidRay) {
        this.rayOrigin.copy(this._lastValidOrigin);
        this.rayDirection.copy(this._lastValidDirection);
        this._updateRayGeometry();
      } else {
        this.ray.visible = false;
      }
      return;
    }

    // Pinch detection: compute distance even if wrist pose is missing so
    // pinch events are as reliable as possible.
    this._noPoseStreak = 0;
    const tipPos = tip.transform.position;
    const thumbPos = thumb.transform.position;
    const d = Math.sqrt(
      (tipPos.x - thumbPos.x) ** 2 + (tipPos.y - thumbPos.y) ** 2 + (tipPos.z - thumbPos.z) ** 2
    );
    this.pinchDistance = d;

    if (!this.pinched && d < this.pinchThreshold) {
      this.pinched = true;
      console.warn(
        `[HandPointer ${this.index}] pinch start d=${d.toFixed(3)} handedness=${this.handedness} frame=${this._debugFrame}`
      );
      if (this.onPinchStart && this._lastPinchCallbackFrame !== this._debugFrame) {
        this._lastPinchCallbackFrame = this._debugFrame;
        this.onPinchStart(this);
      } else if (this.onPinchStart) {
        console.warn(`[HandPointer ${this.index}] pinch start callback gated (same frame)`);
      }
    } else if (this.pinched && d > this.releaseThreshold) {
      this.pinched = false;
      console.warn(
        `[HandPointer ${this.index}] pinch end d=${d.toFixed(3)} frame=${this._debugFrame}`
      );
      if (this.onPinchEnd && this._lastPinchCallbackFrame !== this._debugFrame) {
        this._lastPinchCallbackFrame = this._debugFrame;
        this.onPinchEnd(this);
      }
    }

    // Pointing ray: from index tip forward along the index metacarpal -> tip
    // direction. This is closer to the actual pointing vector than wrist -> tip
    // and avoids the ray drifting off to the side on Quest hand tracking.
    const origin = this.rayOrigin.set(tipPos.x, tipPos.y, tipPos.z);
    let dir: THREE.Vector3;
    if (knuckle) {
      const knucklePos = new THREE.Vector3(
        knuckle.transform.position.x,
        knuckle.transform.position.y,
        knuckle.transform.position.z
      );
      dir = this.rayDirection.copy(origin).sub(knucklePos).normalize();
    } else if (wrist) {
      const wristPos = new THREE.Vector3(
        wrist.transform.position.x,
        wrist.transform.position.y,
        wrist.transform.position.z
      );
      dir = this.rayDirection.copy(origin).sub(wristPos).normalize();
    } else {
      // Last resort: use the hand space world matrix if available. Some test
      // mocks do not populate matrixWorld, so fall back to a neutral forward
      // direction instead of throwing.
      if (this.space?.matrixWorld?.elements) {
        dir = this.rayDirection.set(0, 0, -1).transformDirection(this.space.matrixWorld);
      } else {
        dir = this.rayDirection.set(0, 0, -1);
      }
    }

    // Guard against degenerate direction.
    if (!Number.isFinite(dir.x) || dir.lengthSq() === 0) {
      dir.set(0, 0, -1);
    }

    // Set ray origin directly to the index fingertip position
    this.rayOrigin.copy(origin);
    this.rayDirection.copy(dir);

    // Remember this valid pose for the next transient-loss frame.
    this._lastValidOrigin.copy(this.rayOrigin);
    this._lastValidDirection.copy(this.rayDirection);
    this._hasLastValidRay = true;

    // Update world-space line; default 4 m, will be scaled by InputRouter on hit.
    this.setRayLength(4);
    this._updateRayGeometry();
    this.ray.visible = true;
  }

  _updateRayGeometry(): void {
    const origin = this.rayOrigin;
    const dir = this.rayDirection;
    const end = new THREE.Vector3().copy(origin).add(dir.clone().multiplyScalar(this.rayLength));
    const positions = this.ray.geometry.attributes.position.array as Float32Array;
    positions[0] = origin.x;
    positions[1] = origin.y;
    positions[2] = origin.z;
    positions[3] = end.x;
    positions[4] = end.y;
    positions[5] = end.z;
    this.ray.geometry.attributes.position.needsUpdate = true;
  }

  getRay(targetRay: THREE.Ray): THREE.Ray {
    targetRay.origin.copy(this.rayOrigin);
    targetRay.direction.copy(this.rayDirection);
    return targetRay;
  }

  setRayLength(length: number): void {
    this.rayLength = Math.max(0.3, length);
  }

  getWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.rayOrigin);
  }

  /**
   * Return the hand's current world-space position and orientation.
   * Uses the wrist joint if available; otherwise falls back to the index
   * knuckle. Orientation is derived from the pointing ray.
   */
  getHandTransform(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion): THREE.Vector3 {
    targetPosition.copy(this.rayOrigin);

    // Try wrist joint for a more stable anchor than the fingertip.
    if (this.jointsValid && this.joints?.wrist && this._lastFrame && this._lastRefSpace) {
      const wrist = this.getJointPose('wrist', this._lastFrame, this._lastRefSpace);
      if (wrist) {
        targetPosition.set(
          wrist.transform.position.x,
          wrist.transform.position.y,
          wrist.transform.position.z
        );
      }
    }

    // Orientation from pointing ray.
    targetQuaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      this.rayDirection.lengthSq() > 0 ? this.rayDirection : new THREE.Vector3(0, 0, -1)
    );
    return targetPosition;
  }

  isPinched(): boolean {
    return this.pinched;
  }

  /**
   * True if the hand has a usable ray this frame (live or from the last valid
   * pose). This lets InputRouter prefer hand tracking even when a single frame
   * of joint data is missing.
   */
  isPoseValid(): boolean {
    return this.jointsValid && this._hasLastValidRay && this.rayDirection.lengthSq() > 0;
  }

  getJointPose(name: string, frame: XRFrame | null, referenceSpace: XRReferenceSpace | null): XRPose | null {
    const joint = this.joints?.[name];
    if (!joint || !frame || !referenceSpace) return null;
    const isNative = typeof XRJointSpace !== 'undefined' && joint instanceof XRJointSpace;
    if (isNative || typeof XRJointSpace === 'undefined') {
      try {
        const pose = frame.getJointPose?.(joint as XRJointSpace, referenceSpace);
        return pose ?? null;
      } catch (_err) {
        // Transient joint-pose failures should not blank the hand laser.
        return null;
      }
    }
    // three.js wrapper joint: derive a pose from its world matrix so hands
    // stay usable when only the wrapper path has live data.
    const wrapper = joint as unknown as { matrixWorld?: THREE.Matrix4 };
    if (wrapper?.matrixWorld) {
      this._wrapperPosePosition.setFromMatrixPosition(wrapper.matrixWorld);
      return this._wrapperPose as unknown as XRPose;
    }
    return null;
  }

  _validateJoints(): boolean {
    if (!this.joints) return false;
    const nativeRequired = typeof XRJointSpace !== 'undefined';
    return ['index-finger-tip', 'thumb-tip'].every((name) => {
      const joint = this.joints?.[name];
      if (!joint) {
        this._logJointIssueOnce(`missing joint '${name}'`);
        return false;
      }
      // three.js populates space.joints with THREE.Group wrappers. They are
      // not valid XRJointSpace inputs for frame.getJointPose(), so treating
      // them as valid would permanently block the native inputSource fallback
      // and kill all pose queries. Reject them and let the fallback engage.
      if (nativeRequired && !(joint instanceof XRJointSpace)) {
        this._logJointIssueOnce(
          `joint '${name}' is a non-native wrapper; falling back to inputSource joints`
        );
        return false;
      }
      return true;
    });
  }

  private _logJointIssueOnce(message: string): void {
    if (this._lastJointIssueMsg === message) return;
    this._lastJointIssueMsg = message;
    console.warn(`[HandPointer ${this.index}] ${message}`);
  }

  /**
   * Convert the various runtime joint representations into a plain object.
   * - data.joints: plain { name: XRJointSpace }
   * - data.hand: XRHand Map-like with get(name) -> XRJointSpace
   */
  _extractJoints(data: unknown): Record<string, XRJointSpace> | null {
    const d = data as { joints?: Record<string, XRJointSpace>; hand?: unknown };
    if (d?.joints) return this._normalizeJoints(d.joints);
    if (d?.hand) {
      return this._normalizeJoints(d.hand);
    }
    return null;
  }

  /**
   * Normalize any joint collection into a plain { name: XRJointSpace } object.
   * Accepts a plain object, an XRHand Map-like, or an iterable of [name, space].
   */
  _normalizeJoints(raw: unknown): Record<string, XRJointSpace> | null {
    if (!raw) return null;

    // Plain object already keyed by name.
    if (typeof raw === 'object' && !(raw as { get?: unknown }).get) {
      const obj = raw as Record<string, XRJointSpace>;
      const keys = Object.keys(obj);
      if (keys.length > 0) return obj;
    }

    // Map-like XRHand object.
    const mapLike = raw as {
      get?: (name: string) => XRJointSpace | undefined;
      entries?: () => Iterable<[string, XRJointSpace]>;
    };
    if (typeof mapLike.get === 'function') {
      const joints: Record<string, XRJointSpace> = {};
      let found = 0;
      for (const name of HAND_JOINT_NAMES) {
        try {
          const space = mapLike.get(name);
          if (space) {
            joints[name] = space;
            found++;
          }
        } catch (_err) {
          // Ignore unsupported joint introspection.
        }
      }
      // Also try iterating entries if available (spec-compliant XRHand is iterable).
      if (found === 0 && typeof mapLike.entries === 'function') {
        try {
          for (const [name, space] of mapLike.entries()) {
            if (space) {
              joints[name] = space;
              found++;
            }
          }
        } catch (_err) {
          // Ignore unsupported hand iteration.
        }
      }
      return found > 0 ? joints : null;
    }

    return null;
  }

  /**
   * Last-resort discovery of joint names on the three.js hand space itself.
   * Some Quest Browser builds attach joint spaces under different property
   * names than `joints`.
   */
  _findJointNamesFromSpace(space: THREE.Group): Record<string, XRJointSpace> | null {
    const s = space as unknown as Record<string, unknown>;
    for (const key of ['joints', 'handJoints', 'xrHand', '_joints']) {
      const raw = s[key];
      if (raw) {
        const normalized = this._normalizeJoints(raw);
        if (normalized) return normalized;
      }
    }
    return null;
  }

  _findHandSource(session: XRSession): (XRInputSource & { hand?: unknown }) | null {
    const sources = Array.from(session.inputSources || []);
    const handSources = sources.filter((s) => s.hand);

    // Stay bound to the input source we already claimed while it exists, so
    // a flapping handedness value or reconnect ordering cannot make two
    // HandPointers track the same physical hand.
    if (this._boundSource && handSources.includes(this._boundSource)) {
      return this._boundSource;
    }
    if (this._boundSource) {
      HandPointer._sourceClaims.delete(this._boundSource);
      this._boundSource = null;
    }

    const unclaimed = handSources.filter((s) => {
      const claimant = HandPointer._sourceClaims.get(s as object);
      return !claimant || claimant === this;
    });

    let bound: (XRInputSource & { hand?: unknown }) | null = null;
    if (this.handedness && this.handedness !== 'none') {
      bound = unclaimed.find((s) => s.handedness === this.handedness) ?? null;
    }
    if (!bound) {
      bound = unclaimed[this.index] ?? null;
    }
    if (bound) {
      this._boundSource = bound;
      HandPointer._sourceClaims.set(bound, this);
    }
    return bound;
  }

  get group(): THREE.Group {
    return this.space;
  }
}
