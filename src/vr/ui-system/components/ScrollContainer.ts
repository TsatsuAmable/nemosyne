import { Container, type ContainerProperties } from '@pmndrs/uikit';
import { COLOR_TOKENS, SPACING_TOKENS } from '../tokens.ts';

export interface ScrollContainerProperties extends ContainerProperties {
  /** Fixed height for the scrollable region. */
  scrollHeight?: number;
}

/**
 * Scrollable container with standard padding and gap.
 * Wraps the proven `overflow: 'scroll'` pattern from HolographicInspector.
 */
export class ScrollContainer extends Container {
  constructor(properties: ScrollContainerProperties = {}) {
    const { scrollHeight = 400, ...rest } = properties;

    super({
      flexDirection: 'column',
      overflow: 'scroll',
      height: scrollHeight,
      gap: SPACING_TOKENS.grid.x8,
      padding: SPACING_TOKENS.grid.x8,
      backgroundColor: COLOR_TOKENS.surface.base,
      borderRadius: 4,
      borderColor: COLOR_TOKENS.surface.border,
      borderWidth: 1,
      ...rest,
    });
  }
}
