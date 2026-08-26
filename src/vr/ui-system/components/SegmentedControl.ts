import { Container, Text } from '@pmndrs/uikit';
import { COLOR_TOKENS, SPACING_TOKENS } from '../tokens.ts';

export interface SegmentedControlProperties {
  options: string[];
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

/**
 * Horizontal segmented control for choosing between a small set of options.
 * Active segment is highlighted; others are subdued.
 */
export class SegmentedControl extends Container {
  private _value: string;
  private _options: string[];
  private _segments: Map<string, Container> = new Map();
  private _segmentLabels: Map<string, Text> = new Map();
  private _onChange: ((value: string) => void) | undefined;
  private _disabled: boolean;

  constructor(properties: SegmentedControlProperties) {
    super({
      flexDirection: 'row',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: COLOR_TOKENS.surface.border,
      overflow: 'hidden',
    });

    this._value = properties.value;
    this._options = properties.options;
    this._onChange = properties.onChange;
    this._disabled = properties.disabled ?? false;

    for (const option of this._options) {
      const isActive = option === this._value;

      const segment = new Container({
        paddingX: SPACING_TOKENS.grid.x12,
        paddingY: SPACING_TOKENS.grid.x8,
        backgroundColor: isActive ? COLOR_TOKENS.interaction.focus : COLOR_TOKENS.surface.raised,
        cursor: this._disabled ? 'default' : 'pointer',
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
      });

      const label = new Text({
        text: this._formatLabel(option),
        fontSize: 13,
        color: isActive ? COLOR_TOKENS.surface.base : COLOR_TOKENS.text.secondary,
        fontWeight: isActive ? 'bold' : 'normal',
      });

      segment.add(label);
      this._segments.set(option, segment);
      this._segmentLabels.set(option, label);
      this.add(segment);

      if (!this._disabled) {
        segment.addEventListener('click', () => {
          if (this._value === option) return;
          this._value = option;
          this._updateVisuals();
          this._onChange?.(this._value);
        });
      }
    }
  }

  get value(): string {
    return this._value;
  }

  set value(v: string) {
    if (!this._options.includes(v) || this._value === v) return;
    this._value = v;
    this._updateVisuals();
  }

  private _formatLabel(option: string): string {
    return option.charAt(0).toUpperCase() + option.slice(1);
  }

  private _updateVisuals(): void {
    for (const [option, segment] of this._segments.entries()) {
      const isActive = option === this._value;
      segment.setProperties({
        backgroundColor: isActive ? COLOR_TOKENS.interaction.focus : COLOR_TOKENS.surface.raised,
      });
      const label = this._segmentLabels.get(option);
      label?.setProperties({
        color: isActive ? COLOR_TOKENS.surface.base : COLOR_TOKENS.text.secondary,
        fontWeight: isActive ? 'bold' : 'normal',
      });
    }
  }
}
