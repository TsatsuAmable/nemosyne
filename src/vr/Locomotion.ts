import * as THREE from 'three';
import type { EngineLike, HandLike } from './coordinators/types.ts';

/**
 * VR locomotion for the Nemosyne suite with optional teleport anchors and
 * 3D flight mode.
 *
 * Controller mode:
 * - Left thumbstick  : forward/back + strafe relative to headset yaw
 * - Right thumbstick : snap turn left/right, or (when teleport mode is armed)
 *                      aim and release to teleport, or (when flight mode is
 *                      armed) move vertically up/down
 *
 * Hand-tracking mode:
 * - Pinch and drag to pull/push yourself through space (world-grab locomotion).
 * - Flight mode: `scoopUp` / `scoopDown` gestures ascend/descend.
 *
 * Flight mode (toggle via wheel menu):
 * - Enables full 3D translation (X, Y, Z) with the controllers and vertical
 *   hand gestures.
 * - Use "Drop to Floor" to quickly return to ground level.
 *
 * Teleport mode (toggle via wheel menu or keyboard `T`):
 * - A parabolic arc previews the landing point on the floor.
 * - Release the right thumbstick trigger / click to teleport.
 * - Named anchors (overview, detail, north, south) can be selected directly.
 *
 * Desktop fallback:
 * - WASD : move
 * - Q/E  : snap turn
 * - T    : toggle teleport aim mode
 */
export class Locomotion {
  engine: EngineLike;
  camera: THREE.Camera;
  cameraGroup: THREE.Group;
  scene: THREE.Scene;

  moveSpeed = 2.0; // meters per second
  verticalSpeed = 1.5; // meters per second (flight mode)
  flightSpeed = 2.0; // horizontal flight speed
  snapAngle = Math.PI / 6; // 30 degrees
  deadZone = 0.15;

  snapTurnEnabled = true;
  reducedMotion = false;
  seatedHeightOffset = 0;

  flightMode = false;

  tempVec = new THREE.Vector3();
  tempVec2 = new THREE.Vector3();
  tempQuat = new THREE.Quaternion();
  tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Transient comfort vignette (reduced-motion mode only). Fades a peripheral
  // vignette in while the user is translating/turning/teleporting and back out
  // once they are still, instead of relying on a static always-on vignette. When
  // `reducedMotion` is false this is inert so the ComfortSettingsController's
  // static `vignette` toggle remains the sole owner of the vignette state.
  _vignetteOpacity = 0;
  _vignetteStartPos = new THREE.Vector3();
  _vignetteStartYaw = 0;

  turnCooldown = 0;
  turnCooldownDuration = 0.35;

  // Hand-grab state
  grabHand: HandLike | null = null;
  grabAnchor = new THREE.Vector3();
  handPosition = new THREE.Vector3();

  // Teleport state
  teleportMode = false;
  teleportActive = false;
  teleportTarget = new THREE.Vector3();
  teleportValid = false;
  _teleportArcMesh: THREE.Line | null = null;
  _teleportTargetMesh: THREE.Mesh | null = null;
  _teleportDiscs = new THREE.Group();

  teleportGravity = 9.8;
  teleportMaxDistance = 12.0;
  teleportStep = 0.04;
  teleportArcSegments = 64;
  teleportFloorY = 0.0;

  // Named anchors (name -> { position, yaw, label }).
  anchors = new Map<string, { position: THREE.Vector3; yaw: number; label: string }>();
  _anchorMeshes: THREE.Mesh[] = [];

  _floorPlane: THREE.Plane;

  // Keyboard state
  keys = new Set<string>();
  _keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  _keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  _lastPreviewWasThumbstick = false;

  constructor(engine: EngineLike) {
    this.engine = engine;
    this.camera = engine.camera!;
    this.cameraGroup = engine.cameraGroup;
    this.scene = engine.scene as THREE.Scene;

    this._floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.teleportFloorY);

