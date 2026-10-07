import { Container, Text } from '@pmndrs/uikit';
import { COLOR_TOKENS, TYPOGRAPHY_TOKENS, SPACING_TOKENS } from '../tokens.ts';
import { applyGlyphFallback } from '../glyphFallback.ts';

export interface SectionHeaderProperties {
  title: string;
  /** Override the accent color (e.g. for high-contrast accessibility theming). */
  color?: number;
}

/**
 * Section divider header for panel layouts.
 * Renders "// SECTION NAME" in the established VR design language.
 */
export class SectionHeader extends Container {
  private _text: Text;

  constructor(properties: SectionHeaderProperties) {
    super({
      paddingY: SPACING_TOKENS.grid.x4,
      marginTop: SPACING_TOKENS.grid.x16,
      marginBottom: SPACING_TOKENS.grid.x4,
      // Never compress below the 16px header text: sibling rows in a fixed
      // scrollport collapse to a few px while labels still paint, stacking
      // lines onto each other.
      flexShrink: 0,
      minHeight: 28,
    });

    this._text = new Text({
      text: applyGlyphFallback(`// ${properties.title}`),
      fontSize: TYPOGRAPHY_TOKENS.scale.label,
      color: properties.color ?? COLOR_TOKENS.interaction.focus,
      fontWeight: 'bold',
    });

    this.add(this._text);
  }

  set title(value: string) {
    this._text.setProperties({ text: applyGlyphFallback(`// ${value}`) });
  }

  set color(value: number) {
    this._text.setProperties({ color: value });
  }
}