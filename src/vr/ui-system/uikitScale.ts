/**
 * Canonical UIKit design-pixel scale.
 *
 * `@pmndrs/uikit` lays out components in design pixels and converts to local
 * units with `pixelSize` (default `0.01`, see the package's
 * `properties/defaults.js`; Nemosyne does not override it). A panel whose
 * design width is `PANEL_WIDTH` therefore spans
 * `PANEL_WIDTH * UIKIT_PIXEL_SIZE` local units, and the root scale that maps
 * that span to a world width in metres is
 * `worldWidth / (PANEL_WIDTH * UIKIT_PIXEL_SIZE)`.
 *
 * Dividing by the raw design pixels instead collapses the card to ~1/100th
 * of its intended size (millimetres) so it is effectively invisible in the
 * headset. Every `SpatialPanel` subclass must derive its scale from
 * {@link panelWorldScale} so the divisor cannot drift per file again.
 */
export const UIKIT_PIXEL_SIZE = 0.01;

/**
 * Root scale mapping a panel's design-pixel width to a world width in metres.
 */
export function panelWorldScale(worldWidthMetres: number, panelWidthPx: number): number {
  return worldWidthMetres / (panelWidthPx * UIKIT_PIXEL_SIZE);
}
