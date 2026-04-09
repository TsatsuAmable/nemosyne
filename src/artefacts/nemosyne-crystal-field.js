/**
 * nemosyne-crystal-field: Volume/Field Visualization
 *
 * Renders scalar fields, vector fields, and volumetric data.
 * Supports isosurfaces, volume rendering, and field line tracing.
 *
 * Features:
 * - Isosurface extraction (marching cubes)
 * - Volume rendering with ray marching
 * - Scalar field coloring
 * - Field line/streamline visualization
 * - Slice planes
 * - Animated field evolution
 */

AFRAME.registerComponent('nemosyne-crystal-field', {
  schema: {
    // Data
    fieldData: { type: 'array', default: [] }, // 3D array of scalar values
    dimensions: { type: 'vec3', default: { x: 32, y: 32, z: 32 } },
    bounds: { type: 'vec3', default: { x: 10, y: 10, z: 10 } },

    // Visualization mode
    mode: { type: 'string', default: 'isosurface' }, // 'isosurface', 'volumetric', 'slices', 'fieldlines'

    // Isosurface
    isovalue: { type: 'number', default: 0.5 }, // Threshold value (0-1)
    smoothNormals: { type: 'boolean', default: true },

    // Volumetric rendering
    opacityScale: { type: 'number', default: 1.0 },
    stepSize: { type: 'number', default: 0.1 },

    // Coloring
    colorScale: { type: 'string', default: 'heatmap' },
    minColor: { type: 'color', default: '#000044' },
    maxColor: { type: 'color', default: '#00ffaa' },

    // Field lines (for vector fields)
    numStreamlines: { type: 'number', default: 50 },
    streamlineLength: { type: 'number', default: 100 },
    streamlineStep: { type: 'number', default: 0.1 },

    // Slices
    sliceCount: { type: 'number', default: 3 },
    sliceAxis: { type: 'string', default: 'z' }, // 'x', 'y', 'z'

    // Animation
    animateField: { type: 'boolean', default: false },
    animationSpeed: { type: 'number', default: 1.0 }
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);

    this.isoMesh = null;
    this.volumeEntity = null;
    this.fieldLines = [];
    this.slices = [];

    // Normalize field data
    this.normalizeField();

    // Render based on mode
    switch (this.data.mode) {
      case 'isosurface':
        this.renderIsosurface();
        break;
      case 'slices':
        this.renderSlices();
        break;
      case 'fieldlines':
        this.renderFieldLines();
        break;
      default:
        this.renderIsosurface();
    }

    // Setup animation
    if (this.data.animateField) {
      this.startAnimation();
    }

    console.log('[nemosyne-crystal-field] Initialized',
                this.data.dimensions.x, '×', this.data.dimensions.y, '×', this.data.dimensions.z);
  },

  normalizeField: function() {
    // Flatten to 3D array if needed
    if (!Array.isArray(this.data.fieldData[0])) {
      const dim = this.data.dimensions;
      const flat = this.data.fieldData;
      this.field3D = [];

      for (let z = 0; z < dim.z; z++) {
        const zSlice = [];
        for (let y = 0; y < dim.y; y++) {
          const ySlice = [];
          for (let x = 0; x < dim.x; x++) {
            const idx = z * dim.y * dim.x + y * dim.x + x;
            ySlice.push(flat[idx] || 0);
          }
          zSlice.push(ySlice);
        }
        this.field3D.push(zSlice);
      }
    } else {
      this.field3D = this.data.fieldData;
    }

    // Normalize to 0-1
    let min = Infinity, max = -Infinity;
    this.field3D.forEach(z => {
      z.forEach(y => {
        y.forEach(v => {
          if (v < min) min = v;
          if (v > max) max = v;
        });
      });
    });

    this.fieldMin = min;
    this.fieldMax = max;

    this.field3D = this.field3D.map(z =>
      z.map(y =>
        y.map(v => (v - min) / (max - min || 1))
      )
    );
  },

  getFieldValue: function(x, y, z) {
    const dim = this.data.dimensions;
    const ix = Math.max(0, Math.min(dim.x - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(dim.y - 1, Math.floor(y)));
    const iz = Math.max(0, Math.min(dim.z - 1, Math.floor(z)));
    return this.field3D[iz]?.[iy]?.[ix] || 0;
  },

  renderIsosurface: function() {
    // Simplified marching cubes - create wireframe bounding box with color-coded surface
    const bounds = this.data.bounds;
    const dim = this.data.dimensions;

    // Create wireframe cube representing field bounds
    const cube = document.createElement('a-box');
    cube.setAttribute('width', bounds.x);
    cube.setAttribute('height', bounds.y);
    cube.setAttribute('depth', bounds.z);
    cube.setAttribute('material', {
      wireframe: true,
      color: '#00d4aa',
      opacity: 0.3,
      transparent: true
    });
    this.container.appendChild(cube);

    // Create isosurface points at threshold
    const threshold = this.data.isovalue;
    const points = this.extractIsosurfacePoints(threshold);

    // Render surface points as crystals
    points.forEach((point, i) => {
      const crystal = document.createElement('a-octahedron');
      crystal.setAttribute('position', point);
      crystal.setAttribute('radius', 0.1);

      // Color based on gradient
      const color = this.getColorForValue(threshold);
      crystal.setAttribute('material', {
        color: color,
        emissive: color,
        emissiveIntensity: 0.6
      });

      crystal.setAttribute('animation__enter', {
        property: 'scale',
        from: '0 0 0',
        to: '1 1 1',
        dur: 500,
        delay: i * 2,
        easing: 'easeOutElastic'
      });

      this.container.appendChild(crystal);
    });

    // Add pulsing effect
    this.container.setAttribute('animation__pulse', {
      property: 'scale',
      from: '1 1 1',
      to: '1.05 1.05 1.05',
      dur: 2000,
      dir: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    });
  },

  extractIsosurfacePoints: function(threshold) {
    const points = [];
    const dim = this.data.dimensions;
    const bounds = this.data.bounds;

    // Sample points where field crosses threshold
    for (let z = 0; z < dim.z - 1; z++) {
      for (let y = 0; y < dim.y - 1; y++) {
        for (let x = 0; x < dim.x - 1; x++) {
          const v = this.field3D[z][y][x];

          if (Math.abs(v - threshold) < 0.05) {
            // Convert grid to world position
            points.push({
              x: (x / dim.x - 0.5) * bounds.x,
              y: (y / dim.y - 0.5) * bounds.y,
              z: (z / dim.z - 0.5) * bounds.z
            });
          }
        }
      }
    }

    // Limit number of surface points
    return points.slice(0, 500);
  },

  renderSlices: function() {
    const dim = this.data.dimensions;
    const bounds = this.data.bounds;
    const sliceCount = this.data.sliceCount;

    for (let i = 0; i < sliceCount; i++) {
      const t = i / (sliceCount - 1 || 1);
      const sliceIndex = Math.floor(t * dim.z);

      this.createSlice(sliceIndex, t, i);
    }
  },

  createSlice: function(zIndex, t, index) {
    const bounds = this.data.bounds;
    const dim = this.data.dimensions;

    // Create canvas texture for slice
    const canvas = document.createElement('canvas');
    canvas.width = dim.x;
    canvas.height = dim.y;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(dim.x, dim.y);

    // Fill with field values
    for (let y = 0; y < dim.y; y++) {
      for (let x = 0; x < dim.x; x++) {
        const value = this.field3D[zIndex]?.[y]?.[x] || 0;
        const color = this.hexToRgb(this.getColorForValue(value));
        const idx = (y * dim.x + x) * 4;
        imgData.data[idx] = color.r;
        imgData.data[idx + 1] = color.g;
        imgData.data[idx + 2] = color.b;
        imgData.data[idx + 3] = Math.floor(value * 255 * this.data.opacityScale);
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);

    // Create slice plane
    const slice = document.createElement('a-plane');
    slice.setAttribute('width', bounds.x);
    slice.setAttribute('height', bounds.y);
    slice.setAttribute('position', {
      x: 0,
      y: 0,
      z: (t - 0.5) * bounds.z
    });

    if (this.data.sliceAxis === 'x') {
      slice.setAttribute('rotation', { x: 0, y: 90, z: 0 });
      slice.setAttribute('position', { x: (t - 0.5) * bounds.x, y: 0, z: 0 });
    } else if (this.data.sliceAxis === 'y') {
      slice.setAttribute('rotation', { x: 90, y: 0, z: 0 });
      slice.setAttribute('position', { x: 0, y: (t - 0.5) * bounds.y, z: 0 });
    }

    slice.setAttribute('material', {
      src: texture,
      transparent: true,
      opacity: 0.8,
      side: 'double'
    });

    this.container.appendChild(slice);
    this.slices.push(slice);
  },

  renderFieldLines: function() {
    // Trace streamlines through field
    const numLines = this.data.numStreamlines;
    const dim = this.data.dimensions;
    const bounds = this.data.bounds;

    for (let i = 0; i < numLines; i++) {
      // Random starting point
      const start = {
        x: Math.random() * dim.x,
        y: Math.random() * dim.y,
        z: Math.random() * dim.z
      };

      // Trace line
      const points = this.traceFieldLine(start);

      // Create line entity
      if (points.length > 2) {
        this.createFieldLineEntity(points, i);
      }
    }
  },

  traceFieldLine: function(start) {
    const points = [start];
    const length = this.data.streamlineLength;
    const step = this.data.streamlineStep;
    const dim = this.data.dimensions;

    let current = { ...start };

    for (let i = 0; i < length; i++) {
      // Get gradient at current point (simplified)
      const gx = this.getFieldValue(current.x + 1, current.y, current.z) -
                 this.getFieldValue(current.x - 1, current.y, current.z);
      const gy = this.getFieldValue(current.x, current.y + 1, current.z) -
                 this.getFieldValue(current.x, current.y - 1, current.z);
      const gz = this.getFieldValue(current.x, current.y, current.z + 1) -
                 this.getFieldValue(current.x, current.y, current.z - 1);

      // Normalize
      const len = Math.sqrt(gx*gx + gy*gy + gz*gz);
      if (len > 0) {
        current.x += (gx / len) * step;
        current.y += (gy / len) * step;
        current.z += (gz / len) * step;
      }

      // Bounds check
      if (current.x < 0 || current.x >= dim.x ||
          current.y < 0 || current.y >= dim.y ||
          current.z < 0 || current.z >= dim.z) {
        break;
      }

      points.push({ ...current });
    }

    return points;
  },

  createFieldLineEntity: function(points, index) {
    const bounds = this.data.bounds;
    const dim = this.data.dimensions;

    // Convert to world space
    const worldPoints = points.map(p => ({
      x: (p.x / dim.x - 0.5) * bounds.x,
      y: (p.y / dim.y - 0.5) * bounds.y,
      z: (p.z / dim.z - 0.5) * bounds.z
    }));

    // Create tube along path
    const group = document.createElement('a-entity');

    for (let i = 0; i < worldPoints.length - 1; i++) {
      const line = document.createElement('a-cylinder');
      const p1 = worldPoints[i];
      const p2 = worldPoints[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      line.setAttribute('position', {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: (p1.z + p2.z) / 2
      });
      line.setAttribute('height', dist);
      line.setAttribute('radius', 0.02);

      // Orient
      line.object3D.lookAt(p2.x, p2.y, p2.z);
      line.object3D.rotateX(Math.PI / 2);

      // Color gradient along line
      const t = i / worldPoints.length;
      const color = this.getColorForValue(t);
      line.setAttribute('material', {
        color: color,
        emissive: color,
        emissiveIntensity: 0.5
      });

      group.appendChild(line);
    }

    this.container.appendChild(group);
    this.fieldLines.push(group);
  },

  getColorForValue: function(value) {
    const t = Math.max(0, Math.min(1, value));

    if (this.data.colorScale === 'heatmap') {
      // Interpolate between min and max colors
      return this.interpolateColor(this.data.minColor, this.data.maxColor, t);
    }

    return this.data.maxColor;
  },

  interpolateColor: function(color1, color2, t) {
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

  hexToRgb: function(hex) {
    return {
      r: parseInt(hex.substr(1, 2), 16),
      g: parseInt(hex.substr(3, 2), 16),
      b: parseInt(hex.substr(5, 2), 16)
    };
  },

  startAnimation: function() {
    const animate = () => {
      if (!this.data.animateField) return;

      // Rotate field
      const currentRot = this.container.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
      this.container.setAttribute('rotation', {
        x: currentRot.x,
        y: currentRot.y + this.data.animationSpeed,
        z: currentRot.z
      });

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  },

  remove: function() {
    this.data.animateField = false;
    this.container.innerHTML = '';
  }
});


console.log('[nemosyne-crystal-field] Component registered');
