/**
 * Generic Utilities & Common Primitives.
 */

export { MeshPool, type IMeshPool, executeInTimeSlices } from './ObjectPool.ts';
export { disposeObject } from './Dispose.ts';
export { downloadDataUrl, downloadText } from './Download.ts';
export { SeededRandom } from './SeededRandom.ts';
export { buildReviewBundle, formatReviewBundle } from './ReviewBundle.ts';
export {
  remapColor,
  normalizeHex,
  colorFamily,
  scaleFont,
  DwellTimer,
  COLORBLIND_PALETTE,
  HIGH_CONTRAST,
  type ColorblindPalette,
  type ColorFamily,
} from './Accessibility.ts';
