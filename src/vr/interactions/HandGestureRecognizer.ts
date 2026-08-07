/**
 * Dual-hand gesture recognizer for Nemosyne analysis commands.
 *
 * Reads poses from two HandPointer instances each frame and maps simple
 * movement + pinch patterns to analysis intents. Detection is deliberately
 * conservative: each gesture has a cooldown and requires a clear displacement
 * or pose so accidental hand motion does not spam commands.
 *
 * Gesture vocabulary:
 *   - pinchTogether      : both hands pinched and moving toward each other
 *   - pinchApart         : both hands pinched and moving apart
 *   - swipeRight / swipeLeft : dominant open palm swipes horizontally
 *   - sliceDown / sliceUp: dominant open palm slices vertically
 *   - scoopUp            : both palms up, rising together
 *   - scoopDown          : both palms down, lowering together
 *   - pushForward        : both palms forward, pushing away
 *   - rotateCW / rotateCCW: cupped hands twisting opposite directions
 *   - okSign             : dominant pinch held while non-dominant is open
 *   - bothPinched        : both hands pinched simultaneously (system toggle)
 */

import * as THREE from 'three';
import type { GestureContext, HandLike } from '../coordinators/types.ts';

interface HandPose {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  pinched: boolean;
  valid: boolean;
}

interface HandGestureRecognizerOptions {
  onGesture?: (name: string, ctx: GestureContext) => void;
  cooldown?: number;
  moveThreshold?: number;
  pinchThreshold?: number;
  releaseThreshold?: number;
  palmDotThreshold?: number;
}

export class HandGestureRecognizer {
  onGesture: (name: string, ctx: GestureContext) => void;
  cooldown: number;
  moveThreshold: number;
  pinchThreshold: number;
  releaseThreshold: number;
  palmDotThreshold: number;

  hands: HandLike[] = [];
  dominantHandIndex = 0;
  nonDominantHandIndex = 1;

  private _prev: {
    leftPos: THREE.Vector3;
    rightPos: THREE.Vector3;
    leftDir: THREE.Vector3;
    rightDir: THREE.Vector3;
    leftPinched: boolean;
    rightPinched: boolean;
    time: number;
  };
  private _initialized = false;

  private _lastGestureTime = 0;
  private _lastGestureName: string | null = null;

  // Track sustained both-pinched-close pose for pause/resume input.
  private _bothPinchedCloseStart: number | null = null;
  private _pauseResumeFired = false;
  private _pauseHoldThreshold = 0.8;
  private _pauseCloseDistance = 0.25;

  private _tempA = new THREE.Vector3();
  private _tempB = new THREE.Vector3();

  // Expose which hand is dominant for callers that need to follow it.
  dominant?: HandPose;
  nonDominant?: HandPose;

  constructor({
    onGesture = () => {},
    cooldown = 0.65,
    moveThreshold = 0.12,
    pinchThreshold = 0.045,
    releaseThreshold = 0.07,
    palmDotThreshold = 0.55,
  }: HandGestureRecognizerOptions = {}) {
    this.onGesture = onGesture;
    this.cooldown = cooldown;
    this.moveThreshold = moveThreshold;
    this.pinchThreshold = pinchThreshold;
    this.releaseThreshold = releaseThreshold;
    this.palmDotThreshold = palmDotThreshold;

    this._prev = {
      leftPos: new THREE.Vector3(),
      rightPos: new THREE.Vector3(),
      leftDir: new THREE.Vector3(),
      rightDir: new THREE.Vector3(),
      leftPinched: false,
      rightPinched: false,
      time: 0,
    };
  }

  setHands(hands: HandLike[] | null | undefined) {
    this.hands = (hands || []).filter((h): h is HandLike => !!h);
    // Default dominant = right (index 1 if tracked), fallback to first valid.
    const right = this.hands.find((h) => h.handedness === 'right');
    const left = this.hands.find((h) => h.handedness === 'left');
    this.dominantHandIndex = right ? this.hands.indexOf(right) : 0;
    this.nonDominantHandIndex = left
      ? this.hands.indexOf(left)
      : this.hands.length > 1
        ? 1
        : 0;
  }

  setDominantHand(handedness: string) {
    const idx = this.hands.findIndex((h) => h.handedness === handedness);
    if (idx < 0) return;
    this.dominantHandIndex = idx;
    this.nonDominantHandIndex = this.hands.findIndex((h) => h.handedness !== handedness);
    if (this.nonDominantHandIndex < 0)
      this.nonDominantHandIndex = (idx + 1) % this.hands.length;
  }

