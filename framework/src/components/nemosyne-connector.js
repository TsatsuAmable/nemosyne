/**
 * Nemosyne Connector Component
 * Renders edges/connections between artefacts
 */

export const NemosyneConnector = {
  schema: {
    // Source and target artefact selectors
    from: { type: 'selector', default: '' },
    to: { type: 'selector', default: '' },
    
    // Connection style
    type: { type: 'string', default: 'line' }, // line, curve, tube, beam
    thickness: { type: 'number', default: 0.03 },
    
    // Appearance
    color: { type: 'string', default: '#00d4aa' },
    opacity: { type: 'number', default: 0.4 },
    emissive: { type: 'string', default: '#00d4aa' },
    emissiveIntensity: { type: 'number', default: 0.2 },
    
    // Animation
    animated: { type: 'boolean', default: false },
    pulse: { type: 'boolean', default: false }
  },

  init: function() {
    this.sourceEl = null;
    this.targetEl = null;
    this.connectorEl = null;
    
    this.findEndpoints();
    this.createConnector();
    this.setupObservers();
  },

  findEndpoints: function() {
    this.sourceEl = this.data.from;
    this.targetEl = this.data.to;
    
    if (!this.sourceEl || !this.targetEl) {
      console.warn('Nemosyne connector: Could not find source or target');
      return;
    }
  },

  createConnector: function() {
    if (!this.sourceEl || !this.targetEl) return;
    
    // Remove existing connector
    if (this.connectorEl) {
      this.connectorEl.parentNode.removeChild(this.connectorEl);
    }
    
    const type = this.data.type;
    
    switch (type) {
      case 'line':
        this.connectorEl = this.createLine();
        break;
      case 'curve':
        this.connectorEl = this.createCurve();
        break;
      case 'tube':
        this.connectorEl = this.createTube();
        break;
      case 'beam':
        this.connectorEl = this.createBeam();
        break;
      default:
        this.connectorEl = this.createLine();
    }
    
    if (this.connectorEl) {
      this.el.appendChild(this.connectorEl);
      this.updatePosition();
    }
  },

  createLine: function() {
    const line = document.createElement('a-entity');
    line.setAttribute('geometry', {
      primitive: 'cylinder',
      radius: this.data.thickness,
      height: 1 // Will be updated
    });
    line.setAttribute('material', {
      color: this.data.color,
      opacity: this.data.opacity,
      transparent: true,
      emissive: this.data.emissive,
      emissiveIntensity: this.data.emissiveIntensity
    });
    
    // Add pulse effect if enabled
    if (this.data.pulse) {
      line.setAttribute('animation', {
        property: 'material.emissiveIntensity',
        from: this.data.emissiveIntensity,
        to: this.data.emissiveIntensity * 2,
        dir: 'alternate',
        dur: 1000,
        loop: true,
        easing: 'easeInOutSine'
      });
    }
    
    // Add flow animation if enabled
    if (this.data.animated) {
      line.setAttribute('animation__flow', {
        property: 'material.opacity',
        from: this.data.opacity,
        to: this.data.opacity * 1.5,
        dir: 'alternate',
        dur: 800,
        loop: true
      });
    }
    
    return line;
  },

  createCurve: function() {
    // Bezier curve using multiple segments
    // Simplified: create a curved tube
    return this.createLine(); // Placeholder - would implement Catmull-Rom
  },

  createTube: function() {
    return this.createLine(); // Same as line but with rounded ends
  },

  createBeam: function() {
    const beam = this.createLine();
    beam.setAttribute('geometry', 'radius', this.data.thickness * 2);
    beam.setAttribute('material', 'emissiveIntensity', this.data.emissiveIntensity * 2);
    return beam;
  },

  updatePosition: function() {
    if (!this.sourceEl || !this.targetEl || !this.connectorEl) return;
    
    const posA = this.getWorldPosition(this.sourceEl);
    const posB = this.getWorldPosition(this.targetEl);
    
    // Calculate distance
    const distance = Math.sqrt(
      Math.pow(posB.x - posA.x, 2) +
      Math.pow(posB.y - posA.y, 2) +
      Math.pow(posB.z - posA.z, 2)
    );
    
    // Position at midpoint
    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;
    const midZ = (posA.z + posB.z) / 2;
    
    this.connectorEl.setAttribute('position', `${midX} ${midY} ${midZ}`);
    this.connectorEl.setAttribute('geometry', 'height', distance);
    
    // Orient toward target
    this.connectorEl.object3D.lookAt(posB.x, posB.y, posB.z);
    this.connectorEl.object3D.rotateX(Math.PI / 2);
  },

  getWorldPosition: function(el) {
    const position = new THREE.Vector3();
    el.object3D.getWorldPosition(position);
    return position;
  },

  setupObservers: function() {
    // Update connector when endpoints move
    this.tick = AFRAME.utils.throttleTick(this.updatePosition.bind(this), 100, this);
  },

  remove: function() {
    if (this.connectorEl && this.connectorEl.parentNode) {
      this.connectorEl.parentNode.removeChild(this.connectorEl);
    }
  }
};
