/**
 * PropertyMapper: Maps Data Values to Visual Properties
 * 
 * The curator between data semantics and visual aesthetics.
 * Automatically determines:
 * - Color from categorical/continuous values
 * - Size from importance/magnitude
 * - Geometry from data structure
 * - Opacity from confidence/uncertainty
 * - Animation from temporal characteristics
 * 
 * Supports user overrides for curator intervention while providing
 * sensible defaults based on data semantics.
 */

class PropertyMapper {
  constructor(options = {}) {
    // Color scales
    this.colorScales = {
      ...options.colorScales,
      heatmap: ['#0000ff', '#00ff00', '#ffff00', '#ff0000'], // Blue -> Red
      diverging: ['#d73027', '#fee08b', '#1a9850'], // Red -> Yellow -> Green
      categorical: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33'],
      monochrome: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b']
    };
    
    // Domain color associations
    this.domainColors = {
      temperature: this.colorScales.heatmap,
      sales: this.colorScales.diverging,
      risk: ['#fee08b', '#f46d43', '#d73027'], // Low -> High
      health: ['#f0f9e8', '#7bccc4', '#2b8cbe'],
 ...options.domainColors
    };
    
    // Geometry mapping
    this.geometryMap = {
      point: { primitive: 'sphere', radius: 0.1 },
      vector: { primitive: 'cone', radiusBottom: 0.05, radiusTop: 0.01, height: 0.2 },
      matrix: { primitive: 'box', width: 0.15, height: 0.15, depth: 0.15 },
      graph: { primitive: 'dodecahedron', radius: 0.1 },
      tree: { primitive: 'icosahedron', radius: 0.08 },
      grid: { primitive: 'octahedron', radius: 0.1 },
      field: { primitive: 'tetrahedron', radius: 0.08 },
      default: { primitive: 'sphere', radius: 0.1 }
    };
    
    // Registry for custom mappings
    this.customMappings = new Map();
  }

  /**
   * Main mapping function: DataPacket -> VisualProperties
   */
  map(packet) {
    // Check for user overrides first
    if (packet.overrides && Object.keys(packet.overrides).length > 0) {
      // Merge auto-detected with overrides
      const autoProps = this.autoMap(packet);
      return this.mergeWithOverrides(autoProps, packet.overrides);
    }
    
    return this.autoMap(packet);
  }

  /**
   * Automatic property determination
   */
  autoMap(packet) {
    const semantics = packet.semantics;
    const context = packet.context;
    
    return {
      // Geometry from structure
      geometry: this.mapGeometry(semantics.structure),
      
      // Color from value/semantics
      color: this.mapColor(packet),
      emissive: this.mapEmissive(packet),
      emissiveIntensity: this.mapEmissiveIntensity(packet),
      
      // Scale from importance/confidence
      scale: this.mapScale(context.importance, context.confidence),
      
      // Opacity from confidence/uncertainty
      opacity: this.mapOpacity(context.confidence, semantics.uncertainty),
      
      // Material properties
      metalness: 0.8,
      roughness: 0.2,
      
      // Animation hints
      shouldAnimate: semantics.temporal || context.importance > 0.8
    };
  }

  mapGeometry(structure) {
    return this.geometryMap[structure] || this.geometryMap.default;
  }

  mapColor(packet) {
    const { semantics, value } = packet;
    
    // Categorical: hash-based color
    if (semantics.scale === 'nominal' || semantics.type === 'categorical') {
      return this.categoricalColor(value, semantics.domain);
    }
    
    // Continuous: heatmap
    if (semantics.scale === 'continuous' || semantics.type === 'quantitative') {
      const range = this.getDomainRange(semantics.domain);
      return this.valueToHeatmap(value, range, semantics.domain);
    }
    
    // Ordinal: discrete steps
    if (semantics.scale === 'ordinal') {
      return this.ordinalColor(value, semantics.domain);
    }
    
    // Default: base color with variation
    return this.hashToColor(packet.id);
  }

