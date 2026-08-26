import { Container, Text } from '@pmndrs/uikit';
import { COLOR_TOKENS, SPACING_TOKENS } from '../tokens.ts';

export interface SliderProperties {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  width?: number;
  formatValue?: (v: number) => string;
}

/**
 * Horizontal slider control with a draggable thumb.
 *
 * Drag tracking uses the pointer-capture path on the underlying `SpatialPanel`
 * (and `SpatialUIRoot`): on `pointerdown` the panel captures the pointer, and
 * subsequent `pointermove` events are dispatched to the captured component
 * with the raycast `uv` attached (`ThreePointerEvent = Intersection & {…}`).
 * The track's `uv.x` spans `[0, 1]` across its width, so it maps directly to the
 * value fraction. The fill and thumb are `pointerEvents: 'none'` so the track
 * is always the hit target and receives a consistent, track-local `uv`.
 */
export class Slider extends Container {
  private _value: number;
  private _min: number;
  private _max: number;
  private _step: number;
  private _disabled: boolean;
  private _trackBg: Container;
  private _trackFill: Container;
  private _thumb: Container;
  private _valueLabel: Text;
  private _onChange: ((value: number) => void) | undefined;
  private _trackWidth: number;
  private _isDragging = false;
  private _formatValue: (v: number) => string;

  constructor(properties: SliderProperties) {
    const trackWidth = properties.width ?? 160;
    const trackHeight = 8;
    const thumbSize = 24;

    super({
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING_TOKENS.grid.x12,
      cursor: properties.disabled ? 'default' : 'pointer',
    });

    this._value = properties.value;
    this._min = properties.min;
    this._max = properties.max;
    this._step = properties.step ?? 0;
    this._disabled = properties.disabled ?? false;
    this._onChange = properties.onChange;
    this._trackWidth = trackWidth;
    this._formatValue = properties.formatValue ?? ((v: number) => v.toFixed(2));

    // Track background — the only interactive surface.
    this._trackBg = new Container({
      width: trackWidth,
      height: trackHeight,
      borderRadius: trackHeight / 2,
      backgroundColor: this._disabled ? COLOR_TOKENS.text.muted : COLOR_TOKENS.surface.border,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      cursor: this._disabled ? 'default' : 'pointer',
    });

    // Fill — grows with the value fraction; non-interactive.
    this._trackFill = new Container({
      width: trackWidth * this._fraction(),
      height: trackHeight,
      backgroundColor: this._disabled ? COLOR_TOKENS.text.muted : COLOR_TOKENS.interaction.focus,
      borderRadius: trackHeight / 2,
      pointerEvents: 'none',
    });
    this._trackBg.add(this._trackFill);

    // Thumb — centered on the fill's leading edge via a negative left margin;
    // non-interactive so the track always owns the pointer hit.
    this._thumb = new Container({
      width: thumbSize,
      height: thumbSize,
      borderRadius: thumbSize / 2,
      backgroundColor: this._disabled ? COLOR_TOKENS.text.muted : COLOR_TOKENS.interaction.focus,
      borderWidth: 2,
      borderColor: COLOR_TOKENS.text.primary,
      marginLeft: -thumbSize / 2,
      pointerEvents: 'none',
    });
    this._trackBg.add(this._thumb);

    // The fill and thumb are visual-only. No-op their raycast so the production
    // pointer path (`SpatialPanel.handlePointerDown` -> raycaster.intersectObject,
    // which does NOT consult uikit's `pointerEvents` signal, and where children
    // are biased in front of parents) hits the track (`_trackBg`) — where the
    // drag listeners live and whose local uv spans [0,1] — instead of these
    // children. The `pointerEvents: 'none'` above additionally excludes them if
    // a `SpatialUIRoot` interaction path is ever wired in. uikit uses the same
    // no-op-raycast trick for `InstancedGlyphMesh`/Text.
    this._trackFill.raycast = () => {};
    this._thumb.raycast = () => {};

    this.add(this._trackBg);

    // Value label.
    this._valueLabel = new Text({
      text: this._formatValue(this._value),
      fontSize: 14,
      color: this._disabled ? COLOR_TOKENS.text.muted : COLOR_TOKENS.text.secondary,
    });
    this.add(this._valueLabel);

    if (!this._disabled) {
      this._trackBg.addEventListener('pointerdown', (e) => {
        this._isDragging = true;
        this._updateFromEvent(e);
      });
      this._trackBg.addEventListener('pointermove', (e) => {
        if (this._isDragging) this._updateFromEvent(e);
      });
      this._trackBg.addEventListener('pointerup', () => {
        this._isDragging = false;
      });
      this._trackBg.addEventListener('pointercancel', () => {
        this._isDragging = false;
      });
    }
  }

  get value(): number {
    return this._value;
  }

  /** Programmatic set — updates visuals without firing onChange (no feedback loop). */
  set value(v: number) {
    this._setValue(v, /* silent */ true);
  }

  /**
   * Programmatic increment for stepper-style / keyboard usage. Advances to the
   * next step boundary strictly above the current value (a relative epsilon
   * guards against float drift so an on-boundary value still advances by one
   * step rather than stalling).
   */
  increment(): void {
    if (this._step > 0) {
      const eps = this._step * 1e-9;
      this._setValue(Math.ceil((this._value + eps) / this._step) * this._step);
    } else {
      this._setValue(this._value + this._effectiveStep());
    }
  }

  decrement(): void {
    if (this._step > 0) {
      const eps = this._step * 1e-9;
      this._setValue(Math.floor((this._value - eps) / this._step) * this._step);
    } else {
      this._setValue(this._value - this._effectiveStep());
    }
  }

  /** Map a normalized fraction `[0, 1]` to a clamped, step-snapped value. */
  private _fractionToValue(fraction: number): number {
    const clamped = Math.max(0, Math.min(1, fraction));
    let v = this._min + clamped * (this._max - this._min);
    if (this._step > 0) {
      v = Math.round(v / this._step) * this._step;
    }
    return Math.max(this._min, Math.min(this._max, v));
  }

  private _updateFromEvent(e: { uv?: { x?: number } | null }): void {
    const uv = e.uv;
    if (!uv || typeof uv.x !== 'number') return;
    this._setValue(this._fractionToValue(uv.x));
  }

  private _setValue(raw: number, silent = false): void {
    let v = Math.max(this._min, Math.min(this._max, raw));
    if (this._step > 0) {
      v = Math.round(v / this._step) * this._step;
      v = Math.max(this._min, Math.min(this._max, v));
    }
    // Clamp floating-point drift introduced by step rounding.
    v = Math.max(this._min, Math.min(this._max, v));
    if (v === this._value) return;
    this._value = v;
    this._updateVisuals();
    if (!silent) this._onChange?.(this._value);
  }

  private _effectiveStep(): number {
    return this._step > 0 ? this._step : (this._max - this._min) / 20;
  }

  private _fraction(): number {
    const range = this._max - this._min;
    if (range <= 0) return 0;
    return (this._value - this._min) / range;
  }

  private _updateVisuals(): void {
    const fraction = this._fraction();
    this._trackFill.setProperties({
      width: this._trackWidth * fraction,
    });
    this._valueLabel.setProperties({
      text: this._formatValue(this._value),
    });
  }
}