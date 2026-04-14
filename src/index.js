/**
 * Nemosyne - Data-Native VR Visualization Framework
 * Main entry point
 * 
 * @version 1.0.0
 * @author Tsatsu Amable
 * @license MIT
 */

// Core Engine
export { DataNativeEngine } from './core/DataNativeEngine.js';
export { NemosyneDataPacket } from './core/NemosyneDataPacket.js';
export { TopologyDetector } from './core/TopologyDetector.js';
export { PropertyMapper } from './core/PropertyMapper.js';
export { LayoutEngine } from './core/LayoutEngine.js';
export { ResearchTelemetry } from './core/ResearchTelemetry.js';
export { WebSocketDataSource, loadWebSocket } from './core/WebSocketDataSource.js';
export * as TransformDSL from './core/TransformDSL.js';

// Components (side-effect: registers A-Frame components)
import './components/nemosyne-artefact-v2.js';
import './components/nemosyne-data-native.js';

// Animation
export { TemporalScrubber } from './animation/TemporalScrubber.js';
export { UncertaintyVisualizer } from './animation/UncertaintyVisualizer.js';

// Physics
export { AmmoPhysicsEngine } from './physics/AmmoPhysicsEngine.js';

// Version
export const VERSION = '1.0.0';

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

// Default export
export default {
  VERSION,
  DataNativeEngine,
  NemosyneDataPacket,
  TopologyDetector,
  PropertyMapper,
  LayoutEngine,
  TemporalScrubber,
  UncertaintyVisualizer,
  ResearchTelemetry,
  AmmoPhysicsEngine,
  WebSocketDataSource,
  TransformDSL
};
