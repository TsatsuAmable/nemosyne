import { Container, Text, type ContainerProperties } from '@pmndrs/uikit';
import { COLOR_TOKENS } from '../tokens.ts';

export interface ButtonProperties extends ContainerProperties {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
}

export class Button extends Container {
  private _text: Text;
  private _defaultBg: number;
  private _hoverBg: number;
  private _activeBg: number;

  constructor(properties: ButtonProperties) {
    // Strip non-uikit props so we don't double-wire `onClick` (uikit wires it
    // via the EventHandlersProperties surface; we attach our own below) and
    // don't leak `label`/`variant` into the Container schema.
    const { label, variant: variantProp, onClick, ...containerProps } = properties;
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
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingX: 16,
      paddingY: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor,
      backgroundColor: bg,
      cursor: 'pointer',
      ...containerProps,
    });

    this._defaultBg = bg;
    this._hoverBg = hoverBg;
    this._activeBg = activeBg;

    this._text = new Text({
      text: label,
      fontSize: 14,
      color: textColor,
    });
    this.add(this._text);

    this.addEventListener('pointerover', () => {
      this.setProperties({ backgroundColor: this._hoverBg });
    });

    this.addEventListener('pointerout', () => {
      this.setProperties({ backgroundColor: this._defaultBg });
    });

    this.addEventListener('pointerdown', () => {
      this.setProperties({ backgroundColor: this._activeBg });
    });

    this.addEventListener('pointerup', () => {
      this.setProperties({ backgroundColor: this._hoverBg });
    });

    if (onClick) {
      this.addEventListener('click', (e) => {
        e?.stopPropagation?.();
        onClick();
      });
    }
  }

  set label(value: string) {
    this._text.setProperties({ text: value });
  }
}
