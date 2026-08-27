import { Container, Text, Input } from '@pmndrs/uikit';
import { COLOR_TOKENS, SPACING_TOKENS } from '../tokens.ts';

export interface TextFieldProperties {
  /** Initial/controlled value. */
  value?: string;
  /** Fires on user input only (not on programmatic `set value`). */
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'number';
  disabled?: boolean;
  disabledReason?: string;
  width?: number;
}

/**
 * Planar text/numeric entry field — a labelled wrapper around uikit's `Input`.
 *
 * Substrate contract (production path): `SpatialUIRoot` is never instantiated in
 * `src/`, so the live pointer path is the `SpatialPanel` fallback. uikit `Input`
 * drives text entry through a hidden DOM `<input>` element (focus + selection).
 * That DOM bridge is reachable on desktop/browser, but in WebXR there is no DOM
 * surface controllers can focus, so a `TextField` in VR is a **controlled
 * display + callback surface**: an external input driver (system-keyboard
 * overlay, dictation, or a future in-VR keyboard) writes `value`, and
 * `onChange` reports user edits made through whatever input modality owns the
 * field. Do not advertise native VR typing — that requires an input driver
 * this control does not provide.
 *
 * `set value` is silent (mirrors Slider/Toggle): it updates the displayed text
 * without echoing `onChange`, so a host binding the field to external state
 * does not create a feedback loop.
 */
export class TextField extends Container {
  private _value: string;
  private _onChange: ((value: string) => void) | undefined;
  private _disabled: boolean;
  private _disabledReason: string | undefined;
  private _label: Text;
  private _box: Container;
  private _input: Input;
  private _reasonText: Text;
  /**
   * The handler passed to uikit `Input.onValueChange`. Stored as a field so it
   * can be invoked directly in tests as the exact function the substrate calls
   * on user input (the hidden DOM `<input>` path is not exercisable in bare
   * jsdom without the uikit render root).
   */
  private _handleInput: (value: string) => void;

  constructor(properties: TextFieldProperties = {}) {
    super({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x4,
      width: properties.width,
    });

    this._value = properties.value ?? '';
    this._onChange = properties.onChange;
    this._disabled = properties.disabled ?? false;
    this._disabledReason = properties.disabledReason;

    this._label = new Text({
      text: properties.label ?? '',
      fontSize: 14,
      color: this._disabled ? COLOR_TOKENS.text.muted : COLOR_TOKENS.text.secondary,
      display: properties.label ? 'flex' : 'none',
    });
    this.add(this._label);

    this._box = new Container({
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: this._disabled ? COLOR_TOKENS.surface.base : COLOR_TOKENS.surface.raised,
      borderColor: COLOR_TOKENS.surface.border,
      borderWidth: 1,
      borderRadius: 4,
      paddingX: SPACING_TOKENS.grid.x12,
      paddingY: SPACING_TOKENS.grid.x8,
    });
    this.add(this._box);

    this._handleInput = (next: string): void => {
      this._value = next;
      this._onChange?.(next);
    };

    this._input = new Input({
      value: this._value,
      placeholder: properties.placeholder,
      type: properties.type ?? 'text',
      disabled: this._disabled,
      color: this._disabled ? COLOR_TOKENS.text.muted : COLOR_TOKENS.text.primary,
      fontSize: 14,
      flexGrow: 1,
      onValueChange: this._handleInput,
    });
    this._box.add(this._input);

    // Disabled-reason explanation (UX-04 / §35: not colour alone). Added only
    // while disabled with a reason so it does not reserve layout space on
    // enabled fields.
    this._reasonText = new Text({
      text: properties.disabledReason ?? '',
      fontSize: 12,
      color: COLOR_TOKENS.epistemic.uncertain,
    });
    if (this._disabled && properties.disabledReason) this.add(this._reasonText);
  }

  get value(): string {
    return this._value;
  }

  /** Programmatic set — updates the displayed text without firing onChange. */
  set value(v: string) {
    if (this._value === v) return;
    this._value = v;
    this._input.setProperties({ value: v });
  }

  set disabled(value: boolean) {
    if (this._disabled === value) return;
    this._disabled = value;
    this._input.setProperties({ disabled: value });
    this._label.setProperties({
      color: value ? COLOR_TOKENS.text.muted : COLOR_TOKENS.text.secondary,
    });
    this._box.setProperties({
      backgroundColor: value ? COLOR_TOKENS.surface.base : COLOR_TOKENS.surface.raised,
    });
    this._syncReasonPresence();
  }

  set disabledReason(value: string | undefined) {
    this._reasonText.setProperties({ text: value ?? '' });
    this._syncReasonPresence();
  }

  private _syncReasonPresence(): void {
    const shouldShow = this._disabled && !!this._disabledReason;
    const attached = this._reasonText.parent === this;
    if (shouldShow && !attached) this.add(this._reasonText);
    else if (!shouldShow && attached) this.remove(this._reasonText);
  }

  get isDisabled(): boolean {
    return this._disabled;
  }
}