    this._setupKeyboard();
    this._buildTeleportArc();
    this._buildTargetMarker();
  }

  /**
   * Register a named viewpoint anchor. The optional yaw rotates the user to face
   * the anchor's forward direction after warping.
   */
  addAnchor(name: string, position: number[], yaw = 0, label = name): void {
    this.anchors.set(name, { position: new THREE.Vector3(...position), yaw, label });
    this._rebuildAnchorDiscs();
  }

  removeAnchor(name: string): void {
    this.anchors.delete(name);
    this._rebuildAnchorDiscs();
  }

  getAnchor(name: string): { position: THREE.Vector3; yaw: number; label: string } | undefined {
    return this.anchors.get(name);
  }

  teleportToAnchor(name: string): boolean {
    const anchor = this.anchors.get(name);
    if (!anchor) return false;
    this._warpTo(anchor.position, anchor.yaw);
    return true;
  }

  setTeleportEnabled(enabled: boolean): void {
    this.teleportMode = enabled;
    if (enabled) this.flightMode = false;
    if (!enabled) this._endTeleportPreview();
  }

  toggleTeleport(): void {
    this.setTeleportEnabled(!this.teleportMode);
  }

  setFlightEnabled(enabled: boolean): void {
    this.flightMode = enabled;
    if (enabled) {
      this.teleportMode = false;
      this._endTeleportPreview();
    }
  }

  toggleFlight(): void {
    this.setFlightEnabled(!this.flightMode);
  }

  setSnapTurnEnabled(enabled: boolean): void {
    this.snapTurnEnabled = enabled;
  }

  setSnapAngle(radians: number): void {
    if (radians > 0) this.snapAngle = radians;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = !!enabled;
  }

  setSeatedHeightOffset(offset: number): void {
    this.seatedHeightOffset = offset;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.teleportMode = false;
      this.flightMode = false;
      this._endTeleportPreview();
    }
  }

  enabled = true;

  dropToFloor(): void {
    this.cameraGroup.position.y = this.teleportFloorY;
  }

  ascend(): void {
    this.cameraGroup.position.y = Math.max(
      this.teleportFloorY,
      this.cameraGroup.position.y + 0.35
    );
  }

  descend(): void {
    this.cameraGroup.position.y = Math.max(
      this.teleportFloorY,
      this.cameraGroup.position.y - 0.35
    );
  }

  _setupKeyboard(): void {
    this._keyDownHandler = (e) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
        this.keys.add(e.code);
      }
      if (e.code === 'KeyT') {
        this.toggleTeleport();
      }
    };
    this._keyUpHandler = (e) => {
      this.keys.delete(e.code);
    };
    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup', this._keyUpHandler);
  }

  dispose(): void {
    if (this._keyDownHandler) window.removeEventListener('keydown', this._keyDownHandler);
    if (this._keyUpHandler) window.removeEventListener('keyup', this._keyUpHandler);
    this._endTeleportPreview();
    this._disposeTeleportMeshes();
    for (const mesh of this._anchorMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.scene.remove(this._teleportDiscs);
  }

  _disposeTeleportMeshes(): void {
    if (this._teleportArcMesh) {
      this._teleportArcMesh.geometry.dispose();
      (this._teleportArcMesh.material as THREE.Material).dispose();
      this.scene.remove(this._teleportArcMesh);
      this._teleportArcMesh = null;
    }
    if (this._teleportTargetMesh) {
      this._teleportTargetMesh.geometry.dispose();
      (this._teleportTargetMesh.material as THREE.Material).dispose();
      this.scene.remove(this._teleportTargetMesh);
      this._teleportTargetMesh = null;
    }
  }

  _buildTeleportArc(): void {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.teleportArcSegments * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setDrawRange(0, 0);

    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this._teleportArcMesh = new THREE.Line(geom, mat);
    this._teleportArcMesh.frustumCulled = false;
    this._teleportArcMesh.visible = false;
    this.scene.add(this._teleportArcMesh);
  }

  _buildTargetMarker(): void {
    const geom = new THREE.CircleGeometry(0.22, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this._teleportTargetMesh = new THREE.Mesh(geom, mat);
    this._teleportTargetMesh.rotation.x = -Math.PI / 2;
    this._teleportTargetMesh.visible = false;
    this.scene.add(this._teleportTargetMesh);
  }

  _rebuildAnchorDiscs(): void {
    for (const mesh of this._anchorMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this._teleportDiscs.remove(mesh);
    }
    this._anchorMeshes = [];

    for (const [name, anchor] of this.anchors) {
      const geom = new THREE.CircleGeometry(0.28, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff00cc,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(anchor.position);
      mesh.position.y = this.teleportFloorY + 0.02;
      mesh.rotation.x = -Math.PI / 2;
      mesh.userData.anchorName = name;
      this._teleportDiscs.add(mesh);
      this._anchorMeshes.push(mesh);
    }
  }

  update(delta: number, time: number): void {
    if (this.enabled === false) return;
    this.turnCooldown = Math.max(0, this.turnCooldown - delta);

    // Capture the camera-group pose before any motion sub-step so the transient
    // vignette can detect net translation/rotation this frame.
    if (this.reducedMotion) {
      this._vignetteStartPos.copy(this.cameraGroup.position);
      this._vignetteStartYaw = this._yawOf(this.cameraGroup);
    }

    // 1. Controller thumbsticks
    this._updateControllerMovement(delta);

    // 2. Hand-tracking grab locomotion
    this._updateHandGrabMovement(delta);

    // 3. Desktop keyboard fallback
    this._updateKeyboardMovement(delta);

    // 4. Teleport preview update
    this._updateTeleportPreview();

    // 5. Apply seated-height offset and reduced-motion damping.
    this._applyComfortOffset(delta);

    // 6. Drive the transient comfort vignette (reduced-motion only).
    this._updateLocomotionVignette(delta);
  }

  /** Extract the yaw (heading) of an object's world quaternion. */
  _yawOf(obj: THREE.Object3D): number {
    this.tempEuler.setFromQuaternion(obj.quaternion, 'YXZ');
    return this.tempEuler.y;
  }

  /**
   * Fade a peripheral comfort vignette in while the user is moving and out once
   * they are still — only when reduced-motion is enabled. When reduced-motion is
   * off, this is a no-op so the ComfortSettingsController's static `vignette`
   * setting stays the sole owner of vignette state.
   */
  _updateLocomotionVignette(delta: number): void {
    if (!this.reducedMotion) return;
    const moved = this.cameraGroup.position.distanceToSquared(this._vignetteStartPos) > 1e-4; // ~1 cm
    let yawDelta = this._yawOf(this.cameraGroup) - this._vignetteStartYaw;
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
    const turning = Math.abs(yawDelta) > 0.02; // ~1.1°
    const target = moved || turning ? 0.6 : 0;
    // Fade in faster than out: ramping up discomfort shielding promptly matters
    // more than a leisurely release once the user is steady.
    const rate = target > this._vignetteOpacity ? 8 : 3;
    this._vignetteOpacity += (target - this._vignetteOpacity) * Math.min(1, rate * delta);
    if (this._vignetteOpacity < 0.01) {
      this._vignetteOpacity = 0;
      this.engine.setVignetteEnabled?.(false, 0);
    } else {
      this.engine.setVignetteEnabled?.(true, this._vignetteOpacity);
    }
  }

  _applyComfortOffset(delta: number): void {
    if (this.seatedHeightOffset !== 0) {
      const targetY = this.camera.position.y + this.seatedHeightOffset;
      // Do not fight the camera group's own vertical movement; just maintain
      // the configured offset from the tracked head height.
      if (Math.abs(this.cameraGroup.position.y - targetY) > 0.001) {
        // Use lower alpha to dampen tracking jitter and prevent oscillation.
        // Reduced motion: 0.02 (slower); Normal: 0.05 (prevents overshoot on 90 FPS).
        const alpha = this.reducedMotion ? 0.02 : 0.05;
        this.cameraGroup.position.y +=
          (targetY - this.cameraGroup.position.y) * Math.min(1, alpha * (delta * 60));
      }
    }
  }

  _updateControllerMovement(delta: number): void {
    const session = this.engine.renderer?.xr.getSession();
    if (!session || !session.inputSources) return;

    const sources = Array.from(session.inputSources);

    let moveX = 0;
    let moveY = 0;
    let turnX = 0;
    let aimX = 0;
    let aimY = 0;
    let triggerPressed = false;

    for (const source of sources) {
      const gp = source.gamepad;
      if (!gp || !gp.axes || gp.axes.length === 0 || !gp.buttons) continue;

      const isLeft = source.handedness === 'left';
      const isRight = source.handedness === 'right';
      triggerPressed = triggerPressed || !!gp.buttons[0]?.pressed;

      if (gp.axes.length >= 2) {
        if (isLeft) {
          moveX += this._applyDeadZone(gp.axes[0]);
          moveY += this._applyDeadZone(gp.axes[1]);
        } else if (isRight) {
          if (gp.axes.length >= 4) {
            turnX += this._applyDeadZone(gp.axes[2]);
            aimX = this._applyDeadZone(gp.axes[2]);
            aimY = this._applyDeadZone(gp.axes[3]);
          } else {
            turnX += this._applyDeadZone(gp.axes[0]);
            aimX = this._applyDeadZone(gp.axes[0]);
            aimY = this._applyDeadZone(gp.axes[1]);
          }
        } else {
          const idx = sources.indexOf(source);
          if (idx === 0) {
            moveX += this._applyDeadZone(gp.axes[0]);
            moveY += this._applyDeadZone(gp.axes[1]);
          } else if (idx === 1) {
            turnX += this._applyDeadZone(gp.axes[0]);
            aimX = this._applyDeadZone(gp.axes[0]);
            aimY = this._applyDeadZone(gp.axes[1]);
          }
        }
      }
    }

    // In flight mode the right thumbstick controls vertical movement (Y axis),
    // while the left stick continues to strafe and move forward/back. In
    // teleport mode the right thumbstick aims instead.
    let vertical = 0;
    if (this.flightMode) {
      vertical = -this._applyDeadZone(aimY);
    }

    if (this.teleportMode) {
      const rightStickActive = Math.abs(aimX) > 0 || Math.abs(aimY) > 0;
      if (rightStickActive) {
        this._lastPreviewWasThumbstick = true;
        this._startTeleportPreview();
        this._sampleAimFromThumbstick(aimX, aimY);
      } else if (this.teleportActive) {
        // Release the stick to confirm the teleport.
        if (this.teleportValid) {
          this._warpTo(this.teleportTarget, 0);
        }
        this._endTeleportPreview();
      }
    } else {
      if (this.snapTurnEnabled) {
        this._applySnapTurn(turnX);
      } else {
        this._applySmoothTurn(turnX, delta);
      }
    }

    // Trigger acts as a dedicated teleport confirm when the preview is active,
    // so users can fine-tune with the stick then confirm with the trigger.
    if (triggerPressed && this.teleportActive && this.teleportValid) {
      this._warpTo(this.teleportTarget, 0);
      this._endTeleportPreview();
    }

    this._applyMovement(moveX, moveY, delta, vertical);
  }

  _sampleAimFromThumbstick(x: number, y: number): void {
    // Thumbstick Y is negative forward; we want the preview to shoot forward
    // in the camera's yaw direction. Compute a world-space direction from the
    // camera yaw plus the stick angle.
    this.camera.getWorldQuaternion(this.tempQuat);
    this.tempEuler.setFromQuaternion(this.tempQuat);
    const yaw = this.tempEuler.y;

    const stickAngle = Math.atan2(-y, x);
    const distance = Math.min(
      this.teleportMaxDistance,
      Math.sqrt(x * x + y * y) * this.teleportMaxDistance
    );

    this.tempVec
      .set(Math.cos(stickAngle), 0, Math.sin(stickAngle))
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const origin = this.tempVec2.set(0, 0, 0);
    this.cameraGroup.localToWorld(origin);
    origin.y = this.teleportFloorY + 0.1;

    const target = origin.clone().add(this.tempVec.multiplyScalar(distance));
    target.y = this.teleportFloorY;

    this._computeParabolicArc(origin, target);
  }

  _startTeleportPreview(): void {
    this.teleportActive = true;
    if (this._teleportArcMesh) this._teleportArcMesh.visible = true;
    if (this._teleportTargetMesh) this._teleportTargetMesh.visible = true;
    this._teleportDiscs.visible = true;
  }

  _endTeleportPreview(): void {
    this.teleportActive = false;
    this.teleportValid = false;
    if (this._teleportArcMesh) this._teleportArcMesh.visible = false;
    if (this._teleportTargetMesh) this._teleportTargetMesh.visible = false;
    this._teleportDiscs.visible = false;
  }

  _updateTeleportPreview(): void {
    if (!this.teleportActive) return;

    // If the preview is being driven by the controller ray, recalculate it
    // from the active pointer. Otherwise the thumbstick path already computed it.
    const ray = this.engine.input?.raycaster?.ray as THREE.Ray | undefined;
    if (ray && !this._lastPreviewWasThumbstick) {
      this._computeParabolicArcFromRay(ray);
    }
  }

  _computeParabolicArcFromRay(ray: THREE.Ray): void {
    const origin = ray.origin.clone();
    origin.y = Math.max(origin.y, this.teleportFloorY + 0.1);

    // Fire the ray toward the floor plane. If it hits, use that as the target;
    // otherwise fall back to a point along the ray at max distance.
    const denom = this._floorPlane.normal.dot(ray.direction);
    let target: THREE.Vector3 | undefined;
    if (Math.abs(denom) > 0.001) {
      const t =
        -(this._floorPlane.constant + this._floorPlane.normal.dot(origin)) / denom;
      if (t > 0) {
        target = origin
          .clone()
          .add(ray.direction.clone().multiplyScalar(Math.min(t, this.teleportMaxDistance)));
      }
    }
    if (!target) {
      target = origin
        .clone()
        .add(ray.direction.clone().multiplyScalar(this.teleportMaxDistance));
    }
    target.y = this.teleportFloorY;

    this._computeParabolicArc(origin, target);
  }

  _computeParabolicArc(origin: THREE.Vector3, target: THREE.Vector3): void {
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    const clampedDistance = Math.min(distance, this.teleportMaxDistance);
    if (clampedDistance < 0.01) {
      this.teleportValid = false;
      return;
    }

    // Build a parabola that rises slightly above the launch height, then lands
    // exactly at the requested distance on the floor. This is visually
    // consistent with teleport beams in VR games and guarantees the sampled
    // arc intersects the floor within the time window.
    const apexHeight = Math.max(origin.y + 0.2, 1.8);
    const g = this.teleportGravity;
    const v0 = Math.sqrt(2 * g * (apexHeight - origin.y));
    const tApex = v0 / g;
    const tDescent = Math.sqrt((2 * apexHeight) / g);
    const totalTime = tApex + tDescent;
    const velocityXZ = clampedDistance / totalTime;

    const dir = this.tempVec.set(dx, 0, dz).normalize();
    const velocity = dir.multiplyScalar(velocityXZ);
    velocity.y = v0;

    const positions = (this._teleportArcMesh!.geometry.attributes.position.array as Float32Array);
    let hitFloor = false;
    let visibleSegments = 0;

    for (let i = 0; i < this.teleportArcSegments; i++) {
      const t = (i / (this.teleportArcSegments - 1)) * totalTime;
      const px = origin.x + velocity.x * t;
      const py = origin.y + velocity.y * t - 0.5 * g * t * t;
      const pz = origin.z + velocity.z * t;

      if (i > 0 && py <= this.teleportFloorY + 0.001) {
        if (!hitFloor) {
          const lastT = (Math.max(0, i - 1) / (this.teleportArcSegments - 1)) * totalTime;
          const prevY = origin.y + velocity.y * lastT - 0.5 * g * lastT * lastT;
          const ratio = Math.max(
            0,
            Math.min(1, (this.teleportFloorY - prevY) / (py - prevY))
          );
          const prevX = origin.x + velocity.x * lastT;
          const prevZ = origin.z + velocity.z * lastT;
          const ix = prevX + (px - prevX) * ratio;
          const iz = prevZ + (pz - prevZ) * ratio;

          positions[i * 3] = ix;
          positions[i * 3 + 1] = this.teleportFloorY;
          positions[i * 3 + 2] = iz;

          this.teleportTarget.set(ix, this.teleportFloorY, iz);
          this.teleportValid = distance <= this.teleportMaxDistance;
          hitFloor = true;
          visibleSegments = i + 1;
        }
        break;
      }

      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;
      visibleSegments = i + 1;
    }

    this._teleportArcMesh!.geometry.setDrawRange(0, visibleSegments);
    this._teleportArcMesh!.geometry.attributes.position.needsUpdate = true;

    this._teleportTargetMesh!.position.copy(this.teleportTarget);
    this._teleportTargetMesh!.position.y = this.teleportFloorY + 0.02;
    const color = this.teleportValid ? 0x00ffcc : 0xff0055;
    (this._teleportTargetMesh!.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this._teleportArcMesh!.material as THREE.LineBasicMaterial).color.setHex(color);
  }

  _warpTo(position: THREE.Vector3, yaw = 0): void {
    this.cameraGroup.position.set(
      position.x,
      position.y + this.camera.position.y,
      position.z
    );
    if (yaw !== 0) {
      this.cameraGroup.rotation.y = yaw;
    }
  }

  _updateHandGrabMovement(delta: number): void {
    const hands = this.engine.input.hands;
    if (!hands || hands.length === 0) return;

    let activeHand: HandLike | null = null;
    for (const hand of hands) {
      if (hand.isPinched?.()) {
        activeHand = hand;
        break;
      }
    }
    if (!activeHand) activeHand = hands.find((h) => h.ray?.visible) ?? hands[0];
    if (!activeHand) return;

    activeHand.getWorldPosition?.(this.handPosition);

    if (activeHand.isPinched?.()) {
      if (this.grabHand !== activeHand) {
        this.grabHand = activeHand;
        this.grabAnchor.copy(this.handPosition);
      } else {
        const dx = this.grabAnchor.x - this.handPosition.x;
        const dy = this.grabAnchor.y - this.handPosition.y;
        const dz = this.grabAnchor.z - this.handPosition.z;

        this.cameraGroup.position.x += dx * 1.5;
        this.cameraGroup.position.y += dy * 0.5;
        this.cameraGroup.position.z += dz * 1.5;

        this.grabAnchor.copy(this.handPosition);
      }
    } else {
      if (this.grabHand) {
        this.grabHand = null;
      }
    }
  }

  _updateKeyboardMovement(delta: number): void {
    let moveX = 0;
    let moveZ = 0;
    let turn = 0;

    if (this.keys.has('KeyW')) moveZ -= 1;
    if (this.keys.has('KeyS')) moveZ += 1;
    if (this.keys.has('KeyA')) moveX -= 1;
    if (this.keys.has('KeyD')) moveX += 1;
    if (this.keys.has('KeyQ')) turn -= 1;
    if (this.keys.has('KeyE')) turn += 1;

    if (moveX !== 0 || moveZ !== 0) {
      this._applyMovement(moveX, moveZ, delta);
    }
    if (turn !== 0) {
      if (this.snapTurnEnabled) {
        this._applySnapTurn(turn);
      } else {
        this._applySmoothTurn(turn, delta);
      }
    }
  }

  _applyDeadZone(value: number): number {
    if (Math.abs(value) < this.deadZone) return 0;
    return (value - Math.sign(value) * this.deadZone) / (1 - this.deadZone);
  }

  _applyMovement(x: number, z: number, delta: number, vertical = 0): void {
    if (x === 0 && z === 0 && vertical === 0) return;

    if (x !== 0 || z !== 0) {
      this.camera.getWorldQuaternion(this.tempQuat);
      this.tempEuler.setFromQuaternion(this.tempQuat);
      const yaw = this.tempEuler.y;

      this.tempVec
        .set(x, 0, z)
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const speed = this.flightMode ? this.flightSpeed : this.moveSpeed;
      this.tempVec.multiplyScalar(speed * delta);

      this.cameraGroup.position.add(this.tempVec);
    }

    if (vertical !== 0) {
      this.cameraGroup.position.y += vertical * this.verticalSpeed * delta;
    }
  }

  _applySnapTurn(x: number): void {
    if (this.turnCooldown > 0 || x === 0) return;

    const direction = x > 0 ? 1 : -1;
    this.cameraGroup.rotateY(-this.snapAngle * direction);
    this.turnCooldown = this.turnCooldownDuration;
  }

  _applySmoothTurn(x: number, delta: number): void {
    if (x === 0) return;
    const rate = this.reducedMotion ? this.snapAngle / 3 : this.snapAngle * 2;
    this.cameraGroup.rotateY(-rate * x * delta);
  }
}
