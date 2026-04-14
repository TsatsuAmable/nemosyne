/**
 * Nemosyne - Data-Native VR Visualization Framework
 * Main entry point
 * 
 * @version 1.2.0
 * @author Tsatsu Amable
 * @license MIT
 */

// Framework v0.2 (stabilized API)
// This imports and re-exports the framework that powers the documented API
import NemosyneFramework from './framework/index-v2.js';

// Core Engine (legacy exports for backwards compatibility)
export { DataNativeEngine } from './core/DataNativeEngine.js';
export { NemosyneDataPacket } from './core/NemosyneDataPacket.js';
export { TopologyDetector } from './core/TopologyDetector.js';
export { PropertyMapper } from './core/PropertyMapper.js';
export { LayoutEngine as CoreLayoutEngine } from './core/LayoutEngine.js';
export { ResearchTelemetry } from './core/ResearchTelemetry.js';
export { WebSocketDataSource, loadWebSocket } from './core/WebSocketDataSource.js';
export * as TransformDSL from './core/TransformDSL.js';

// Physics
export { AmmoPhysicsEngine } from './physics/AmmoPhysicsEngine.js';

// Animation (legacy)
export { TemporalScrubber } from './animation/TemporalScrubber.js';
export { UncertaintyVisualizer } from './animation/UncertaintyVisualizer.js';

// Version
export const VERSION = '1.2.1';

// Re-export framework as main API
export const Nemosyne = NemosyneFramework;
export const {
  quickStart,
  presets,
  loadData,
  LayoutEngine,
  layoutEngine,
  ArtefactBuilder,
  TransformEngine,
  BehaviourEngine,
  DataLoader,
  MaterialFactory,
  Validator,
  validateSpec,
  validateData,
  create,
  registerLayout,
  connect
} = NemosyneFramework;

// Default export matches README documentation
export default NemosyneFramework;

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNemosyne);
  } else {
    initNemosyne();
  }
}

function initNemosyne() {
  console.log(`[Nemosyne] v${VERSION} initialized`);
  
  // Dispatch global ready event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nemosyne-ready', {
      detail: { version: VERSION }
    }));
  }
}
