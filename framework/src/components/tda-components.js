/**
 * Topological Data Analysis Component
 * Implements TDA visualizations: persistence, simplicial complexes, mapper, reeb graphs
 */

export const NemosyneTDA = {
  /**
   * Persistence Barcode Component
   * Visualizes H0, H1, H2 features as horizontal bars
   */
  PersistenceBarcode: {
    schema: {
      data: { type: 'string', default: '' },
      threshold: { type: 'number', default: 0 },
      dimensions: { type: 'string', default: '[0,1,2]' },
      colorScheme: { type: 'string', default: 'dimension' }
    },
    
    init() {
      // Parse persistence data
      this.pairs = this.parsePersistenceData(this.data.data);
      this.initScales();
      this.createBarcode();
      
      // Filter by threshold
      if (this.data.threshold > 0) {
        this.filterByThreshold(this.data.threshold);
      }
    },
    
    initScales() {
      const births = this.pairs.map(p => p.birth);
      const deaths = this.pairs.map(p => p.death);
      
      this.xScale = d3.scaleLinear()
        .domain([0, Math.max(...deaths)])
        .range([0, 20]);
        
      this.yScale = d3.scaleBand()
        .domain([0, 1, 2])
        .range([0, 6])
        .padding(0.1);
    },
    
    createBarcode() {
      this.pairs.forEach((pair, i) => {
        const width = this.xScale(pair.persistence);
        const x = this.xScale(pair.birth);
        const y = this.yScale(pair.dimension);
        const color = this.getDimensionColor(pair.dimension, pair.persistence);
        
        const bar = document.createElement('a-box');
        bar.setAttribute('width', width);
        bar.setAttribute('height', 0.15);
        bar.setAttribute('depth', 0.1);
        bar.setAttribute('position', `${x + width/2} ${y} ${pair.dimension * 0.5}`);
        bar.setAttribute('color', color);
        bar.setAttribute('material', {
          emissive: color,
          emissiveIntensity: pair.persistence > 2 ? 0.8 : 0.3
        });
        
        // Data attributes for interaction
        bar.dataset.dimension = pair.dimension;
        bar.dataset.persistence = pair.persistence;
        bar.dataset.birth = pair.birth;
        bar.dataset.death = pair.death;
        
        this.el.appendChild(bar);
      });
    },
    
    getDimensionColor(dim, persistence) {
      const colors = ['#1f77b4', '#ff7f0e', '#2ca02c'];
      // Highlight high-persistence features
      if (persistence > 3) return '#d62728';
      return colors[dim] || '#999';
    },
    
    parsePersistenceData(dataString) {
      try {
        const data = JSON.parse(dataString);
        return data.persistence_pairs || [];
      } catch(e) {
        return [];
      }
    }
  },

  /**
   * Simplicial Complex Component
   * Rips/Vietoris-Rips complex at given epsilon
   */
  SimplicialComplex: {
    schema: {
      vertices: { type: 'string', default: '' },
      epsilon: { type: 'number', default: 1.0 },
      maxDimension: { type: 'number', default: 2 }
    },
    
    init() {
      this.vertices = JSON.parse(this.data.vertices);
      this.epsilon = this.data.epsilon;
      this.buildComplex();
    },
    
    buildComplex() {
      // Build edges (1-simplices)
      const edges = this.computeEdges();
      edges.forEach(edge => this.createEdge(edge));
      
      // Build triangles (2-simplices)
      if (this.data.maxDimension >= 2) {
        const triangles = this.computeTriangles(edges);
        triangles.forEach(tri => this.createTriangle(tri));
      }
    },
    
    computeEdges() {
      const edges = [];
      const n = this.vertices.length;
      
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dist = this.distance(this.vertices[i], this.vertices[j]);
          if (dist <= this.epsilon * 2) {
            edges.push([i, j, dist]);
          }
        }
      }
      return edges;
    },
    
    computeTriangles(edges) {
      // Find cliques of size 3
      const triangles = [];
      const edgeSet = new Set(edges.map(e => `${e[0]}-${e[1]}`));
      const n = this.vertices.length;
      
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (!edgeSet.has(`${i}-${j}`)) continue;
          for (let k = j + 1; k < n; k++) {
            if (edgeSet.has(`${i}-${k}`) && edgeSet.has(`${j}-${k}`)) {
              triangles.push([i, j, k]);
            }
          }
        }
      }
      return triangles;
    },
    
    createEdge(edge) {
      const [i, j] = edge;
      const v1 = this.vertices[i];
      const v2 = this.vertices[j];
      
      const midX = (v1.x + v2.x) / 2;
      const midY = (v1.y + v2.y) / 2;
      const midZ = (v1.z + v2.z) / 2;
      
      const dist = edge[2];
      
      const line = document.createElement('a-cylinder');
      line.setAttribute('radius', 0.02);
      line.setAttribute('height', dist);
      line.setAttribute('position', `${midX} ${midY} ${midZ}`);
      line.setAttribute('color', '#00d4aa');
      line.setAttribute('opacity', 0.6);
      
      // Orient towards target
      line.object3D.lookAt(v2.x, v2.y, v2.z);
      line.object3D.rotateX(Math.PI / 2);
      
      this.el.appendChild(line);
    },
    
    createTriangle(tri) {
      // Create filled triangle mesh
      const [i, j, k] = tri;
      const [v1, v2, v3] = [this.vertices[i], this.vertices[j], this.vertices[k]];
      
      // Centroid
      const cx = (v1.x + v2.x + v3.x) / 3;
      const cy = (v1.y + v2.y + v3.y) / 3;
      const cz = (v1.z + v2.z + v3.z) / 3;
      
      // Create as small platform representing triangle
      const triMesh = document.createElement('a-triangle');
      triMesh.setAttribute('vertexA', `${v1.x} ${v1.y} ${v1.z}`);
      triMesh.setAttribute('vertexB', `${v2.x} ${v2.y} ${v2.z}`);
      triMesh.setAttribute('vertexC', `${v3.x} ${v3.y} ${v3.z}`);
      triMesh.setAttribute('color', '#00d4aa');
      triMesh.setAttribute('opacity', 0.3);
      triMesh.setAttribute('transparent', true);
      
      this.el.appendChild(triMesh);
    },
    
    distance(a, b) {
      return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2) +
        Math.pow(a.z - b.z, 2)
      );
    }
  },

  /**
   * Mapper Network Component
   * Topological skeleton with clusters and overlaps
   */
  MapperNetwork: {
    schema: {
      clusters: { type: 'string', default: '' },
      edges: { type: 'string', default: '' },
      layout: { type: 'string', default: 'force-directed' }
    },
    
    init() {
      this.clusters = JSON.parse(this.data.clusters);
      this.edges = JSON.parse(this.data.edges);
      this.simulation = null;
      
      if (this.data.layout === 'force-directed') {
        this.initForceLayout();
      }
      
      this.createNetwork();
    },
    
    initForceLayout() {
      // Simplified force simulation
      // In practice, would use d3-force or custom physics
      this.nodePositions = {};
      this.clusters.forEach((c, i) => {
        this.nodePositions[c.id] = {
          x: c.centroid[0] || (Math.random() - 0.5) * 10,
          y: c.centroid[1] || (Math.random() - 0.5) * 5,
          z: c.centroid[2] || (Math.random() - 0.5) * 10
        };
      });
    },
    
    createNetwork() {
      // Create cluster nodes
      this.clusters.forEach(cluster => {
        const node = document.createElement('a-sphere');
        const pos = this.nodePositions[cluster.id];
        
        // Size based on cluster cardinality
        const radius = 0.2 + Math.min(cluster.size / 20, 0.8);
        
        node.setAttribute('radius', radius);
        node.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
        node.setAttribute('color', this.getIntervalColor(cluster.interval));
        node.setAttribute('material', {
          emissive: this.getIntervalColor(cluster.interval),
          emissiveIntensity: 0.4,
          metalness: 0.7
        });
        
        // Data attributes
        node.dataset.clusterId = cluster.id;
        node.dataset.size = cluster.size;
        node.dataset.interval = cluster.interval;
        
        this.el.appendChild(node);
      });
      
      // Create overlap edges
      this.edges.forEach(edge => {
        this.createEdge(edge);
      });
    },
    
    createEdge(edge) {
      const sourcePos = this.nodePositions[edge.source];
      const targetPos = this.nodePositions[edge.target];
      
      const midX = (sourcePos.x + targetPos.x) / 2;
      const midY = (sourcePos.y + targetPos.y) / 2;
      const midZ = (sourcePos.z + targetPos.z) / 2;
      
      const dist = Math.sqrt(
        Math.pow(sourcePos.x - targetPos.x, 2) +
        Math.pow(sourcePos.y - targetPos.y, 2) +
        Math.pow(sourcePos.z - targetPos.z, 2)
      );
      
      const line = document.createElement('a-cylinder');
      line.setAttribute('radius', 0.03);
      line.setAttribute('height', dist);
      line.setAttribute('position', `${midX} ${midY} ${midZ}`);
      line.setAttribute('color', '#888');
      line.setAttribute('opacity', edge.strength || 0.5);
      line.setAttribute('transparent', true);
      
      // Orient
      line.object3D.lookAt(targetPos.x, targetPos.y, targetPos.z);
      line.object3D.rotateX(Math.PI / 2);
      
      this.el.appendChild(line);
    },
    
    getIntervalColor(interval) {
      const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];
      return colors[interval % colors.length];
    }
  },

  /**
   * UMAP Manifold Component
   * 3D embedding with neighbor graph
   */
  UMAPManifold: {
    schema: {
      embedding: { type: 'string', default: '' },
      nNeighbors: { type: 'number', default: 15 },
      showNeighbors: { type: 'boolean', default: true }
    },
    
    init() {
      this.embedding = JSON.parse(this.data.embedding);
      this.createPoints();
      
      if (this.data.showNeighbors) {
        this.createNeighborEdges();
      }
    },
    
    createPoints() {
      this.embedding.forEach(point => {
        const sphere = document.createElement('a-sphere');
        
        // Scale radius by local density (inverse)
        const radius = 0.08;
        
        sphere.setAttribute('radius', radius);
        sphere.setAttribute('position', `${point.x} ${point.y} ${point.z}`);
        sphere.setAttribute('color', this.getClassColor(point.class));
        sphere.setAttribute('material', {
          metalness: 0.4,
          roughness: 0.6
        });
        
        // Store for later
        this.points = this.points || {};
        this.points[point.id] = point;
        
        this.el.appendChild(sphere);
      });
    },
    
    createNeighborEdges() {
      this.embedding.forEach(point => {
        if (!point.neighbors) return;
        
        point.neighbors.forEach(neighborId => {
          const neighbor = this.embedding.find(p => p.id === neighborId);
          if (!neighbor || neighborId < point.id) return; // Avoid duplicates
          
          this.createNeighborEdge(point, neighbor);
        });
      });
    },
    
    createNeighborEdge(p1, p2) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const midZ = (p1.z + p2.z) / 2;
      
      const dist = Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
      );
      
      const line = document.createElement('a-cylinder');
      line.setAttribute('radius', 0.005);
      line.setAttribute('height', dist);
      line.setAttribute('position', `${midX} ${midY} ${midZ}`);
      line.setAttribute('color', '#444');
      line.setAttribute('opacity', 0.2);
      line.setAttribute('transparent', true);
      
      line.object3D.lookAt(p2.x, p2.y, p2.z);
      line.object3D.rotateX(Math.PI / 2);
      
      this.el.appendChild(line);
    },
    
    getClassColor(className) {
      const colors = {
        'control': '#1f77b4',
        'treatment': '#ff7f0e',
        'default': '#888'
      };
      return colors[className] || colors.default;
    }
  }
};

// Register all TDA components
export function registerTDAComponents(AFRAME) {
  AFRAME.registerComponent('tda-persistence-barcode', NemosyneTDA.PersistenceBarcode);
  AFRAME.registerComponent('tda-simplicial-complex', NemosyneTDA.SimplicialComplex);
  AFRAME.registerComponent('tda-mapper-network', NemosyneTDA.MapperNetwork);
  AFRAME.registerComponent('tda-umap-manifold', NemosyneTDA.UMAPManifold);
}

export default NemosyneTDA;
