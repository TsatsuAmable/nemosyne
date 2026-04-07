/**
 * Nemosyne Core Framework
 * Main entry point that registers all A-Frame components
 */

import { NemosyneArtefact } from './components/nemosyne-artefact.js';
import { NemosyneScene } from './components/nemosyne-scene.js';
import * as Transforms from './transforms/index.js';
import * as Behaviours from './behaviours/index.js';
import * as Utils from './utils/index.js';

// Register A-Frame components
if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('nemosyne-artefact', NemosyneArtefact);
  AFRAME.registerComponent('nemosyne-scene', NemosyneScene);
} else {
  console.warn('Nemosyne: AFRAME not found. Make sure to load A-Frame before Nemosyne.');
}

// Export modules for programmatic use
export { Transforms, Behaviours, Utils };

// Version
export const VERSION = '0.1.0';

// Factory function for creating artefacts programmatically
export function createArtefact(spec, data, container) {
  const entity = document.createElement('a-entity');
  entity.setAttribute('nemosyne-artefact', {
    spec: spec,
    data: data
  });
  
  if (container) {
    container.appendChild(entity);
  }
  
  return entity;
}

// Default export
export default {
  VERSION,
  createArtefact,
  Transforms,
  Behaviours,
  Utils
};
