import { Container, Text } from '@pmndrs/uikit';
import { COLOR_TOKENS, SPACING_TOKENS } from '../tokens.ts';

export interface ToggleProperties {
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Binary on/off toggle switch.
 * Track with sliding thumb, styled per Nemosyne VR design tokens.
 */
export class Toggle extends Container {
  private _value: boolean;
  private _disabled: boolean;
  private _track: Container;
  private _thumb: Container;
  private _label: Text | null = null;
  private _onChange: ((value: boolean) => void) | undefined;

  constructor(properties: ToggleProperties) {
    const trackWidth = 72;
    const trackHeight = 36;
    const thumbSize = 28;

    super({
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING_TOKENS.grid.x12,
      cursor: properties.disabled ? 'default' : 'pointer',
    });

    this._value = properties.value;
    this._disabled = properties.disabled ?? false;
    this._onChange = properties.onChange;

    // Track
    this._track = new Container({
      width: trackWidth,
      height: trackHeight,
      borderRadius: trackHeight / 2,
      backgroundColor: this._trackColor(),
      borderWidth: 1,
      borderColor: this._borderColor(),
      flexDirection: 'row',
      alignItems: properties.value ? 'center' : 'center',
      justifyContent: properties.value ? 'flex-end' : 'flex-start',
      paddingX: 3,
      // Non-interactive: the track/thumb must not intercept the ray so the
      // Toggle's own panel mesh is the hit target. The production pointer path
      // (SpatialPanel.handlePointerUp) dispatches `click` to the hit Component
      // and THREE.EventDispatcher does not bubble, so a click landing on the
      // track/thumb child would never reach the listener registered on `this`.
      pointerEvents: 'none',
    });

    // Thumb
    this._thumb = new Container({
      width: thumbSize,
      height: thumbSize,
      borderRadius: thumbSize / 2,
      backgroundColor: this._thumbColor(),
      pointerEvents: 'none',
    });

    this._track.add(this._thumb);
    this.add(this._track);

    // Non-interactive visual children: no-op their raycast so the production
    // pointer path (`SpatialPanel.handlePointerUp` -> raycaster.intersectObject,
    // which does NOT consult uikit's `pointerEvents` signal and where
    // THREE.EventDispatcher does not bubble) hits the Toggle's own panel mesh
    // — where the click listener lives — rather than these children. uikit uses
    // the same no-op-raycast trick for `InstancedGlyphMesh`/Text. The
    // `pointerEvents: 'none` above additionally excludes them if a
    // `SpatialUIRoot` interaction path is ever wired in.
    this._track.raycast = () => {};
    this._thumb.raycast = () => {};

    // Optional label
    if (properties.label) {
      this._label = new Text({
        text: properties.label,
        fontSize: 16,
        color: this._disabled ? COLOR_TOKENS.text.muted : COLOR_TOKENS.text.primary,
      });
      this.add(this._label);
    }

    // Click handler on the whole toggle
    if (!this._disabled) {
      this.addEventListener('click', () => {
        this._value = !this._value;
        this._updateVisuals();
        this._onChange?.(this._value);
      });
    }
  }

  get value(): boolean {
    return this._value;
  }

  set value(v: boolean) {
    if (this._value === v) return;
    this._value = v;
    this._updateVisuals();
  }

  private _trackColor(): number {
    if (this._disabled) return COLOR_TOKENS.surface.base;
    return this._value ? COLOR_TOKENS.interaction.commit : COLOR_TOKENS.surface.raised;
  }

  private _borderColor(): number {
    if (this._disabled) return COLOR_TOKENS.text.muted;
    return this._value ? COLOR_TOKENS.interaction.commit : COLOR_TOKENS.surface.border;
  }

  private _thumbColor(): number {
    if (this._disabled) return COLOR_TOKENS.text.muted;
    return this._value ? COLOR_TOKENS.text.primary : COLOR_TOKENS.text.secondary;
  }

  private _updateVisuals(): void {
    this._track.setProperties({
      backgroundColor: this._trackColor(),
      borderColor: this._borderColor(),
      justifyContent: this._value ? 'flex-end' : 'flex-start',
    });
    this._thumb.setProperties({
      backgroundColor: this._thumbColor(),
    });
  }
}