  update(delta: number, time: number) {
    if (this.hands.length < 1) return;

    const poses = this.hands.map((h) => this._readHand(h));
    const valid = poses.every((p) => p.valid);
    if (!valid) {
      this._initialized = false;
      return;
    }

    const left = poses[0];
    const right = poses[1] || left;

    if (!this._initialized) {
      this._prev.leftPos.copy(left.position);
      this._prev.rightPos.copy(right.position);
      this._prev.leftDir.copy(left.direction);
      this._prev.rightDir.copy(right.direction);
      this._prev.leftPinched = left.pinched;
      this._prev.rightPinched = right.pinched;
      this._prev.time = time;
      this._initialized = true;
      return;
    }

    const dt = time - this._prev.time;
    if (dt <= 0) return;

    const gesture = this._classify(
      left,
      right,
      this._prev.leftPos,
      this._prev.rightPos,
      this._prev.leftDir,
      this._prev.rightDir,
      dt
    );

    // Detect a sustained both-pinched-close pose for pause/resume input.
    const bothPinchedClose =
      left.pinched &&
      right.pinched &&
      left.position.distanceTo(right.position) < this._pauseCloseDistance;
    if (bothPinchedClose && this._bothPinchedCloseStart == null) {
      this._bothPinchedCloseStart = time;
      this._pauseResumeFired = false;
    } else if (!bothPinchedClose) {
      this._bothPinchedCloseStart = null;
      this._pauseResumeFired = false;
    }
    if (
      bothPinchedClose &&
      !this._pauseResumeFired &&
      this._bothPinchedCloseStart != null &&
      time - this._bothPinchedCloseStart >= this._pauseHoldThreshold &&
      this._canFire('pauseResume', time)
    ) {
      this._pauseResumeFired = true;
      this._lastGestureTime = time;
      this._lastGestureName = 'pauseResume';
      this.onGesture('pauseResume', {
        dominant: left,
        nonDominant: right,
        hands: poses,
        openHands: false,
      });
    }

    if (gesture && this._canFire(gesture, time)) {
      this._lastGestureTime = time;
      this._lastGestureName = gesture;
      this.onGesture(gesture, {
        dominant: left,
        nonDominant: right,
        hands: poses,
        openHands: !left.pinched && !right.pinched,
      });
    }

    this._prev.leftPos.copy(left.position);
    this._prev.rightPos.copy(right.position);
    this._prev.leftDir.copy(left.direction);
    this._prev.rightDir.copy(right.direction);
    this._prev.leftPinched = left.pinched;
    this._prev.rightPinched = right.pinched;
    this._prev.time = time;

    // Expose which hand is dominant for callers that need to follow it.
    this.dominant = left;
    this.nonDominant = right;
  }

  private _canFire(gesture: string, time: number) {
    if (time - this._lastGestureTime < this.cooldown) return false;
    return true;
  }

  private _readHand(hand: HandLike): HandPose {
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    let valid = false;

    if (hand.getHandTransform) {
      const q = new THREE.Quaternion();
      hand.getHandTransform(pos, q);
      dir.set(0, 0, -1).applyQuaternion(q);
      valid = Number.isFinite(pos.x) && dir.lengthSq() > 0;
    } else if (hand.rayOrigin && hand.rayDirection) {
      pos.copy(hand.rayOrigin as unknown as THREE.Vector3);
      dir.copy(hand.rayDirection as unknown as THREE.Vector3);
      valid = Number.isFinite(pos.x) && dir.lengthSq() > 0;
    }

    const pinched = hand.isPinched?.() ?? hand.pinched ?? false;
    return {
      position: pos,
      direction: dir.normalize(),
      pinched: valid && !!pinched,
      valid,
    };
  }

