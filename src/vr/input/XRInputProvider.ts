import {
  InputComponent,
  StatefulGamepad,
  loadInputProfile,
  type InputLayout,
} from '@iwsdk/xr-input';

export interface XRInputButtonState {
  /** True when the provider has a standards-profile mapping for this button. */
  available: boolean;
  pressed: boolean;
  down: boolean;
  up: boolean;
}

export interface XRInputProvider {
  /** Sample the current XR sources exactly once before routing this frame. */
  update(session: XRSession | null): void;
  getSelect(source: XRInputSource | null): XRInputButtonState;
  getSqueeze(source: XRInputSource | null): XRInputButtonState;
  reset(): void;
}

const UNAVAILABLE_BUTTON: Readonly<XRInputButtonState> = Object.freeze({
  available: false,
  pressed: false,
  down: false,
  up: false,
});

interface DeviceEntry {
  device: StatefulGamepad;
  gamepad: Gamepad;
  selectComponentId: string;
}

/**
 * Thin adapter over Meta IWSDK's profile-aware stateful gamepad.
 *
 * This intentionally does not instantiate `XRInputManager`: Nemosyne keeps its
 * existing Three.js scene, pointer visuals and semantic routing while IWSDK
 * becomes the commodity authority for WebXR button/profile normalization.
 */
export class IWSDKXRInputProvider implements XRInputProvider {
  private readonly _devices = new Map<XRInputSource, DeviceEntry>();
  private readonly _select = new Map<XRInputSource, XRInputButtonState>();
  private readonly _squeeze = new Map<XRInputSource, XRInputButtonState>();
  private readonly _warnedSources = new WeakSet<XRInputSource>();

  update(session: XRSession | null): void {
    if (!session?.inputSources) {
      this.reset();
      return;
    }

    const sources = Array.from(session.inputSources).filter(Boolean);
    const live = new Set(sources);

    for (const source of this._devices.keys()) {
      if (!live.has(source)) {
        this._devices.delete(source);
        this._select.delete(source);
        this._squeeze.delete(source);
      }
    }

    for (const source of sources) {
      const gamepad = source.gamepad;
      if (!gamepad) {
        this._devices.delete(source);
        this._select.set(source, { ...UNAVAILABLE_BUTTON });
        this._squeeze.set(source, { ...UNAVAILABLE_BUTTON });
        continue;
      }

      try {
        let entry = this._devices.get(source);
        if (!entry || entry.gamepad !== gamepad) {
          const config = loadInputProfile(source);
          entry = {
            device: new StatefulGamepad(config),
            gamepad,
            selectComponentId: (config.layout as InputLayout).selectComponentId,
          };
          this._devices.set(source, entry);
        }

        entry.device.update();
        const selectAvailable = entry.device.buttonMapping.has(entry.selectComponentId);
        const squeezeAvailable = entry.device.buttonMapping.has(InputComponent.Squeeze);

        this._select.set(source, {
          available: selectAvailable,
          pressed: selectAvailable && entry.device.getSelecting(),
          down: selectAvailable && entry.device.getSelectStart(),
          up: selectAvailable && entry.device.getSelectEnd(),
        });
        this._squeeze.set(source, {
          available: squeezeAvailable,
          pressed: squeezeAvailable && entry.device.getButtonPressed(InputComponent.Squeeze),
          down: squeezeAvailable && entry.device.getButtonDown(InputComponent.Squeeze),
          up: squeezeAvailable && entry.device.getButtonUp(InputComponent.Squeeze),
        });
      } catch (error) {
        // Unknown/partial input profiles must never take down the render loop.
        // The router will fall back to the legacy state path for this source.
        this._devices.delete(source);
        this._select.set(source, { ...UNAVAILABLE_BUTTON });
        this._squeeze.set(source, { ...UNAVAILABLE_BUTTON });
        if (!this._warnedSources.has(source)) {
          this._warnedSources.add(source);
          console.warn('[XRInputProvider] IWSDK profile unavailable; using legacy input fallback', error);
        }
      }
    }
  }

  getSelect(source: XRInputSource | null): XRInputButtonState {
    if (!source) return { ...UNAVAILABLE_BUTTON };
    return this._select.get(source) ?? { ...UNAVAILABLE_BUTTON };
  }

  getSqueeze(source: XRInputSource | null): XRInputButtonState {
    if (!source) return { ...UNAVAILABLE_BUTTON };
    return this._squeeze.get(source) ?? { ...UNAVAILABLE_BUTTON };
  }

  reset(): void {
    this._devices.clear();
    this._select.clear();
    this._squeeze.clear();
  }
}
