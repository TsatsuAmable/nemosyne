import * as THREE from 'three';
import type { Engine } from './Engine.ts';

/**
 * Desktop fallback controls: mouse look + pointer interaction.
 *
 * When no XR session is active, the user can drag the mouse to rotate the
 * camera (yaw + pitch), click on panels and scene objects, and use WASD/QE
 * for movement via Locomotion.
 *
 * This class is intentionally separate from Locomotion so either can be
 * tested and replaced independently.
 */
export class DesktopControls {
  engine: Engine;
  camera: THREE.Camera;
  cameraGroup: THREE.Group;
  domElement: HTMLCanvasElement;

  enabled = false;
  isDragging = false;
  lastMouseX = 0;
  lastMouseY = 0;

  yaw = 0;
  pitch = 0;
  sensitivity = 0.002;

  // Synthetic raycaster used as the desktop pointer.
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  mouseDown = false;

  // Keep a visible desktop cursor so the user knows where they are pointing.
  _cursor: THREE.Mesh;
  _cursorDistance = 3;

  _handlers: Record<string, (e: Event) => void>;

  constructor(engine: Engine) {
    this.engine = engine;
    this.camera = engine.camera;
    this.cameraGroup = engine.cameraGroup;
    this.domElement = engine.renderer.domElement;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this._cursor = this._createCursor();
    this.camera.add(this._cursor);

    this._handlers = {
      pointerlockchange: () => this._onPointerLockChange(),
      mousedown: (e) => this._onMouseDown(e as MouseEvent),
      mousemove: (e) => this._onMouseMove(e as MouseEvent),
      mouseup: (e) => this._onMouseUp(e as MouseEvent),
      keydown: (e) => this._onKeyDown(e as KeyboardEvent),
      keyup: (e) => this._onKeyUp(e as KeyboardEvent),
    };

    this._setupDOM();
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.domElement.requestPointerLock?.();
    document.addEventListener('pointerlockchange', this._handlers.pointerlockchange);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
    document.removeEventListener('pointerlockchange', this._handlers.pointerlockchange);
  }

  _setupDOM(): void {
    // Click on the canvas toggles pointer lock for mouse look.
    this.domElement.addEventListener('click', () => {
      const isVR = !!this.engine.renderer.xr.getSession();
      if (!isVR) {
        this.domElement.requestPointerLock?.();
      }
    });

    document.addEventListener('mousedown', this._handlers.mousedown);
    document.addEventListener('mousemove', this._handlers.mousemove);
    document.addEventListener('mouseup', this._handlers.mouseup);
    document.addEventListener('keydown', this._handlers.keydown);
    document.addEventListener('keyup', this._handlers.keyup);
  }

  _onPointerLockChange(): void {
    this.isDragging = document.pointerLockElement === this.domElement;
    if (this.isDragging) {
      this.lastMouseX = 0;
      this.lastMouseY = 0;
    }
  }

  _onMouseDown(e: MouseEvent): void {
    const isVR = !!this.engine.renderer.xr.getSession();
    if (isVR) return;
    this.mouseDown = true;
    this._updateMouse(e);
    this._triggerPointerDown();
  }

  _onMouseMove(e: MouseEvent): void {
    const isVR = !!this.engine.renderer.xr.getSession();
    if (isVR) return;

    if (this.isDragging) {
      // Pointer-lock mode: movementX/Y are deltas.
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
      this._applyRotation();
    }

    this._updateMouse(e);
  }

  _onMouseUp(_e: MouseEvent): void {
    this.mouseDown = false;
    this.engine.input._onPointerUp?.(this);
  }

