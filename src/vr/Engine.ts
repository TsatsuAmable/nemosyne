import * as THREE from 'three';
import { NemosyneVRButton } from './VRButton.ts';
import { WorldTheme } from './WorldTheme.ts';
import { ControllerPointer } from './Controllers.ts';
import { HandPointer } from './Hands.ts';
import { InputRouter } from './InputRouter.ts';
import { Locomotion } from './Locomotion.ts';
import { DesktopControls } from './DesktopControls.ts';
import { disposeObject } from '../utils/Dispose.ts';
import { PerformanceBudget } from '../utils/PerformanceBudget.ts';
import type { HudObject } from './input/InteractableRegistry.ts';
import type { PerformanceBudgetLike, TelemetryCollectorLike, Updatable } from './coordinators/types.ts';

/**
 * Core WebXR engine: scene graph, renderer, XR session, input routing,
 * updatables loop, and disposal.
 */
export class Engine {
  scene: THREE.Scene;
  theme: WorldTheme;

  // Optional telemetry collector. The World sets this once it has created
  // the engine; if unset, frame timing is simply not collected.
  telemetry: TelemetryCollectorLike | null = null;

  // Performance budget enforcement for Quest Browser profiling.
  performanceBudget: PerformanceBudgetLike;
  _lastBudgetCheck = 0;

  cameraGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  updatables: unknown[] = [];
  input: InputRouter;
  locomotion: Locomotion;
  desktop: DesktopControls;
  clock: THREE.Clock;

  // Optional undo/redo callbacks for desktop/VR keyboard shortcuts.
  onUndo: (() => void) | null = null;
  onRedo: (() => void) | null = null;
  onPauseInput: (() => void) | null = null;
  onResetView: (() => void) | null = null;

  headWorldPos: THREE.Vector3;

  _vignetteMesh: THREE.Mesh;

  xrFrame: XRFrame | null = null;
  xrRefSpace: XRReferenceSpace | null = null;
  xrSession: XRSession | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.theme = new WorldTheme(this.scene);

    this.performanceBudget = new PerformanceBudget() as PerformanceBudgetLike;

