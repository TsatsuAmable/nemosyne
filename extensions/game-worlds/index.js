/**
 * Game World Visualization Extension
 * Level editing, NPC paths, performance profiling
 */

/**
 * Navigation Mesh Visualizer
 * Renders walkable areas and obstacles for game AI
 */
export class NavMeshVisualizer {
  constructor() {
    this.navMesh = null;
    this.waypoints = [];
    this.connections = [];
  }

  /**
   * Load navmesh from common formats
   * @param {Object} data - Navmesh data
   * @param {string} format - 'recast', 'unity', 'custom'
   */
  loadNavMesh(data, format = 'custom') {
    switch (format) {
      case 'recast':
        return this.parseRecast(data);
      case 'unity':
        return this.parseUnity(data);
      case 'custom':
      default:
        return this.parseCustom(data);
    }
  }

  parseRecast(data) {
    // Recast navigation mesh format
    const { header, verts, polys, areas } = data;
    
    const vertices = [];
    const polygons = [];
    
    // Parse vertices
    for (let i = 0; i < verts.length; i += 3) {
      vertices.push({
        x: verts[i],
        y: verts[i + 1],
        z: verts[i + 2]
      });
    }
    
    // Parse polygons
    for (let i = 0; i < polys.length; i += header.maxVertsPerPoly) {
      const poly = [];
      for (let j = 0; j < header.maxVertsPerPoly; j++) {
        if (polys[i + j] !== 0xffff) {
          poly.push(polys[i + j]);
        }
      }
      if (poly.length >= 3) {
        polygons.push({
          vertices: poly,
          area: areas[i / header.maxVertsPerPoly] || 0
        });
      }
    }
    
    this.navMesh = { vertices, polygons, header };
    return this.navMesh;
  }

  parseUnity(data) {
    // Unity NavMesh format
    const { vertices, indices, areas } = data;
    
    const verts = vertices.map((v, i) => ({
      x: v.x || vertices[i * 3],
      y: v.y || vertices[i * 3 + 1],
      z: v.z || vertices[i * 3 + 2]
    }));
    
    const polygons = [];
    for (let i = 0; i < indices.length; i += 3) {
      polygons.push({
        vertices: [indices[i], indices[i + 1], indices[i + 2]],
        area: areas ? areas[i / 3] : 0
      });
    }
    
    this.navMesh = { vertices: verts, polygons };
    return this.navMesh;
  }

  parseCustom(data) {
    this.navMesh = data;
    return data;
  }

  /**
   * Generate visualization data for Nemosyne
   * @returns {Object} Nodes and edges for rendering
   */
  toNemosyneData(options = {}) {
    if (!this.navMesh) return { nodes: [], edges: [] };
    
    const { showWalkable = true, showConnections = true, heightOffset = 0.1 } = options;
    const { vertices, polygons } = this.navMesh;
    
    const nodes = [];
    const edges = [];
    
    // Generate surface visualization
    if (showWalkable) {
      polygons.forEach((poly, i) => {
        // Calculate centroid
        let cx = 0, cy = 0, cz = 0;
        poly.vertices.forEach(vidx => {
          const v = vertices[vidx];
          cx += v.x;
          cy += v.y;
          cz += v.z;
        });
        cx /= poly.vertices.length;
        cy /= poly.vertices.length;
        cz /= poly.vertices.length;
        
        // Get area type
        const areaType = poly.area || 0;
        const colors = ['#00d4aa', '#ffaa00', '#ff3864', '#6b4ee6'];
        
        nodes.push({
          id: `poly-${i}`,
          type: 'navmesh-poly',
          position: { x: cx, y: cy + heightOffset, z: cz },
          color: colors[areaType % colors.length],
          polygon: poly,
          centroid: { x: cx, y: cy, z: cz },
          size: this.calculatePolygonArea(poly, vertices)
        });
      });
    }
    
    // Generate edge connections
    if (showConnections) {
      const edgeMap = new Map();
      
      polygons.forEach((poly, i) => {
        // Find shared edges with other polygons
        for (let j = i + 1; j < polygons.length; j++) {
          const shared = this.findSharedEdge(poly, polygons[j]);
          if (shared) {
            const edgeKey = `poly-${i}-poly-${j}`;
            edges.push({
              id: edgeKey,
              source: `poly-${i}`,
              target: `poly-${j}`,
              midpoint: shared.midpoint,
              weight: shared.length
            });
          }
        }
      });
    }
    
    return { nodes, edges };
  }

