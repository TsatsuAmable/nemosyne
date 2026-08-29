/**
 * P1-USIM WebXR simulator adapter (dev/test-only).
 *
 * Wraps the IWER (Immersive Web Emulation Runtime) WebXR device runtime behind
 * a deterministic, bounded harness so product UI/input tests can drive the real
 * WebXR surface Nemosyne ships (XRSession / XRFrame / XRInputSource /
 * XRReferenceSpace) without a physical headset.
 *
 * Invariants enforced by this module and its tests:
 *
 * 1. The adapter only ever mutates IWER device/session state. It never calls
 *    NIL/Atlas/component callbacks directly; simulated input reaches production
 *    code only through the real WebXR objects consumed by `InputRouter.update`.
 * 2. It is dev/test-only. No `src/` module may import `iwer` or this module.
 * 3. Disabling the simulator (`uninstall()`) restores the previous
 *    `navigator.xr`, `userAgent` and any DOM geometry globals that had to be
 *    shimmed for the test environment, so no persistent side effects remain.
 * 4. Unsupported simulator capabilities fail explicitly (`UNSUPPORTED` /
 *    `UnsupportedSimulatorCapabilityError`) rather than fabricating success.
 */

import {
  XRDevice,
  metaQuest3,
  XRWebGLLayer,
  XRSession as IWERXRSession,
  XRFrame as IWERXRFrame,
  XRReferenceSpace as IWERXRReferenceSpace,
  type XRDeviceConfig,
  P_HAND_INPUT,
} from 'iwer';

/**
 * Capabilities Nemosyne cares about for gating deterministic scenarios. IWER
 * advertises a `supportedFeatures` list; the adapter records which of those are
 * trustworthy for gating and fails closed otherwise.
 */
export type SimulatorCapability = string;

export class UnsupportedSimulatorCapabilityError extends Error {
  constructor(feature: string, message?: string) {
    super(message ?? `IWER simulator does not support capability '${feature}'.`);
    this.name = 'UnsupportedSimulatorCapabilityError';
  }
}

export interface SimulatorSession {
  session: XRSession;
  referenceSpace: XRReferenceSpace;
  frame: XRFrame | null;
}

/**
 * Minimal DOM geometry shims required by IWER in Node/jsdom. IWER constructs
 * real `XRRigidTransform`/`XRPose` objects using `DOMPointReadOnly` and the
 * WebGL2 context for `makeXRCompatible`. These are usually absent in a test
 * runtime; the adapter installs minimal implementations and restores the prior
 * state on uninstall so tests have no persistent side effects.
 */
const DOM_SHIM_NAMES = [
  'DOMPointReadOnly',
  'DOMPoint',
  'DOMMatrixReadOnly',
  'DOMMatrix',
  'WebGL2RenderingContext',
] as const;

function shimDOMPoint(): void {
  const Ctor = class DOMPointReadOnlyShim {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
    static fromPoint(p: { x?: number; y?: number; z?: number; w?: number }): DOMPointReadOnlyShim {
      return new DOMPointReadOnlyShim(p.x ?? 0, p.y ?? 0, p.z ?? 0, p.w ?? 1);
    }
    matrixTransform(): DOMPointReadOnlyShim {
      return this;
    }
  };
  (globalThis as Record<string, unknown>).DOMPointReadOnly = Ctor;
  (globalThis as Record<string, unknown>).DOMPoint = Ctor;
}

function shimDOMMatrix(): void {
  const Ctor = class DOMMatrixReadOnlyShim {
    is2D = true;
    isIdentity = true;
    constructor(init?: string | number[]) {
      void init;
    }
    translate(): DOMMatrixReadOnlyShim {
      return this;
    }
    multiply(): DOMMatrixReadOnlyShim {
      return this;
    }
    inverse(): DOMMatrixReadOnlyShim {
      return this;
    }
    toFloat32Array(): Float32Array {
      return new Float32Array(16);
    }
  };
  (globalThis as Record<string, unknown>).DOMMatrixReadOnly = Ctor;
  (globalThis as Record<string, unknown>).DOMMatrix = Ctor;
}

function shimWebGL2RenderingContext(): void {
  // IWER calls defineMakeXRCompatible(WebGL2RenderingContext.prototype) at
  // installRuntime; the constructor only needs a prototype object in tests.
  (globalThis as Record<string, unknown>).WebGL2RenderingContext = { prototype: {} };
}

interface GlobalState {
  key: string;
  existed: boolean;
  value: unknown;
}

export class WebXRSimulatorAdapter {
  readonly device: XRDevice;

