/**
 * LayoutEngine: Spatial Positioning for Data Visualization
 * 
 * Calculates 3D positions based on:
 * - Topology type (graph, tree, timeline, scatter)
 * - Data relationships (hierarchical, temporal, spatial)
 * - Spatial constraints (avoid overlap, maintain clarity)
 * - User context (VR comfort zones, reachability)
 * 
 * Supports gesture-directed constraints for interactive layout.
 */

class LayoutEngine {
  constructor(options = {}) {
    this.options = {
      center: { x: 0, y: 1.6, z: -3 }, // VR standing eye level
      radius: 5, // Default arrangement radius
      spacing: 0.5, // Minimum spacing between elements
      ...options
    };
    
    this.originalPositions = new Map(); // id -> position (for reset)
    this.constraints = []; // Gesture-driven constraints
  }

  /**
   * Main entry point: calculate positions for all packets
   */
  calculatePositions(packets, topology) {
    const packetArray = Array.isArray(packets) ? packets : Array.from(packets);
    
    switch (topology) {
      case 'nemosyne-graph-force':
        return this.forceDirectedLayout(packetArray);
      case 'nemosyne-tree-hierarchical':
        return this.treeLayout(packetArray);
      case 'nemosyne-timeline-spiral':
        return this.spiralTimelineLayout(packetArray);
      case 'nemosyne-timeline-linear':
        return this.linearTimelineLayout(packetArray);
      case 'nemosyne-scatter-semantic':
        return this.scatterLayout(packetArray);
      case 'nemosyne-geo-globe':
        return this.globeLayout(packetArray);
      case 'nemosyne-grid-categorical':
        return this.categoricalGridLayout(packetArray);
      case 'nemosyne-heatmap-matrix':
        return this.matrixLayout(packetArray);
      default:
        return this.sphericalLayout(packetArray);
    }
  }

  /**
   * Force-directed layout for graph structures
   */
  forceDirectedLayout(packets, iterations = 100) {
    // Initialize positions randomly within sphere
    const positions = new Map();
    packets.forEach((p, i) => {
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * this.options.radius;
      
      positions.set(p.id, {
        x: this.options.center.x + r * Math.sin(phi) * Math.cos(angle),
        y: this.options.center.y + r * Math.sin(phi) * Math.sin(angle),
        z: this.options.center.z + r * Math.cos(phi)
      });
    });

    // Force simulation
    const k = this.options.spacing * 2; // Optimal distance
    const cooling = 0.95;
    let temperature = 0.5;

    for (let iter = 0; iter < iterations; iter++) {
      // Calculate forces
      const forces = new Map();
      
      // Repulsion (all pairs)
      for (const p1 of packets) {
        let fx = 0, fy = 0, fz = 0;
        const pos1 = positions.get(p1.id);
        
        for (const p2 of packets) {
          if (p1.id === p2.id) continue;
          
          const pos2 = positions.get(p2.id);
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const dz = pos1.z - pos2.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          if (dist < k) {
            const force = (k * k) / (dist + 0.1);
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
            fz += (dz / dist) * force;
          }
        }
        
        forces.set(p1.id, { x: fx, y: fy, z: fz });
      }
      
      // Attraction (along links)
      for (const p1 of packets) {
        if (!p1.relations?.links) continue;
        
        const pos1 = positions.get(p1.id);
        const force = forces.get(p1.id) || { x: 0, y: 0, z: 0 };
        
        for (const link of p1.relations.links) {
          const p2 = packets.find(p => p.id === link.to);
          if (!p2) continue;
          
          const pos2 = positions.get(p2.id);
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const dz = pos2.z - pos1.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          // Weighted attraction
          const f = (dist * dist / k) * link.weight;
          force.x += (dx / dist) * f * 0.05;
          force.y += (dy / dist) * f * 0.05;
          force.z += (dz / dist) * f * 0.05;
        }
        
        forces.set(p1.id, force);
      }
      
      // Apply forces with temperature
      for (const p of packets) {
        const pos = positions.get(p.id);
        const f = forces.get(p.id) || { x: 0, y: 0, z: 0 };
        
        pos.x += f.x * temperature;
        pos.y += f.y * temperature;
        pos.z += f.z * temperature;
      }
      
      // Cool down
      temperature *= cooling;
    }

    // Store original positions
    positions.forEach((pos, id) => {
      this.originalPositions.set(id, { ...pos });
    });

    return positions;
  }

