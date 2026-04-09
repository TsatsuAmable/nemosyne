/* global AFRAME, THREE */

/**
 * nemosyne-memory-crystal: 6DOF Crystal Component for Memory Palace VR
 * 
 * Provides:
 * - 6 Degrees of Freedom (position, rotation, scale)
 * - Smooth animations for real-time updates
 * - LOD (Level of Detail) support
 * - Hover and selection states
 * - Metadata display
 */

AFRAME.registerComponent('nemosyne-memory-crystal', {
  schema: {
    // 6DOF Transform
    position: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
    rotation: { type: 'vec4', default: { x: 0, y: 0, z: 0, w: 1 } }, // Quaternion
    scale: { type: 'vec3', default: { x: 1, y: 1, z: 1 } },
    
    // MemPalace Data
    drawerId: { type: 'string', default: '' },
    wingId: { type: 'string', default: '' },
    roomId: { type: 'string', default: '' },
    hallId: { type: 'string', default: '' },
    content: { type: 'string', default: '' },
    tags: { type: 'array', default: [] },
    timestamp: { type: 'number', default: 0 },
    
    // Visual Properties
    color: { type: 'color', default: '#00d4aa' },
    emissive: { type: 'color', default: '#00d4aa' },
    emissiveIntensity: { type: 'number', default: 0.5 },
    metalness: { type: 'number', default: 0.8 },
    roughness: { type: 'number', default: 0.2 },
    opacity: { type: 'number', default: 1.0 },
    geometry: { type: 'string', default: 'octahedron', oneOf: ['octahedron', 'dodecahedron', 'icosahedron', 'sphere', 'box'] },
    
    // Animation
    pulse: { type: 'boolean', default: false },
    pulseSpeed: { type: 'number', default: 1.0 },
    
    // Interaction
    interactive: { type: 'boolean', default: true },
    hoverScale: { type: 'number', default: 1.2 },
    
    // LOD
    lodLevel: { type: 'number', default: 0 }
  },

  init: function() {
    this.el.setAttribute('position', this.data.position);
    this.el.setAttribute('scale', this.data.scale);
    
    // Create geometry
    this.updateGeometry();
    
    // Create material
    this.updateMaterial();
    
    // Set rotation from quaternion
    this.updateRotation();
    
    // Setup interactions
    if (this.data.interactive) {
      this.setupInteractions();
    }
    
    // Start pulse animation if enabled
    if (this.data.pulse) {
      this.startPulse();
    }
    
    // Metadata for retrieval
    this.el.memoryData = {
      drawerId: this.data.drawerId,
      wingId: this.data.wingId,
      roomId: this.data.roomId,
      hallId: this.data.hallId,
      content: this.data.content,
      tags: this.data.tags,
      timestamp: this.data.timestamp
    };
    
    this.isHovered = false;
    this.isSelected = false;
    
    console.log(`[MemoryCrystal] Created: ${this.data.drawerId} in ${this.data.wingId}/${this.data.roomId}`);
  },

  update: function(oldData) {
    // Handle smooth transitions
    if (this.hasPositionChanged(oldData)) {
      this.animateTo('position', this.data.position, 500);
    }
    
    if (this.hasRotationChanged(oldData)) {
      this.animateRotation(this.data.rotation, 500);
    }
    
    if (this.hasScaleChanged(oldData)) {
      this.animateTo('scale', this.data.scale, 300);
    }
    
    if (this.data.color !== oldData.color || 
        this.data.emissive !== oldData.emissive) {
      this.updateMaterial();
    }
    
    if (this.data.geometry !== oldData.geometry) {
      this.updateGeometry();
    }
  },

  updateGeometry: function() {
    const geometryData = this.getGeometryForLOD();
    this.el.setAttribute('geometry', geometryData);
  },

  getGeometryForLOD: function() {
    const lod = this.data.lodLevel;
    
    switch (lod) {
      case 0: // Closest
        return { primitive: this.data.geometry, radius: 0.1 };
      case 1: // Medium
        return { primitive: 'dodecahedron', radius: 0.1 };
      case 2: // Far
        return { primitive: 'octahedron', radius: 0.1 };
      case 3: // Billboard
        return { primitive: 'plane', width: 0.2, height: 0.2 };
      default:
        return { primitive: this.data.geometry, radius: 0.1 };
    }
  },

  updateMaterial: function() {
    this.el.setAttribute('material', {
      color: this.data.color,
      emissive: this.data.emissive,
      emissiveIntensity: this.data.emissiveIntensity,
      metalness: this.data.metalness,
      roughness: this.data.roughness,
      opacity: this.data.opacity,
      transparent: this.data.opacity < 1.0
    });
  },

  updateRotation: function() {
    // Convert quaternion to Euler (A-Frame uses Euler)
    const quaternion = new THREE.Quaternion(
      this.data.rotation.x,
      this.data.rotation.y,
      this.data.rotation.z,
      this.data.rotation.w
    );
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    this.el.setAttribute('rotation', {
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y),
      z: THREE.MathUtils.radToDeg(euler.z)
    });
    this.quaternion = quaternion;
  },

  animateRotation: function(targetQuaternion, duration) {
    // Slerp between current and target rotation
    const targetQ = new THREE.Quaternion(
      targetQuaternion.x,
      targetQuaternion.y,
      targetQuaternion.z,
      targetQuaternion.w
    );
    
    const startQ = this.quaternion.clone();
    const startTime = performance.now();
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Smooth easing
      const easedT = this.easeInOutQuad(t);
      
      const currentQ = new THREE.Quaternion().copy(startQ).slerp(targetQ, easedT);
      const euler = new THREE.Euler().setFromQuaternion(currentQ);
      
      this.el.setAttribute('rotation', {
        x: THREE.MathUtils.radToDeg(euler.x),
        y: THREE.MathUtils.radToDeg(euler.y),
        z: THREE.MathUtils.radToDeg(euler.z)
      });
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.quaternion = targetQ;
      }
    };
    
    requestAnimationFrame(animate);
  },

  animateTo: function(property, target, duration) {
    const current = this.el.getAttribute(property);
    
    this.el.setAttribute('animation__' + property, {
      property: property,
      to: `${target.x} ${target.y} ${target.z}`,
      dur: duration,
      easing: 'easeInOutQuad'
    });
  },

  setupInteractions: function() {
    // Raycaster interaction
    this.el.addEventListener('raycaster-intersected', (evt) => {
      this.onHoverEnter();
    });
    
    this.el.addEventListener('raycaster-intersected-cleared', (evt) => {
      this.onHoverExit();
    });
    
    // Click/selection
    this.el.addEventListener('click', (evt) => {
      this.onSelect();
    });
  },

  onHoverEnter: function() {
    if (this.isHovered) return;
    this.isHovered = true;
    
    // Visual feedback
    this.el.setAttribute('animation__hover', {
      property: 'scale',
      to: `${this.data.scale.x * this.data.hoverScale} ${this.data.scale.y * this.data.hoverScale} ${this.data.scale.z * this.data.hoverScale}`,
      dur: 150,
      easing: 'easeOutQuad'
    });
    
    this.el.setAttribute('animation__emissive', {
      property: 'material.emissiveIntensity',
      to: 1.5,
      dur: 150,
      easing: 'easeOutQuad'
    });
    
    // Emit event
    this.el.emit('crystal-hover', { drawerId: this.data.drawerId });
    
    console.log(`[MemoryCrystal] Hover: ${this.data.drawerId}`);
  },

  onHoverExit: function() {
    if (!this.isHovered) return;
    this.isHovered = false;
    
    // Restore
    this.el.setAttribute('animation__hover', {
      property: 'scale',
      to: `${this.data.scale.x} ${this.data.scale.y} ${this.data.scale.z}`,
      dur: 150,
      easing: 'easeInOutQuad'
    });
    
    this.el.setAttribute('animation__emissive', {
      property: 'material.emissiveIntensity',
      to: this.data.emissiveIntensity,
      dur: 150,
      easing: 'easeInOutQuad'
    });
    
    this.el.emit('crystal-hover-end', { drawerId: this.data.drawerId });
  },

  onSelect: function() {
    this.isSelected = !this.isSelected;
    
    if (this.isSelected) {
      // Flash effect
      this.el.setAttribute('animation__select', {
        property: 'material.emissive',
        from: '#ffffff',
        to: this.data.emissive,
        dur: 300,
        easing: 'easeOutQuad'
      });
      
      console.log(`[MemoryCrystal] Selected: ${this.data.drawerId}`);
      this.el.emit('crystal-select', { 
        drawerId: this.data.drawerId,
        data: this.el.memoryData 
      });
    }
  },

  startPulse: function() {
    const speed = 1000 / this.data.pulseSpeed;
    
    this.el.setAttribute('animation__pulse', {
      property: 'material.emissiveIntensity',
      from: 0.3,
      to: 1.0,
      dur: speed / 2,
      easing: 'easeInOutSine',
      loop: true,
      dir: 'alternate'
    });
  },

  spawnAnimation: function() {
    // Start invisible
    this.el.setAttribute('scale', '0 0 0');
    this.el.setAttribute('material.opacity', 0);
    
    // Pop in
    this.el.setAttribute('animation__spawn', {
      property: 'scale',
      to: `${this.data.scale.x} ${this.data.scale.y} ${this.data.scale.z}`,
      dur: 500,
      easing: 'easeOutElastic'
    });
    
    this.el.setAttribute('animation__fade', {
      property: 'material.opacity',
      to: this.data.opacity,
      dur: 300,
      easing: 'easeOutQuad'
    });
    
    // Flash
    this.el.setAttribute('animation__flash', {
      property: 'material.emissiveIntensity',
      from: 2.0,
      to: this.data.emissiveIntensity,
      dur: 600,
      easing: 'easeOutQuad'
    });
  },

  vanishAnimation: function() {
    return new Promise((resolve) => {
      this.el.setAttribute('animation__vanish', {
        property: 'scale',
        to: '0 0 0',
        dur: 300,
        easing: 'easeInQuad'
      });
      
      setTimeout(() => resolve(), 300);
    });
  },

  // Utility: Check if data has changed
  hasPositionChanged: function(oldData) {
    return oldData.position && 
      (this.data.position.x !== oldData.position.x ||
       this.data.position.y !== oldData.position.y ||
       this.data.position.z !== oldData.position.z);
  },

  hasRotationChanged: function(oldData) {
    return oldData.rotation &&
      (this.data.rotation.x !== oldData.rotation.x ||
       this.data.rotation.y !== oldData.rotation.y ||
       this.data.rotation.z !== oldData.rotation.z ||
       this.data.rotation.w !== oldData.rotation.w);
  },

  hasScaleChanged: function(oldData) {
    return oldData.scale &&
      (this.data.scale.x !== oldData.scale.x ||
       this.data.scale.y !== oldData.scale.y ||
       this.data.scale.z !== oldData.scale.z);
  },

  easeInOutQuad: function(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },

  remove: function() {
    // Cleanup
    this.el.removeAttribute('animation__pulse');
    console.log(`[MemoryCrystal] Removed: ${this.data.drawerId}`);
  }
});

