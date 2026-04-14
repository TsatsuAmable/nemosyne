/**
 * Layout Engine
 * Calculates positions for collections of artefacts
 */

export class LayoutEngine {
  constructor() {
    this.layouts = new Map();
    this.registerDefaultLayouts();
  }

  registerDefaultLayouts() {
    this.layouts.set('grid', this.gridLayout.bind(this));
    this.layouts.set('radial', this.radialLayout.bind(this));
    this.layouts.set('timeline', this.timelineLayout.bind(this));
    this.layouts.set('spiral', this.spiralLayout.bind(this));
    this.layouts.set('tree', this.treeLayout.bind(this));
    this.layouts.set('force', this.forceLayout.bind(this));
    this.layouts.set('scatter', this.scatterLayout.bind(this));
  }

  /**
   * Calculate positions for data records
   * @param {string} layoutName - Layout algorithm name
   * @param {Array} records - Data records
   * @param {Object} options - Layout-specific options
   * @returns {Array} Array of {x, y, z} positions
   */
  calculate(layoutName, records, options = {}) {
    const layoutFn = this.layouts.get(layoutName);
    if (!layoutFn) {
      console.warn(`Nemosyne: Unknown layout "${layoutName}". Using scatter.`);
      return this.scatterLayout(records, options);
    }
    return layoutFn(records, options);
  }

  /**
   * Alias for calculate() - maintains compatibility with core API
   * @param {Array} records - Data records (or first arg as layout name)
   * @param {string|Object} layoutNameOrOptions - Layout name or options
   * @param {Object} options - Layout options
   * @returns {Array} Array of {x, y, z} positions
   */
  calculatePositions(records, layoutNameOrOptions, options = {}) {
    // Handle different call signatures
    if (typeof layoutNameOrOptions === 'string') {
      return this.calculate(layoutNameOrOptions, records, options);
    }
    // If second arg is options object, default to scatter
    return this.calculate('scatter', records, layoutNameOrOptions || options);
  }

  /**
   * Grid layout - rows and columns
   */
  gridLayout(records, options = {}) {
    const cols = options.columns || Math.ceil(Math.sqrt(records.length));
    const spacing = options.spacing || 3;
    const offset = options.offset || { x: 0, y: 0, z: 0 };
    
    return records.map((_, i) => ({
      x: ((i % cols) - (cols - 1) / 2) * spacing + offset.x,
      y: (Math.floor(i / cols) - Math.floor((records.length - 1) / cols) / 2) * -spacing + offset.y,
      z: offset.z
    }));
  }

  /**
   * Radial layout - circular arrangement
   */
  radialLayout(records, options = {}) {
    const radius = options.radius || 5;
    const angleOffset = options.angleOffset || 0;
    const yOffset = options.yOffset || 0;
    
    return records.map((_, i) => {
      const angle = (i / records.length) * Math.PI * 2 + angleOffset;
      return {
        x: Math.cos(angle) * radius,
        y: yOffset,
        z: Math.sin(angle) * radius
      };
    });
  }

  /**
   * Timeline layout - linear arrangement along X axis
   */
  timelineLayout(records, options = {}) {
    const spacing = options.spacing || 3;
    const totalWidth = (records.length - 1) * spacing;
    const yOffset = options.yOffset || 0;
    const zOffset = options.zOffset || 0;
    
    return records.map((_, i) => ({
      x: (i * spacing) - (totalWidth / 2),
      y: yOffset,
      z: zOffset
    }));
  }

  /**
   * Spiral layout - rising spiral
   */
  spiralLayout(records, options = {}) {
    const radius = options.radius || 5;
    const heightStep = options.heightStep || 0.5;
    const rotations = options.rotations || 2;
    const radiusShrink = options.radiusShrink || 0.3; // 0-1, how much radius decreases
    
    return records.map((_, i) => {
      const t = i / records.length;
      const angle = t * Math.PI * 2 * rotations;
      const r = radius * (1 - t * radiusShrink);
      
      return {
        x: Math.cos(angle) * r,
        y: i * heightStep,
        z: Math.sin(angle) * r
      };
    });
  }

  /**
   * Tree layout - hierarchical arrangement
   */
  treeLayout(records, options = {}) {
    const levelHeight = options.levelHeight || 3;
    const siblingSpacing = options.siblingSpacing || 4;
    
    // Build tree structure from flat records
    const nodes = records.map(r => ({ ...r, children: [], width: 1 }));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Link parents and children
    nodes.forEach(node => {
      if (node.parent && nodeMap.has(node.parent)) {
        const parent = nodeMap.get(node.parent);
        parent.children.push(node);
      }
    });
    
    // Calculate positions recursively
    const root = nodes.find(n => !n.parent) || nodes[0];
    this.calculateTreePositions(root, 0, 0, 0, siblingSpacing);
    
    return nodes.map(n => ({ x: n.x, y: n.y, z: n.z }));
  }

  calculateTreePositions(node, x, y, z, siblingSpacing) {
    node.x = x;
    node.y = y;
    node.z = z;
    
    if (node.children.length > 0) {
      const totalWidth = (node.children.length - 1) * siblingSpacing;
      const startX = x - totalWidth / 2;
      
      node.children.forEach((child, i) => {
        this.calculateTreePositions(
          child,
          startX + i * siblingSpacing,
          y - 3, // Lower levels
          z,
          siblingSpacing
        );
      });
    }
  }

  /**
   * Force layout - simple force-directed (placeholder for full implementation)
   */
  forceLayout(records, options = {}) {
    // Simplified: random positions with repulsion
    // Full implementation would use a proper physics engine
    const bounds = options.bounds || 10;
    
    return records.map(() => ({
      x: (Math.random() - 0.5) * bounds,
      y: (Math.random() - 0.5) * bounds * 0.5,
      z: (Math.random() - 0.5) * bounds
    }));
  }

  /**
   * Scatter layout - random positions
   */
  scatterLayout(records, options = {}) {
    const bounds = options.bounds || 10;
    
    return records.map(() => ({
      x: (Math.random() - 0.5) * bounds,
      y: (Math.random() - 0.5) * bounds * 0.5,
      z: (Math.random() - 0.5) * bounds
    }));
  }

  /**
   * Register custom layout
   * @param {string} name - Layout name
   * @param {Function} fn - Layout function (records, options) => positions
   */
  register(name, fn) {
    this.layouts.set(name, fn);
  }
}

// Singleton instance
export const layoutEngine = new LayoutEngine();
