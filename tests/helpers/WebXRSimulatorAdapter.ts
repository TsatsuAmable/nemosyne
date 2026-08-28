import { XRDevice, metaQuest3 } from 'iwer';

export class WebXRSimulatorAdapter {
  device: XRDevice;

  constructor() {
    this.device = new XRDevice(metaQuest3);
  }

  install(): void {
    this.device.installRuntime({ forceInstall: true });
  }

  uninstall(): void {
    this.device.uninstallRuntime();
  }

  async startSession(): Promise<any> {
    if (typeof navigator !== 'undefined' && (navigator as any).xr) {
      const session = await (navigator as any).xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking'],
      });
      return session;
    }
    throw new Error('navigator.xr not available');
  }

  setHeadsetPosition(x: number, y: number, z: number): void {
    this.device.position.set(x, y, z);
    this.device.notifyStateChange();
  }

  setRightControllerPosition(x: number, y: number, z: number): void {
    const controller = this.device.controllers.right;
    if (controller) {
      controller.position.set(x, y, z);
      this.device.notifyStateChange();
    }
  }

  setLeftControllerPosition(x: number, y: number, z: number): void {
    const controller = this.device.controllers.left;
    if (controller) {
      controller.position.set(x, y, z);
      this.device.notifyStateChange();
    }
  }

  triggerRightControllerButton(buttonId: string, pressed: boolean, value: number = 1.0): void {
    const controller = this.device.controllers.right;
    if (controller) {
      controller.setButtonValueImmediate(buttonId, value);
      controller.updateButtonTouch(buttonId, pressed);
      this.device.notifyStateChange();
    }
  }
}