  calculatePolygonArea(poly, vertices) {
    // Shoelace formula for 3D polygon projected to plane
    let area = 0;
    const v = poly.vertices.map(idx => vertices[idx]);
    
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length;
      area += v[i].x * v[j].z;
      area -= v[j].x * v[i].z;
    }
    
    return Math.abs(area) / 2;
  }

  findSharedEdge(poly1, poly2) {
    const shared = [];
    poly1.vertices.forEach(v1 => {
      if (poly2.vertices.includes(v1)) {
        shared.push(v1);
      }
    });
    
    if (shared.length === 2) {
      const v1 = this.navMesh.vertices[shared[0]];
      const v2 = this.navMesh.vertices[shared[1]];
      
      const length = Math.sqrt(
        Math.pow(v2.x - v1.x, 2) +
        Math.pow(v2.y - v1.y, 2) +
        Math.pow(v2.z - v1.z, 2)
      );
      
      return {
        vertices: shared,
        length,
        midpoint: {
          x: (v1.x + v2.x) / 2,
          y: (v1.y + v2.y) / 2,
          z: (v1.z + v2.z) / 2
        }
      };
    }
    
    return null;
  }

  /**
   * Calculate path between two points
   * @param {Object} start - {x, y, z}
   * @param {Object} end - {x, y, z}
   * @returns {Array} Array of waypoints
   */
  findPath(start, end) {
    // Simplified A* - would use proper implementation
    // Find start and end polygons
    const startPoly = this.findContainingPolygon(start);
    const endPoly = this.findContainingPolygon(end);
    
    if (!startPoly || !endPoly) return null;
    
    // Simple straight line (would do proper A* through graph)
    return [start, end];
  }

  findContainingPolygon(point) {
    if (!this.navMesh) return null;
    
    return this.navMesh.polygons.find(poly => {
      // Simplified point-in-polygon
      // Would use proper barycentric or ray casting
      const centroid = this.calculateCentroid(poly);
      const dist = Math.sqrt(
        Math.pow(point.x - centroid.x, 2) +
        Math.pow(point.z - centroid.z, 2)
      );
      return dist < 2; // Simple radius check
    });
  }

  calculateCentroid(poly) {
    let x = 0, y = 0, z = 0;
    poly.vertices.forEach(idx => {
      const v = this.navMesh.vertices[idx];
      x += v.x;
      y += v.y;
      z += v.z;
    });
    return {
      x: x / poly.vertices.length,
      y: y / poly.vertices.length,
      z: z / poly.vertices.length
    };
  }
}

/**
 * Game Performance Profiler Visualizer
 * Renders performance metrics in 3D space
 */
export class PerformanceProfiler {
  constructor() {
    this.metrics = {
      fps: [],
      drawCalls: [],
      triangles: [],
      frameTime: [],
      memory: []
    };
    this.maxHistory = 60; // 1 second at 60fps
    this.history = [];
  }

  record(frame) {
    const snapshot = {
      timestamp: performance.now(),
      fps: frame.fps || 0,
      drawCalls: frame.drawCalls || 0,
      triangles: frame.triangles || 0,
      frameTime: frame.frameTime || 0,
      memory: frame.memory || 0
    };
    
    this.history.push(snapshot);
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Generate heatmap of performance over world space
   */
  generateWorldHeatmap(cameraPosition, viewDirection, granularity = 5) {
    const zones = [];
    
    // Divide view frustum into zones
    for (let x = -5; x <= 5; x += granularity) {
      for (let z = -5; z <= 5; z += granularity) {
        const zone = {
          position: {
            x: cameraPosition.x + x * 10,
            y: cameraPosition.y,
            z: cameraPosition.z + z * 10
          },
          size: { x: granularity * 10, y: 5, z: granularity * 10 },
          metrics: this.estimateZoneMetrics(x, z)
        };
        
        zone.color = this.getHeatmapColor(zone.metrics.overall);
        zones.push(zone);
      }
    }
    
    return zones;
  }

