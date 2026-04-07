/**
 * Nemosyne Quick Start API
 * Simplified, declarative API for common use cases
 */

import { layoutEngine } from '../layouts/layout-engine.js';

/**
 * Create a simple visualization with minimal configuration
 * @param {HTMLElement} container - A-Frame scene or entity
 * @param {Object} config - Configuration object
 * @returns {HTMLElement} The created nemosyne-artefact element
 * 
 * Example:
 * Nemosyne.quickStart(scene, {
 *   type: 'crystal',
 *   data: [42, 56, 23, 89],
 *   layout: 'bar',
 *   color: 'teal'
 * });
 */
export function quickStart(container, config) {
  const defaults = {
    type: 'crystal',
    data: [],
    layout: 'grid',
    color: '#00d4aa',
    labels: true,
    animate: true
  };
  
  const opts = { ...defaults, ...config };
  
  // Convert data array to records
  const records = opts.data.map((d, i) => ({
    id: `item-${i}`,
    value: typeof d === 'number' ? d : d.value || 0,
    label: typeof d === 'object' ? d.label : String(d),
    ...((typeof d === 'object' && !d.value && !d.label) ? d : {})
  }));
  
  // Determine geometry based on type
  const geometry = getGeometryForType(opts.type);
  
  // Build spec
  const spec = {
    id: `${opts.type}-${Date.now()}`,
    geometry: geometry,
    material: {
      properties: {
        color: opts.color,
        emissive: opts.color,
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.2
      }
    },
    transform: {
      scale: opts.type === 'bar' ? { $data: 'value', $range: [1, 5] } : { $data: 'value', $range: [0.5, 1.5] }
    },
    behaviours: [
      { trigger: 'hover', action: 'glow', params: { intensity: 2 } },
      { trigger: 'hover-leave', action: 'glow', params: { intensity: 0.4 } },
      { trigger: 'click', action: opts.labels ? 'show-label' : 'scale', params: { factor: 1.3 } },
      { trigger: 'idle', action: 'rotate', params: { speed: 0.2, axis: 'y' } }
    ],
    labels: opts.labels ? {
      primary: { $data: 'label' },
      color: '#fff',
      position: opts.type === 'bar' ? 'below' : 'above'
    } : null
  };
  
  // Map layout shorthand to full layout name
  const layoutMap = {
    'bar': 'grid',
    'line': 'timeline',
    'scatter': 'scatter',
    'network': 'force',
    'tree': 'tree',
    'spiral': 'spiral',
    'grid': 'grid',
    'radial': 'radial',
    'timeline': 'timeline'
  };
  
  // Create element
  const el = document.createElement('a-entity');
  el.setAttribute('nemosyne-artefact-v2', {
    spec: JSON.stringify(spec),
    dataset: JSON.stringify({ records }),
    layout: layoutMap[opts.layout] || 'grid',
    animate: opts.animate
  });
  
  container.appendChild(el);
  return el;
}

function getGeometryForType(type) {
  const map = {
    'crystal': { type: 'octahedron', radius: 1 },
    'sphere': { type: 'sphere', radius: 0.8 },
    'bar': { type: 'box' },
    'node': { type: 'dodecahedron', radius: 0.7 },
    'orb': { type: 'sphere', radius: 1 }
  };
  return map[type] || map['crystal'];
}

/**
 * Pre-configured presets for common visualizations
 */
export const presets = {
  /**
   * Bar chart preset
   */
  barChart(data, options = {}) {
    return {
      type: 'bar',
      data,
      layout: 'bar',
      color: options.color || '#00d4aa',
      ...options
    };
  },

  /**
   * Network graph preset
   */
  network(nodes, edges, options = {}) {
    return {
      type: 'node',
      data: nodes.map((n, i) => ({ id: i, ...n })),
      layout: 'network',
      connections: edges,
      color: options.color || 'category10',
      ...options
    };
  },

  /**
   * Timeline preset
   */
  timeline(data, options = {}) {
    return {
      type: 'crystal',
      data,
      layout: 'timeline',
      color: options.color || 'viridis',
      ...options
    };
  },

  /**
   * Scatter plot preset
   */
  scatter(data, options = {}) {
    return {
      type: 'sphere',
      data,
      layout: 'scatter',
      color: options.color || 'category10',
      ...options
    };
  }
};

/**
 * Helper to load data from various sources
 */
export async function loadData(source) {
  if (typeof source === 'string') {
    // URL
    const res = await fetch(source);
    return await res.json();
  }
  if (typeof source === 'object') {
    // Already an object
    return source;
  }
  throw new Error('Data source must be a URL or object');
}