    this.cameraGroup = new THREE.Group();
    this.scene.add(this.cameraGroup);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      200
    );
    this.camera.position.set(0, 1.6, 0);
    this.cameraGroup.add(this.camera);

    // Neon origin marker so we can see *something* even if the rest of the
    // scene is black or the camera is at the wrong height.
    this._addOriginMarker();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    // Set explicit scene background color so WebXR framebuffers don't clear to transparent black.
    this.scene.background = new THREE.Color(0x020208);
    this.renderer.setClearColor(0x020208, 1);
    document.body.appendChild(this.renderer.domElement);

    this._contextRestored = this._contextRestored.bind(this);
    this._contextLost = this._contextLost.bind(this);
    this.renderer.domElement.addEventListener('webglcontextlost', this._contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._contextRestored);

    document.body.appendChild(NemosyneVRButton.createButton(this.renderer));

    this.input = new InputRouter(this);
    this.locomotion = new Locomotion(this);
    this.desktop = new DesktopControls(this);
    this.clock = new THREE.Clock();

    this.headWorldPos = new THREE.Vector3();

    this._vignetteMesh = this._createVignetteMesh();
    this.camera.add(this._vignetteMesh);
    this._vignetteMesh.visible = false;

    this._setupControllersAndHands();

    window.addEventListener('resize', () => this._onWindowResize());
  }

  _setupControllersAndHands(): void {
    for (let i = 0; i < 2; i++) {
      const controller = new ControllerPointer(this.renderer, i);
      this.cameraGroup.add(controller.group);
      this.input.addController(controller);

      const hand = new HandPointer(this.renderer, i);
      this.cameraGroup.add(hand.group);
      hand.mount(this.scene);
      this.input.addHand(hand);
    }
  }

  addUpdatable(obj: unknown): void {
    if (
      obj &&
      typeof obj === 'object' &&
      'update' in obj &&
      typeof (obj as { update?: unknown }).update === 'function'
    ) {
      this.updatables.push(obj);
    } else if (typeof obj === 'function') {
      this.updatables.push(obj);
    }
  }

  removeUpdatable(obj: unknown): void {
    const idx = this.updatables.findIndex((u) => u === obj);
    if (idx >= 0) this.updatables.splice(idx, 1);
  }

  addInteractable(mesh: THREE.Object3D, handlers: Record<string, unknown> = {}): void {
    this.input.addInteractable(mesh, handlers);
  }

  removeInteractable(mesh: THREE.Object3D): void {
    this.input.removeInteractable(mesh);
  }

  addHudObject(obj: HudObject): void {
    this.input.addHudObject(obj);
  }

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(() => this._tick());

    // Listen for XR session visibility changes (e.g., user removes headset,
    // guardian triggered, tracking lost). We hook here because the session is
    // created lazily by the VR button.
    const checkSession = () => {
      const session = this.renderer.xr.getSession();
      if (session && !(session as XRSession & { _nemosyneVisibilityHook?: boolean })._nemosyneVisibilityHook) {
        (session as XRSession & { _nemosyneVisibilityHook?: boolean })._nemosyneVisibilityHook = true;
        session.addEventListener('visibilitychange', () => {
          this._reportSessionStatus(
            session.visibilityState === 'visible'
              ? 'session resumed'
              : `session ${session.visibilityState}`,
            session.visibilityState === 'visible' ? '#00ffcc' : '#ffaa00'
          );
        });
      }
    };
    this.renderer.xr.addEventListener('sessionstart', checkSession);
  }

  _tick(): void {
    const frameStart = performance.now();
    try {
      const delta = this.clock.getDelta();
      const time = this.clock.getElapsedTime();

      const frame = this.renderer.xr.getFrame() ?? null;
      const refSpace = this.renderer.xr.getReferenceSpace() ?? null;
      const session = this.renderer.xr.getSession() ?? null;
      this.xrFrame = frame;
      this.xrRefSpace = refSpace;
      this.xrSession = session;
      if (frame && refSpace) {
        this.input.update(frame, refSpace, session, time);
      }

      this.camera.getWorldPosition(this.headWorldPos);

      this.locomotion.update(delta, time);
      this.desktop.update();

      for (const u of this.updatables) {
        if (typeof u === 'function') {
          u();
        } else if (typeof (u as { update?: unknown }).update === 'function') {
          (u as Updatable).update(delta, time);
        }
      }

      this.renderer.render(this.scene, this.camera);

      // Evaluate performance budget once per second to avoid overhead.
      const now = performance.now();
      if (now - this._lastBudgetCheck >= 1000) {
        this._lastBudgetCheck = now;
        const frameMs = now - frameStart;
        const snapshot = {
          frameMs,
          dropped: frameMs > (this.performanceBudget.budgets?.frameMs ?? 16.67),
          rendererInfo: this.renderer.info,
          interactableCount: this.input.interactables.length,
          updatableCount: this.updatables.length,
          panelCount: this.input.panels.length,
          time: this.clock.getElapsedTime(),
        };
        const violations = this.performanceBudget.check(snapshot);
        if (violations.length > 0 && typeof console !== 'undefined') {
          for (const v of violations) {
            console.warn(`[PerformanceBudget] ${v.severity}: ${v.message}`);
          }
        }
      }
    } catch (err) {
      this._reportTickError(err);
    } finally {
      this.telemetry?.recordFrame?.(performance.now() - frameStart);
    }
  }

  _reportTickError(err: unknown): void {
    console.error('[Engine] tick error:', err);
    const telemetry = document.getElementById('telemetry');
    if (telemetry) {
      telemetry.textContent = `TICK ERROR: ${(err as Error | undefined)?.message ?? err}`;
      telemetry.style.color = '#ff0055';
    }
  }

  _createVignetteMesh(): THREE.Mesh {
    // A full-screen quad that is always centered in front of the camera.
    // Used as a tunnel-vision / peripheral darkening comfort aid during
    // locomotion. Hidden by default.
    const geom = new THREE.PlaneGeometry(2, 2, 1, 1);
    // Radial gradient in UV space.
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d') || this._createMockContext();
    const gradient = ctx.createRadialGradient(128, 128, 64, 128, 128, 180);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.z = -0.5;
    mesh.name = 'vignette';
    return mesh;
  }

  setVignetteEnabled(enabled: boolean, intensity = 0.4): void {
    if (!this._vignetteMesh) return;
    this._vignetteMesh.visible = enabled;
    (this._vignetteMesh.material as THREE.MeshBasicMaterial).opacity = enabled ? intensity : 0;
  }

  _addOriginMarker(): void {
    const markerGroup = new THREE.Group();

    // Small glowing floor ring at the origin. Keep it unobtrusive so it does
    // not block the view, but visible enough to confirm rendering is working.
    const ringGeo = new THREE.RingGeometry(0.15, 0.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    markerGroup.add(ring);

    // Small vertical tick so users can locate the origin in 3D space.
    const tickGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.3, 8);
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0xff00cc,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    });
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.y = 0.15;
    markerGroup.add(tick);

    this.scene.add(markerGroup);
  }

  _onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _contextLost(event: Event): void {
    event.preventDefault();
    console.warn('[Engine] WebGL context lost');
    this._reportSessionStatus('GPU context lost — pausing render', '#ffaa00');
    // Stop the animation loop; the renderer will resume automatically once the
    // context is restored. three.js does not require manual resource recreation
    // for a simple context restoration, but we clear transient state.
    this.renderer.setAnimationLoop(null);
  }

  _contextRestored(): void {
    console.warn('[Engine] WebGL context restored');
    this._reportSessionStatus('GPU context restored', '#00ffcc');
    this.renderer.setAnimationLoop(() => this._tick());
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.removeEventListener('webglcontextlost', this._contextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this._contextRestored);
    this.locomotion.dispose();
    this.desktop.dispose();
    disposeObject(this.scene);
    this.theme.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  _reportSessionStatus(message: string, color = '#00ffcc'): void {
    // eslint-disable-next-line no-console
    console.log('[Engine]', message);
    const telemetry = document.getElementById('telemetry');
    if (telemetry) {
      telemetry.textContent = message;
      telemetry.style.color = color;
    }
  }

  _createMockContext(): CanvasRenderingContext2D {
    return {
      createRadialGradient: () => ({
        addColorStop: () => {},
      }) as unknown as CanvasGradient,
      fillRect: () => {},
    } as unknown as CanvasRenderingContext2D;
  }
}
