/**
 * nemosyne-parallel-coords: Multi-Dimensional Data Visualization
 * 
 * Parallel coordinates for high-dimensional data exploration.
 * Each vertical axis represents a dimension, lines connect values.
 */

AFRAME.registerComponent('nemosyne-parallel-coords', {
  schema: {
    data: { type: 'string', default: '[]' },
    dimensions: { type: 'string', default: '[]' },
    width: { type: 'number', default: 8 },
    height: { type: 'number', default: 4 },
    lineOpacity: { type: 'number', default: 0.3 },
    lineWidth: { type: 'number', default: 0.02 },
    showAxes: { type: 'boolean', default: true },
    colorBy: { type: 'string', default: 'category' },
    highlightOnHover: { type: 'boolean', default: true }
  },

  init() {
    this.parsedData = [];
    this.parsedDims = [];
    this.dimensions = [];
    this.colorScales = {};

    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);

    this.parseData();
    this.setupScales();
    this.buildParallelCoords();
  },

  parseData() {
    try {
      this.parsedData = JSON.parse(this.data.data);
      this.parsedDims = JSON.parse(this.data.dimensions);

      // Auto-detect dimensions if not provided
      if (this.parsedDims.length === 0 && this.parsedData.length > 0) {
        const sample = this.parsedData[0];
        this.parsedDims = Object.keys(sample).filter(k =>
          typeof sample[k] === 'number')
        ;
      }

      this.dimensions = this.parsedDims;
    } catch (e) {
      console.error('[nemosyne-parallel-coords] Parse error:', e);
    }
  },

  setupScales() {
    // Create scale for each dimension
    this.dimensions.forEach(dim => {
      const values = this.parsedData.map(d => d[dim]).filter(v => v !== undefined);
      const min = Math.min(...values);
      const max = Math.max(...values);

      this.colorScales[dim] = {
        min,
        max,
        scale: (v) => (v - min) / (max - min || 1)
      };
    });
  },

  buildParallelCoords() {
    if (this.dimensions.length < 2) return;

    const dimCount = this.dimensions.length;
    const xStep = this.data.width / (dimCount - 1);

    // Build axes
    this.dimensions.forEach((dim, i) => {
      const x = (i * xStep) - this.data.width / 2;
      this.createAxis(dim, x, i);
    });

    // Build data lines
    this.parsedData.forEach((datum, i) => {
      this.createDataLine(datum, i);
    });
  },

  createAxis(dimension, x, index) {
    if (this.data.showAxes) {
      // Axis line
      const axis = document.createElement('a-cylinder');
      axis.setAttribute('position', `${x} 0 0`);
      axis.setAttribute('height', this.data.height);
      axis.setAttribute('radius', 0.02);
      axis.setAttribute('color', '#333333');
      this.container.appendChild(axis);

      // Axis label
      const label = document.createElement('a-text');
      label.setAttribute('value', dimension);
      label.setAttribute('align', 'center');
      label.setAttribute('position', `${x} ${this.data.height / 2 + 0.5} 0`);
      label.setAttribute('scale', '0.4 0.4 0.4');
      label.setAttribute('color', '#ffffff');
      this.container.appendChild(label);

      // Tick marks
      const scale = this.colorScales[dimension];
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        const y = (t * this.data.height) - this.data.height / 2;
        const value = scale.min + t * (scale.max - scale.min);

        const tick = document.createElement('a-box');
        tick.setAttribute('position', `${x} ${y} 0`);
        tick.setAttribute('width', 0.3);
        tick.setAttribute('height', 0.02);
        tick.setAttribute('depth', 0.02);
        tick.setAttribute('color', '#555555');
        this.container.appendChild(tick);

        const tickLabel = document.createElement('a-text');
        tickLabel.setAttribute('value', value.toFixed(1));
        tickLabel.setAttribute('position', `${x + 0.4} ${y} 0`);
        tickLabel.setAttribute('scale', '0.2 0.2 0.2');
        tickLabel.setAttribute('color', '#888888');
        this.container.appendChild(tickLabel);
      }
    }
  },

  createDataLine(datum, index) {
    const points = [];

    this.dimensions.forEach((dim, i) => {
      const scale = this.colorScales[dim];
      const value = datum[dim];

      if (value !== undefined && scale) {
        const t = scale.scale(value);
        const x = (i * (this.data.width / (this.dimensions.length - 1))) - this.data.width / 2;
        const y = (t * this.data.height) - this.data.height / 2;
        points.push({ x, y, z: 0 });
      }
    });

    if (points.length < 2) return;

    // Create line connecting points
    const line = document.createElement('a-entity');
    const color = this.getLineColor(datum);

    // Build line segments
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const segment = document.createElement('a-cylinder');
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      segment.setAttribute('position', {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: 0
      });
      segment.setAttribute('height', distance);
      segment.setAttribute('radius', this.data.lineWidth);
      segment.setAttribute('color', color);
      segment.setAttribute('material', {
        opacity: this.data.lineOpacity,
        transparent: true
      });

      // Rotate to match direction
      segment.setAttribute('rotation', {
        x: 0,
        y: 0,
        z: angle - 90
      });

      segment.userData = { datum, index };
      segment.classList.add('parallel-line');

      if (this.data.highlightOnHover) {
        segment.addEventListener('mouseenter', () => {
          segment.setAttribute('material', 'opacity', 1);
          segment.setAttribute('radius', this.data.lineWidth * 2);
        });

        segment.addEventListener('mouseleave', () => {
          segment.setAttribute('material', 'opacity', this.data.lineOpacity);
          segment.setAttribute('radius', this.data.lineWidth);
        });
      }

      line.appendChild(segment);
    }

    this.container.appendChild(line);
  },

  getLineColor(datum) {
    const colorField = this.data.colorBy;
    const value = datum[colorField];

    if (typeof value === 'number') {
      // Use heat scale
      const t = Math.max(0, Math.min(1, value));
      return `hsl(${240 - t * 240}, 70%, 50%)`;
    } else {
      // Hash string to color
      const colors = ['#00d4aa', '#ff6b6b', '#4ecdc4', '#ffeaa7', '#a29bfe'];
      const hash = String(value).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return colors[Math.abs(hash) % colors.length];
    }
  },

  update() {
    // Clear and rebuild
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    this.parseData();
    this.setupScales();
    this.buildParallelCoords();
  },

  remove() {
    if (this.container) {
      this.container.remove();
    }
  }
});

console.log('[nemosyne-parallel-coords] Parallel coordinates component registered');
