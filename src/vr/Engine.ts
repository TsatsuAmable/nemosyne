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
import { WorldEventBus } from '../utils/EventBus.ts';
import { AdaptiveFrameGovernor } from './scalability/AdaptiveFrameGovernor.ts';
import type { HudObject } from './input/InteractableRegistry.ts';
import type { PerformanceBudgetLike, TelemetryCollectorLike, Updatable, WorldUIManagerLike } from './coordinators/types.ts';
import './registerFactories.ts';

export type EngineState = 'running' | 'context_lost' | 'paused' | 'disposed';
export type FrameTask =
  | Updatable
  | { update?(delta?: number, time?: number): void }
  | ((delta?: number, time?: number) => void);

/**
 * Core WebXR engine: scene graph, renderer, XR session, input routing,
 * updatables loop, explicit lifecycle state machine, and clean disposal.
 */
export class Engine {
  scene: THREE.Scene;
  theme: WorldTheme;

  // Optional telemetry collector. The World sets this once it has created
  // the engine; if unset, frame timing is simply not collected.
  telemetry: TelemetryCollectorLike | null = null;

  // Optional subsystem references attached by World for controls dispatch.
  uiManager: WorldUIManagerLike | null = null;
  guidedTour: { next?(): void; previous?(): void } | null = null;

  // Performance budget enforcement for Quest Browser profiling.
  performanceBudget: PerformanceBudgetLike;
  frameGovernor: AdaptiveFrameGovernor;
  _lastBudgetCheck = 0;

  /**
   * Explicit lifecycle state machine.
   */
  state: EngineState = 'running';

  /**
   * Shared event bus. Created by the engine so the AdaptiveFrameGovernor can
   * emit WorldTopics.PERFORMANCE_THROTTLE from the moment it is constructed.
   * `World` reuses this same instance for all coordinators so the governor's
   * throttle events reach every subscriber.
   */
  eventBus: WorldEventBus;

  cameraGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  updatables: Set<FrameTask> = new Set();
  input: InputRouter;
  locomotion: Locomotion;
  desktop: DesktopControls;
  clock: THREE.Clock;

  // Optional undo/redo callbacks for desktop/VR keyboard shortcuts.
  onUndo: (() => void) | null = null;
  onRedo: (() => void) | null = null;
  onPauseInput: (() => void) | null = null;
  onResetView: (() => void) | null = null;
  // Optional load-test callbacks (populated by World; triggered by desktop KeyT).
  onToggleLoadTestPanel: (() => void) | null = null;
  onStartLoadTest: (() => void) | null = null;

  _vrButtonElement: HTMLElement;
  headWorldPos: THREE.Vector3;

  _vignetteMesh: THREE.Mesh;

  xrFrame: XRFrame | null = null;
  xrRefSpace: XRReferenceSpace | null = null;
  xrSession: XRSession | null = null;

  /**
   * Last frame's wall-clock duration in ms (frameEnd - frameStart from `_tick`).
   * Exposed so the load-test collector (an Engine updatable) can read per-frame
   * timing without re-instrumenting the frame loop. 0 until the first tick.
   */
  lastFrameMs = 0;

  private readonly _onResize = () => this._onWindowResize();
  private readonly _onSessionStart = () => this._handleSessionStart();
  private readonly _onSessionEnd = () => this._handleSessionEnd();

  // Retained per-session XR visibility handler so it can be detached on
  // session end / engine disposal. Previously an anonymous arrow was passed
  // to addEventListener and the reference was lost, leaking the listener if
  // the XRSession outlived the Engine.
  private _xrVisibilityHandler: ((event: XRSessionEvent) => void) | null = null;
  private _xrVisibilitySession: XRSession | null = null;
  private _sessionStartBound = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.theme = new WorldTheme(this.scene);

    this.performanceBudget = new PerformanceBudget() as PerformanceBudgetLike;
    this.eventBus = new WorldEventBus();
    this.frameGovernor = new AdaptiveFrameGovernor(11.1, 30, this.eventBus);

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

    this._vrButtonElement = NemosyneVRButton.createButton(this.renderer);
    document.body.appendChild(this._vrButtonElement);

    this.input = new InputRouter(this);
    this.locomotion = new Locomotion(this);
    this.desktop = new DesktopControls(this);
    this.clock = new THREE.Clock();

    this.headWorldPos = new THREE.Vector3();

    this._vignetteMesh = this._createVignetteMesh();
    this.camera.add(this._vignetteMesh);
    this._vignetteMesh.visible = false;

    this._setupControllersAndHands();

    window.addEventListener('resize', this._onResize);
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

  addUpdatable(obj: FrameTask): void {
    if (obj) {
      this.updatables.add(obj);
    }
  }

  removeUpdatable(obj: FrameTask): void {
    this.updatables.delete(obj);
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
    if (this.state === 'disposed') return;
    // Idempotent: a running engine is a no-op. Guards against repeated
    // sessionstart listener registration and clock restarts.
    if (this.state === 'running' && this._sessionStartBound) return;
    this.state = 'running';
    this.clock.start();
    this.renderer.setAnimationLoop(() => this._tick());
    this.renderer.xr.addEventListener('sessionstart', this._onSessionStart);
    this.renderer.xr.addEventListener('sessionend', this._onSessionEnd);
    this._sessionStartBound = true;
  }