  private _installed = false;
  private _session: IWERXRSession | null = null;
  private _referenceSpace: IWERXRReferenceSpace | null = null;
  private _restoredGlobals: GlobalState[] = [];
  /**
   * IWER shares one `oculusHandConfig` poses singleton across every XRDevice.
   * `configureHandPinch` rewrites joint geometry to satisfy Nemosyne's pinch
   * threshold, so the adapter snapshots the original matrices on install and
   * restores them on uninstall to avoid leaking the mutation into other
   * devices/tests (no persistent side effects).
   */
  private _handPoseSnapshot: Array<{
    side: 'left' | 'right';
    pose: string;
    joint: string;
    offsetMatrix: number[];
  }> = [];

  constructor(deviceConfig: XRDeviceConfig = metaQuest3) {
    this.device = new XRDevice(deviceConfig);
  }

  get installed(): boolean {
    return this._installed;
  }

  /** The real emulated session, cast to the DOM surface Nemosyne consumes. */
  get session(): XRSession | null {
    return this._session as unknown as XRSession | null;
  }

  get referenceSpace(): XRReferenceSpace | null {
    return this._referenceSpace as unknown as XRReferenceSpace | null;
  }

  get activeSession(): SimulatorSession | null {
    if (!this._session || !this._referenceSpace) return null;
    return {
      session: this._session as unknown as XRSession,
      referenceSpace: this._referenceSpace as unknown as XRReferenceSpace,
      frame: null,
    };
  }

  /**
   * Capability matrix of IWER/metaQuest3. `supportedFeatures` reflects what the
   * emulated runtime actually advertises; the matrix records which of those are
   * trustworthy enough to gate deterministic scenarios and which must fail
   * closed.
   */
  supportedFeatures(): SimulatorCapability[] {
    return [...(this.device.supportedFeatures as SimulatorCapability[])];
  }

  supportsFeature(feature: string): boolean {
    return this.device.supportedFeatures.includes(feature);
  }

  /**
   * Fail closed for capabilities IWER cannot honestly simulate. Simulating a
   * fake success for an unsupported capability would violate the "fail
   * unsupported simulator capabilities explicitly" contract.
   */
  assertSupported(feature: string): void {
    if (!this.supportsFeature(feature)) {
      throw new UnsupportedSimulatorCapabilityError(feature);
    }
  }

  install(): void {
    if (this._installed) return;
    this._restoredGlobals = DOM_SHIM_NAMES.map((key) => {
      const g = globalThis as Record<string, unknown>;
      const existed = key in g;
      const value = g[key];
      if (!existed) {
        if (key === 'DOMPointReadOnly' || key === 'DOMPoint') shimDOMPoint();
        else if (key === 'DOMMatrixReadOnly' || key === 'DOMMatrix') shimDOMMatrix();
        else if (key === 'WebGL2RenderingContext') shimWebGL2RenderingContext();
      }
      return { key, existed, value };
    });
    // Force-install so tests override any ambient runtime deterministically.
    this.device.installRuntime({ forceInstall: true });
    // IWER exposes programmatic control for deterministic scenarios.
    this.device.controlMode = 'programmatic';
    this._snapshotHandPoses();
    this._installed = true;
  }

  private _snapshotHandPoses(): void {
    this._handPoseSnapshot = [];
    for (const side of ['left', 'right'] as const) {
      const poses = this._getHandPoses(side);
      if (!poses) continue;
      for (const pose of ['default', 'pinch', 'point']) {
        const jointTransforms = poses[pose]?.jointTransforms;
        if (!jointTransforms) continue;
        for (const joint of Object.keys(jointTransforms)) {
          const offsetMatrix = jointTransforms[joint]?.offsetMatrix;
          if (!offsetMatrix) continue;
          this._handPoseSnapshot.push({
            side,
            pose,
            joint,
            offsetMatrix: Array.from(offsetMatrix),
          });
        }
      }
    }
  }

  private _restoreHandPoses(): void {
    for (const entry of this._handPoseSnapshot) {
      const poses = this._getHandPoses(entry.side);
      const offsetMatrix = poses?.[entry.pose]?.jointTransforms?.[entry.joint]?.offsetMatrix;
      if (offsetMatrix) {
        for (let i = 0; i < entry.offsetMatrix.length; i++) {
          offsetMatrix[i] = entry.offsetMatrix[i];
        }
      }
    }
    this._handPoseSnapshot = [];
  }

