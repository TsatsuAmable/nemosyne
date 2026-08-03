import * as THREE from 'three';

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
  constructor(engine) {
    this.engine = engine;
    this.camera = engine.camera;
    this.cameraGroup = engine.cameraGroup;
    this.scene = engine.scene;

    this.moveSpeed = 2.0; // meters per second
    this.verticalSpeed = 1.5; // meters per second (flight mode)
    this.flightSpeed = 2.0; // horizontal flight speed
    this.snapAngle = Math.PI / 6; // 30 degrees
    this.deadZone = 0.15;

    this.flightMode = false;

    this.tempVec = new THREE.Vector3();
    this.tempVec2 = new THREE.Vector3();
    this.tempQuat = new THREE.Quaternion();
    this.tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.turnCooldown = 0;
    this.turnCooldownDuration = 0.35;

    // Hand-grab state
    this.grabHand = null;
    this.grabAnchor = new THREE.Vector3();
    this.handPosition = new THREE.Vector3();

    // Teleport state
    this.teleportMode = false;
    this.teleportActive = false;
    this.teleportTarget = new THREE.Vector3();
    this.teleportValid = false;
    this._teleportArcMesh = null;
    this._teleportTargetMesh = null;
    this._teleportDiscs = new THREE.Group();
    this._teleportDiscs.visible = false;
    this.scene.add(this._teleportDiscs);

    this.teleportGravity = 9.8;
    this.teleportMaxDistance = 12.0;
    this.teleportStep = 0.04;
    this.teleportArcSegments = 64;
    this.teleportFloorY = 0.0;

    // Named anchors (name -> { position, yaw, label }).
    this.anchors = new Map();
    this._anchorMeshes = [];

    this._floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.teleportFloorY);

    // Keyboard state
    this.keys = new Set();
    this._setupKeyboard();

    this._buildTeleportArc();
    this._buildTargetMarker();
  }

  /**
   * Register a named viewpoint anchor. The optional yaw rotates the user to face
   * the anchor's forward direction after warping.
   */
  addAnchor(name, position, yaw = 0, label = name) {
    this.anchors.set(name, { position: new THREE.Vector3(...position), yaw, label });
    this._rebuildAnchorDiscs();
  }

  removeAnchor(name) {
    this.anchors.delete(name);
    this._rebuildAnchorDiscs();
  }

  getAnchor(name) {
    return this.anchors.get(name);
  }

  teleportToAnchor(name) {
    const anchor = this.anchors.get(name);
    if (!anchor) return false;
    this._warpTo(anchor.position, anchor.yaw);
    return true;
  }

  setTeleportEnabled(enabled) {
    this.teleportMode = enabled;
    if (enabled) this.flightMode = false;
    if (!enabled) this._endTeleportPreview();
  }

  toggleTeleport() {
    this.setTeleportEnabled(!this.teleportMode);
  }

  setFlightEnabled(enabled) {
    this.flightMode = enabled;
    if (enabled) {
      this.teleportMode = false;
      this._endTeleportPreview();
    }
  }

  toggleFlight() {
    this.setFlightEnabled(!this.flightMode);
  }

  dropToFloor() {
    this.cameraGroup.position.y = this.teleportFloorY;
  }

  ascend() {
    this.cameraGroup.position.y = Math.max(this.teleportFloorY, this.cameraGroup.position.y + 0.35);
  }

  descend() {
    this.cameraGroup.position.y = Math.max(this.teleportFloorY, this.cameraGroup.position.y - 0.35);
  }

  _setupKeyboard() {
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

  dispose() {
    if (this._keyDownHandler) window.removeEventListener('keydown', this._keyDownHandler);
    if (this._keyUpHandler) window.removeEventListener('keyup', this._keyUpHandler);
    this._endTeleportPreview();
    this._disposeTeleportMeshes();
    for (const mesh of this._anchorMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.scene.remove(this._teleportDiscs);
  }

  _disposeTeleportMeshes() {
    if (this._teleportArcMesh) {
      this._teleportArcMesh.geometry.dispose();
      this._teleportArcMesh.material.dispose();
      this.scene.remove(this._teleportArcMesh);
      this._teleportArcMesh = null;
    }
    if (this._teleportTargetMesh) {
      this._teleportTargetMesh.geometry.dispose();
      this._teleportTargetMesh.material.dispose();
      this.scene.remove(this._teleportTargetMesh);
      this._teleportTargetMesh = null;
    }
  }

  _buildTeleportArc() {
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

  _buildTargetMarker() {
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

  _rebuildAnchorDiscs() {
    for (const mesh of this._anchorMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
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

  update(delta, time) {
    this.turnCooldown = Math.max(0, this.turnCooldown - delta);

    // 1. Controller thumbsticks
    this._updateControllerMovement(delta);

    // 2. Hand-tracking grab locomotion
    this._updateHandGrabMovement(delta);

    // 3. Desktop keyboard fallback
    this._updateKeyboardMovement(delta);

    // 4. Teleport preview update
    this._updateTeleportPreview();
  }

  _updateControllerMovement(delta) {
    const session = this.engine.renderer.xr.getSession();
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
      this._applySnapTurn(turnX);
    }

    // Trigger acts as a dedicated teleport confirm when the preview is active,
    // so users can fine-tune with the stick then confirm with the trigger.
    if (triggerPressed && this.teleportActive && this.teleportValid) {
      this._warpTo(this.teleportTarget, 0);
      this._endTeleportPreview();
    }

    this._applyMovement(moveX, moveY, delta, vertical);
  }

  _sampleAimFromThumbstick(x, y) {
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

  _startTeleportPreview() {
    this.teleportActive = true;
    this._teleportArcMesh.visible = true;
    this._teleportTargetMesh.visible = true;
    this._teleportDiscs.visible = true;
  }

  _endTeleportPreview() {
    this.teleportActive = false;
    this.teleportValid = false;
    if (this._teleportArcMesh) this._teleportArcMesh.visible = false;
    if (this._teleportTargetMesh) this._teleportTargetMesh.visible = false;
    this._teleportDiscs.visible = false;
  }

  _updateTeleportPreview() {
    if (!this.teleportActive) return;

    // If the preview is being driven by the controller ray, recalculate it
    // from the active pointer. Otherwise the thumbstick path already computed it.
    const ray = this.engine.input?.raycaster?.ray;
    if (ray && !this._lastPreviewWasThumbstick) {
      this._computeParabolicArcFromRay(ray);
    }
  }

  _computeParabolicArcFromRay(ray) {
    const origin = ray.origin.clone();
    origin.y = Math.max(origin.y, this.teleportFloorY + 0.1);

    // Fire the ray toward the floor plane. If it hits, use that as the target;
    // otherwise fall back to a point along the ray at max distance.
    const denom = this._floorPlane.normal.dot(ray.direction);
    let target;
    if (Math.abs(denom) > 0.001) {
      const t = -(this._floorPlane.constant + this._floorPlane.normal.dot(origin)) / denom;
      if (t > 0) {
        target = origin
          .clone()
          .add(ray.direction.clone().multiplyScalar(Math.min(t, this.teleportMaxDistance)));
      }
    }
    if (!target) {
      target = origin.clone().add(ray.direction.clone().multiplyScalar(this.teleportMaxDistance));
    }
    target.y = this.teleportFloorY;

    this._computeParabolicArc(origin, target);
  }

  _computeParabolicArc(origin, target) {
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

    const positions = this._teleportArcMesh.geometry.attributes.position.array;
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
          const ratio = Math.max(0, Math.min(1, (this.teleportFloorY - prevY) / (py - prevY)));
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

    this._teleportArcMesh.geometry.setDrawRange(0, visibleSegments);
    this._teleportArcMesh.geometry.attributes.position.needsUpdate = true;

    this._teleportTargetMesh.position.copy(this.teleportTarget);
    this._teleportTargetMesh.position.y = this.teleportFloorY + 0.02;
    const color = this.teleportValid ? 0x00ffcc : 0xff0055;
    this._teleportTargetMesh.material.color.setHex(color);
    this._teleportArcMesh.material.color.setHex(color);
  }

  _warpTo(position, yaw = 0) {
    this.cameraGroup.position.set(position.x, position.y + this.camera.position.y, position.z);
    if (yaw !== 0) {
      this.cameraGroup.rotation.y = yaw;
    }
  }

  _updateHandGrabMovement(delta) {
    const hands = this.engine.input.hands;
    if (!hands || hands.length === 0) return;

    let activeHand = null;
    for (const hand of hands) {
      if (hand.isPinched()) {
        activeHand = hand;
        break;
      }
    }
    if (!activeHand) activeHand = hands.find((h) => h.ray?.visible) ?? hands[0];
    if (!activeHand) return;

    activeHand.getWorldPosition(this.handPosition);

    if (activeHand.isPinched()) {
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

  _updateKeyboardMovement(delta) {
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
      this._applySnapTurn(turn);
    }
  }

  _applyDeadZone(value) {
    if (Math.abs(value) < this.deadZone) return 0;
    return (value - Math.sign(value) * this.deadZone) / (1 - this.deadZone);
  }

  _applyMovement(x, z, delta, vertical = 0) {
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

  _applySnapTurn(x) {
    if (this.turnCooldown > 0 || x === 0) return;

    const direction = x > 0 ? 1 : -1;
    this.cameraGroup.rotateY(-this.snapAngle * direction);
    this.turnCooldown = this.turnCooldownDuration;
  }
}