  mapEmissive(packet) {
    // Use same color but with intensity variation
    const baseColor = this.mapColor(packet);
    
    // High importance = brighter emission
    if (packet.context.importance > 0.8) {
      return this.lighten(baseColor, 0.3);
    }
    
    return baseColor;
  }

  mapEmissiveIntensity(packet) {
    // Vary by importance
    const importance = packet.context.importance || 0.5;
    return 0.3 + importance * 0.7; // 0.3 to 1.0
  }

  mapScale(importance = 0.5, confidence = 1.0) {
    // Base size from importance
    let size = 0.5 + importance * 1.5; // 0.5x to 2.0x
    
    // Reduce size slightly for low confidence
    size *= confidence;
    
    return { x: size, y: size, z: size };
  }

  mapOpacity(confidence = 1.0, uncertainty = 0) {
    // High confidence = more opaque
    // High uncertainty = more transparent
    return Math.max(0.3, confidence * (1 - uncertainty * 0.5));
  }

  // Color utilities
  categoricalColor(value, domain) {
    const palette = this.domainColors[domain] || this.colorScales.categorical;
    const index = this.hashString(String(value)) % palette.length;
    return palette[index];
  }

  valueToHeatmap(value, range, domain) {
    const palette = this.domainColors[domain] || this.colorScales.heatmap;
    
    // Normalize to 0-1
    let normalized = (value - range.min) / (range.max - range.min);
    normalized = Math.max(0, Math.min(1, normalized));
    
    // Find position in palette
    const position = normalized * (palette.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const t = position - lower;
    
    // Interpolate
    return this.interpolateColor(palette[lower], palette[upper], t);
  }

  ordinalColor(value, domain) {
    const palette = this.domainColors[domain] || this.colorScales.diverging;
    const index = Math.min(value, palette.length - 1);
    return palette[index] || palette[0];
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  getDomainRange(domain) {
    // Known domain ranges
    const ranges = {
      temperature: { min: -10, max: 40 },
      sales: { min: 0, max: 1000000 },
      percentage: { min: 0, max: 100 },
      risk: { min: 0, max: 1 }
    };
    
    return ranges[domain] || { min: 0, max: 100 };
  }

  interpolateColor(color1, color2, t) {
    // Parse hex colors
    const c1 = this.parseHex(color1);
    const c2 = this.parseHex(color2);
    
    // Linear interpolation
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  parseHex(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  lighten(color, percent) {
    const c = this.parseHex(color);
    const r = Math.min(255, c.r + (255 - c.r) * percent);
    const g = Math.min(255, c.g + (255 - c.g) * percent);
    const b = Math.min(255, c.b + (255 - c.b) * percent);
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  }

  hashToColor(str) {
    const hue = (this.hashString(str) % 360) / 360;
    return this.hslToHex(hue, 0.7, 0.5);
  }

  hslToHex(h, s, l) {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
  }

  // Merge auto properties with user overrides
  mergeWithOverrides(autoProps, overrides) {
    const merged = { ...autoProps };
    
    if (overrides.color) merged.color = overrides.color;
    if (overrides.geometry) merged.geometry = overrides.geometry;
    if (overrides.position) merged.position = overrides.position;
    if (overrides.scale) merged.scale = overrides.scale;
    if (overrides.animation) {
      merged.shouldAnimate = true;
      merged.animation = overrides.animation;
    }
    if (overrides.material) {
      Object.assign(merged, overrides.material);
    }
    
    return merged;
  }

  // Register custom mapping
  registerMapping(dataProperty, visualProperty, transformFn) {
    const key = `${dataProperty}:${visualProperty}`;
    this.customMappings.set(key, transformFn);
  }

  // Apply custom mapping if registered
  applyCustomMapping(packet, dataProperty, visualProperty) {
    const key = `${dataProperty}:${visualProperty}`;
    const transform = this.customMappings.get(key);
    
    if (transform) {
      const value = packet.get(dataProperty);
      return transform(value, packet);
    }
    
    return null;
  }
}


// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PropertyMapper;
}