  /**
   * Hierarchical tree layout
   */
  treeLayout(packets) {
    // Build tree hierarchy
    const root = this.buildHierarchy(packets);
    if (!root) return this.sphericalLayout(packets);

    const positions = new Map();
    
    // Recursive layout
    const layoutNode = (node, angle, depth) => {
      const radius = depth * 1.5; // Each level 1.5m further
      const x = this.options.center.x + radius * Math.cos(angle);
      const y = this.options.center.y;
      const z = this.options.center.z + radius * Math.sin(angle);
      
      positions.set(node.id, { x, y, z });
      
      // Layout children in arc
      if (node.children?.length > 0) {
        const arcSize = Math.PI / Math.max(2, depth);
        const startAngle = angle - arcSize / 2;
        
        node.children.forEach((child, i) => {
          const childAngle = startAngle + (arcSize * i / (node.children.length - 1 || 1));
          layoutNode(child, childAngle, depth + 1);
        });
      }
    };
    
    layoutNode(root, 0, 0);
    
    return positions;
  }

  buildHierarchy(packets) {
    // Return null for empty arrays
    if (!packets || packets.length === 0) return null;
    
    // Find root (node without parent or most ancestors)
    const parents = new Map();
    const byId = new Map();
    
    packets.forEach(p => {
      byId.set(p.id, p);
      if (p.relations?.parent) {
        parents.set(p.id, p.relations.parent);
      }
    });
    
    // Find root (node not listed as anyone's child)
    let rootId = packets[0].id;
    const childIds = new Set(parents.keys());
    const parentIds = Array.from(parents.values());
    for (const pid of parentIds) {
      if (!childIds.has(pid)) {
        rootId = pid;
        break;
      }
    }
    
    const buildRecursive = (id) => {
      const packet = byId.get(id);
      if (!packet) return null;
      
      const node = { ...packet, children: [] };
      
      // Find children
      packets.forEach(p => {
        if (p.relations?.parent === id) {
          const child = buildRecursive(p.id);
          if (child) node.children.push(child);
        }
      });
      
      return node;
    };
    
    return buildRecursive(rootId);
  }

  /**
   * Spiral timeline layout
   */
  spiralTimelineLayout(packets) {
    // Sort by timestamp
    const sorted = [...packets].sort((a, b) => 
      (a.context.timestamp || 0) - (b.context.timestamp || 0)
    );
    
    const positions = new Map();
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.507 degrees
    
    sorted.forEach((p, i) => {
      const radius = 2 + i * 0.15; // Expand outward
      const angle = goldenAngle * i;
      const height = (p.context.timestamp - sorted[0].context.timestamp) / 1000000;
      
      positions.set(p.id, {
        x: this.options.center.x + radius * Math.cos(angle),
        y: this.options.center.y + height,
        z: this.options.center.z + radius * Math.sin(angle)
      });
    });
    
    return positions;
  }

  /**
   * Linear timeline
   */
  linearTimelineLayout(packets) {
    if (!packets || packets.length === 0) return new Map();
    
    const sorted = [...packets].sort((a, b) => 
      (a.context?.timestamp || 0) - (b.context?.timestamp || 0)
    );
    
    const positions = new Map();
    const firstTime = sorted[0].context?.timestamp || 0;
    const lastTime = sorted[sorted.length - 1].context?.timestamp || firstTime;
    const totalSpan = lastTime - firstTime || 1;
    const length = 10; // 10 meters
    
    sorted.forEach((p, i) => {
      const t = ((p.context?.timestamp || firstTime) - firstTime) / totalSpan;
      
      positions.set(p.id, {
        x: this.options.center.x + (t - 0.5) * length,
        y: this.options.center.y + Math.sin(i * 0.5) * 0.5, // Slight variation
        z: this.options.center.z + (Math.random() - 0.5) * 2 // Depth jitter
      });
    });
    
    return positions;
  }

