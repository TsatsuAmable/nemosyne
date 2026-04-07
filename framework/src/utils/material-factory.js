/**
 * Material Factory
 * Creates materials for geometries based on specifications
 */

export class MaterialFactory {
  constructor() {
    this.defaults = {
      shader: 'standard',
      color: '#00d4aa',
      emissive: '#000000',
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      metalness: 0.5,
      roughness: 0.5,
      wireframe: false
    };
  }

  /**
   * Create material properties for A-Frame
   * @param {Object} spec - Material specification
   * @param {Object} data - Data record for dynamic values
   * @returns {Object} Material properties
   */
  create(spec, data) {
    if (!spec) {
      return { ...this.defaults };
    }
    
    const props = spec.properties || spec;
    const material = { ...this.defaults };
    
    // Apply each property
    Object.keys(props).forEach(key => {
      const value = props[key];
      
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        material[key] = value;
      } else if (value?.$data) {
        // Data-driven property
        const dataValue = data?.[value.$data];
        
        if (key === 'color' && value.$map) {
          material[key] = this.mapColor(dataValue, value.$map);
        } else if (key === 'scale' && value.$range) {
          material[key] = this.mapRange(dataValue, value.$domain, value.$range);
        } else {
          material[key] = dataValue || value.default || this.defaults[key];
        }
      }
    });
    
    // Auto-enable transparency if opacity < 1
    if (material.opacity < 1) {
      material.transparent = true;
    }
    
    return material;
  }

  /**
   * Map value to color using named scale
   */
  mapColor(value, scaleName) {
    const palettes = {
      'viridis': this.interpolateViridis.bind(this),
      'plasma': this.interpolatePlasma.bind(this),
      'warm': this.interpolateWarm.bind(this),
      'cool': this.interpolateCool.bind(this),
      'category10': this.categoricalColors.bind(this),
      'rdgy': this.redGrey.bind(this), // diverging
      'diverging-rdgy': this.redGrey.bind(this)
    };
    
    const interpolator = palettes[scaleName];
    if (interpolator) {
      return interpolator(value);
    }
    
    return value || '#00d4aa';
  }

  /**
   * Simple categorical colors
   */
  categoricalColors(value) {
    const colors = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', 
      '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', 
      '#bcbd22', '#17becf'
    ];
    
    if (typeof value === 'number') {
      return colors[value % 10];
    }
    
    if (typeof value === 'string') {
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % 10];
    }
    
    return colors[0];
  }

  /**
   * Diverging red-grey for positive/negative
   */
  redGrey(value) {
    if (value >= 0) {
      return '#00d4aa'; // Positive - teal
    }
    return '#ff3864'; // Negative - rose
  }

  /**
   * Simple viridis approximation
   */
  interpolateViridis(t) {
    t = Math.max(0, Math.min(1, t));
    // Simplified viridis: dark blue -> cyan -> yellow
    const r = Math.floor(68 + t * 220);
    const g = Math.floor(1 + t * 180);
    const b = Math.floor(84 + (1-t) * 80);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Simple plasma approximation
   */
  interpolatePlasma(t) {
    t = Math.max(0, Math.min(1, t));
    // Simplified plasma: dark purple -> orange -> yellow
    const r = Math.floor(63 + t * 250);
    const g = Math.floor(1 + t * 200);
    const b = Math.floor(150 + (1-t) * 100);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Warm colors
   */
  interpolateWarm(t) {
    t = Math.max(0, Math.min(1, t));
    const r = 255;
    const g = Math.floor(100 + t * 155);
    const b = Math.floor(t * 100);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Cool colors
   */
  interpolateCool(t) {
    t = Math.max(0, Math.min(1, t));
    const r = Math.floor(t * 100);
    const g = Math.floor(150 + t * 105);
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}