  private _getHandPoses(
    side: 'left' | 'right'
  ): Record<string, { jointTransforms: Record<string, { offsetMatrix: number[] }> }> | undefined {
    const hand = this.device.hands[side];
    if (!hand) return undefined;
    return (
      hand as unknown as {
        [P_HAND_INPUT]?: {
          poses: Record<string, { jointTransforms: Record<string, { offsetMatrix: number[] }> }>;
        };
      }
    )[P_HAND_INPUT]?.poses;
  }

  uninstall(): void {
    if (!this._installed) return;
    this._session = null;
    this._referenceSpace = null;
    this.device.uninstallRuntime();
    for (const entry of this._restoredGlobals) {
      const g = globalThis as Record<string, unknown>;
      if (entry.existed) {
        g[entry.key] = entry.value;
      } else {
        delete g[entry.key];
      }
    }
    this._restoredGlobals = [];
    this._restoreHandPoses();
    this._installed = false;
  }

  /**
   * Start a real immersive-vr session through `navigator.xr`. Returns the real
   * IWER XRSession and reference space. Requires the runtime to be installed.
   */
  async startSession(
    options: {
      requiredFeatures?: string[];
      optionalFeatures?: string[];
      referenceSpaceType?: 'viewer' | 'local' | 'local-floor' | 'bounded-floor' | 'unbounded';
    } = {}
  ): Promise<SimulatorSession> {
    if (!this._installed) throw new Error('WebXRSimulatorAdapter: install() before startSession()');
    const xr = (navigator as Navigator & {
      xr?: { requestSession: (...args: unknown[]) => Promise<unknown> };
    }).xr;
    if (!xr) throw new Error('WebXRSimulatorAdapter: navigator.xr unavailable after install');

    const session = (await xr.requestSession('immersive-vr', {
      requiredFeatures: options.requiredFeatures ?? ['local-floor'],
      optionalFeatures: options.optionalFeatures ?? ['hand-tracking'],
    })) as unknown as IWERXRSession;
    this._session = session;

    const referenceSpace = (await session.requestReferenceSpace(
      // IWER defines an XRReferenceSpaceType enum; the DOM lib's global type is
      // structurally incompatible, so pass the string literal and cast at the
      // boundary exactly as `navigator.xr` would at runtime.
      (options.referenceSpaceType ?? 'local-floor') as never
    )) as unknown as IWERXRReferenceSpace;
    this._referenceSpace = referenceSpace;

    // IWER only advances device frames when a base layer is set. Bind a layer
    // to the test canvas's WebGL context so real frames/poses are produced.
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (gl) {
        const layer = new XRWebGLLayer(session, gl);
        await session.updateRenderState({ baseLayer: layer });
      }
    } catch (err) {
      // A real browser will supply its own layer via the renderer. Without one
      // the emulator cannot drive frames, but session/pose objects still exist.
      console.warn('[WebXRSimulatorAdapter] no base layer bound:', err);
    }

    // Wait for the device frame loop to publish input sources so the session is
    // usable by InputRouter. Bounded so a broken runtime fails rather than hangs.
    await this.waitForInputSources(2000);

