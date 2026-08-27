import { Container, Text, type ContainerProperties } from '@pmndrs/uikit';
import { COLOR_TOKENS } from '../tokens.ts';

export interface ButtonProperties extends ContainerProperties {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  /**
   * When true the button is visually muted and its `onClick` is guarded (the
   * click listener stays registered so hover still fires, but the action does
   * not run). Per UX-04 / design-system §35 a disabled control must not encode
   * its state solely through colour, so a `disabledReason` — when provided —
   * is rendered as explanatory text rather than only muting the surface.
   */
  disabled?: boolean;
  disabledReason?: string;
}

export class Button extends Container {
  private _text: Text;
  private _reasonText: Text;
  private _defaultBg: number;
  private _hoverBg: number;
  private _activeBg: number;
  private _disabled = false;
  private _disabledReason: string | undefined;
  private _onClick: (() => void) | undefined;

  constructor(properties: ButtonProperties) {
    // Strip non-uikit props so we don't double-wire `onClick` (uikit wires it
    // via the EventHandlersProperties surface; we attach our own below) and
    // don't leak `label`/`variant`/`disabled*` into the Container schema.
    const {
      label,
      variant: variantProp,
      onClick,
      disabled = false,
      disabledReason,
      ...containerProps
    } = properties;
    const variant = variantProp ?? 'secondary';

    let bg: number = COLOR_TOKENS.surface.raised;
    let hoverBg: number = COLOR_TOKENS.surface.border;
    let activeBg: number = COLOR_TOKENS.interaction.focus;
    const textColor: number = COLOR_TOKENS.text.primary;
    let borderColor: number = COLOR_TOKENS.surface.border;

    if (variant === 'primary') {
      bg = COLOR_TOKENS.interaction.focus;
      hoverBg = COLOR_TOKENS.interaction.focus;
      activeBg = COLOR_TOKENS.interaction.commit;
      borderColor = COLOR_TOKENS.interaction.focus;
    } else if (variant === 'danger') {
      bg = COLOR_TOKENS.danger.destructive;
      hoverBg = COLOR_TOKENS.danger.destructive;
      activeBg = COLOR_TOKENS.epistemic.contradiction;
      borderColor = COLOR_TOKENS.danger.destructive;
    }

    super({
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      paddingX: 16,
      paddingY: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor,
      backgroundColor: bg,
      cursor: disabled ? 'default' : 'pointer',
      ...containerProps,
    });

    this._disabled = disabled;
    this._disabledReason = disabledReason;
    this._onClick = onClick;
    this._defaultBg = bg;
    this._hoverBg = hoverBg;
    this._activeBg = activeBg;

    this._text = new Text({
      text: label,
      fontSize: 14,
      color: disabled ? COLOR_TOKENS.text.secondary : textColor,
    });
    this.add(this._text);

    // Disabled-reason explanation (UX-04 / §35: not colour alone). Added only
    // while the button is disabled with a reason so it does not reserve layout
    // space on enabled buttons. Bare `Text` whose glyph raycast is already
    // no-op'd by uikit, so it cannot intercept the production pointer hit.
    this._reasonText = new Text({
      text: disabledReason ?? '',
      fontSize: 12,
      color: COLOR_TOKENS.epistemic.uncertain,
    });
    if (disabled && disabledReason) this.add(this._reasonText);

    if (disabled) this._applyDisabledStyle();

    this.addEventListener('pointerover', () => {
      if (this._disabled) return;
      this.setProperties({ backgroundColor: this._hoverBg });
    });

    this.addEventListener('pointerout', () => {
      if (this._disabled) return;
      this.setProperties({ backgroundColor: this._defaultBg });
    });

    this.addEventListener('pointerdown', () => {
      if (this._disabled) return;
      this.setProperties({ backgroundColor: this._activeBg });
    });

    this.addEventListener('pointerup', () => {
      if (this._disabled) return;
      this.setProperties({ backgroundColor: this._hoverBg });
    });

    if (onClick) {
      this.addEventListener('click', (e) => {
        e?.stopPropagation?.();
        // Guard inside the listener: the production path dispatches `click` to
        // the hit Component (uikit's glyph raycast is no-op'd for Text, so the
        // Button's own mesh is the hit), and `pointerEvents:'none'` would not
        // stop a `raycaster.intersectObject` hit in the fallback path. The guard
        // is the authoritative disabled enforcement.
        if (this._disabled) return;
        this._onClick?.();
      });
    }
  }

  private _applyDisabledStyle(): void {
    this.setProperties({
      backgroundColor: COLOR_TOKENS.surface.raised,
      borderColor: COLOR_TOKENS.surface.border,
    });
    this._text.setProperties({ color: COLOR_TOKENS.text.secondary });
  }

  private _applyEnabledStyle(): void {
    this.setProperties({
      backgroundColor: this._defaultBg,
      cursor: 'pointer',
    });
    this._text.setProperties({ color: COLOR_TOKENS.text.primary });
  }

  private _syncReasonPresence(): void {
    const shouldShow = this._disabled && !!this._disabledReason;
    const attached = this._reasonText.parent === this;
    if (shouldShow && !attached) {
      this.add(this._reasonText);
    } else if (!shouldShow && attached) {
      this.remove(this._reasonText);
    }
  }

  set label(value: string) {
    this._text.setProperties({ text: value });
  }

  set disabled(value: boolean) {
    if (this._disabled === value) return;
    this._disabled = value;
    this.setProperties({ cursor: value ? 'default' : 'pointer' });
    if (value) {
      this._applyDisabledStyle();
    } else {
      this._applyEnabledStyle();
    }
    this._syncReasonPresence();
  }

  set disabledReason(value: string | undefined) {
    this._disabledReason = value;
    this._reasonText.setProperties({ text: value ?? '' });
    this._syncReasonPresence();
  }

  get isDisabled(): boolean {
    return this._disabled;
  }

  get disabledReason(): string | undefined {
    return this._disabledReason;
  }
}