// Convenience method for programmatic creation
AFRAME.registerComponent('memory-crystal-spawner', {
  schema: {
    autoSpawn: { type: 'boolean', default: false }
  },

  init: function() {
    if (this.data.autoSpawn) {
      // Listen for spawn events
      this.el.sceneEl.addEventListener('spawn-crystal', (evt) => {
        this.spawnCrystal(evt.detail);
      });
    }
  },

  spawnCrystal: function(data) {
    const entity = document.createElement('a-entity');
    
    entity.setAttribute('nemosyne-memory-crystal', {
      position: data.position,
      rotation: data.rotation,
      scale: data.scale,
      drawerId: data.drawerId,
      wingId: data.wingId,
      roomId: data.roomId,
      color: data.color,
      emissive: data.emissive,
      pulse: data.pulse || false
    });
    
    this.el.sceneEl.appendChild(entity);
    
    // Trigger spawn animation
    entity.addEventListener('loaded', () => {
      const comp = entity.components['nemosyne-memory-crystal'];
      if (comp) comp.spawnAnimation();
    });
    
    return entity;
  },

  removeCrystal: async function(drawerId) {
    const entity = document.querySelector(`[nemosyne-memory-crystal][drawer-id="${drawerId}"]`);
    if (entity) {
      const comp = entity.components['nemosyne-memory-crystal'];
      if (comp) {
        await comp.vanishAnimation();
      }
      entity.remove();
    }
  }
});

console.log('[MemoryPalaceVR] 6DOF Crystal Component Registered');
