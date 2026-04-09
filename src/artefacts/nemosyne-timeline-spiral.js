/**
 * nemosyne-timeline-spiral: Temporal Data Visualization
 * 
 * Renders time-series data as nodes positioned along an Archimedean spiral.
 * Time progresses along the spiral, with earlier data at the center.
 * 
 * Features:
 * - Golden-angle spiral (optimal packing)
 * - Temporal navigation (swipe to move through time)
 * - Density-based coloring (cluster detection)
 * - Time-based animation (sequential reveal)
 * - Hover for temporal details
 * - Zoom to specific time periods
 * 
 * Required: Data packets with temporal semantics and timestamps
 */

AFRAME.registerComponent('nemosyne-timeline-spiral', {
  schema: {
    // Data
    dataPoints: { type: 'array', default: [] }, // Array of {timestamp, value, ...}
    
    // Spiral parameters
    startRadius: { type: 'number', default: 1 },      // Inner spiral radius
    radiusGrowth: { type: 'number', default: 0.15 }, // Radius increase per point
    verticalScale: { type: 'number', default: 0.001 }, // Height per timestamp
    goldenAngle: { type: 'number', default: 137.507 }, // Degrees between points
    
    // Time range
    timeRange: { type: 'string', default: 'auto' },  // 'auto' or {start, end} in ms
    
    // Visualization
    nodeGeometry: { type: 'string', default: 'sphere' },
    baseNodeSize: { type: 'number', default: 0.1 },
    colorBy: { type: 'string', default: 'value' },    // 'value', 'density', 'category'
    showConnectors: { type: 'boolean', default: true }, // Show lines between sequential points
    connectorColor: { type: 'color', default: '#00d4aa' },
    
    // Interaction
    temporalScrubbing: { type: 'boolean', default: true }, // Enable time navigation
    playAnimation: { type: 'boolean', default: false }, // Auto-play through time
    playSpeed: { type: 'number', default: 1000 }, // ms per point
    loop: { type: 'boolean', default: true },
    
    // Current view
    currentTime: { type: 'number', default: 0 }, // Center of current view
    viewWindow: { type: 'number', default: 0 }, // How much time to show (0 = all)
    
    // Labels
    showTimeLabels: { type: 'boolean', default: true },
    timeFormat: { type: 'string', default: 'relative' } // 'relative', 'absolute', 'elapsed'
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);
    
    this.nodeMeshes = new Map();
    this.connectorMeshes = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    
    // Sort data by timestamp
    this.sortedData = [...this.data.dataPoints].sort((a, b) => 
      (a.timestamp || 0) - (b.timestamp || 0)
    );
    
    // Calculate time range
    this.calculateTimeRange();
    
    // Build spiral
    this.buildSpiral();
    
    // Setup interactions
    this.setupInteractions();
    
    // Start animation if enabled
    if (this.data.playAnimation) {
      this.startPlayback();
    }
    
    console.log('[nemosyne-timeline-spiral] Initialized with', 
                this.sortedData.length, 'points');
  },

  calculateTimeRange: function() {
    if (this.data.timeRange !== 'auto' && typeof this.data.timeRange === 'object') {
      this.timeStart = this.data.timeRange.start;
      this.timeEnd = this.data.timeRange.end;
    } else {
      const times = this.sortedData.map(d => d.timestamp).filter(t => t);
      this.timeStart = Math.min(...times);
      this.timeEnd = Math.max(...times);
    }
    
    this.timeSpan = this.timeEnd - this.timeStart;
    
    // Calculate density for color mapping
    this.calculateDensity();
  },

  calculateDensity: function() {
    // Group by time windows to detect clusters
    const windowSize = this.timeSpan / 20; // 20 time windows
    const density = new Map();
    
    this.sortedData.forEach(point => {
      const window = Math.floor((point.timestamp - this.timeStart) / windowSize);
      density.set(window, (density.get(window) || 0) + 1);
    });
    
    // Normalize
    const maxDensity = Math.max(...density.values());
    this.sortedData.forEach(point => {
      const window = Math.floor((point.timestamp - this.timeStart) / windowSize);
      point.density = (density.get(window) || 0) / maxDensity;
    });
  },

  buildSpiral: function() {
    const angleRad = this.data.goldenAngle * (Math.PI / 180);
    
    // Create time labels if enabled
    if (this.data.showTimeLabels) {
      this.createTimeLabels();
    }
    
    // Create nodes
    this.sortedData.forEach((point, i) => {
      const t = i; // Position along spiral
      
      // Spiral position
      const radius = this.data.startRadius + (t * this.data.radiusGrowth);
      const angle = t * angleRad;
      
      // Calculate 3D position
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      const y = (point.timestamp - this.timeStart) * this.data.verticalScale;
      
      point.x = x;
      point.y = y;
      point.z = z;
      point.angle = angle;
      point.radius = radius;
      
      // Create node
      this.createNode(point, i);
      
      // Create connector to previous
      if (i > 0 && this.data.showConnectors) {
        this.createConnector(this.sortedData[i-1], point, i);
      }
    });
  },

  createNode: function(point, index) {
    const entity = document.createElement(`a-${this.data.nodeGeometry}`);
    
    // Position
    entity.setAttribute('position', {
      x: point.x,
      y: point.y,
      z: point.z
    });
    
    // Size (can vary by value magnitude)
    const size = this.calculateNodeSize(point);
    entity.setAttribute('radius', size);
    
    // Color based on selected attribute
    const color = this.calculateColor(point);
    entity.setAttribute('material', {
      color: color,
      emissive: color,
      emissiveIntensity: 0.4 + (point.density || 0) * 0.6,
      metalness: 0.6,
      roughness: 0.3
    });
    
    // Store data
    entity.dataset.pointIndex = index;
    entity.dataset.timestamp = point.timestamp;
    entity.pointData = point;
    
    // Interaction
    entity.classList.add('clickable');
    
    // Entrance animation (staggered by time)
    const delay = (point.timestamp - this.timeStart) / this.timeSpan * 2000;
    
    entity.setAttribute('visible', false);
    setTimeout(() => {
      entity.setAttribute('visible', true);
      entity.setAttribute('animation__entrance', {
        property: 'scale',
        from: '0 0 0',
        to: '1 1 1',
        dur: 500,
        easing: 'easeOutElastic'
      });
    }, delay);
    
    // Event handlers
    this.setupNodeEvents(entity, point);
    
    this.container.appendChild(entity);
    this.nodeMeshes.set(point.id || index, entity);
  },

  createConnector: function(from, to, index) {
    const line = document.createElement('a-entity');
    
    line.setAttribute('line', {
      start: `${from.x} ${from.y} ${from.z}`,
      end: `${to.x} ${to.y} ${to.z}`,
      color: this.data.connectorColor,
      opacity: 0.3,
      dashed: true,
      dashSize: 0.1,
      gapSize: 0.05
    });
    
    // Staggered appearance
    const fromTime = from.timestamp - this.timeStart;
    line.setAttribute('visible', false);
    setTimeout(() => {
      line.setAttribute('visible', true);
    }, fromTime / this.timeSpan * 2000);
    
    this.container.appendChild(line);
    this.connectorMeshes.push(line);
  },

  createTimeLabels: function() {
    // Create labels at regular intervals
    const intervals = 5;
    const intervalSpan = this.timeSpan / intervals;
    
    for (let i = 0; i <= intervals; i++) {
      const timestamp = this.timeStart + (i * intervalSpan);
      const timeLabel = this.formatTime(timestamp);
      
      // Find nearest point for position
      const nearestPoint = this.findNearestPoint(timestamp);
      
      if (nearestPoint) {
        const label = document.createElement('a-text');
        label.setAttribute('value', timeLabel);
        label.setAttribute('align', 'center');
        label.setAttribute('color', '#888888');
        label.setAttribute('width', 3);
        label.setAttribute('side', 'double');
        label.setAttribute('position', {
          x: nearestPoint.x * 1.2,
          y: nearestPoint.y,
          z: nearestPoint.z * 1.2
        });
        label.setAttribute('billboard', true);
        
        this.container.appendChild(label);
      }
    }
  },

  findNearestPoint: function(timestamp) {
    return this.sortedData.reduce((nearest, point) => {
      if (!nearest) return point;
      return Math.abs(point.timestamp - timestamp) < Math.abs(nearest.timestamp - timestamp)
        ? point 
        : nearest;
    }, null);
  },

  calculateNodeSize: function(point) {
    const base = this.data.baseNodeSize;
    
    if (typeof point.value === 'number') {
      // Scale by value magnitude (logarithmic)
      const scale = 1 + Math.log10(Math.abs(point.value) + 1) * 0.2;
      return base * scale;
    }
    
    return base;
  },

  calculateColor: function(point) {
    switch (this.data.colorBy) {
      case 'value':
        // Heatmap based on value
        if (typeof point.value === 'number') {
          return this.valueToColor(point.value);
        }
        return '#00d4aa';
        
      case 'density':
        // Density-based (clusters are brighter)
        const density = point.density || 0;
        return this.densityToColor(density);
        
      case 'category':
        // Hash of category
        return this.hashToColor(String(point.category || point.value));
        
      default:
        return '#00d4aa';
    }
  },

  valueToColor: function(value) {
    // Simple heatmap: cool (low) to hot (high)
    // Normalize to 0-1
    const values = this.sortedData.map(d => d.value).filter(v => typeof v === 'number');
    const min = Math.min(...values);
    const max = Math.max(...values);
    const t = (value - min) / (max - min || 1);
    
    return this.interpolateColor('#4477ff', '#ff7744', t);
  },

  densityToColor: function(density) {
    // Low density = dark, high density = bright cyan
    const r = Math.floor(0 + density * 0);
    const g = Math.floor(100 + density * 112);
    const b = Math.floor(150 + density * 60);
    return `rgb(${r},${g},${b})`;
  },

  hashToColor: function(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  },

  interpolateColor: function(color1, color2, t) {
    // Simple hex interpolation
    const r1 = parseInt(color1.substr(1, 2), 16);
    const g1 = parseInt(color1.substr(3, 2), 16);
    const b1 = parseInt(color1.substr(5, 2), 16);
    const r2 = parseInt(color2.substr(1, 2), 16);
    const g2 = parseInt(color2.substr(3, 2), 16);
    const b2 = parseInt(color2.substr(5, 2), 16);
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  },

  setupNodeEvents: function(entity, point) {
    // Hover
    entity.addEventListener('mouseenter', () => {
      entity.setAttribute('scale', '1.5 1.5 1.5');
      
      // Show tooltip
      this.showTooltip(point, entity);
    });
    
    entity.addEventListener('mouseleave', () => {
      entity.setAttribute('scale', '1 1 1');
      this.hideTooltip();
    });
    
    // Click
    entity.addEventListener('click', () => {
      this.selectPoint(point);
    });
  },

  showTooltip: function(point, entity) {
    const tooltip = document.createElement('a-text');
    tooltip.setAttribute('value', 
      `Time: ${this.formatTime(point.timestamp)}\n` +
      `Value: ${JSON.stringify(point.value).slice(0, 30)}`
    );
    tooltip.setAttribute('align', 'center');
    tooltip.setAttribute('color', '#ffffff');
    tooltip.setAttribute('width', 4);
    tooltip.setAttribute('side', 'double');
    tooltip.setAttribute('position', {
      x: point.x,
      y: point.y + 0.5,
      z: point.z
    });
    tooltip.setAttribute('billboard', true);
    tooltip.classList.add('tooltip');
    
    this.container.appendChild(tooltip);
    this.currentTooltip = tooltip;
  },

  hideTooltip: function() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  },

  selectPoint: function(point) {
    this.el.emit('point-selected', { point });
    this.currentIndex = this.sortedData.indexOf(point);
    
    // Visual feedback
    const mesh = this.nodeMeshes.get(point.id || this.sortedData.indexOf(point));
    if (mesh) {
      mesh.setAttribute('animation__select', {
        property: 'material.emissiveIntensity',
        from: 2.0,
        to: 0.5,
        dur: 1000
      });
    }
  },

  setupInteractions: function() {
    // Swipe gestures for temporal navigation
    document.addEventListener('swipe-left', () => this.navigateTemporal(-1));
    document.addEventListener('swipe-right', () => this.navigateTemporal(1));
    
    // Scroll gestures for zooming
    document.addEventListener('scroll-up', () => this.zoomTimeWindow(0.8));
    document.addEventListener('scroll-down', () => this.zoomTimeWindow(1.25));
  },

  // Temporal navigation
  navigateTemporal: function(direction) {
    // Move current time position
    const step = this.timeSpan / this.sortedData.length * 10; // Jump 10 points
    this.data.currentTime += direction * step;
    
    // Clamp
    this.data.currentTime = Math.max(this.timeStart, Math.min(this.timeEnd, this.data.currentTime));
    
    // Update visibility based on time window
    this.updateTimeWindow();
    
    this.el.emit('time-navigated', { 
      currentTime: this.data.currentTime,
      direction 
    });
  },

  zoomTimeWindow: function(factor) {
    // Expand or contract visible time window
    if (this.data.viewWindow === 0) {
      this.data.viewWindow = this.timeSpan;
    }
    this.data.viewWindow *= factor;
    this.data.viewWindow = Math.max(this.timeSpan / 20, Math.min(this.timeSpan, this.data.viewWindow));
    
    this.updateTimeWindow();
  },

  updateTimeWindow: function() {
    const center = this.data.currentTime || (this.timeStart + this.timeEnd) / 2;
    const halfWindow = this.data.viewWindow / 2;
    
    this.nodeMeshes.forEach((mesh, key) => {
      const point = this.sortedData[key];
      if (!point) return;
      
      const inWindow = point.timestamp >= center - halfWindow && 
                         point.timestamp <= center + halfWindow;
      
      mesh.setAttribute('visible', inWindow);
      mesh.setAttribute('material', 'opacity', inWindow ? 1 : 0.1);
    });
  },

  // Playback
  startPlayback: function() {
    this.isPlaying = true;
    this.playNext();
  },

  playNext: function() {
    if (!this.isPlaying) return;
    
    if (this.currentIndex >= this.sortedData.length) {
      if (this.data.loop) {
        this.currentIndex = 0;
      } else {
        this.isPlaying = false;
        return;
      }
    }
    
    const point = this.sortedData[this.currentIndex];
    this.selectPoint(point);
    
    // Smooth camera transition to follow playback
    this.moveCameraToPoint(point);
    
    this.currentIndex++;
    
    setTimeout(() => this.playNext(), this.data.playSpeed);
  },

  moveCameraToPoint: function(point) {
    // Smoothly move camera to view point
    const camera = document.getElementById('camera');
    if (!camera) return;
    
    const currentPos = camera.getAttribute('position');
    const targetPos = {
      x: point.x * 1.5,
      y: point.y + 1.6,
      z: point.z * 1.5
    };
    
    camera.setAttribute('animation', {
      property: 'position',
      to: `${targetPos.x} ${targetPos.y} ${targetPos.z}`,
      dur: this.data.playSpeed * 0.8,
      easing: 'easeInOutQuad'
    });
  },

  // Utilities
  formatTime: function(timestamp) {
    const date = new Date(timestamp);
    
    switch (this.data.timeFormat) {
      case 'relative':
        const elapsed = timestamp - this.timeStart;
        const hours = Math.floor(elapsed / 3600000);
        const mins = Math.floor((elapsed % 3600000) / 60000);
        return `+${hours}h ${mins}m`;
        
      case 'elapsed':
        const totalSecs = Math.floor((timestamp - this.timeStart) / 1000);
        const mins2 = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins2}:${secs.toString().padStart(2, '0')}`;
        
      case 'absolute':
      default:
        return date.toLocaleTimeString();
    }
  },

  remove: function() {
    this.isPlaying = false;
    this.container.innerHTML = '';
  }
});


console.log('[nemosyne-timeline-spiral] Component registered');
