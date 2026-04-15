/**
 * Nemosyne — Orbital Awareness Edition
 * Minimal, focused build for 3D NEO visualization
 * 
 * @version 2.0.0-orbital
 * @author Tsatsu Amable
 * @license MIT
 */

// Core Essentials
export { DataNativeEngine } from './core/DataNativeEngine.js';
export { PropertyMapper } from './core/PropertyMapper.js';
export { LayoutEngine } from './core/LayoutEngine.js';
export * as TransformDSL from './core/TransformDSL.js';

// Data Loading (individual utilities)
export { parseCSV, fetchCSV, transformRecords, filterRecords, groupBy } from './core/DataLoader.js';

// Version
export const VERSION = '2.0.0-orbital';

// Initialize
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNemosyne);
  } else {
    initNemosyne();
  }
}

function initNemosyne() {
  console.log(`[Nemosyne Orbital] v${VERSION} initialized — Ready for asteroid tracking`);
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nemosyne-ready', {
      detail: { version: VERSION, variant: 'orbital' }
    }));
  }
}
