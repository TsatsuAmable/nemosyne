/**
 * Nemosyne Framework v0.2.0
 * Stabilized API with layout engine, connectors, and validation
 * 
 * Main entry point that registers all A-Frame components
 */

// Components
import { NemosyneArtefactV2 } from './components/nemosyne-artefact-v2.js';
import { NemosyneConnector } from './components/nemosyne-connector.js';
import { NemosyneScene } from './components/nemosyne-scene.js';

// Modules
import { layoutEngine, LayoutEngine } from './layouts/layout-engine.js';
import { ArtefactBuilder } from './components/artefact-builder.js';
import { TransformEngine } from './transforms/transform-engine.js';
import { BehaviourEngine } from './behaviours/behaviour-engine.js';
import { DataLoader } from './utils/data-loader.js';
import { MaterialFactory } from './utils/material-factory.js';
import { Validator, validateSpec, validateData } from './utils/validator.js';

// Quick start API
import { quickStart, presets, loadData } from './api/quick-start.js';

// Register A-Frame components
if (typeof AFRAME !== 'undefined') {
  // New v2 component (recommended)
  AFRAME.registerComponent('nemosyne-artefact-v2', NemosyneArtefactV2);
  
  // Legacy v1 component (backwards compatibility)
  // AFRAME.registerComponent('nemosyne-artefact', NemosyneArtefact);
  
  // Connector component
  AFRAME.registerComponent('nemosyne-connector', NemosyneConnector);
  
  // Scene component
  AFRAME.registerComponent('nemosyne-scene', NemosyneScene);
  
  console.log('🐾 Nemosyne v0.2.0 loaded. Components: nemosyne-artefact-v2, nemosyne-connector, nemosyne-scene');
} else {
  console.warn('Nemosyne: AFRAME not found. Make sure to load A-Frame before Nemosyne.');
}

// Main API
export const Nemosyne = {
  // Version
  VERSION: '0.2.0',

  // Quick start
  quickStart,
  presets,
  loadData,

  // Core modules
  LayoutEngine,
  layoutEngine,
  ArtefactBuilder,
  TransformEngine,
  BehaviourEngine,
  DataLoader,
  MaterialFactory,
  Validator,

  // Validation helpers
  validateSpec,
  validateData,

  /**
   * Create a visualization programmatically
   * @param {HTMLElement} container - Container element
   * @param {Object} spec - Artefact specification
   * @param {Object} data - Data object
   * @param {Object} options - Additional options
   */
  create(container, spec, data, options = {}) {
    const el = document.createElement('a-entity');
    el.setAttribute('nemosyne-artefact-v2', {
      spec: JSON.stringify(spec),
      dataset: JSON.stringify(data),
      layout: options.layout || 'grid',
      animate: options.animate !== false,
      interactive: options.interactive !== false,
      debug: options.debug || false
    });
    
    container.appendChild(el);
    return el;
  },

  /**
   * Register a custom layout
   * @param {string} name - Layout name
   * @param {Function} fn - Layout function
   */
  registerLayout(name, fn) {
    layoutEngine.register(name, fn);
  },

  /**
   * Create connector between two elements
   * @param {HTMLElement} fromEl - Source element
   * @param {HTMLElement} toEl - Target element
   * @param {Object} style - Connector style
   */
  connect(fromEl, toEl, style = {}) {
    const connector = document.createElement('a-entity');
    connector.setAttribute('nemosyne-connector', {
      from: fromEl,
      to: toEl,
      ...style
    });
    
    // Add to common parent
    const scene = fromEl.sceneEl || toEl.sceneEl;
    if (scene) {
      scene.appendChild(connector);
    }
    
    return connector;
  }
};

// Default export
export default Nemosyne;

// Global for CDN usage
if (typeof window !== 'undefined') {
  window.Nemosyne = Nemosyne;
}
