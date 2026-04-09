/**
 * nemosyne-network-globe: 3D Network Connections on Sphere
 *
 * Visualizes global network connections on a sphere surface.
 * Nodes positioned by latitude/longitude, connected by arcs.
 */

AFRAME.registerComponent('nemosyne-network-globe', {
  schema: {
    nodes: { type: 'string', default: '[]' },
    links: { type: 'string', default: '[]' },
    radius: { type: 'number', default: 3 },
    nodeSize: { type: 'number', default: 0.1 },
    arcHeight: { type: 'number', default: 0.3 },
    colors: { type: 'array', default: [] },
    autoRotate: { type: 'boolean', default: true },
    rotateSpeed: { type: 'number', default: 0.1 }
  },

  init() {
    this.nodes = [];
    this.links = [];
    this.nodeEntities = [];
    this.linkEntities = [];
    this.globeRotation = 0;

    this.setupScene();
    this.processData();
    this.buildGlobe();
    this.buildNodes();
    this.buildLinks();

    if (this.data.autoRotate) {
      this.startRotation();
    }
  },

  setupScene() {
    // Create globe container
    this.globe = document.createElement('a-entity');
    this.globe.setAttribute('id', 'network-globe');
    this.el.appendChild(this.globe);

    // Create wireframe sphere
    const sphere = document.createElement('a-sphere');
    sphere.setAttribute('radius', this.data.radius);
    sphere.setAttribute('material', {
      color: '#1a1a2e',
      wireframe: true,
      opacity: 0.3,
      transparent: true
    });
    this.globe.appendChild(sphere);
  },

  processData() {
    try {
      this.nodes = JSON.parse(this.data.nodes);
      this.links = JSON.parse(this.data.links);
    } catch (e) {
      console.error('[nemosyne-network-globe] Parse error:', e);
    }
  },

  latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return { x, y, z };
  },

  buildGlobe() {
    // Add continent silhouettes (optional)
    const color = new THREE.Color('#00d4aa');
  },

  buildNodes() {
    this.nodes.forEach((node, i) => {
      const pos = this.latLonToVector3(
        node.lat || 0,
        node.lon || 0,
        this.data.radius + 0.05
      );

      const entity = document.createElement('a-sphere');
      entity.setAttribute('position', pos);
      entity.setAttribute('radius', this.data.nodeSize * (node.weight || 1));
      entity.setAttribute('color', node.color || '#00d4aa');
      entity.setAttribute('emissive', node.color || '#00d4aa');
      entity.setAttribute('emissiveIntensity', 0.5);

      entity.userData = { node, index: i };
      entity.classList.add('clickable');

      // Hover effect
      entity.addEventListener('mouseenter', () => {
        entity.setAttribute('scale', '1.5 1.5 1.5');
        this.highlightLinks(i);
      });

      entity.addEventListener('mouseleave', () => {
        entity.setAttribute('scale', '1 1 1');
        this.resetLinks();
      });

      this.globe.appendChild(entity);
      this.nodeEntities.push(entity);
    });
  },

  buildLinks() {
    this.links.forEach(link => {
      const source = this.nodes[link.source];
      const target = this.nodes[link.target];

      if (!source || !target) return;

      const start = this.latLonToVector3(
        source.lat || 0,
        source.lon || 0,
        this.data.radius + 0.05
      );
      const end = this.latLonToVector3(
        target.lat || 0,
        target.lon || 0,
        this.data.radius + 0.05
      );

      // Create arc curve
      const curve = this.createGreatCircleArc(start, end);
      const points = curve.getPoints(50);

      // Create line
      const lineEntity = document.createElement('a-entity');
      lineEntity.setAttribute('line', {
        start: points[0],
        end: points[points.length - 1],
        color: link.color || '#00d4aa',
        opacity: 0.3
      });

      this.globe.appendChild(lineEntity);
      this.linkEntities.push({
        entity: lineEntity,
        source: link.source,
        target: link.target
      });
    });
  },

  createGreatCircleArc(start, end) {
    // Calculate control point for arc
    const mid = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: (start.z + end.z) / 2
    };

    // Push control point outward for arc
    const len = Math.sqrt(mid.x * mid.x + mid.y * mid.y + mid.z * mid.z);
    const arcHeight = this.data.arcHeight * this.data.radius;
    const control = {
      x: mid.x / len * (this.data.radius + arcHeight),
      y: mid.y / len * (this.data.radius + arcHeight),
      z: mid.z / len * (this.data.radius + arcHeight)
    };

    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(control.x, control.y, control.z),
      new THREE.Vector3(end.x, end.y, end.z)
    );
  },

  highlightLinks(nodeIndex) {
    this.linkEntities.forEach(link => {
      if (link.source === nodeIndex || link.target === nodeIndex) {
        link.entity.setAttribute('line', 'opacity', 0.8);
        link.entity.setAttribute('line', 'color', '#ff6b6b');
      } else {
        link.entity.setAttribute('line', 'opacity', 0.1);
      }
    });
  },

  resetLinks() {
    this.linkEntities.forEach(link => {
      link.entity.setAttribute('line', 'opacity', 0.3);
      link.entity.setAttribute('line', 'color', '#00d4aa');
    });
  },

  startRotation() {
    const rotate = () => {
      if (!this.data.autoRotate) return;

      this.globeRotation += this.data.rotateSpeed * 0.016;
      this.globe.setAttribute('rotation', {
        x: 0,
        y: this.globeRotation * (180 / Math.PI),
        z: 0
      });

      requestAnimationFrame(rotate);
    };

    rotate();
  },

  update() {
    // Rebuild on data change
    this.processData();

    // Clear and rebuild
    this.nodeEntities.forEach(e => e.remove());
    this.linkEntities.forEach(l => l.entity.remove());
    this.nodeEntities = [];
    this.linkEntities = [];

    this.buildNodes();
    this.buildLinks();
  },

  remove() {
    if (this.globe) {
      this.globe.remove();
    }
  }
});

console.log('[nemosyne-network-globe] Network globe component registered');
