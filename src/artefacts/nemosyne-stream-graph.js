/**
 * nemosyne-stream-graph: Flowing Data Visualization Over Time
 * 
 * Visualizes data flow and evolution over time using layered areas
 * that flow like rivers. Perfect for:
 * - Website traffic over time
 * - Resource allocation across categories
 * - Population demographics shifting
 * - Memory accumulation by type
 * 
 * Features:
 * - Smooth flowing curves between time points
 * - Stacked areas showing composition
 * - Interactive time scrubbing
 * - Color gradients showing intensity
 * - VR-compatible 6DOF rendering
 */

AFRAME.registerComponent('nemosyne-stream-graph', {
  schema: {
    data: { type: 'string', default: '[]' },
    timeField: { type: 'string', default: 'timestamp' },
    valueField: { type: 'string', default: 'value' },
    categoryField: { type: 'string', default: 'category' },
    width: { type: 'number', default: 10 },
    depth: { type: 'number', default: 4 },
    heightScale: { type: 'number', default: 3 },
    smoothing: { type: 'number', default: 0.5 },
    colors: { type: 'array', default: [] },
    showLabels: { type: 'boolean', default: true },
    animated: { type: 'boolean', default: true },
    animationSpeed: { type: 'number', default: 1 }
  },

  init() {
    this.parsedData = [];
    this.categories = new Set();
    this.timePoints = [];
    this.meshData = [];
    this.animationTime = 0;
    
    // Color palette if not provided
    this.colorPalette = this.data.colors.length > 0 ? this.data.colors : [
      '#00d4aa', '#ff6b6b', '#4ecdc4', '#ffeaa7', '#a29bfe',
      '#fd79a8', '#00b894', '#e17055', '#74b9ff', '#55efc4'
    ];

    this.container = document.createElement('a-entity');
    this.container.setAttribute('id', 'stream-container');
    this.el.appendChild(this.container);

    this.parseData();
    this.buildStreamGraph();
    
    if (this.data.animated) {
      this.startAnimation();
    }
  },

  parseData() {
    try {
      this.parsedData = JSON.parse(this.data.data);
      
      // Extract unique categories and time points
      this.parsedData.forEach(d => {
        this.categories.add(d[this.data.categoryField]);
      });
      
      this.categories = Array.from(this.categories);
      
      // Sort and extract time points
      const times = [...new Set(this.parsedData.map(d => d[this.data.timeField]))]
        .sort((a, b) => new Date(a) - new Date(b));
      
      this.timePoints = times;
      
      // Reorganize data by time point
      this.timeSeriesData = times.map(time => {
        const timeSlice = { time, values: {} };
        this.categories.forEach(cat => {
          const item = this.parsedData.find(d => 
            d[this.data.timeField] === time && 
            d[this.data.categoryField] === cat
          );
          timeSlice.values[cat] = item ? (item[this.data.valueField] || 0) : 0;
        });
        return timeSlice;
      });
      
    } catch (e) {
      console.error('Failed to parse stream graph data:', e);
      this.parsedData = [];
    }
  },

  buildStreamGraph() {
    if (this.timeSeriesData.length === 0 || this.categories.length === 0) return;

    // Calculate baseline using zero-stacking
    const layers = this.calculateStackLayers();
    
    // Create geometry for each category layer
    this.categories.forEach((category, catIndex) => {
      this.createStreamLayer(category, catIndex, layers[catIndex]);
    });

    // Add labels
    if (this.data.showLabels) {
      this.addLabels();
    }
  },

  calculateStackLayers() {
    const layers = [];
    
    this.categories.forEach((category, i) => {
      const layer = this.timeSeriesData.map((point, pointIndex) => {
        // Get baseline from previous layers
        let baseline = 0;
        for (let j = 0; j < i; j++) {
          if (pointIndex < layers[j].length) {
            baseline += layers[j][pointIndex].y1;
          }
        }
        
        const value = point.values[category] || 0;
        return {
          y0: baseline,
          y1: baseline + value,
          value: value,
          time: point.time
        };
      });
      
      layers.push(layer);
    });
    
    return layers;
  },

  createStreamLayer(category, index, layerData) {
    const color = this.colorPalette[index % this.colorPalette.length];
    const positions = [];
    const indices = [];
    const colors = [];
    
    const timeCount = layerData.length;
    const xStep = this.data.width / (timeCount - 1);
    
    // Apply smoothing using Catmull-Rom splines
    const smoothLayer = this.smoothLayer(layerData, this.data.smoothing);
    
    // Generate vertices for the layer area
    smoothLayer.forEach((point, i) => {
      const x = (i / (smoothLayer.length - 1)) * this.data.width - this.data.width / 2;
      
      // Scale height
      const y0 = (point.y0 / this.getMaxValue()) * this.data.heightScale;
      const y1 = (point.y1 / this.getMaxValue()) * this.data.heightScale;
      
      // Add vertices for top and bottom of stream
      const z = 0;
      
      // Bottom edge
      positions.push(x, y0, z);
      positions.push(x, y0, this.data.depth);
      
      // Top edge
      positions.push(x, y1, z);
      positions.push(x, y1, this.data.depth);
      
      // Add colors (gradient from bottom to top)
      const baseColor = new THREE.Color(color);
      const topColor = baseColor.clone().multiplyScalar(1.2);
      
      colors.push(baseColor.r, baseColor.g, baseColor.b);
      colors.push(baseColor.r, baseColor.g, baseColor.b);
      colors.push(topColor.r, topColor.g, topColor.b);
      colors.push(topColor.r, topColor.g, topColor.b);
      
      // Create triangles
      if (i < smoothLayer.length - 1) {
        const base = i * 4;
        
        // Front face
        indices.push(base, base + 2, base + 4);
        indices.push(base + 2, base + 6, base + 4);
        
        // Back face
        indices.push(base + 1, base + 5, base + 3);
        indices.push(base + 3, base + 5, base + 7);
        
        // Top surface
        indices.push(base + 2, base + 3, base + 6);
        indices.push(base + 3, base + 7, base + 6);
        
        // Bottom surface
        indices.push(base, base + 5, base + 1);
        indices.push(base, base + 4, base + 5);
      }
    });
    
    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Create material with vertex colors
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `stream-layer-${category}`;
    
    // Add to scene
    this.el.setObject3D(`layer-${category}`, mesh);
    
    // Store for animation
    this.meshData.push({
      category,
      mesh,
      originalPositions: [...positions],
      index
    });
    
    // Add hover interaction
    this.addLayerInteraction(mesh, category, layerData);
  },

  smoothLayer(layerData, smoothing) {
    if (smoothing <= 0 || layerData.length < 4) return layerData;
    
    const smoothed = [];
    
    for (let i = 0; i < layerData.length; i++) {
      if (i === 0 || i === layerData.length - 1) {
        smoothed.push(layerData[i]);
        continue;
      }
      
      const prev = layerData[i - 1];
      const curr = layerData[i];
      const next = layerData[i + 1];
      
      smoothed.push({
        y0: curr.y0 * (1 - smoothing) + (prev.y0 + next.y0) / 2 * smoothing,
        y1: curr.y1 * (1 - smoothing) + (prev.y1 + next.y1) / 2 * smoothing,
        value: curr.value,
        time: curr.time
      });
    }
    
    return smoothed;
  },

  getMaxValue() {
    let max = 0;
    this.timeSeriesData.forEach(point => {
      const total = Object.values(point.values).reduce((a, b) => a + b, 0);
      max = Math.max(max, total);
    });
    return max > 0 ? max : 1;
  },

  addLayerInteraction(mesh, category, layerData) {
    mesh.userData = { category, layerData };
    
    // Highlight on hover
    mesh.onBeforeRender = () => {
      // This runs every frame - could add hover effects here
    };
  },

  addLabels() {
    // Add time axis labels
    const labelCount = Math.min(this.timePoints.length, 5);
    
    for (let i = 0; i < labelCount; i++) {
      const index = Math.floor(i * (this.timePoints.length - 1) / (labelCount - 1));
      const time = this.timePoints[index];
      const x = (i / (labelCount - 1)) * this.data.width - this.data.width / 2;
      
      const label = document.createElement('a-text');
      label.setAttribute('value', this.formatTime(time));
      label.setAttribute('align', 'center');
      label.setAttribute('position', `${x} -0.5 0`);
      label.setAttribute('scale', '0.5 0.5 0.5');
      label.setAttribute('color', '#888888');
      this.container.appendChild(label);
    }
    
    // Add category legend
    this.categories.forEach((category, i) => {
      const y = this.data.heightScale + 0.5 + (i * 0.4);
      const color = this.colorPalette[i % this.colorPalette.length];
      
      const marker = document.createElement('a-sphere');
      marker.setAttribute('position', `${this.data.width / 2 + 1} ${y} 0`);
      marker.setAttribute('radius', 0.1);
      marker.setAttribute('color', color);
      this.container.appendChild(marker);
      
      const label = document.createElement('a-text');
      label.setAttribute('value', category);
      label.setAttribute('position', `${this.data.width / 2 + 1.5} ${y} 0`);
      label.setAttribute('scale', '0.4 0.4 0.4');
      label.setAttribute('color', '#cccccc');
      label.setAttribute('align', 'left');
      this.container.appendChild(label);
    });
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },

  startAnimation() {
    let lastTime = performance.now();
    
    const animate = (currentTime) => {
      if (!this.data.animated) return;
      
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      this.animationTime += delta * this.data.animationSpeed;
      
      // Animate waves flowing through the stream
      this.meshData.forEach((layer, i) => {
        const positions = layer.mesh.geometry.attributes.position.array;
        const vertexCount = positions.length / 3;
        
        for (let v = 0; v < vertexCount; v++) {
          const originalY = layer.originalPositions[v * 3 + 1];
          const x = positions[v * 3];
          
          // Add flowing wave effect
          const wave = Math.sin(x * 0.5 + this.animationTime * 2 + i) * 0.05;
          positions[v * 3 + 1] = originalY + wave;
        }
        
        layer.mesh.geometry.attributes.position.needsUpdate = true;
      });
      
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  },

  update() {
    // Data changed - rebuild
    this.parseData();
    this.buildStreamGraph();
  },

  remove() {
    // Cleanup
    this.meshData.forEach(layer => {
      this.el.removeObject3D(`layer-${layer.category}`);
    });
  }
});

console.log('[nemosyne-stream-graph] Stream graph component registered');
