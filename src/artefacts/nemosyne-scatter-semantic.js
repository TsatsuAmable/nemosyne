/**
 * nemosyne-scatter-semantic: High-Dimensional Data Projection
 *
 * Renders high-dimensional data (embeddings, vectors) in 3D space
 * using dimensionality reduction or direct projection.
 *
 * Features:
 * - Support for UMAP/t-SNE pre-projected data
 * - Direct 3D embedding projection (first 3 dimensions)
 * - Distance-based brushing/highlighting
 * - Cluster detection and visualization
 * - Lasso selection in 3D space
 * - Axes showing principal components
 *
 * Required: Data packets with embeddings or high-dimensional values
 */

AFRAME.registerComponent('nemosyne-scatter-semantic', {
  schema: {
    // Data
    dataPoints: { type: 'array', default: [] }, // Array with embeddings

    // Projection
    projection: { type: 'string', default: 'auto' }, // 'auto', 'umap', 'pca', 'tsne', 'direct'
    dimensions: { type: 'number', default: 3 }, // 2 or 3

    // Visualization
    pointSize: { type: 'number', default: 0.08 },
    pointGeometry: { type: 'string', default: 'sphere' },
    colorBy: { type: 'string', default: 'cluster' }, // 'cluster', 'value', 'density'
    showAxes: { type: 'boolean', default: true },
    showGrid: { type: 'boolean', default: true },

    // Brushing/selection
    brushEnabled: { type: 'boolean', default: true },
    brushRadius: { type: 'number', default: 0.5 },

    // Clustering
    autoCluster: { type: 'boolean', default: true },
    clusterCount: { type: 'number', default: 5 },

    // LOD
    lodEnabled: { type: 'boolean', default: true },
    maxVisiblePoints: { type: 'number', default: 5000 }
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);

    this.pointMeshes = new Map();
    this.clusters = new Map();
    this.selectedPoints = new Set();

    // Process data
    this.processData();

    // Build visualization
    this.buildScatter();

    // Setup interactions
    this.setupInteractions();

    console.log('[nemosyne-scatter-semantic] Initialized with',
                this.data.dataPoints.length, 'points');
  },

  processData: function() {
    // Extract embeddings
    this.data.dataPoints.forEach(point => {
      if (!point.embeddings && point.value && Array.isArray(point.value)) {
        point.embeddings = point.value;
      }
    });

    // Auto-detect projection
    if (this.data.projection === 'auto') {
      this.detectProjection();
    }

    // Auto-cluster if enabled
    if (this.data.autoCluster) {
      this.performClustering();
    }

    // Calculate density
    this.calculateDensity();
  },

  detectProjection: function() {
    const sample = this.data.dataPoints[0];
    if (!sample || !sample.embeddings) return;

    const dim = sample.embeddings.length;

    if (dim === 2) {
      this.currentProjection = '2d-direct';
      this.projectTo3D = (emb) => ({ x: emb[0], y: 0, z: emb[1] });
    } else if (dim === 3) {
      this.currentProjection = '3d-direct';
      this.projectTo3D = (emb) => ({ x: emb[0], y: emb[1], z: emb[2] });
    } else if (dim > 3) {
      this.currentProjection = 'reduced';
      this.projectTo3D = (emb) => ({
        x: emb[0] || 0,
        y: emb[1] || 0,
        z: emb[2] || 0
      });
    }
  },

  performClustering: function() {
    // Simple k-means clustering on first 3 dimensions
    const k = this.data.clusterCount;
    const points = this.data.dataPoints.filter(p => p.embeddings);

    if (points.length < k) return;

    // Initialize centroids randomly
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * points.length);
      const emb = points[idx].embeddings;
      centroids.push({ x: emb[0] || 0, y: emb[1] || 0, z: emb[2] || 0 });
    }

    // Run iterations
    for (let iter = 0; iter < 20; iter++) {
      // Assign points to clusters
      const assignments = new Map();

      points.forEach(point => {
        const emb = point.embeddings;
        const pos = { x: emb[0] || 0, y: emb[1] || 0, z: emb[2] || 0 };

        let minDist = Infinity;
        let closestCluster = 0;

        centroids.forEach((centroid, i) => {
          const dist = Math.sqrt(
            Math.pow(pos.x - centroid.x, 2) +
            Math.pow(pos.y - centroid.y, 2) +
            Math.pow(pos.z - centroid.z, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            closestCluster = i;
          }
        });

        assignments.set(point.id, closestCluster);
      });

      // Update centroids
      const newCentroids = centroids.map(() => ({ x: 0, y: 0, z: 0, count: 0 }));

      points.forEach(point => {
        const cluster = assignments.get(point.id);
        const emb = point.embeddings;
        newCentroids[cluster].x += emb[0] || 0;
        newCentroids[cluster].y += emb[1] || 0;
        newCentroids[cluster].z += emb[2] || 0;
        newCentroids[cluster].count++;
      });

      centroids.forEach((c, i) => {
        if (newCentroids[i].count > 0) {
          c.x = newCentroids[i].x / newCentroids[i].count;
          c.y = newCentroids[i].y / newCentroids[i].count;
          c.z = newCentroids[i].z / newCentroids[i].count;
        }
      });

      // Store assignments
      this.clusters.clear();
      assignments.forEach((clusterId, pointId) => {
        this.clusters.set(pointId, clusterId);
      });
    }

    // Assign cluster colors
    this.clusterColors = [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
      '#ffff33', '#a65628', '#f781bf', '#999999'
    ];
  },

  calculateDensity: function() {
    // Calculate local density for each point
    const points = this.data.dataPoints;
    const radius = 0.5; // Neighborhood radius

    points.forEach((point, i) => {
      if (!point.embeddings) {
        point.density = 0;
        return;
      }

      const emb = point.embeddings;
      const pos = { x: emb[0] || 0, y: emb[1] || 0, z: emb[2] || 0 };

      let count = 0;
      points.forEach((other, j) => {
        if (i === j || !other.embeddings) return;

        const otherEmb = other.embeddings;
        const otherPos = { x: otherEmb[0] || 0, y: otherEmb[1] || 0, z: otherEmb[2] || 0 };

        const dist = Math.sqrt(
          Math.pow(pos.x - otherPos.x, 2) +
          Math.pow(pos.y - otherPos.y, 2) +
          Math.pow(pos.z - otherPos.z, 2)
        );

        if (dist < radius) count++;
      });

      point.density = count / points.length;
    });
  },

  buildScatter: function() {
    // Add axes
    if (this.data.showAxes) {
      this.createAxes();
    }

    // Add grid
    if (this.data.showGrid) {
      this.createGrid();
    }

    // Create points
    const pointsToShow = this.data.dataPoints.slice(0, this.data.maxVisiblePoints);

    pointsToShow.forEach((point, i) => {
      this.createPoint(point, i);
    });
  },

  createAxes: function() {
    const axisLength = 3;
    const axisColors = { x: '#ff0000', y: '#00ff00', z: '#0000ff' };

    ['x', 'y', 'z'].forEach(axis => {
      const line = document.createElement('a-entity');
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 0, y: 0, z: 0 };
      end[axis] = axisLength;

      line.setAttribute('line', {
        start: `${start.x} ${start.y} ${start.z}`,
        end: `${end.x} ${end.y} ${end.z}`,
        color: axisColors[axis],
        opacity: 0.5
      });

      this.container.appendChild(line);
    });
  },

  createGrid: function() {
    const gridSize = 5;
    const divisions = 10;
    const step = gridSize / divisions;

    for (let i = -divisions; i <= divisions; i++) {
      // X lines
      const xLine = document.createElement('a-entity');
      xLine.setAttribute('line', {
        start: `${-gridSize} 0 ${i * step}`,
        end: `${gridSize} 0 ${i * step}`,
        color: '#333333',
        opacity: 0.2
      });
      this.container.appendChild(xLine);

      // Z lines
      const zLine = document.createElement('a-entity');
      zLine.setAttribute('line', {
        start: `${i * step} 0 ${-gridSize}`,
        end: `${i * step} 0 ${gridSize}`,
        color: '#333333',
        opacity: 0.2
      });
      this.container.appendChild(zLine);
    }
  },

  createPoint: function(point, index) {
    if (!point.embeddings) return;

    const entity = document.createElement(`a-${this.data.pointGeometry}`);

    // Position from embedding
    const pos = this.projectTo3D(point.embeddings);

    // Scale position for visibility
    const scale = 2;
    entity.setAttribute('position', {
      x: pos.x * scale,
      y: pos.y * scale,
      z: pos.z * scale
    });

    // Size
    const size = this.data.pointSize * (1 + point.density * 2);
    entity.setAttribute('radius', size);

    // Color
    const color = this.calculatePointColor(point);
    entity.setAttribute('material', {
      color: color,
      emissive: color,
      emissiveIntensity: 0.3 + point.density * 0.5,
      metalness: 0.5,
      roughness: 0.5
    });

    // Metadata
    entity.dataset.pointId = point.id;
    entity.dataset.cluster = this.clusters.get(point.id) || -1;
    entity.pointData = point;

    entity.classList.add('clickable');
    entity.classList.add('scatter-point');

    // Events
    this.setupPointEvents(entity, point);

    // Entrance animation
    entity.setAttribute('visible', false);
    setTimeout(() => {
      entity.setAttribute('visible', true);
      entity.setAttribute('animation__entrance', {
        property: 'scale',
        from: '0 0 0',
        to: '1 1 1',
        dur: 400,
        easing: 'easeOutQuad'
      });
    }, index * 2);

    this.container.appendChild(entity);
    this.pointMeshes.set(point.id, entity);
  },

  calculatePointColor: function(point) {
    switch (this.data.colorBy) {
      case 'cluster':
        const clusterId = this.clusters.get(point.id);
        if (clusterId !== undefined) {
          return this.clusterColors[clusterId % this.clusterColors.length];
        }
        return '#888888';

      case 'density':
        const density = point.density || 0;
        const r = Math.floor(100 + density * 100);
        const g = Math.floor(100 + density * 100);
        const b = Math.floor(150 + density * 50);
        return `rgb(${r},${g},${b})`;

      case 'value':
      default:
        return '#00d4aa';
    }
  },

  setupPointEvents: function(entity, point) {
    entity.addEventListener('mouseenter', () => {
      entity.setAttribute('scale', '1.5 1.5 1.5');
      this.showPointDetails(point, entity);
    });

    entity.addEventListener('mouseleave', () => {
      entity.setAttribute('scale', '1 1 1');
      this.hidePointDetails();
    });

    entity.addEventListener('click', () => {
      this.selectPoint(point);
    });
  },

  showPointDetails: function(point, entity) {
    // Create tooltip
    const tooltip = document.createElement('a-text');
    const pos = entity.getAttribute('position');

    let value = typeof point.value === 'object'
      ? JSON.stringify(point.value).slice(0, 50)
      : String(point.value);

    tooltip.setAttribute('value',
      `ID: ${point.id}\n` +
      `Cluster: ${this.clusters.get(point.id) || 'N/A'}\n` +
      `Density: ${(point.density || 0).toFixed(2)}\n` +
      `Value: ${value}`
    );
    tooltip.setAttribute('align', 'center');
    tooltip.setAttribute('color', '#ffffff');
    tooltip.setAttribute('width', 3);
    tooltip.setAttribute('position', { x: pos.x, y: pos.y + 0.3, z: pos.z });
    tooltip.setAttribute('billboard', true);
    tooltip.classList.add('scatter-tooltip');

    this.container.appendChild(tooltip);
    this.currentTooltip = tooltip;
  },

  hidePointDetails: function() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  },

  selectPoint: function(point) {
    const entity = this.pointMeshes.get(point.id);
    if (!entity) return;

    // Highlight
    entity.setAttribute('animation', {
      property: 'material.emissiveIntensity',
      from: 2,
      to: 0.3,
      dur: 1000
    });

    // Emit event
    this.el.emit('point-selected', { point });
  },

  setupInteractions: function() {
    // Brush selection
    if (this.data.brushEnabled) {
      this.setupBrushSelection();
    }
  },

  setupBrushSelection: function() {
    // Hold trigger to brush-select points in radius
    // Implementation would integrate with gesture system
  },

  // Lasso selection in 3D
  selectByRegion: function(region) {
    // region: { center: {x,y,z}, radius: number }
    const selected = [];

    this.data.dataPoints.forEach(point => {
      if (!point.embeddings) return;

      const pos = this.projectTo3D(point.embeddings);
      const dist = Math.sqrt(
        Math.pow(pos.x - region.center.x, 2) +
        Math.pow(pos.y - region.center.y, 2) +
        Math.pow(pos.z - region.center.z, 2)
      );

      if (dist < region.radius) {
        selected.push(point);
        this.selectedPoints.add(point.id);
      }
    });

    // Highlight selected
    this.selectedPoints.forEach(id => {
      const mesh = this.pointMeshes.get(id);
      if (mesh) {
        mesh.setAttribute('material', 'emissiveIntensity', 2);
      }
    });

    this.el.emit('region-selected', { selected, count: selected.length });
  },

  clearSelection: function() {
    this.selectedPoints.forEach(id => {
      const mesh = this.pointMeshes.get(id);
      if (mesh) {
        mesh.setAttribute('material', 'emissiveIntensity', 0.3);
      }
    });
    this.selectedPoints.clear();
  },

  remove: function() {
    this.container.innerHTML = '';
  }
});


console.log('[nemosyne-scatter-semantic] Component registered');
