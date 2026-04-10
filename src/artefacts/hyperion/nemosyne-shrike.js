/**
 * nemosyne-shrike: Hyperion-Cantos Themed Time Entity
 *
 * A metallic, blade-like entity inspired by the Shrike from Dan Simmons' Hyperion Cantos.
 * Features rotating gear mechanisms, blade projections, and time-dilation visual effects.
 *
 * The Shrike is a mysterious entity of metal and thorns that exists outside of time,
 * capable of appearing and disappearing instantaneously.
 *
 * Features:
 * - Multi-blade geometric structure
 * - Rotating gear animations (timekeeping metaphor)
 * - Temporal glitch/teleport effects
 * - Emissive thorns that pulse warning signals
 * - Scale based on temporal proximity
 *
 * @author Nemosyne Framework
 * @version 0.2.0
 *
 * Usage:
 * ```html
 * <a-entity nemosyne-shrike="
 *   data: { timestamp: 123456789, intensity: 0.8 };
 *   bladeCount: 6;
 *   enableGlitch: true
 * "></a-entity>
 * ```
 */

AFRAME.registerComponent('nemosyne-shrike', {
  schema: {
    // Data binding
    data: { type: 'string', default: '{}' },
    timestamp: { type: 'number', default: 0 },
    intensity: { type: 'number', default: 0.5 },
    
    // Appearance
    bladeCount: { type: 'number', default: 6 },       // Number of blade projections
    bladeLength: { type: 'number', default: 2.0 },    // Length of blades
    bladeColor: { type: 'color', default: '#8B0000' }, // Dark red/crimson
    metalColor: { type: 'color', default: '#2C2C2C' }, // Dark metal
    emissiveColor: { type: 'color', default: '#FF4500' }, // Orange-red glow
    
    // Animation
    rotationSpeed: { type: 'number', default: 30 },  // Degrees per second
    gearRatio: { type: 'number', default: 0.3 },      // Gear rotation multiplier
    pulseRate: { type: 'number', default: 2000 },     // Emissive pulse interval
    
    // Effects
    enableGlitch: { type: 'boolean', default: true }, // Temporal glitch effect
    glitchInterval: { type: 'number', default: 5000 }, // ms between glitches
    glitchDuration: { type: 'number', default: 200 },  // ms of glitch
    
    // Scale
    baseScale: { type: 'number', default: 1.0 },
    intensityScale: { type: 'boolean', default: true } // Scale by intensity
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);
    
    // Parse data
    this.parsedData = this.parseData();
    
    // Core structure
    this.createCore();
    this.createBlades();
    this.createGears();
    this.createThorns();
    
    // Apply transforms
    this.applyTransforms();
    
    // Setup animations
    this.setupAnimations();
    
    // Glitch effect
    if (this.data.enableGlitch) {
      this.setupGlitch();
    }
    
    console.log('[nemosyne-shrike] Shrike entity manifested', {
      blades: this.data.bladeCount,
      intensity: this.parsedData.intensity
    });
  },

  parseData: function() {
    try {
      const parsed = JSON.parse(this.data.data);
      return {
        timestamp: parsed.timestamp || this.data.timestamp,
        intensity: Math.max(0, Math.min(1, parsed.intensity || this.data.intensity))
      };
    } catch(e) {
      return {
        timestamp: this.data.timestamp,
        intensity: this.data.intensity
      };
    }
  },

  createCore: function() {
    // Central metallic core
    this.core = document.createElement('a-dodecahedron');
    this.core.setAttribute('radius', 0.5);
    this.core.setAttribute('color', this.data.metalColor);
    this.core.setAttribute('material', {
      metalness: 1.0,
      roughness: 0.2,
      emissive: this.data.emissiveColor,
      emissiveIntensity: 0.3 * this.parsedData.intensity
    });
    
    // Inner glowing orb
    this.orb = document.createElement('a-sphere');
    this.orb.setAttribute('radius', 0.3);
    this.orb.setAttribute('color', this.data.emissiveColor);
    this.orb.setAttribute('material', {
      emissive: this.data.emissiveColor,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.7
    });
    
    this.container.appendChild(this.core);
    this.core.appendChild(this.orb);
  },

  createBlades: function() {
    this.blades = [];
    const count = this.data.bladeCount;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      
      // Create blade (elongated octahedron)
      const blade = document.createElement('a-entity');
      
      // Multiple stacked geometries for blade shape
      const tip = document.createElement('a-cone');
      tip.setAttribute('radius-bottom', 0.1);
      tip.setAttribute('radius-top', 0.01);
      tip.setAttribute('height', this.data.bladeLength);
      tip.setAttribute('position', { x: 0, y: 0, z: this.data.bladeLength / 2 });
      tip.setAttribute('color', this.data.bladeColor);
      tip.setAttribute('material', {
        metalness: 0.9,
        roughness: 0.1
      });
      
      // Add emissive edge
      const edge = document.createElement('a-cylinder');
      edge.setAttribute('radius', 0.02);
      edge.setAttribute('height', this.data.bladeLength);
      edge.setAttribute('position', { x: 0, y: 0, z: this.data.bladeLength / 2 });
      edge.setAttribute('color', this.data.emissiveColor);
      edge.setAttribute('material', {
        emissive: this.data.emissiveColor,
        emissiveIntensity: 2.0
      });
      
      // Position blade radially
      blade.setAttribute('rotation', { x: 90, y: angle * 180 / Math.PI, z: 0 });
      blade.setAttribute('position', {
        x: Math.cos(angle) * 0.3,
        y: Math.sin(angle) * 0.3,
        z: 0
      });
      
      blade.appendChild(tip);
      blade.appendChild(edge);
      this.core.appendChild(blade);
      this.blades.push(blade);
    }
  },

  createGears: function() {
    this.gears = [];
    
    // Create 3 nested gears
    for (let i = 0; i < 3; i++) {
      const gear = document.createElement('a-torus');
      const radius = 0.6 + (i * 0.3);
      
      gear.setAttribute('radius', radius);
      gear.setAttribute('tube', 0.05);
      gear.setAttribute('radial-segments', 8 + (i * 4));
      gear.setAttribute('tubular-segments', 24);
      gear.setAttribute('position', { x: 0, y: 0, z: -0.2 - (i * 0.1) });
      gear.setAttribute('color', this.data.metalColor);
      gear.setAttribute('material', {
        metalness: 1.0,
        roughness: 0.3
      });
      
      this.core.appendChild(gear);
      this.gears.push({ element: gear, index: i });
    }
  },

  createThorns: function() {
    this.thorns = [];
    const thornCount = 12;
    
    for (let i = 0; i < thornCount; i++) {
      const angle = (i / thornCount) * Math.PI * 2;
      const height = 0.4 + (Math.random() * 0.3);
      
      const thorn = document.createElement('a-cone');
      thorn.setAttribute('radius-bottom', 0.08);
      thorn.setAttribute('radius-top', 0);
      thorn.setAttribute('height', height);
      thorn.setAttribute('color', this.data.emissiveColor);
      thorn.setAttribute('position', {
        x: Math.cos(angle) * 0.35,
        y: Math.sin(angle) * 0.35,
        z: (Math.random() - 0.5) * 0.4
      });
      thorn.setAttribute('rotation', { x: 0, y: 0, z: angle * 180 / Math.PI + 90 });
      thorn.setAttribute('material', {
        emissive: this.data.emissiveColor,
        emissiveIntensity: 1.0,
        metalness: 0.8
      });
      
      this.core.appendChild(thorn);
      this.thorns.push(thorn);
    }
  },

  applyTransforms: function() {
    const scale = this.data.intensityScale 
      ? this.data.baseScale * (0.5 + this.parsedData.intensity)
      : this.data.baseScale;
    
    this.container.setAttribute('scale', { x: scale, y: scale, z: scale });
    
    // Color intensity based on data
    const intensity = this.parsedData.intensity;
    this.orb.setAttribute('material', 'emissiveIntensity', 0.5 + intensity);
  },

  setupAnimations: function() {
    // Core rotation (slow, ominous)
    this.core.setAttribute('animation__rotate', {
      property: 'rotation',
      to: '0 360 0',
      dur: 60000 / this.data.rotationSpeed,
      loop: true,
      easing: 'linear'
    });
    
    // Gears rotate at different speeds
    this.gears.forEach((gear, index) => {
      const speed = this.data.rotationSpeed * (1 + index) * this.data.gearRatio;
      const direction = index % 2 === 0 ? 1 : -1;
      
      gear.element.setAttribute('animation__gear', {
        property: 'rotation',
        to: `${direction * 360} 0 0`,
        dur: 60000 / speed,
        loop: true,
        easing: 'linear'
      });
    });
    
    // Orb pulse
    this.orb.setAttribute('animation__pulse', {
      property: 'scale',
      from: '1 1 1',
      to: '1.3 1.3 1.3',
      dur: this.data.pulseRate,
      loop: true,
      dir: 'alternate',
      easing: 'easeInOutSine'
    });
  },

  setupGlitch: function() {
    // Temporal displacement effect
    const glitch = () => {
      // Store original position
      const originalPos = this.container.getAttribute('position');
      
      // Random displacement
      const displacement = {
        x: (Math.random() - 0.5) * 0.5,
        y: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5
      };
      
      this.container.setAttribute('position', {
        x: originalPos.x + displacement.x,
        y: originalPos.y + displacement.y,
        z: originalPos.z + displacement.z
      });
      
      // Visual glitch
      this.core.setAttribute('material', 'opacity', 0.5);
      this.core.setAttribute('material', 'transparent', true);
      
      // Restore
      setTimeout(() => {
        this.container.setAttribute('position', originalPos);
        this.core.setAttribute('material', 'opacity', 1);
        this.core.setAttribute('material', 'transparent', false);
      }, this.data.glitchDuration);
    };
    
    // Random glitch intervals
    const scheduleGlitch = () => {
      const delay = this.data.glitchInterval + (Math.random() * 3000);
      setTimeout(() => {
        glitch();
        scheduleGlitch();
      }, delay);
    };
    
    scheduleGlitch();
  },

  update: function(oldData) {
    if (oldData.data !== this.data.data) {
      this.parsedData = this.parseData();
      this.applyTransforms();
    }
  },

  remove: function() {
    this.container.innerHTML = '';
  }
});

console.log('[nemosyne-shrike] Component registered - "The Lord of Pain" awaits');