  estimateZoneMetrics(x, z) {
    // Simulated - would use actual occlusion queries
    const distance = Math.sqrt(x*x + z*z);
    const load = Math.max(0, 100 - distance * 10);
    
    return {
      overall: load,
      gpu: load * 0.8,
      cpu: load * 0.6
    };
  }

  getHeatmapColor(value) {
    // Value 0-100: green -> yellow -> red
    if (value < 33) return '#00d4aa';
    if (value < 66) return '#ffaa00';
    return '#ff3864';
  }

  /**
   * Generate Nemosyne data for metrics visualization
   */
  toNemosyneData() {
    const latest = this.history[this.history.length - 1];
    if (!latest) return null;
    
    return {
      nodes: [
        {
          id: 'fps-meter',
          label: `FPS: ${Math.round(latest.fps)}`,
          value: latest.fps,
          color: latest.fps > 55 ? '#00d4aa' : latest.fps > 30 ? '#ffaa00' : '#ff3864',
          position: { x: 0, y: 0, z: 0 }
        },
        {
          id: 'draw-calls',
          label: `Draws: ${latest.drawCalls}`,
          value: latest.drawCalls,
          color: latest.drawCalls < 100 ? '#00d4aa' : latest.drawCalls < 500 ? '#ffaa00' : '#ff3864',
          position: { x: 3, y: 0, z: 0 }
        },
        {
          id: 'triangles',
          label: `Tris: ${(latest.triangles / 1000000).toFixed(1)}M`,
          value: latest.triangles / 1000000,
          color: latest.triangles < 1000000 ? '#00d4aa' : latest.triangles < 5000000 ? '#ffaa00' : '#ff3864',
          position: { x: 6, y: 0, z: 0 }
        }
      ],
      history: this.history
    };
  }
}

/**
 * Entity Component System Visualizer
 * Shows ECS relationships and component dependencies
 */
export class ECSVisualizer {
  constructor() {
    this.entities = new Map();
    this.components = new Map();
    this.systems = [];
  }

  addEntity(id, components = []) {
    this.entities.set(id, {
      id,
      components: new Set(components),
      active: true
    });
  }

  addComponent(name, data = {}) {
    this.components.set(name, {
      name,
      entities: new Set(),
      data
    });
  }

  addSystem(name, componentQuery = []) {
    this.systems.push({
      name,
      queries: componentQuery,
      entityCount: 0
    });
  }

  /**
   * Generate Nemosyne visualization of ECS
   */
  toNemosyneData() {
    const nodes = [];
    const edges = [];
    
    // Add entities
    this.entities.forEach((entity, id) => {
      nodes.push({
        id: `entity-${id}`,
        type: 'entity',
        label: id.toString(),
        color: entity.active ? '#00d4aa' : '#666666',
        size: 1,
        components: Array.from(entity.components)
      });
      
      // Connect to components
      entity.components.forEach(compName => {
        edges.push({
          source: `entity-${id}`,
          target: `component-${compName}`,
          type: 'has-component'
        });
      });
    });
    
    // Add components
    this.components.forEach((comp, name) => {
      nodes.push({
        id: `component-${name}`,
        type: 'component',
        label: name,
        color: '#6b4ee6',
        size: 2,
        entityCount: comp.entities.size
      });
    });
    
    // Add systems
    this.systems.forEach((sys, i) => {
      nodes.push({
        id: `system-${sys.name}`,
        type: 'system',
        label: sys.name,
        color: '#ffaa00',
        size: 3
      });
      
      // Connect systems to queried components
      sys.queries.forEach(compName => {
        edges.push({
          source: `system-${sys.name}`,
          target: `component-${compName}`,
          type: 'queries'
        });
      });
    });
    
    return { nodes, edges };
  }
}