  private _classify(
    l: HandPose,
    r: HandPose,
    prevL: THREE.Vector3,
    prevR: THREE.Vector3,
    prevLDir: THREE.Vector3,
    prevRDir: THREE.Vector3,
    dt: number
  ): string | null {
    const bothPinchedNow = l.pinched && r.pinched;
    const bothPinchedBefore = this._prev.leftPinched && this._prev.rightPinched;

    // System gesture: both hands pinch at the same moment.
    if (bothPinchedNow && !bothPinchedBefore) {
      return 'bothPinched';
    }

    // Two-hand pinch together / apart.
    if (bothPinchedNow) {
      const dNow = l.position.distanceTo(r.position);
      const dPrev = prevL.distanceTo(prevR);
      const delta = dNow - dPrev;
      if (Math.abs(delta) > this.moveThreshold && delta < 0) return 'pinchTogether';
      if (Math.abs(delta) > this.moveThreshold && delta > 0) return 'pinchApart';
    }

    // Two-hand shared-pose gestures must be checked before single-hand swipes
    // so that motions performed by both hands (e.g., lifting two palms up) are
    // not misread as a dominant-hand slice.

    // Two-hand scoop up: both palms facing up and rising together.
    if (
      l.direction.y > this.palmDotThreshold &&
      r.direction.y > this.palmDotThreshold
    ) {
      const dyL = l.position.y - prevL.y;
      const dyR = r.position.y - prevR.y;
      if (dyL > 0 && dyR > 0 && Math.min(dyL, dyR) > this.moveThreshold * 0.15) {
        return 'scoopUp';
      }
    }

    // Two-hand scoop down: both palms facing down and lowering together.
    if (
      l.direction.y < -this.palmDotThreshold &&
      r.direction.y < -this.palmDotThreshold
    ) {
      const dyL = l.position.y - prevL.y;
      const dyR = r.position.y - prevR.y;
      if (dyL < 0 && dyR < 0 && Math.min(-dyL, -dyR) > this.moveThreshold * 0.15) {
        return 'scoopDown';
      }
    }

    // Two-hand push forward: both palms facing forward and moving forward.
    if (
      l.direction.z < -this.palmDotThreshold &&
      r.direction.z < -this.palmDotThreshold
    ) {
      const dzL = l.position.z - prevL.z;
      const dzR = r.position.z - prevR.z;
      if (dzL < -this.moveThreshold * 0.5 && dzR < -this.moveThreshold * 0.5) {
        return 'pushForward';
      }
    }

    // Two-hand rotate: cupped palms facing each other, opposite twist.
    if (this._palmsFaceEachOther(l, r) && this._oppositeTwist(l, r, prevLDir, prevRDir)) {
      const twist = this._twistAngle(l, r, prevLDir, prevRDir, dt);
      if (twist > 0.15) return 'rotateCW';
      if (twist < -0.15) return 'rotateCCW';
    }

    // Dominant open-hand swipe / slice.
    if (!l.pinched && !r.pinched) {
      const dx = l.position.x - prevL.x;
      const dy = l.position.y - prevL.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx > this.moveThreshold && adx > ady * 1.5) {
        return dx > 0 ? 'swipeRight' : 'swipeLeft';
      }
      if (ady > this.moveThreshold && ady > adx * 1.5) {
        return dy > 0 ? 'sliceUp' : 'sliceDown';
      }
    }

    // Dominant OK sign: pinch while non-dominant is open and not pinching.
    if (l.pinched && !r.pinched) {
      // Require a short hold to distinguish from a selection pinch.
      if (bothPinchedBefore || this._lastGestureName === 'okSign') return null;
      return 'okSign';
    }

    return null;
  }

  private _palmsFaceEachOther(l: HandPose, r: HandPose) {
    // In three.js camera space the dominant hand is typically on the user's
    // right (negative X from world origin). Palms face each other when the
    // right hand points left-ish and the left hand points right-ish.
    const toOther = this._tempA.subVectors(r.position, l.position).normalize();
    const lFacing = l.direction.dot(toOther) > this.palmDotThreshold;
    const rFacing = r.direction.dot(toOther.clone().negate()) > this.palmDotThreshold;
    return lFacing && rFacing;
  }

  private _oppositeTwist(
    l: HandPose,
    r: HandPose,
    prevLDir: THREE.Vector3,
    prevRDir: THREE.Vector3
  ) {
    const lYaw = Math.atan2(l.direction.x, l.direction.z);
    const rYaw = Math.atan2(r.direction.x, r.direction.z);
    const pLYaw = Math.atan2(prevLDir.x, prevLDir.z);
    const pRYaw = Math.atan2(prevRDir.x, prevRDir.z);
    const dl = this._angleDelta(lYaw, pLYaw);
    const dr = this._angleDelta(rYaw, pRYaw);
    // Require hands to twist in opposite directions.
    return dl * dr < -0.001;
  }

  private _twistAngle(
    l: HandPose,
    r: HandPose,
    prevLDir: THREE.Vector3,
    prevRDir: THREE.Vector3,
    dt: number
  ) {
    const lYaw = Math.atan2(l.direction.x, l.direction.z);
    const rYaw = Math.atan2(r.direction.x, r.direction.z);
    const pLYaw = Math.atan2(prevLDir.x, prevLDir.z);
    const pRYaw = Math.atan2(prevRDir.x, prevRDir.z);
    const dl = this._angleDelta(lYaw, pLYaw);
    const dr = this._angleDelta(rYaw, pRYaw);
    return (dl - dr) / Math.max(0.001, dt);
  }

  private _angleDelta(a: number, b: number) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /** Expose the last recognized gesture for debug UI. */
  get lastGesture(): string | null {
    return this._lastGestureName;
  }
}