  _onKeyDown(e: KeyboardEvent): void {
    // Pass keyboard events to Locomotion via the engine.
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
      this.engine.locomotion.keys.add(e.code);
    }
    if (e.code === 'Escape') {
      document.exitPointerLock?.();
    }
    if (e.code === 'KeyP') {
      this.engine.onPauseInput?.();
    }
    if (e.code === 'KeyR') {
      this.engine.onResetView?.();
    }
    if (e.code === 'KeyT') {
      // Dev shortcut: toggle the load-test panel (Shift+T starts a full run).
      if (e.shiftKey) {
        this.engine.onStartLoadTest?.();
      } else {
        this.engine.onToggleLoadTestPanel?.();
      }
    }
    if (e.code === 'KeyM' || e.code === 'KeyL' || e.code === 'Backquote') {
      this.engine.uiManager?.handWheelMenu?.toggle?.();
      this.engine.uiManager?.panelManager?.toggleLauncher?.();
    }
    if (e.code === 'KeyN' || e.code === 'ArrowRight') {
      this.engine.guidedTour?.next?.();
    }
    if (e.code === 'KeyB' || e.code === 'ArrowLeft') {
      this.engine.guidedTour?.previous?.();
    }

    // Desktop undo/redo shortcuts.
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          this.engine.onRedo?.();
        } else {
          this.engine.onUndo?.();
        }
        e.preventDefault();
      } else if (e.key === 'y' || e.key === 'Y') {
        this.engine.onRedo?.();
        e.preventDefault();
      }
    }
  }

  _onKeyUp(e: KeyboardEvent): void {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
      this.engine.locomotion.keys.delete(e.code);
    }
  }

  _updateMouse(e: MouseEvent): void {
    if (document.pointerLockElement === this.domElement) {
      // When locked, the cursor is centered and the synthetic ray goes
      // straight through the middle of the screen.
      this.mouse.set(0, 0);
    } else {
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
  }

  _applyRotation(): void {
    // Rotate the camera group by yaw and the camera by pitch.
    this.cameraGroup.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  _triggerPointerDown(): void {
    // Pass the DesktopControls instance itself as the synthetic pointer; it
    // already implements the small PointerLike surface InputRouter expects.
    this.engine.input._onPointerDown(this);
  }

  getRay(targetRay: THREE.Ray): THREE.Ray {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    targetRay.origin.copy(this.raycaster.ray.origin);
    targetRay.direction.copy(this.raycaster.ray.direction);
    return targetRay;
  }

  setRayLength(length: number): void {
    this._cursorDistance = length;
  }

  update(): void {
    const isVR = !!this.engine.renderer.xr.getSession();
    if (isVR) {
      this._cursor.visible = false;
      return;
    }
    this._cursor.visible = true;

    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Hit-test panels and scene interactables to place the cursor and set
    // ray length for the router's laser visuals.
    const panelMeshes = this.engine.input.panels.map(
      (p: { mesh?: THREE.Object3D | null }) => p.mesh
    );
    const panelHits = this.raycaster.intersectObjects(
      panelMeshes.filter((mesh): mesh is THREE.Object3D => !!mesh),
      false
    );
    const sceneHit = this.engine.input.raycastScene(this.raycaster);
    const panelDistance = panelHits[0]?.distance ?? Number.POSITIVE_INFINITY;
    const sceneDistance = sceneHit?.distance ?? Number.POSITIVE_INFINITY;
    const nearestDistance = Math.min(panelDistance, sceneDistance);
    const dist = Number.isFinite(nearestDistance) ? nearestDistance : this._cursorDistance;

    const end = new THREE.Vector3()
      .copy(this.raycaster.ray.origin)
      .add(this.raycaster.ray.direction.clone().multiplyScalar(dist));
    this._cursor.position.copy(end);
    this._cursor.lookAt(this.raycaster.ray.origin);

    if (this.mouseDown) {
      this.engine.input.update(null, null, null);
    }
  }

  _createCursor(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(0.015, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  dispose(): void {
    this.disable();
    document.removeEventListener('mousedown', this._handlers.mousedown);
    document.removeEventListener('mousemove', this._handlers.mousemove);
    document.removeEventListener('mouseup', this._handlers.mouseup);
    document.removeEventListener('keydown', this._handlers.keydown);
    document.removeEventListener('keyup', this._handlers.keyup);
  }
}