  /**
   * Scatter plot layout (use embeddings or random)
   */
  scatterLayout(packets) {
    const positions = new Map();
    
    // Check for embeddings
    const hasEmbeddings = packets.some(p => p.semantics.embedding);
    
    if (hasEmbeddings) {
      // Project embeddings to 3D
      // Simplified: just use first 3 dimensions or random projection
      packets.forEach(p => {
        if (p.semantics.embedding) {
          const emb = p.semantics.embedding;
          positions.set(p.id, {
            x: this.options.center.x + (emb[0] || 0) * this.options.radius,
            y: this.options.center.y + (emb[1] || 0) * this.options.radius,
            z: this.options.center.z + (emb[2] || 0) * this.options.radius
          });
        } else {
          // Random position for packets without embeddings
          positions.set(p.id, this.randomPosition());
        }
      });
    } else {
      // No embeddings: use PCA-like distribution
      packets.forEach((p, i) => {
        const angle = (i / packets.length) * Math.PI * 2;
        const radius = 2 + Math.random() * 3;
        positions.set(p.id, {
          x: this.options.center.x + radius * Math.cos(angle),
          y: this.options.center.y + (Math.random() - 0.5) * 4,
          z: this.options.center.z + radius * Math.sin(angle)
        });
      });
    }
    
    return positions;
  }

  /**
   * Geographic layout on sphere
   */
  globeLayout(packets) {
    const positions = new Map();
    
    packets.forEach(p => {
      if (p.semantics.subtype === 'latlong' || p.value?.lat) {
        const lat = p.value.lat || 0;
        const lng = p.value.lng || 0;
        
        // Convert to 3D on unit sphere
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);
        
        const radius = 3; // Globe radius
        
        positions.set(p.id, {
          x: this.options.center.x + radius * Math.sin(phi) * Math.cos(theta),
          y: this.options.center.y + radius * Math.cos(phi),
          z: this.options.center.z + radius * Math.sin(phi) * Math.sin(theta)
        });
      } else {
        positions.set(p.id, this.randomPosition());
      }
    });
    