    return {
      session: session as unknown as XRSession,
      referenceSpace: referenceSpace as unknown as XRReferenceSpace,
      frame: null,
    };
  }

  async endSession(): Promise<void> {
    const session = this._session;
    this._session = null;
    this._referenceSpace = null;
    if (session) {
      try {
        await session.end();
      } catch (err) {
        console.warn('[WebXRSimulatorAdapter] session.end() failed:', err);
      }
    }
  }

  async waitForInputSources(timeoutMs = 2000): Promise<void> {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      const sources = this._session?.inputSources;
      if (sources && Array.from(sources).length > 0) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    // Do not silently succeed: a session with no input sources cannot drive the
    // production InputRouter path deterministically.
    throw new Error('WebXRSimulatorAdapter: no XR input sources became available');
  }

  getInputSources(): XRInputSource[] {
    return this._session
      ? (Array.from(this._session.inputSources) as unknown as XRInputSource[])
      : [];
  }

  /**
   * Run `fn` inside a real XR animation frame callback so `frame` is valid for
   * the callback duration (XRFrame is only valid inside its callback). Returns
   * the callback result, or `null` when no frame was produced within the
   * timeout.
   */
  runInFrame<T>(fn: (frame: XRFrame) => T, timeoutMs = 2000): Promise<T | null> {
    const session = this._session;
    if (!session) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      try {
        session.requestAnimationFrame((_time, frame: IWERXRFrame) => {
          clearTimeout(timer);
          resolve(fn(frame as unknown as XRFrame));
        });
      } catch (err) {
        clearTimeout(timer);
        console.warn('[WebXRSimulatorAdapter] requestAnimationFrame failed:', err);
        resolve(null);
      }
    });
  }

  // ---- Pose / input driving ------------------------------------------------

  /** Move the headset in world space. */
  setHeadPose(x: number, y: number, z: number): void {
    this.device.position.set(x, y, z);
    this.device.notifyStateChange();
  }

  /**
   * Drive a controller pose. `side` is `left`/`right`; position in world space.
   * Keeps the controller's current orientation.
   */
  setControllerPosition(side: 'left' | 'right', x: number, y: number, z: number): void {
    const controller = this.device.controllers[side];
    if (!controller) return;
    controller.position.set(x, y, z);
    this.device.notifyStateChange();
  }

  /**
   * Press or release the trigger on a controller. `setButtonValueImmediate`
   * makes the value readable on the next device frame; the real session input
   * source gamepad then reflects `pressed` for `InputRouter._pollSelection`.
   */
  setControllerTrigger(side: 'left' | 'right', pressed: boolean): void {
    const controller = this.device.controllers[side];
    if (!controller) return;
    controller.setButtonValueImmediate('trigger', pressed ? 1 : 0);
    controller.updateButtonTouch('trigger', pressed);
    this.device.notifyStateChange();
  }

  setPrimaryInputMode(mode: 'controller' | 'hand'): void {
    this.device.primaryInputMode = mode;
    this.device.notifyStateChange();
  }

  /**
   * Inject an XR session visibility change (USIM-A lifecycle fault). IWER
   * queues the state until the next device frame, then dispatches a real
   * `visibilitychange` event on the session. While not `visible`, IWER returns
   * an empty `inputSources` list, so this also exercises "input source
   * disappears" through the real session surface the production InputRouter
   * polls.
   */
  setSessionVisibilityState(state: 'visible' | 'visible-blurred' | 'hidden'): void {
    const device = this.device as unknown as {
      updateVisibilityState(st: string): void;
      visibilityState: string;
    };
    device.updateVisibilityState(state);
    this.device.notifyStateChange();
  }

  get sessionVisibilityState(): 'visible' | 'visible-blurred' | 'hidden' {
    const device = this.device as unknown as { visibilityState: string };
    return (device.visibilityState as 'visible' | 'visible-blurred' | 'hidden') ?? 'visible';
  }

  /**
   * Disconnect/reconnect an emulated input source (USIM-A lifecycle fault).
   * Toggling `XRTrackedInput.connected` removes/re-adds the source from the
   * real session `inputSources`, and the next device frame marks the change so
   * three.js-style `inputsourceschange` handling observes it.
   */
  setInputSourceConnected(side: 'left' | 'right', connected: boolean): void {
    const tracked = (this.device as unknown as {
      controllers: Record<string, { connected: boolean }>;
      hands: Record<string, { connected: boolean }>;
    });
    const controller = tracked.controllers[side];
    const hand = tracked.hands[side];
    if (controller) controller.connected = connected;
    if (hand) hand.connected = connected;
    this.device.notifyStateChange();
  }

  /**
   * Configure the emulated hand so that index-finger-tip and thumb-tip approach
   * each other (pinch) or separate. IWER's shipped pinch pose keeps the tips
   * ~9cm apart, which is above Nemosyne's 0.04m pinch threshold, so the adapter
   * rewrites the emulated joint geometry deterministically and records that
   * IWER's default pose is not calibrated to Nemosyne's threshold.
   */
  configureHandPinch(side: 'left' | 'right', pinched: boolean): void {
    const hand = this.device.hands[side];
    if (!hand) return;
    const poses = this._getHandPoses(side);
    if (!poses) return;
    const gap = pinched ? 0.02 : 0.15;
    for (const pose of ['default', 'pinch', 'point']) {
      const jointTransforms = poses[pose]?.jointTransforms;
      if (!jointTransforms) continue;
      const thumb = jointTransforms['thumb-tip'];
      const index = jointTransforms['index-finger-tip'];
      if (!thumb || !index) continue;
      // Mutate the shared matrices IN PLACE (same array references) so the
      // install-time snapshot can restore them exactly on uninstall without
      // leaving dangling replaced references in the shared oculusHandConfig.
      // Column-major identity + translation (z=-0.3 along the hand ray).
      const indexMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -0.3, 1];
      const thumbMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, gap, 0, -0.3, 1];
      for (let i = 0; i < 16; i++) {
        index.offsetMatrix[i] = indexMatrix[i];
        thumb.offsetMatrix[i] = thumbMatrix[i];
      }
    }
    hand.poseId = 'default';
    hand.updatePinchValue(pinched ? 0.95 : 0.0);
    hand.updateHandPose();
    this.device.notifyStateChange();
  }
}