/**
 * nemosyne-geo-globe: Geographic Data Visualization
 *
 * Renders geographic data (lat/long coordinates) on a 3D Earth globe.
 * Supports marker clustering, great circle arcs, and country/region coloring.
 *
 * Features:
 * - Spherical Earth with texture mapping
 * - Lat/long to 3D coordinate conversion
 * - Marker clustering at different zoom levels
 * - Great circle arc connections between points
 * - Country/region coloring
 * - Rotation and zoom controls
 * - Marker size by data value
 */

AFRAME.registerComponent('nemosyne-geo-globe', {
  schema: {
    // Data
    points: { type: 'array', default: [] }, // {lat, lng, value, label}
    connections: { type: 'array', default: [] }, // {from, to, weight}

    // Globe settings
    radius: { type: 'number', default: 3 },
    rotationSpeed: { type: 'number', default: 0.05 }, // degrees per frame
    autoRotate: { type: 'boolean', default: true },

    // Markers
    markerSize: { type: 'number', default: 0.08 },
    markerGeometry: { type: 'string', default: 'cylinder' },
    markerHeight: { type: 'number', default: 0.3 }, // Vertical extrusion
    colorBy: { type: 'string', default: 'value' }, // 'value', 'cluster', 'region'

    // Connections
    showConnections: { type: 'boolean', default: true },
    connectionColor: { type: 'color', default: '#00d4aa' },
    connectionOpacity: { type: 'number', default: 0.4 },
    arcHeight: { type: 'number', default: 0.5 }, // Arc height above surface

    // Clustering
    enableClustering: { type: 'boolean', default: true },
    clusterDistance: { type: 'number', default: 0.5 }, // radians

    // Interaction
    interactive: { type: 'boolean', default: true },
    zoomEnabled: { type: 'boolean', default: true },
    minZoom: { type: 'number', default: 2 },
    maxZoom: { type: 'number', default: 10 }
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);

    this.markers = new Map();
    this.connections = [];
    this.camera = null;
    this.currentZoom = this.data.radius;

    // Create Earth
    this.createEarth();

    // Create markers
    this.createMarkers();

    // Create connections
    if (this.data.showConnections) {
      this.createConnections();
    }

    // Setup interactions
    this.setupInteractions();

    // Start rotation if enabled
    if (this.data.autoRotate) {
      this.startRotation();
    }

    console.log('[nemosyne-geo-globe] Initialized with',
                this.data.points.length, 'points');
  },

  createEarth: function() {
    // Globe sphere
    const globe = document.createElement('a-sphere');
    globe.setAttribute('radius', this.data.radius);
    globe.setAttribute('segments-width', 64);
    globe.setAttribute('segments-height', 64);

    // Material - procedural Earth-like
    globe.setAttribute('material', {
      color: '#1a237e', // Deep ocean blue
      emissive: '#0d1b3a',
      emissiveIntensity: 0.2,
      roughness: 0.8,
      metalness: 0.2
    });

    // Wireframe overlay for tech feel
    const wireframe = document.createElement('a-sphere');
    wireframe.setAttribute('radius', this.data.radius * 1.01);
    wireframe.setAttribute('segments-width', 24);
    wireframe.setAttribute('segments-height', 24);
    wireframe.setAttribute('material', {
      wireframe: true,
      color: '#00d4aa',
      opacity: 0.1,
      transparent: true
    });

    // Grid lines parallel to equator
    for (let lat = -80; lat <= 80; lat += 20) {
      const ring = document.createElement('a-ring');
      const rad = this.data.radius * Math.cos(lat * Math.PI / 180);
      ring.setAttribute('radius-inner', rad * 0.99);
      ring.setAttribute('radius-outer', rad * 1.01);
      ring.setAttribute('rotation', { x: 90, y: 0, z: 0 });
      ring.setAttribute('position', { x: 0, y: this.data.radius * Math.sin(lat * Math.PI / 180), z: 0 });
      ring.setAttribute('material', {
        color: '#00d4aa',
        opacity: 0.1,
        transparent: true,
        shader: 'flat'
      });
      globe.appendChild(ring);
    }

    // Meridian lines
    for (let lng = 0; lng < 360; lng += 30) {
      const arc = document.createElement('a-torus');
      arc.setAttribute('radius', this.data.radius * 0.999);
      arc.setAttribute('radius-tubular', 0.005);
      arc.setAttribute('arc', 180);
      arc.setAttribute('rotation', { x: 0, y: lng, z: 0 });
      arc.setAttribute('material', {
        color: '#00d4aa',
        opacity: 0.1,
        transparent: true
      });
      globe.appendChild(arc);
    }

    this.container.appendChild(globe);
    this.container.appendChild(wireframe);

    this.globe = globe;
  },

  latLongToXYZ: function(lat, lng, radius = this.data.radius) {
    // Convert lat/long (degrees) to 3D coordinates
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    return {
      x: -(radius * Math.sin(phi) * Math.cos(theta)),
      y: radius * Math.cos(phi),
      z: radius * Math.sin(phi) * Math.sin(theta)
    };
  },

  createMarkers: function() {
    // Cluster points if enabled
    let pointsToRender = this.data.points;
    if (this.data.enableClustering) {
      pointsToRender = this.clusterPoints(this.data.points);
    }

    pointsToRender.forEach((point, i) => {
      this.createMarker(point, i);
    });
  },

  clusterPoints: function(points) {
    // Simple distance-based clustering
    const clusters = [];
    const processed = new Set();

    points.forEach((point, i) => {
      if (processed.has(i)) return;

      const cluster = [point];
      processed.add(i);

      // Find nearby points
      points.forEach((other, j) => {
        if (i === j || processed.has(j)) return;

        const dist = this.haversineDistance(point.lat, point.lng, other.lat, other.lng);
        if (dist < this.data.clusterDistance * 100) { // Rough conversion
          cluster.push(other);
          processed.add(j);
        }
      });

      if (cluster.length === 1) {
        clusters.push({
          ...point,
          isCluster: false,
          count: 1
        });
      } else {
        // Create centroid
        const avgLat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
        const avgLng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length;
        const totalValue = cluster.reduce((s, p) => s + (p.value || 0), 0);

        clusters.push({
          lat: avgLat,
          lng: avgLng,
          value: totalValue,
          isCluster: true,
          count: cluster.length,
          items: cluster
        });
      }
    });

    return clusters;
  },

  haversineDistance: function(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  createMarker: function(point, index) {
    const pos = this.latLongToXYZ(point.lat, point.lng);
    const surfacePos = this.latLongToXYZ(point.lat, point.lng, this.data.radius);

    // Create marker - extruded cylinder pointing outward
    const marker = document.createElement(`a-${this.data.markerGeometry}`);
    marker.setAttribute('position', surfacePos);

    // Orientation - point outward from center
    const centerToSurface = {
      x: surfacePos.x,
      y: surfacePos.y,
      z: surfacePos.z
    };
    const length = Math.sqrt(centerToSurface.x**2 + centerToSurface.y**2 + centerToSurface.z**2);
    const normal = {
      x: centerToSurface.x / length,
      y: centerToSurface.y / length,
      z: centerToSurface.z / length
    };

    // Calculate rotation to point outward
    const rotX = Math.atan2(normal.z, normal.y) * 180 / Math.PI;
    const rotZ = -Math.atan2(normal.x, normal.y) * 180 / Math.PI;
    marker.setAttribute('rotation', { x: rotX, y: 0, z: rotZ });

    // Size
    const valueScale = point.value ? Math.log10(point.value + 1) * 0.3 : 1;
    const clusterScale = point.isCluster ? Math.sqrt(point.count) * 0.5 : 1;
    const size = this.data.markerSize * valueScale * clusterScale;

    if (this.data.markerGeometry === 'cylinder') {
      marker.setAttribute('radius', size);
      marker.setAttribute('height', this.data.markerHeight * valueScale);
      // Move up so base is on surface
      const heightOffset = {
        x: normal.x * this.data.markerHeight * valueScale * 0.5,
        y: normal.y * this.data.markerHeight * valueScale * 0.5,
        z: normal.z * this.data.markerHeight * valueScale * 0.5
      };
      marker.setAttribute('position', {
        x: surfacePos.x + heightOffset.x,
        y: surfacePos.y + heightOffset.y,
        z: surfacePos.z + heightOffset.z
      });
    } else {
      marker.setAttribute('radius', size);
    }

    // Color
    const color = this.getMarkerColor(point);
    marker.setAttribute('material', {
      color: color,
      emissive: color,
      emissiveIntensity: point.isCluster ? 0.8 : 0.5
    });

    // Label for clusters
    if (point.isCluster && point.count > 1) {
      const label = document.createElement('a-text');
      label.setAttribute('value', point.count.toString());
      label.setAttribute('align', 'center');
      label.setAttribute('color', '#ffffff');
      label.setAttribute('width', 8);
      label.setAttribute('position', { x: 0, y: 0.1, z: 0 });
      marker.appendChild(label);
    }

    // Metadata
    marker.dataset.pointIndex = index;
    marker.dataset.lat = point.lat;
    marker.dataset.lng = point.lng;
    marker.pointData = point;

    // Interaction
    if (this.data.interactive) {
      marker.classList.add('clickable');
      this.setupMarkerEvents(marker, point);
    }

    // Entrance animation
    marker.setAttribute('scale', '0 0 0');
    marker.setAttribute('animation__enter', {
      property: 'scale',
      to: '1 1 1',
      dur: 500,
      delay: index * 20,
      easing: 'easeOutElastic'
    });

    this.container.appendChild(marker);
    this.markers.set(index, marker);
  },

  getMarkerColor: function(point) {
    switch (this.data.colorBy) {
      case 'value':
        if (point.value) {
          // Heatmap from blue (low) to red (high)
          const maxVal = Math.max(...this.data.points.map(p => p.value || 0));
          const t = (point.value / maxVal) || 0;
          return this.interpolateColor('#4477ff', '#ff4444', t);
        }
        return '#00d4aa';

      case 'cluster':
        return point.isCluster ? '#ffaa00' : '#00d4aa';

      case 'region':
        // Hash by lat/long region
        const region = `${Math.floor(point.lat / 10)}_${Math.floor(point.lng / 10)}`;
        return this.hashToColor(region);

      default:
        return '#00d4aa';
    }
  },

  interpolateColor: function(c1, c2, t) {
    const r1 = parseInt(c1.substr(1, 2), 16);
    const g1 = parseInt(c1.substr(3, 2), 16);
    const b1 = parseInt(c1.substr(5, 2), 16);
    const r2 = parseInt(c2.substr(1, 2), 16);
    const g2 = parseInt(c2.substr(3, 2), 16);
    const b2 = parseInt(c2.substr(5, 2), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
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

  setupMarkerEvents: function(marker, point) {
    marker.addEventListener('mouseenter', () => {
      marker.setAttribute('scale', '1.3 1.3 1.3');
    });

    marker.addEventListener('mouseleave', () => {
      marker.setAttribute('scale', '1 1 1');
    });

    marker.addEventListener('click', () => {
      this.selectMarker(point, marker);
    });
  },

  createConnections: function() {
    this.data.connections.forEach((conn, i) => {
      const from = this.data.points.find(p => p.id === conn.from || p.label === conn.from);
      const to = this.data.points.find(p => p.id === conn.to || p.label === conn.to);

      if (!from || !to) return;

      this.createArcConnection(from, to, conn, i);
    });
  },

  createArcConnection: function(from, to, conn, index) {
    // Create great circle arc
    const start = this.latLongToXYZ(from.lat, from.lng, this.data.radius);
    const end = this.latLongToXYZ(to.lat, to.lng, this.data.radius);

    // Calculate midpoint and elevate it for arc
    const mid = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: (start.z + end.z) / 2
    };
    const midLen = Math.sqrt(mid.x**2 + mid.y**2 + mid.z**2);
    const arcHeight = this.data.radius + this.data.arcHeight * conn.weight;
    const elevatedMid = {
      x: mid.x / midLen * arcHeight,
      y: mid.y / midLen * arcHeight,
      z: mid.z / midLen * arcHeight
    };

    // Create curve using multiple segments
    const segments = 20;
    const curve = this.quadraticBezierCurve(start, elevatedMid, end, segments);

    const curveEntity = document.createElement('a-entity');

    for (let i = 0; i < curve.length - 1; i++) {
      const line = document.createElement('a-entity');
      line.setAttribute('line', {
        start: `${curve[i].x} ${curve[i].y} ${curve[i].z}`,
        end: `${curve[i+1].x} ${curve[i+1].y} ${curve[i+1].z}`,
        color: this.data.connectionColor,
        opacity: this.data.connectionOpacity * conn.weight
      });
      curveEntity.appendChild(line);
    }

    // Animation - pulse along the arc
    curveEntity.setAttribute('animation', {
      property: 'material.opacity',
      from: 0.2,
      to: 0.6,
      dur: 2000,
      dir: 'alternate',
      loop: true
    });

    this.container.appendChild(curveEntity);
    this.connections.push(curveEntity);
  },

  quadraticBezierCurve: function(p0, p1, p2, segments) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x;
      const y = (1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y;
      const z = (1-t)*(1-t)*p0.z + 2*(1-t)*t*p1.z + t*t*p2.z;
      points.push({ x, y, z });
    }
    return points;
  },

  selectMarker: function(point, marker) {
    // Highlight
    marker.setAttribute('animation__select', {
      property: 'material.emissiveIntensity',
      from: 2,
      to: 0.5,
      dur: 500
    });

    // Emit event
    this.el.emit('marker-select', { point });

    // Zoom to marker if enabled
    if (this.data.zoomEnabled && this.camera) {
      this.zoomToMarker(point);
    }
  },

  zoomToMarker: function(point) {
    const pos = this.latLongToXYZ(point.lat, point.lng, this.currentZoom * 2);

    this.camera.setAttribute('animation', {
      property: 'position',
      to: `${pos.x} ${pos.y} ${pos.z}`,
      dur: 1000,
      easing: 'easeInOutQuad'
    });
  },

  setupInteractions: function() {
    // Get camera for zoom
    this.camera = document.getElementById('camera') || document.querySelector('a-camera');
  },

  startRotation: function() {
    const rotate = () => {
      if (!this.data.autoRotate) return;

      const currentRot = this.container.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
      this.container.setAttribute('rotation', {
        x: currentRot.x,
        y: currentRot.y + this.data.rotationSpeed,
        z: currentRot.z
      });

      requestAnimationFrame(rotate);
    };

    requestAnimationFrame(rotate);
  },

  remove: function() {
    this.data.autoRotate = false;
    this.container.innerHTML = '';
  }
});


console.log('[nemosyne-geo-globe] Component registered');