    return positions;
  }

  /**
   * Grid layout for categorical data
   */
  categoricalGridLayout(packets) {
    // Group by category
    const categories = new Map();
    packets.forEach(p => {
      const cat = p.semantics.subtype || 'default';
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat).push(p);
    });
    
    const positions = new Map();
    const catList = Array.from(categories.keys());
    const gridSpacing = this.options.spacing * 2;
    
    catList.forEach((cat, catIndex) => {
      const items = categories.get(cat);
      const gridWidth = Math.ceil(Math.sqrt(items.length));
      
      items.forEach((p, i) => {
        const row = Math.floor(i / gridWidth);
        const col = i % gridWidth;
        
        positions.set(p.id, {
          x: this.options.center.x + (catIndex - catList.length/2) * gridSpacing * 2 + col * gridSpacing,
          y: this.options.center.y,
          z: this.options.center.z + row * gridSpacing
        });
      });
    });
    
    return positions;
  }

  /**
   * Matrix layout
   */
  matrixLayout(packets) {
    const positions = new Map();
    const spacing = this.options.spacing * 1.5;
    
    // Sort to maintain order
    packets.forEach((p, i) => {
      const row = Math.floor(i / 10);
      const col = i % 10;
      
      positions.set(p.id, {
        x: this.options.center.x + (col - 5) * spacing,
        y: this.options.center.y + (row - 5) * spacing * 0.5, // Flatter
        z: this.options.center.z
      });
    });
    
    return positions;
  }

  /**
   * Default spherical layout
   */
  sphericalLayout(packets) {
    const positions = new Map();
    
    packets.forEach((p, i) => {
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const y = 1 - (i / (packets.length - 1 || 1)) * 2; // y goes from 1 to -1
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      
      const r = this.options.radius;
      
      positions.set(p.id, {
        x: this.options.center.x + r * radius * Math.cos(theta),
        y: this.options.center.y + r * y,
        z: this.options.center.z + r * radius * Math.sin(theta)
      });
    });
    
    return positions;
  }

  randomPosition() {
    return {
      x: this.options.center.x + (Math.random() - 0.5) * this.options.radius * 2,
      y: this.options.center.y + (Math.random() - 0.5) * this.options.radius * 2,
      z: this.options.center.z + (Math.random() - 0.5) * this.options.radius * 2
    };
  }

  /**
   * Get original position for a packet (for reset)
   */
  getOriginalPosition(packetId) {
    return this.originalPositions.get(packetId);
  }

  /**
   * Add gesture-driven constraint
   */
  addConstraint(type, data) {
    this.constraints.push({ type, data });
    
    // Types:
    // 'attract-to': Pull nodes toward a point
    // 'repel-from': Push nodes away from a point
    // 'plane': Keep nodes on one side of a plane
    // 'region': Confine nodes to a region
    // 'cluster': Group specific nodes together
  }

  /**
   * Apply constraints to positions (for interactive adjustment)
   */
  applyConstraints(positions) {
    this.constraints.forEach(constraint => {
      switch (constraint.type) {
        case 'attract-to':
          this.applyAttraction(positions, constraint.data);
          break;
        case 'repel-from':
          this.applyRepulsion(positions, constraint.data);
          break;
        case 'plane':
          this.applyPlaneConstraint(positions, constraint.data);
          break;
      }
    });
    
    return positions;
  }

  applyAttraction(positions, data) {
    const { point, strength = 1.0, packetIds } = data;
    
    packetIds.forEach(id => {
      const pos = positions.get(id);
      if (pos) {
        const dx = point.x - pos.x;
        const dy = point.y - pos.y;
        const dz = point.z - pos.z;
        
        pos.x += dx * strength * 0.1;
        pos.y += dy * strength * 0.1;
        pos.z += dz * strength * 0.1;
      }
    });
  }

  applyRepulsion(positions, data) {
    const { point, strength = 1.0 } = data;
    
    positions.forEach((pos) => {
      const dx = pos.x - point.x;
      const dy = pos.y - point.y;
      const dz = pos.z - point.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (dist < strength * 2) {
        pos.x += (dx / dist) * strength;
        pos.y += (dy / dist) * strength;
        pos.z += (dz / dist) * strength;
      }
    });
  }

  applyPlaneConstraint(positions, data) {
    const { normal, offset } = data; // plane: normal · x = offset
    
    positions.forEach((pos) => {
      const dot = normal.x * pos.x + normal.y * pos.y + normal.z * pos.z;
      if (dot < offset) {
        // Move to plane
        const t = (offset - dot) / (normal.x*normal.x + normal.y*normal.y + normal.z*normal.z);
        pos.x += normal.x * t;
        pos.y += normal.y * t;
        pos.z += normal.z * t;
      }
    });
  }

  /**
   * Utility: Smoothly interpolate between layouts
   */
  interpolatePositions(currentPositions, targetPositions, t) {
    const result = new Map();
    
    currentPositions.forEach((current, id) => {
      const target = targetPositions.get(id);
      if (target) {
        result.set(id, {
          x: current.x + (target.x - current.x) * t,
          y: current.y + (target.y - current.y) * t,
          z: current.z + (target.z - current.z) * t
        });
      } else {
        result.set(id, current);
      }
    });
    
    return result;
  }
}


// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LayoutEngine;
}

export { LayoutEngine };
