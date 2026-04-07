/**
 * Transform Engine
 * Converts data fields to visual properties using data-driven transforms
 */

import 'https://cdn.jsdelivr.net/npm/d3-scale@4/dist/d3-scale.min.js';
import 'https://cdn.jsdelivr.net/npm/d3-color@3/dist/d3-color.min.js';

export class TransformEngine {
  constructor() {
    this.scales = new Map();
    this.defaultScales = {
      'viridis': d3?.scaleSequential?.(d3.interpolateViridis) || null,
      'plasma': d3?.scaleSequential?.(d3.interpolatePlasma) || null,
      'warm': d3?.scaleSequential?.(d3.interpolateWarm) || null,
      'cool': d3?.scaleSequential?.(d3.interpolateCool) || null,
      'blues': d3?.scaleSequential?.(d3.interpolateBlues) || null,
      'reds': d3?.scaleSequential?.(d3.interpolateReds) || null,
      'greens': d3?.scaleSequential?.(d3.interpolateGreens) || null
    };
  }

  /**
   * Extract transforms from spec and data
   * @param {Object} transformSpec - Transform specification
   * @param {Object} data - Data record
   * @returns {Object} Resolved transforms
   */
  extractTransforms(transformSpec, data) {
    if (!transformSpec) return {};
    
    return {
      scale: this.resolveScale(transformSpec?.scale, data),
      position: this.resolvePosition(transformSpec?.position, data),
      rotation: this.resolveRotation(transformSpec?.rotation, data),
      color: this.resolveColor(transformSpec?.color || transformSpec, data)
    };
  }

  /**
   * Resolve scale transform
   */
  resolveScale(scaleSpec, data) {
    if (!scaleSpec) return 1;
    
    // Direct value
    if (typeof scaleSpec === 'number') {
      return scaleSpec;
    }
    
    // Data mapping
    if (scaleSpec.$data && data) {
      const value = this.getNestedValue(data, scaleSpec.$data);
      const range = scaleSpec.$range || [0.5, 2];
      const domain = scaleSpec.$domain || this.estimateDomain(data.$dataset, scaleSpec.$data);
      
      return this.mapRange(value, domain, range);
    }
    
    return 1;
  }

  /**
   * Resolve position transform
   */
  resolvePosition(positionSpec, data) {
    if (!positionSpec) return null;
    
    if (positionSpec.$layout) {
      // Layout is handled by the component, not here
      return null;
    }
    
    return {
      x: positionSpec.x || 0,
      y: positionSpec.y || 0,
      z: positionSpec.z || 0
    };
  }

  /**
   * Resolve rotation transform
   */
  resolveRotation(rotationSpec, data) {
    if (!rotationSpec) return null;
    
    const rotation = { x: 0, y: 0, z: 0 };
    
    ['x', 'y', 'z'].forEach(axis => {
      const val = rotationSpec[axis];
      if (typeof val === 'number') {
        rotation[axis] = val;
      } else if (val?.$data) {
        const value = this.getNestedValue(data, val.$data);
        rotation[axis] = value || 0;
      }
    });
    
    return rotation;
  }

  /**
   * Resolve color transform
   */
  resolveColor(colorSpec, data) {
    if (!colorSpec) return '#00d4aa';
    
    // Direct color
    if (typeof colorSpec === 'string' && !colorSpec.startsWith('$')) {
      return colorSpec;
    }
    
    // Data-driven color
    if (colorSpec.$data) {
      const value = this.getNestedValue(data, colorSpec.$data);
      const map = colorSpec.$map;
      
      if (map && this.defaultScales[map]) {
        return this.defaultScales[map](value) || '#00d4aa';
      }
      
      // Simple category mapping
      if (map === 'category10') {
        const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
        return colors[Math.abs(value?.toString?.()?.charCodeAt(0) || 0) % 10];
      }
      
      // Diverging (e.g., negative/positive)
      if (map?.includes('diverging') || map?.includes('rdgy')) {
        return value >= 0 ? '#00d4aa' : '#ff3864';
      }
    }
    
    return '#00d4aa';
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Map value from one range to another
   */
  mapRange(value, domain, range) {
    if (value === undefined || value === null) return range[0];
    
    const [dMin, dMax] = domain;
    const [rMin, rMax] = range;
    
    if (dMax === dMin) return rMin;
    
    const normalized = Math.max(0, Math.min(1, (value - dMin) / (dMax - dMin)));
    return rMin + normalized * (rMax - rMin);
  }

  /**
   * Estimate domain from dataset (would be calculated from full data in real implementation)
   */
  estimateDomain(dataset, field) {
    // Placeholder: return default domain
    return [0, 100];
  }
}
