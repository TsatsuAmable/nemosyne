import * as THREE from 'three';
import { NemosyneVRButton } from './VRButton.js';
import { WorldTheme } from './WorldTheme.js';
import { ControllerPointer } from './Controllers.js';
import { HandPointer } from './Hands.js';
import { InputRouter } from './InputRouter.js';
import { Locomotion } from './Locomotion.js';
import { DesktopControls } from './DesktopControls.js';
import { disposeObject } from '../utils/Dispose.js';
import { PerformanceBudget } from '../utils/PerformanceBudget.js';

/**
 * Core WebXR engine: scene graph, renderer, XR session, input routing,
 * updatables loop, and disposal.
 */
export class Engine {
  constructor() {
    this.scene = new THREE.Scene();
    this.theme = new WorldTheme(this.scene);

    // Optional telemetry collector. The World sets this once it has created
    // the engine; if unset, frame timing is simply not collected.
    this.telemetry = null;

    // Performance budget enforcement for Quest Browser profiling.
    this.performanceBudget = new PerformanceBudget();
    this._lastBudgetCheck = 0;

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
    // On some mobile/XR runtimes the default clear color leaks through if the
    // scene background is not explicitly set. Match the theme fog color.
    this.renderer.setClearColor(0x020208, 1);
    document.body.appendChild(this.renderer.domElement);

    this._contextRestored = this._contextRestored.bind(this);
    this._contextLost = this._contextLost.bind(this);
    this.renderer.domElement.addEventListener('webglcontextlost', this._contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._contextRestored);

    document.body.appendChild(NemosyneVRButton.createButton(this.renderer));

    this.updatables = [];
    this.input = new InputRouter(this);
    this.locomotion = new Locomotion(this);
    this.desktop = new DesktopControls(this);
    this.clock = new THREE.Clock();

    // Optional undo/redo callbacks for desktop/VR keyboard shortcuts.
    this.onUndo = null;
    this.onRedo = null;

    this.headWorldPos = new THREE.Vector3();

    this._setupControllersAndHands();

    window.addEventListener('resize', () => this._onWindowResize());
  }

  _setupControllersAndHands() {
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

  addUpdatable(obj) {
    if (obj?.update) this.updatables.push(obj);
  }

  removeUpdatable(obj) {
    const idx = this.updatables.findIndex((u) => u === obj);
    if (idx >= 0) this.updatables.splice(idx, 1);
  }

  addInteractable(mesh, handlers = {}) {
    this.input.addInteractable(mesh, handlers);
  }

  removeInteractable(mesh) {
    this.input.removeInteractable(mesh);
  }

  addHudObject(obj) {
    this.input.addHudObject(obj);
  }

  start() {
    this.clock.start();
    this.renderer.setAnimationLoop(() => this._tick());

    // Listen for XR session visibility changes (e.g., user removes headset,
    // guardian triggered, tracking lost). We hook here because the session is
    // created lazily by the VR button.
    const checkSession = () => {
      const session = this.renderer.xr.getSession();
      if (session && !session._nemosyneVisibilityHook) {
        session._nemosyneVisibilityHook = true;
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

  _tick() {
    const frameStart = performance.now();
    try {
      const delta = this.clock.getDelta();
      const time = this.clock.getElapsedTime();

      const frame = this.renderer.xr.getFrame();
      const refSpace = this.renderer.xr.getReferenceSpace();
      const session = this.renderer.xr.getSession();
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
        u.update(delta, time);
      }

      this.renderer.render(this.scene, this.camera);

      // Evaluate performance budget once per second to avoid overhead.
      const now = performance.now();
      if (now - this._lastBudgetCheck >= 1000) {
        this._lastBudgetCheck = now;
        const frameMs = now - frameStart;
        const snapshot = {
          frameMs,
          dropped: frameMs > this.performanceBudget.budgets.frameMs,
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

  _reportTickError(err) {
    console.error('[Engine] tick error:', err);
    const telemetry = document.getElementById('telemetry');
    if (telemetry) {
      telemetry.textContent = `TICK ERROR: ${err?.message ?? err}`;
      telemetry.style.color = '#ff0055';
    }
  }

  _addOriginMarker() {
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
    this._originMarker = markerGroup;
  }

  _onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _contextLost(event) {
    event.preventDefault();
    console.warn('[Engine] WebGL context lost');
    this._reportSessionStatus('GPU context lost — pausing render', '#ffaa00');
    // Stop the animation loop; the renderer will resume automatically once the
    // context is restored. three.js does not require manual resource recreation
    // for a simple context restoration, but we clear transient state.
    this.renderer.setAnimationLoop(null);
  }

  _contextRestored() {
    console.warn('[Engine] WebGL context restored');
    this._reportSessionStatus('GPU context restored', '#00ffcc');
    this.renderer.setAnimationLoop(() => this._tick());
  }

  dispose() {
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

  _reportSessionStatus(message, color = '#00ffcc') {
    console.log('[Engine]', message);
    const telemetry = document.getElementById('telemetry');
    if (telemetry) {
      telemetry.textContent = message;
      telemetry.style.color = color;
    }
  }
}
