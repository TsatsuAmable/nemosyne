/**
 * WebXR Frame and Session Mock Harness for E2E Spatial VR Testing.
 * Provides virtual WebXR session, viewer pose, reference spaces, and controller inputs.
 */

export class MockXRTransform {
  position: { x: number; y: number; z: number; w: number };
  orientation: { x: number; y: number; z: number; w: number };
  matrix: Float32Array;

  constructor(
    pos = { x: 0, y: 1.6, z: 0, w: 1 },
    orient = { x: 0, y: 0, z: 0, w: 1 }
  ) {
    this.position = pos;
    this.orientation = orient;
    this.matrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      pos.x, pos.y, pos.z, 1,
    ]);
  }
}

export class MockXRView {
  eye: string;
  projectionMatrix: Float32Array;
  transform: MockXRTransform;

  constructor(eye = 'left') {
    this.eye = eye;
    this.projectionMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, -1, -1,
      0, 0, -0.2, 0,
    ]);
    this.transform = new MockXRTransform(
      eye === 'left' ? { x: -0.03, y: 1.6, z: 0, w: 1 } : { x: 0.03, y: 1.6, z: 0, w: 1 }
    );
  }
}

export class MockXRViewerPose {
  transform: MockXRTransform;
  views: MockXRView[];

  constructor(pos?: { x: number; y: number; z: number; w: number }, orient?: { x: number; y: number; z: number; w: number }) {
    this.transform = new MockXRTransform(pos, orient);
    this.views = [new MockXRView('left'), new MockXRView('right')];
  }
}

export class MockXRFrame {
  session: MockXRSession;

  constructor(session: MockXRSession) {
    this.session = session;
  }

  getViewerPose(_referenceSpace: any): MockXRViewerPose {
    return this.session.currentPose;
  }

  getPose(_space: any, _baseSpace: any): any {
    return {
      transform: new MockXRTransform(),
    };
  }
}

export class MockXRInputSource {
  handedness: 'left' | 'right' | 'none';
  targetRayMode: 'gaze' | 'tracked-pointer' | 'screen';
  profiles: string[];
  targetRaySpace: any;
  gripSpace: any;
  gamepad: any;

  constructor(handedness: 'left' | 'right' = 'right') {
    this.handedness = handedness;
    this.targetRayMode = 'tracked-pointer';
    this.profiles = ['oculus-touch-v3', 'generic-trigger-squeeze-thumbstick'];
    this.targetRaySpace = { __space: 'targetRay', handedness };
    this.gripSpace = { __space: 'grip', handedness };
    this.gamepad = {
      buttons: [
        { pressed: false, touched: false, value: 0 }, // Trigger
        { pressed: false, touched: false, value: 0 }, // Grip
        { pressed: false, touched: false, value: 0 }, // Primary button
        { pressed: false, touched: false, value: 0 }, // Secondary button
      ],
      axes: [0, 0, 0, 0], // Thumbstick X/Y, Touchpad X/Y
    };
  }

  pressTrigger(value = 1.0) {
    this.gamepad.buttons[0].pressed = true;
    this.gamepad.buttons[0].value = value;
  }

  releaseTrigger() {
    this.gamepad.buttons[0].pressed = false;
    this.gamepad.buttons[0].value = 0;
  }
}

export class MockXRSession {
  mode: string;
  visibilityState: string = 'visible';
  inputSources: MockXRInputSource[] = [];
  currentPose: MockXRViewerPose;
  private animationCallbacks = new Map<number, (time: number, frame: MockXRFrame) => void>();
  private nextCallbackId = 1;
  private isEnded = false;
  renderState: any = { baseLayer: null };

  constructor(mode: string = 'immersive-vr') {
    this.mode = mode;
    this.currentPose = new MockXRViewerPose();
    this.inputSources = [new MockXRInputSource('right'), new MockXRInputSource('left')];
  }

  requestReferenceSpace(type: string): Promise<any> {
    return Promise.resolve({
      __referenceSpaceType: type,
      getOffsetReferenceSpace: () => this,
    });
  }

  updateRenderState(newState: any): void {
    Object.assign(this.renderState, newState);
  }

  requestAnimationFrame(callback: (time: number, frame: MockXRFrame) => void): number {
    const id = this.nextCallbackId++;
    this.animationCallbacks.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id: number): void {
    this.animationCallbacks.delete(id);
  }

  end(): Promise<void> {
    this.isEnded = true;
    this.animationCallbacks.clear();
    return Promise.resolve();
  }

  /**
   * Harness helper to trigger a virtual frame tick
   */
  tickFrame(timestamp = performance.now()): void {
    if (this.isEnded) return;
    const callbacks = Array.from(this.animationCallbacks.entries());
    this.animationCallbacks.clear();
    const frame = new MockXRFrame(this);
    for (const [_, cb] of callbacks) {
      cb(timestamp, frame);
    }
  }

  setPose(pos: { x: number; y: number; z: number; w: number }, orient: { x: number; y: number; z: number; w: number }): void {
    this.currentPose = new MockXRViewerPose(pos, orient);
  }
}

export function installWebXRMock(): MockXRSession {
  const activeSession = new MockXRSession('immersive-vr');
  const mockXR = {
    isSessionSupported: (mode: string) => Promise.resolve(mode === 'immersive-vr' || mode === 'inline'),
    requestSession: (_mode: string) => Promise.resolve(activeSession),
  };

  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'xr', {
      value: mockXR,
      configurable: true,
      writable: true,
    });
  }

  return activeSession;
}