  private _handleSessionStart(): void {
    const session = this.renderer.xr.getSession();
    if (session && this._xrVisibilitySession !== session) {
      // Detach any previous session's visibility listener before binding the
      // new one (defensive: should not normally happen because _handleSessionEnd
      // clears the fields, but guards against a second sessionstart without an
      // intervening sessionend).
      this._detachXrVisibility();

      try {
        if (typeof (this.renderer.xr as unknown as { setFoveation?: (f: number) => void }).setFoveation === 'function') {
          (this.renderer.xr as unknown as { setFoveation: (f: number) => void }).setFoveation(1.0);
        }
      } catch (_) {
        // Ignored if foveation is unsupported in environment
      }

      const handler = (event: XRSessionEvent) => {
        void event;
        this._reportSessionStatus(
          session.visibilityState === 'visible'
            ? 'session resumed'
            : `session ${session.visibilityState}`,
          session.visibilityState === 'visible' ? '#00ffcc' : '#ffaa00'
        );
      };
      this._xrVisibilityHandler = handler;
      this._xrVisibilitySession = session;
      session.addEventListener('visibilitychange', handler);
    }
  }

  private _handleSessionEnd(): void {
    this._detachXrVisibility();
  }

  private _detachXrVisibility(): void {
    if (this._xrVisibilitySession && this._xrVisibilityHandler) {
      try {
        this._xrVisibilitySession.removeEventListener(
          'visibilitychange',
          this._xrVisibilityHandler
        );
      } catch (_) {
        /* session may already be gone */
      }
    }
    this._xrVisibilityHandler = null;
    this._xrVisibilitySession = null;
  }

  _tick(): void {
    if (this.state !== 'running') return;
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
          u(delta, time);
        } else if (typeof (u as Updatable).update === 'function') {
          (u as Updatable).update(delta, time);
        }
      }

      this.renderer.render(this.scene, this.camera);

      const frameEnd = performance.now();
      const frameMs = frameEnd - frameStart;
      this.frameGovernor.recordFrame(frameMs);
      this.lastFrameMs = frameMs;

      // Evaluate performance budget once per second to avoid overhead.
      const now = performance.now();
      if (now - this._lastBudgetCheck >= 1000) {
        this._lastBudgetCheck = now;
        const snapshot = {
          frameMs: this.lastFrameMs,
          dropped: this.lastFrameMs > (this.performanceBudget.budgets?.frameMs ?? 11.11),
          rendererInfo: this.renderer.info,
          interactableCount: this.input.interactables.length,
          updatableCount: this.updatables.size,
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

  /**
   * Gracefully ends the active WebXR session if one is running, returning the
   * user to desktop mode. Resolves with `true` when the session ended cleanly
   * (or none was active), `false` when `session.end()` failed so the caller
   * (UI / telemetry / study instrumentation) can surface the failure instead
   * of presenting a dead button.
   */
  async exitVR(): Promise<boolean> {
    const session = this.renderer.xr.getSession();
    if (!session) return true;
    try {
      await session.end();
      return true;
    } catch (err) {
      console.warn('[Engine] Error ending WebXR session:', err);
      return false;
    }
  }

  /**
   * Returns true if currently presenting in an active WebXR session.
   */
  isInVR(): boolean {
    return this.renderer.xr.isPresenting;
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

    // 1. Center pulsing core (small sphere).
    const coreGeom = new THREE.SphereGeometry(0.04, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    core.position.set(0, 0.05, 0);
    markerGroup.add(core);

    // 2. Floor alignment ring.
    const ringGeom = new THREE.RingGeometry(0.2, 0.22, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    markerGroup.add(ring);

    // 3. Compact coordinate axes at ground level.
    const axes = new THREE.AxesHelper(0.3);
    axes.position.y = 0.01;
    markerGroup.add(axes);

    markerGroup.name = 'originMarker';
    this.scene.add(markerGroup);
  }

  _onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    // Do not call setSize() while the XR compositor owns the framebuffer.
    if (!this.renderer.xr.isPresenting) {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  _contextLost(event: Event): void {
    event.preventDefault();
    this.state = 'context_lost';
    console.warn('[Engine] WebGL context lost');
    this._reportSessionStatus('GPU context lost — pausing render', '#ffaa00');
    // Stop the animation loop; the renderer will resume automatically once the
    // context is restored. three.js does not require manual resource recreation
    // for a simple context restoration, but we clear transient state.
    this.renderer.setAnimationLoop(null);
  }

  _contextRestored(): void {
    // A context-restored event arriving after dispose() would resurrect a
    // disposed Engine. Bail before touching state or restarting the loop.
    if (this.state === 'disposed') return;
    this.state = 'running';
    console.warn('[Engine] WebGL context restored');
    this._reportSessionStatus('GPU context restored', '#00ffcc');
    this.renderer.setAnimationLoop(() => this._tick());
  }

  dispose(): void {
    this.state = 'disposed';
    this.renderer.setAnimationLoop(null);

    // Clean up window & XR event listeners
    window.removeEventListener('resize', this._onResize);
    this.renderer.xr.removeEventListener('sessionstart', this._onSessionStart);
    this.renderer.xr.removeEventListener('sessionend', this._onSessionEnd);
    this.renderer.domElement.removeEventListener('webglcontextlost', this._contextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this._contextRestored);
    // Detach any retained per-session XR visibility listener so an XRSession
    // that outlives the Engine does not keep the handler (and the Engine
    // closure) alive.
    this._detachXrVisibility();

    this.updatables.clear();
    this.locomotion.dispose();
    this.desktop.dispose();
    disposeObject(this.scene);
    this.theme.dispose();
    this.renderer.dispose();
    if (this._vrButtonElement && this._vrButtonElement.parentNode) {
      this._vrButtonElement.parentNode.removeChild(this._vrButtonElement);
    }
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
