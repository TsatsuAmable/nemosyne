import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

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
];

/**
 * Wraps WebXR hand tracking and renders a hand mesh plus a pointing ray.
 * Detects pinch between thumb tip and index tip and emits 'nemosyne-pinchstart'
 * and 'nemosyne-pinchend' events.
 *
 * Robust joint lookup: some runtimes expose `XRHandPrimitive.joints` directly,
 * while others (Quest Browser) expose them on the connected event. We cache
 * whichever is available and validate before calling frame.getJointPose.
 */
export class HandPointer {
  constructor(renderer, index) {
    this.index = index;
    this.space = renderer.xr.getHand(index);

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

    this.pinched = false;
    this.pinchThreshold = 0.04; // meters (forgiving for Quest hand tracking)
    this.releaseThreshold = 0.065; // meters

    // Keep a reusable origin/direction for ray queries.
    this.rayOrigin = new THREE.Vector3();
    this.rayDirection = new THREE.Vector3();
    this.pinchDistance = Infinity;
    this.jointsValid = false;
    this.handedness = 'none';
    this._lastFrame = null;
    this._lastRefSpace = null;

    // Keep the last valid pose so transient tracking loss does not snap the
    // pointer back to the origin. The ray is updated from these values even
    // when a single frame is missing joints.
    this._lastValidOrigin = new THREE.Vector3();
    this._lastValidDirection = new THREE.Vector3(0, 0, -1);
    this._hasLastValidRay = false;

    // Callbacks avoid relying on three.js Object3D event dispatch, which in
    // some builds rejects custom events with read-only `target`.
    this.onPinchStart = null;
    this.onPinchEnd = null;

    // Event dispatch when pinch state changes.
    this._onConnected = (evt) => {
      this.handedness = evt.data?.handedness ?? 'none';

      // Runtimes expose joints in different shapes. Try all known sources in
      // order of preference, then convert to a plain lookup.
      const rawSpaceJoints = this.space.joints;
      const rawDataJoints = evt.data?.joints;
      const rawDataHand = evt.data?.hand;
      let normalized = null;

      if (rawSpaceJoints) normalized = this._normalizeJoints(rawSpaceJoints);
      if (!normalized && rawDataJoints) normalized = this._normalizeJoints(rawDataJoints);
      if (!normalized && rawDataHand) normalized = this._normalizeJoints(rawDataHand);

      this.joints = normalized;
      this.jointsValid = this._validateJoints();

      // Extra diagnostics for XRHand shape debugging.
      const dataHand = rawDataHand;
      let handGetSample = null;
      if (dataHand?.get) {
        try {
          handGetSample = dataHand.get('index-finger-tip');
        } catch (_) {
          // Ignore unsupported hand introspection.
        }
      }
      let handEntries = null;
      if (dataHand && typeof dataHand.entries === 'function') {
        try {
          handEntries = [...dataHand.entries()].slice(0, 5);
        } catch (_) {
          // Ignore unsupported hand introspection.
        }
      }

      // Keep this log minimal; it is useful the first time a hand connects.
      if (!this.jointsValid || this._debugFrame <= 1) {
        console.log(`[HandPointer ${this.index}] connected`, {
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
          console.log(`[HandPointer ${this.index}] fallback joint names valid=${this.jointsValid}`);
        }
      }
    };
    this._onDisconnected = () => {
      this.jointsValid = false;
      this.joints = null;
      this.ray.visible = false;
      console.log(`[HandPointer ${this.index}] disconnected`);
    };

    this.space.addEventListener('connected', this._onConnected);
    this.space.addEventListener('disconnected', this._onDisconnected);

    // Also try to grab joints synchronously in case they are already present.
    if (this.space.joints) {
      this.joints = this._normalizeJoints(this.space.joints);
      this.jointsValid = this._validateJoints();
    }

    this._debugFrame = 0;
  }

  /** Add ray line to scene (not to hand space so we can position it precisely). */
  mount(scene) {
    scene.add(this.ray);
  }

  update(frame, referenceSpace, session) {
    try {
      this._doUpdate(frame, referenceSpace, session);
    } catch (err) {
      // Isolate hand-tracking failures so one bad hand does not blank the app.
      console.error(`[HandPointer ${this.index}] update error:`, err);
      this.ray.visible = false;
    }
  }

  _doUpdate(frame, referenceSpace, session) {
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
              console.log(
                `[HandPointer ${this.index}] fallback from inputSource valid=${this.jointsValid} count=${Object.keys(this.joints).length} handedness=${this.handedness}`
              );
            }
          }
        }
      }

      if (!this.jointsValid) {
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
    const tipPos = tip.transform.position;
    const thumbPos = thumb.transform.position;
    const d = Math.sqrt(
      (tipPos.x - thumbPos.x) ** 2 + (tipPos.y - thumbPos.y) ** 2 + (tipPos.z - thumbPos.z) ** 2
    );
    this.pinchDistance = d;

    if (!this.pinched && d < this.pinchThreshold) {
      this.pinched = true;
      if (this.onPinchStart) this.onPinchStart(this);
    } else if (this.pinched && d > this.releaseThreshold) {
      this.pinched = false;
      if (this.onPinchEnd) this.onPinchEnd(this);
    }

    // Pointing ray: from index tip forward along the index metacarpal -> tip
    // direction. This is closer to the actual pointing vector than wrist -> tip
    // and avoids the ray drifting off to the side on Quest hand tracking.
    const origin = this.rayOrigin.set(tipPos.x, tipPos.y, tipPos.z);
    let dir;
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

    // Remember this valid pose for the next transient-loss frame.
    this._lastValidOrigin.copy(origin);
    this._lastValidDirection.copy(dir);
    this._hasLastValidRay = true;

    // Update world-space line; default 4 m, will be scaled by InputRouter on hit.
    this.setRayLength(4);
    this._updateRayGeometry();
    this.ray.visible = true;
  }

  _updateRayGeometry() {
    const origin = this.rayOrigin;
    const dir = this.rayDirection;
    const end = new THREE.Vector3().copy(origin).add(dir.clone().multiplyScalar(this.rayLength));
    const positions = this.ray.geometry.attributes.position.array;
    positions[0] = origin.x;
    positions[1] = origin.y;
    positions[2] = origin.z;
    positions[3] = end.x;
    positions[4] = end.y;
    positions[5] = end.z;
    this.ray.geometry.attributes.position.needsUpdate = true;
  }

  getRay(targetRay) {
    targetRay.origin.copy(this.rayOrigin);
    targetRay.direction.copy(this.rayDirection);
    return targetRay;
  }

  setRayLength(length) {
    this.rayLength = Math.max(0.3, length);
  }

  getWorldPosition(target) {
    return target.copy(this.rayOrigin);
  }

  /**
   * Return the hand's current world-space position and orientation.
   * Uses the wrist joint if available; otherwise falls back to the index
   * knuckle. Orientation is derived from the pointing ray.
   */
  getHandTransform(targetPosition, targetQuaternion) {
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

  isPinched() {
    return this.pinched;
  }

  /**
   * True if the hand has a usable ray this frame (live or from the last valid
   * pose). This lets InputRouter prefer hand tracking even when a single frame
   * of joint data is missing.
   */
  isPoseValid() {
    return this.jointsValid && this._hasLastValidRay && this.rayDirection.lengthSq() > 0;
  }

  getJointPose(name, frame, referenceSpace) {
    const joint = this.joints?.[name];
    if (!joint) return null;
    // XRJointSpace is only defined when the hand-tracking module is supported.
    // Avoid a ReferenceError in runtimes where the global is missing.
    if (typeof XRJointSpace !== 'undefined' && !(joint instanceof XRJointSpace)) return null;
    try {
      return frame.getJointPose(joint, referenceSpace);
    } catch (err) {
      // Transient joint-pose failures should not blank the hand laser.
      return null;
    }
  }

  _validateJoints() {
    if (!this.joints) return false;
    return ['index-finger-tip', 'thumb-tip'].every((name) => {
      const joint = this.joints[name];
      if (!joint) {
        console.log(`[HandPointer ${this.index}] missing joint '${name}'`);
        return false;
      }
      const isJointSpace = typeof XRJointSpace === 'undefined' || joint instanceof XRJointSpace;
      if (!isJointSpace) {
        console.log(`[HandPointer ${this.index}] joint '${name}' is not XRJointSpace`, joint);
      }
      return isJointSpace;
    });
  }

  /**
   * Convert the various runtime joint representations into a plain object.
   * - data.joints: plain { name: XRJointSpace }
   * - data.hand: XRHand Map-like with get(name) -> XRJointSpace
   */
  _extractJoints(data) {
    if (data?.joints) return this._normalizeJoints(data.joints);
    const hand = data?.hand;
    if (hand) {
      return this._normalizeJoints(hand);
    }
    return null;
  }

  /**
   * Normalize any joint collection into a plain { name: XRJointSpace } object.
   * Accepts a plain object, an XRHand Map-like, or an iterable of [name, space].
   */
  _normalizeJoints(raw) {
    if (!raw) return null;

    // Plain object already keyed by name.
    if (!raw.get && typeof raw === 'object') {
      const keys = Object.keys(raw);
      if (keys.length > 0) return raw;
    }

    // Map-like XRHand object.
    if (typeof raw.get === 'function') {
      const joints = {};
      let found = 0;
      for (const name of HAND_JOINT_NAMES) {
        try {
          const space = raw.get(name);
          if (space) {
            joints[name] = space;
            found++;
          }
        } catch (_) {
          // Ignore unsupported joint introspection.
        }
      }
      // Also try iterating entries if available (spec-compliant XRHand is iterable).
      if (found === 0 && typeof raw.entries === 'function') {
        try {
          for (const [name, space] of raw.entries()) {
            if (space) {
              joints[name] = space;
              found++;
            }
          }
        } catch (_) {
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
  _findJointNamesFromSpace(space) {
    for (const key of ['joints', 'handJoints', 'xrHand', '_joints']) {
      const raw = space[key];
      if (raw) {
        const normalized = this._normalizeJoints(raw);
        if (normalized) return normalized;
      }
    }
    return null;
  }

  _findHandSource(session) {
    const sources = Array.from(session.inputSources || []);
    if (this.handedness && this.handedness !== 'none') {
      return sources.find((s) => s.hand && s.handedness === this.handedness) || null;
    }
    const handSources = sources.filter((s) => s.hand);
    return handSources[this.index] ?? null;
  }

  get group() {
    return this.space;
  }
}
