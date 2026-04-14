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
/**
 * nemosyne-time-tomb: Hyperion-Cantos Sealed Chamber
 *
 * A sealed, time-locked chamber for encrypted data visualization.
 * Inspired by the Time Tombs of Hyperion - mysterious structures that exist
 * in temporal stasis, counting down to an unknown event.
 *
 * Features:
 * - Hexagonal chamber structure
 * - Countdown timer display
 * - Encrypted data visualization (noise/distortion)
 * - Temporal lock effects
 * - Revelation animation on unlock
 * - Warning indicators for approaching unlock
 *
 * @author Nemosyne Framework
 * @version 0.2.0
 *
 * Usage:
 * ```html
 * <a-entity nemosyne-time-tomb="
 *   targetTime: 1234567890000;
 *   encryptedData: { value: 42, secret: 'encrypted' };
 *   showCountdown: true
 * "></a-entity>
 * ```
 */

AFRAME.registerComponent('nemosyne-time-tomb', {
  schema: {
    // Temporal configuration
    targetTime: { type: 'number', default: Date.now() + 3600000 }, // Timestamp to unlock
    timeOffset: { type: 'number', default: 0 },                   // Current server offset
    
    // Encrypted data
    data: { type: 'string', default: '{}' },
    
    // Appearance
    chamberColor: { type: 'color', default: '#1a1a2e' },          // Deep blue-black
    sealColor: { type: 'color', default: '#e94560' },            // Warning red
    glowColor: { type: 'color', default: '#0f3460' },            // Deep glow
    encryptedColor: { type: 'color', default: '#16213e' },         // Dark obfuscated
    
    // Size
    chamberRadius: { type: 'number', default: 1.5 },
    chamberHeight: { type: 'number', default: 2.5 },
    
    // Display
    showCountdown: { type: 'boolean', default: true },
    showProgress: { type: 'boolean', default: true },
    countdownFormat: { type: 'string', default: 'auto' },          // 'auto' | 'compact' | 'full'
    
    // Animation
    pulseRate: { type: 'number', default: 3000 },
    lockRotation: { type: 'number', default: 10 },               // Seconds per rotation
    
    // Effects
    enableNoise: { type: 'boolean', default: true },           // Data encryption visualization
    revealOnUnlock: { type: 'boolean', default: true },         // Animate on unlock
    warningThreshold: { type: 'number', default: 60000 }         // Red warning when < 1 min
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);
    
    // Parse and store data
    this.tombData = this.parseData();
    this.currentTime = Date.now() + this.data.timeOffset;
    this.isUnlocked = false;
    
    // Create structure
    this.createChamber();
    this.createSeals();
    this.createCountdown();
    this.createEncryptedData();
    this.createProgressRing();
    
    // Setup animations
    this.setupAnimations();
    
    // Start update loop
    this.startUpdateLoop();
    
    console.log('[nemosyne-time-tomb] Time tomb sealed', {
      target: new Date(this.data.targetTime).toISOString(),
      locked: !this.isUnlocked
    });
  },

  parseData: function() {
    try {
      return JSON.parse(this.data.data);
    } catch(e) {
      return { value: '???', status: 'encrypted' };
    }
  },

  createChamber: function() {
    // Outer hexagonal prism
    this.chamber = document.createElement('a-entity');
    
    // Use cylinder with 6 sides for hexagon
    const hexPrism = document.createElement('a-cylinder');
    hexPrism.setAttribute('radius', this.data.chamberRadius);
    hexPrism.setAttribute('height', this.data.chamberHeight);
    hexPrism.setAttribute('segments-radial', 6);
    hexPrism.setAttribute('segments-height', 1);
    hexPrism.setAttribute('color', this.data.chamberColor);
    hexPrism.setAttribute('material', {
      metalness: 0.8,
      roughness: 0.4,
      transparent: true,
      opacity: 0.9,
      side: 'double'
    });
    
    // Inner glow layer
    const innerShell = document.createElement('a-cylinder');
    innerShell.setAttribute('radius', this.data.chamberRadius - 0.1);
    innerShell.setAttribute('height', this.data.chamberHeight - 0.1);
    innerShell.setAttribute('segments-radial', 6);
    innerShell.setAttribute('color', this.data.glowColor);
    innerShell.setAttribute('material', {
      emissive: this.data.glowColor,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5
    });
    
    this.chamber.appendChild(hexPrism);
    this.chamber.appendChild(innerShell);
    this.container.appendChild(this.chamber);
  },

  createSeals: function() {
    this.seals = [];
    
    // Create 4 rotating seals at top
    for (let i = 0; i < 4; i++) {
      const seal = document.createElement('a-torus');
      const radius = this.data.chamberRadius + 0.2 + (i * 0.15);
      
      seal.setAttribute('radius', radius);
      seal.setAttribute('tube', 0.04);
      seal.setAttribute('radial-segments', 12);
      seal.setAttribute('tubular-segments', 32);
      seal.setAttribute('color', this.data.sealColor);
      seal.setAttribute('material', {
        emissive: this.data.sealColor,
        emissiveIntensity: 0.5,
        metalness: 1.0
      });
      
      // Position at top
      seal.setAttribute('position', { x: 0, y: this.data.chamberHeight / 2 + 0.1, z: 0 });
      seal.setAttribute('rotation', { x: 90, y: 0, z: 0 });
      
      this.seals.push(seal);
      this.chamber.appendChild(seal);
    }
  },

  createCountdown: function() {
    if (!this.data.showCountdown) return;
    
    this.countdownDisplay = document.createElement('a-text');
    this.countdownDisplay.setAttribute('value', 'LOCKED');
    this.countdownDisplay.setAttribute('align', 'center');
    this.countdownDisplay.setAttribute('color', this.data.sealColor);
    this.countdownDisplay.setAttribute('width', 4);
    this.countdownDisplay.setAttribute('side', 'double');
    this.countdownDisplay.setAttribute('position', {
      x: 0,
      y: 0,
      z: this.data.chamberRadius + 0.2
    });
    this.countdownDisplay.setAttribute('billboard', true);
    
    this.countdownDisplay.setAttribute('material', {
      emissive: this.data.sealColor,
      emissiveIntensity: 0.5
    });
    
    this.chamber.appendChild(this.countdownDisplay);
  },

  createEncryptedData: function() {
    // Visual representation of encrypted data
    this.encryptedContainer = document.createElement('a-entity');
    
    // Create noise particles
    const particleCount = 20;
    this.particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('a-sphere');
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = this.data.chamberRadius * 0.5 * Math.random();
      
      particle.setAttribute('radius', 0.05 + Math.random() * 0.05);
      particle.setAttribute('color', this.data.encryptedColor);
      particle.setAttribute('position', {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi)
      });
      particle.setAttribute('material', {
        transparent: true,
        opacity: 0.6
      });
      
      // Random drift animation
      particle.setAttribute('animation__drift', {
        property: 'position',
        to: `${(Math.random() - 0.5) * r} ${(Math.random() - 0.5) * r} ${(Math.random() - 0.5) * r}`,
        dur: 2000 + Math.random() * 3000,
        loop: true,
        dir: 'alternate',
        easing: 'easeInOutSine'
      });
      
      this.particles.push(particle);
      this.encryptedContainer.appendChild(particle);
    }
    
    this.chamber.appendChild(this.encryptedContainer);
  },

  createProgressRing: function() {
    if (!this.data.showProgress) return;
    
    // Ring showing time remaining
    this.progressRing = document.createElement('a-torus');
    this.progressRing.setAttribute('radius', this.data.chamberRadius + 0.4);
    this.progressRing.setAttribute('tube', 0.06);
    this.progressRing.setAttribute('arc', 360);
    this.progressRing.setAttribute('color', '#00d4aa');
    this.progressRing.setAttribute('position', { 
      x: 0, 
      y: -this.data.chamberHeight / 2 - 0.3, 
      z: 0 
    });
    this.progressRing.setAttribute('rotation', { x: 90, y: 0, z: 0 });
    this.progressRing.setAttribute('material', {
      emissive: '#00d4aa',
      emissiveIntensity: 0.5
    });
    
    this.chamber.appendChild(this.progressRing);
  },

  setupAnimations: function() {
    // Chamber subtle float
    this.chamber.setAttribute('animation__float', {
      property: 'position.y',
      from: 0,
      to: 0.2,
      dur: this.data.pulseRate,
      loop: true,
      dir: 'alternate',
      easing: 'easeInOutSine'
    });
    
    // Seal rotation
    this.seals.forEach((seal, i) => {
      const speed = (i + 1) / this.data.lockRotation * 10;
      const direction = i % 2 === 0 ? 1 : -1;
      
      seal.setAttribute('animation__rotate', {
        property: 'rotation.z',
        to: direction * 360,
        dur: speed * 1000,
        loop: true,
        easing: 'linear'
      });
    });
  },

  startUpdateLoop: function() {
    this.updateInterval = setInterval(() => this.updateTimer(), 100);
  },

  updateTimer: function() {
    const now = Date.now();
    const remaining = this.data.targetTime - now;
    
    if (remaining <= 0 && !this.isUnlocked) {
      this.unlock();
      return;
    }
    
    // Update countdown display
    if (this.countdownDisplay) {
      this.countdownDisplay.setAttribute('value', this.formatTime(remaining));
      
      // Warning color when close
      if (remaining < this.data.warningThreshold) {
        this.countdownDisplay.setAttribute('color', '#ff0000');
        this.countdownDisplay.setAttribute('material', 'emissive', '#ff0000');
        this.countdownDisplay.setAttribute('material', 'emissiveIntensity', 1.0);
      }
    }
    
    // Update progress ring
    if (this.progressRing) {
      const total = this.data.targetTime - (this.data.targetTime - remaining - 3600000); // Assume 1hr window
      const progress = Math.max(0, Math.min(1, remaining / 3600000));
      const arc = progress * 360;
      
      this.progressRing.setAttribute('arc', arc);
      this.progressRing.setAttribute('color', remaining < this.data.warningThreshold ? '#ff0000' : '#00d4aa');
    }
  },

  formatTime: function(ms) {
    if (this.data.countdownFormat === 'compact') {
      const seconds = Math.floor(ms / 1000);
      return `${seconds}s`;
    }
    
    if (this.data.countdownFormat === 'full') {
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    
    // Auto format
    if (ms > 86400000) {
      return `${Math.floor(ms / 86400000)}d`;
    } else if (ms > 3600000) {
      return `${Math.floor(ms / 3600000)}h`;
    } else if (ms > 60000) {
      return `${Math.floor(ms / 60000)}m`;
    } else {
      return `${Math.floor(ms / 1000)}s`;
    }
  },

  unlock: function() {
    this.isUnlocked = true;
    
    // Stop update loop
    clearInterval(this.updateInterval);
    
    // Update display
    if (this.countdownDisplay) {
      this.countdownDisplay.setAttribute('value', 'OPEN');
      this.countdownDisplay.setAttribute('color', '#00d4aa');
      this.countdownDisplay.setAttribute('material', 'emissive', '#00d4aa');
    }
    
    if (this.data.revealOnUnlock) {
      // Reveal animation
      this.seals.forEach(seal => {
        seal.setAttribute('animation__unlock', {
          property: 'scale',
          to: '0 0 0',
          dur: 1000,
          easing: 'easeOutExpo'
        });
      });
      
      // Fade encrypted particles
      this.particles.forEach(particle => {
        particle.setAttribute('material', 'opacity', 0);
      });
      
      // Chamber opens
      this.chamber.querySelector('a-cylinder').setAttribute('animation__open', {
        property: 'scale',
        to: '1.5 1.5 1.5',
        dur: 2000,
        easing: 'easeOutElastic'
      });
      
      // Emit event
      this.el.emit('tomb-unlocked', { data: this.tombData });
    }
  },

  update: function(oldData) {
    if (oldData.data !== this.data.data) {
      this.tombData = this.parseData();
    }
  },

  remove: function() {
    clearInterval(this.updateInterval);
    this.container.innerHTML = '';
  }
});

console.log('[nemosyne-time-tomb] Component registered - "Time Tombs of the future"');
/**
 * nemosyne-farcaster: Hyperion-Cantos Portal
 *
 * An instantaneous data transport portal inspired by Farcasters from the
 * Hyperion Cantos - devices enabling instantaneous travel across vast distances.
 *
 * Features:
 * - Circular portal with energy field
 * - Particle stream effects (data in transit)
 * - Portal opening/closing animations
 * - Energy pulse effects
 * - Destination visualization
 * - Connection strength indicators
 *
 * @author Nemosyne Framework
 * @version 0.2.0
 *
 * Usage:
 * ```html
 * <a-entity nemosyne-farcaster="
 *   destination: { x: 10, y: 0, z: 10 };
 *   active: true;
 *   streamCount: 50
 * "></a-entity>
 * ```
 */

AFRAME.registerComponent('nemosyne-farcaster', {
  schema: {
    // Portal configuration
    destination: { type: 'string', default: '{"x":0,"y":0,"z":0}' },
    active: { type: 'boolean', default: false },
    
    // Appearance
    portalColor: { type: 'color', default: '#7B2D8E' },      // Purple energy
    streamColor: { type: 'color', default: '#00d4aa' },     // Cyan stream
    rimColor: { type: 'color', default: '#FFD700' },        // Gold rim
    
    // Size
    portalRadius: { type: 'number', default: 1.0 },
    
    // Stream configuration
    streamCount: { type: 'number', default: 30 },           // Number of data streams
    streamSpeed: { type: 'number', default: 2.0 },          // Travel time (seconds)
    streamThickness: { type: 'number', default: 0.02 },
    
    // Animation
    openSpeed: { type: 'number', default: 1000 },           // Portal open animation (ms)
    pulseSpeed: { type: 'number', default: 2000 },          // Energy pulse interval
    rimRotationSpeed: { type: 'number', default: 20 },      // Degrees per second
    
    // Effects
    enableParticles: { type: 'boolean', default: true },
    turbulence: { type: 'number', default: 0.2 }             // Stream wobble (0-1)
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);
    
    // Parse destination
    this.destination = this.parseDestination();
    
    // Create structure
    this.createPortalRing();
    this.createEnergyField();
    this.createStreams();
    this.createDestinationMarker();
    
    // Initial state
    this.isOpen = false;
    
    // Setup animations
    this.setupAnimations();
    
    // Auto-open if active
    if (this.data.active) {
      setTimeout(() => this.openPortal(), 500);
    }
    
    console.log('[nemosyne-farcaster] Portal initialized');
  },

  parseDestination: function() {
    try {
      return JSON.parse(this.data.destination);
    } catch(e) {
      return { x: 0, y: 0, z: 0 };
    }
  },

  createPortalRing: function() {
    // Outer rotating ring
    this.outerRing = document.createElement('a-torus');
    this.outerRing.setAttribute('radius', this.data.portalRadius + 0.1);
    this.outerRing.setAttribute('tube', 0.08);
    this.outerRing.setAttribute('radial-segments', 3);
    this.outerRing.setAttribute('tubular-segments', 64);
    this.outerRing.setAttribute('color', this.data.rimColor);
    this.outerRing.setAttribute('material', {
      emissive: this.data.rimColor,
      emissiveIntensity: 0.8,
      metalness: 1.0,
      roughness: 0.2
    });
    this.outerRing.setAttribute('scale', '0 0 0'); // Start closed
    
    // Inner ring
    this.innerRing = document.createElement('a-torus');
    this.innerRing.setAttribute('radius', this.data.portalRadius - 0.1);
    this.innerRing.setAttribute('tube', 0.05);
    this.innerRing.setAttribute('radial-segments', 3);
    this.innerRing.setAttribute('tubular-segments', 32);
    this.innerRing.setAttribute('color', this.data.portalColor);
    this.innerRing.setAttribute('material', {
      emissive: this.data.portalColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7
    });
    this.innerRing.setAttribute('scale', '0 0 0');
    
    this.container.appendChild(this.outerRing);
    this.container.appendChild(this.innerRing);
  },

  createEnergyField: function() {
    // Energy disk at portal center
    this.energyField = document.createElement('a-circle');
    this.energyField.setAttribute('radius', this.data.portalRadius - 0.15);
    this.energyField.setAttribute('segments', 32);
    this.energyField.setAttribute('color', this.data.portalColor);
    this.energyField.setAttribute('material', {
      emissive: this.data.portalColor,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.4,
      side: 'double'
    });
    this.energyField.setAttribute('rotation', { x: 90, y: 0, z: 0 });
    this.energyField.setAttribute('position', { x: 0, y: 0, z: 0 });
    this.energyField.setAttribute('visible', false);
    
    // Add shimmer effect using shader-like animation
    this.energyField.setAttribute('animation__pulse', {
      property: 'material.emissiveIntensity',
      from: 0.2,
      to: 0.6,
      dur: this.data.pulseSpeed,
      loop: true,
      dir: 'alternate',
      easing: 'easeInOutSine'
    });
    
    this.container.appendChild(this.energyField);
  },

  createStreams: function() {
    this.streams = [];
    
    for (let i = 0; i < this.data.streamCount; i++) {
      const stream = this.createSingleStream(i);
      this.streams.push(stream);
      this.container.appendChild(stream);
    }
  },

  createSingleStream: function(index) {
    const stream = document.createElement('a-entity');
    
    // Random starting angle
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (this.data.portalRadius - 0.3);
    
    // Start position (portal center)
    const startX = Math.cos(angle) * radius;
    const startZ = Math.sin(angle) * radius;
    
    // Calculate direction to destination
    const dest = this.destination;
    const dx = dest.x - startX;
    const dy = dest.y - startZ;
    const dz = dest.z;
    
    // Create stream as series of small spheres or a tube
    const particleCount = 8;
    const particleSpacing = 0.1;
    
    for (let j = 0; j < particleCount; j++) {
      const particle = document.createElement('a-sphere');
      particle.setAttribute('radius', this.data.streamThickness);
      particle.setAttribute('color', this.data.streamColor);
      particle.setAttribute('material', {
        emissive: this.data.streamColor,
        emissiveIntensity: 1.0
      });
      
      // Store for animation
      particle.dataset.index = j;
      particle.dataset.total = particleCount;
      particle.dataset.streamIndex = index;
      
      stream.appendChild(particle);
    }
    
    // Store animation data
    stream.dataset.angle = angle;
    stream.dataset.radius = radius;
    stream.dataset.speed = this.data.streamSpeed * (0.8 + Math.random() * 0.4); // Vary speed
    
    return stream;
  },

  createDestinationMarker: function() {
    // Visual marker at destination
    this.destMarker = document.createElement('a-entity');
    this.destMarker.setAttribute('position', this.destination);
    
    // Destination beacon
    const beacon = document.createElement('a-cylinder');
    beacon.setAttribute('radius', 0.2);
    beacon.setAttribute('height', 0.05);
    beacon.setAttribute('color', this.data.rimColor);
    beacon.setAttribute('material', {
      emissive: this.data.rimColor,
      emissiveIntensity: 0.8
    });
    
    // Vertical beam
    const beam = document.createElement('a-cylinder');
    beam.setAttribute('radius', 0.05);
    beam.setAttribute('height', 3);
    beam.setAttribute('color', this.data.portalColor);
    beam.setAttribute('position', { x: 0, y: 1.5, z: 0 });
    beam.setAttribute('material', {
      emissive: this.data.portalColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.5
    });
    
    this.destMarker.appendChild(beacon);
    this.destMarker.appendChild(beam);
    
    // Scale animation for beacon
    this.destMarker.setAttribute('animation__pulse', {
      property: 'scale',
      from: '1 1 1',
      to: '1.2 1.2 1.2',
      dur: 1000,
      loop: true,
      dir: 'alternate',
      easing: 'easeInOutSine'
    });
    
    this.container.appendChild(this.destMarker);
    this.destMarker.setAttribute('visible', false); // Hide until portal opens
  },

  setupAnimations: function() {
    // Outer ring rotation
    this.outerRing.setAttribute('animation__rotate', {
      property: 'rotation',
      to: '0 0 360',
      dur: 360000 / this.data.rimRotationSpeed,
      loop: true,
      easing: 'linear'
    });
    
    // Inner ring counter-rotation
    this.innerRing.setAttribute('animation__rotate', {
      property: 'rotation',
      to: '0 0 -360',
      dur: 360000 / (this.data.rimRotationSpeed * 1.5),
      loop: true,
      easing: 'linear'
    });
  },

  openPortal: function() {
    if (this.isOpen) return;
    this.isOpen = true;
    
    // Animate rings opening
    const openAnim = {
      property: 'scale',
      to: '1 1 1',
      dur: this.data.openSpeed,
      easing: 'easeOutElastic'
    };
    
    this.outerRing.setAttribute('animation__open', openAnim);
    this.innerRing.setAttribute('animation__open', openAnim);
    
    // Show energy field
    this.energyField.setAttribute('visible', true);
    
    // Show destination
    this.destMarker.setAttribute('visible', true);
    
    // Start streams
    this.startStreams();
    
    // Emit event
    this.el.emit('portal-opened', { destination: this.destination });
    
    console.log('[nemosyne-farcaster] Portal opened to', this.destination);
  },

  closePortal: function() {
    if (!this.isOpen) return;
    this.isOpen = false;
    
    // Animate rings closing
    const closeAnim = {
      property: 'scale',
      to: '0 0 0',
      dur: this.data.openSpeed * 0.5,
      easing: 'easeInExpo'
    };
    
    this.outerRing.setAttribute('animation__close', closeAnim);
    this.innerRing.setAttribute('animation__close', closeAnim);
    
    // Hide energy field and destination
    this.energyField.setAttribute('visible', false);
    this.destMarker.setAttribute('visible', false);
    
    // Emit event
    this.el.emit('portal-closed', {});
  },

  startStreams: function() {
    // Animate particles through portal
    this.streams.forEach((stream, i) => {
      const particles = stream.querySelectorAll('a-sphere');
      const speed = parseFloat(stream.dataset.speed) * 1000;
      const delay = i * (speed / this.streams.length); // Stagger starts
      
      particles.forEach((particle, j) => {
        const particleDelay = delay + (j * 100);
        
        this.animateParticle(particle, speed, particleDelay);
      });
    });
  },

  animateParticle: function(particle, duration, delay) {
    // Get stream data
    const streamIndex = particle.dataset.streamIndex;
    const stream = this.streams[parseInt(streamIndex)];
    const angle = parseFloat(stream.dataset.angle);
    const radius = parseFloat(stream.dataset.radius);
    const dest = this.destination;
    
    // Start position (near portal center)
    const startX = Math.cos(angle) * radius;
    const startZ = Math.sin(angle) * radius;
    
    // Animate through portal
    const animate = () => {
      // Position along path to destination
      particle.setAttribute('animation__travel', {
        property: 'position',
        from: `${startX} ${startZ} 0`,
        to: `${dest.x} ${dest.z} ${dest.y}`,
        dur: duration,
        delay: 0,
        easing: 'easeInOutSine'
      });
      
      // Fade out at end
      particle.setAttribute('animation__fade', {
        property: 'material.opacity',
        from: 1,
        to: 0,
        dur: duration * 0.3,
        delay: duration * 0.7,
        easing: 'easeInQuad'
      });
      
      // Reset and loop
      setTimeout(() => {
        particle.setAttribute('material', 'opacity', 1);
        particle.setAttribute('visible', false);
        particle.setAttribute('position', `${startX} ${startZ} 0`);
        
        setTimeout(() => {
          particle.setAttribute('visible', true);
          animate();
        }, Math.random() * 500);
      }, duration);
    };
    
    setTimeout(animate, delay);
  },

  update: function(oldData) {
    // Handle active state changes
    if (oldData.active !== this.data.active) {
      if (this.data.active) {
        this.openPortal();
      } else {
        this.closePortal();
      }
    }
    
    // Handle destination changes
    if (oldData.destination !== this.data.destination) {
      this.destination = this.parseDestination();
      if (this.destMarker) {
        this.destMarker.setAttribute('position', this.destination);
      }
    }
  },

  remove: function() {
    this.streams = [];
    this.container.innerHTML = '';
  }
});

console.log('[nemosyne-farcaster] Component registered - "Enter the Farcasters"');
/**
 * nemosyne-templar-tree: Hyperion-Cantos Tree of Pain
 *
 * A hierarchical tree structure inspired by the Tree of Pain in the Hyperion Cantos -
 * the massive iron tree where the Shrike impales its victims.
 *
 * Features:
 * - Branching hierarchical structure
 * - Synchronized pulsing effects
 * - Seasonal color changes
 * - Pain/pressure indicators
 * - Organic metal texture
 * - Interactive branches
 *
 * @author Nemosyne Framework
 * @version 0.2.0
 *
 * Usage:
 * ```html
 * <a-entity nemosyne-templar-tree="
 *   data: { hierarchy: [...] };
 *   rootPosition: { x: 0, y: 0, z: 0 };
 *   levels: 5
 * "></a-entity>
 * ```
 */

AFRAME.registerComponent('nemosyne-templar-tree', {
  schema: {
    // Data
    data: { type: 'string', default: '{}' },
    
    // Tree structure
    levels: { type: 'number', default: 4 },           // Depth of tree
    branchesPerLevel: { type: 'number', default: 3 }, // Branches per node
    levelHeight: { type: 'number', default: 1.5 },    // Distance between levels
    baseRadius: { type: 'number', default: 0.2 },      // Branch starting thickness
    radiusDecay: { type: 'number', default: 0.7 },   // Thickness decrease per level
    spreadAngle: { type: 'number', default: 45 },     // Branch spread in degrees
    
    // Appearance
    trunkColor: { type: 'color', default: '#4a3728' },   // Dark wood/metal
    branchColor: { type: 'color', default: '#5a4738' },
    tipColor: { type: 'color', default: '#8b0000' },      // Red tips (pain)
    glowColor: { type: 'color', default: '#ff4400' },    // Ember-like glow
    
    // Season/pulse
    pulseRate: { type: 'number', default: 3000 },       // Synchronized pulse
    seasonalColors: { type: 'boolean', default: true },
    enableThorns: { type: 'boolean', default: true },
    
    // Animation
    swayAmount: { type: 'number', default: 2 },        // Degrees of sway
    swaySpeed: { type: 'number', default: 4 }          // Seconds per sway cycle
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);
    
    // Parse data
    this.treeData = this.parseData();
    
    // Build tree structure
    this.branches = [];
    this.createTrunk();
    this.buildBranches();
    this.createThorns();
    
    // Setup animations
    this.setupAnimations();
    this.startPulsing();
    
    console.log('[nemosyne-templar-tree] Tree of Pain grown', {
      levels: this.data.levels,
      branches: this.branches.length
    });
  },

  parseData: function() {
    try {
      return JSON.parse(this.data.data) || this.generateDefaultData();
    } catch(e) {
      return this.generateDefaultData();
    }
  },

  generateDefaultData: function() {
    // Generate fractal tree data
    const data = { nodes: [], root: { id: 'root', value: 100 } };
    
    const generateLevel = (parent, level) => {
      if (level >= this.data.levels) return;
      
      for (let i = 0; i < this.data.branchesPerLevel; i++) {
        const id = `${parent.id}-${i}`;
        const node = {
          id: id,
          parent: parent.id,
          level: level,
          value: parent.value / this.data.branchesPerLevel * (1 + Math.random() * 0.5),
          angle: (i / this.data.branchesPerLevel) * Math.PI * 2
        };
        data.nodes.push(node);
        generateLevel(node, level + 1);
      }
    };
    
    generateLevel(data.root, 1);
    return data;
  },

  createTrunk: function() {
    // Central trunk
    this.trunk = document.createElement('a-cylinder');
    this.trunk.setAttribute('radius', this.data.baseRadius);
    this.trunk.setAttribute('height', this.data.levelHeight);
    this.trunk.setAttribute('position', { x: 0, y: this.data.levelHeight / 2, z: 0 });
    this.trunk.setAttribute('color', this.data.trunkColor);
    this.trunk.setAttribute('material', {
      metalness: 0.6,
      roughness: 0.8,
      emissive: this.data.glowColor,
      emissiveIntensity: 0.1
    });
    
    this.container.appendChild(this.trunk);
  },

  buildBranches: function() {
    this.branchElements = new Map();
    
    // Create branches for each node
    this.treeData.nodes.forEach(node => {
      const branch = this.createBranch(node);
      if (branch) {
        this.branches.push(branch);
        this.branchElements.set(node.id, branch);
      }
    });
  },

  createBranch: function(node) {
    // Find parent position
    let parentPos = { x: 0, y: 0, z: 0 };
    
    if (node.parent === this.treeData.root.id) {
      parentPos = { x: 0, y: this.data.levelHeight, z: 0 }; // Top of trunk
    } else {
      const parent = this.branchElements.get(node.parent);
      if (parent) {
        const pos = parent.getAttribute('position');
        parentPos = { x: pos.x, y: pos.y, z: pos.z };
      }
    }
    
    // Calculate branch position
    const radius = this.data.baseRadius * Math.pow(this.data.radiusDecay, node.level);
    const length = this.data.levelHeight * (0.8 + Math.random() * 0.4);
    
    // Direction from parent
    const angleRad = node.angle || (Math.random() * Math.PI * 2);
    const spreadRad = (this.data.spreadAngle * Math.PI / 180);
    const dirX = Math.cos(angleRad) * Math.sin(spreadRad);
    const dirZ = Math.sin(angleRad) * Math.sin(spreadRad);
    const dirY = Math.cos(spreadRad);
    
    // Position at end of branch
    const endPos = {
      x: parentPos.x + dirX * length,
      y: parentPos.y + dirY * length,
      z: parentPos.z + dirZ * length
    };
    
    // Create branch cylinder
    const branch = document.createElement('a-cylinder');
    branch.setAttribute('radius', radius);
    branch.setAttribute('height', length);
    branch.setAttribute('position', {
      x: parentPos.x + dirX * length / 2,
      y: parentPos.y + dirY * length / 2,
      z: parentPos.z + dirZ * length / 2
    });
    
    // Calculate rotation to point from parent
    const rotationY = angleRad * 180 / Math.PI;
    const rotationZ = -this.data.spreadAngle;
    branch.setAttribute('rotation', { x: 0, y: rotationY, z: rotationZ });
    
    // Color based on level (darker deeper in)
    const levelRatio = (this.data.levels - node.level) / this.data.levels;
    branch.setAttribute('color', 
      node.level === this.data.levels ? this.data.tipColor : this.data.branchColor
    );
    branch.setAttribute('material', {
      metalness: 0.5 + levelRatio * 0.3,
      roughness: 0.7 - levelRatio * 0.2,
      emissive: this.data.glowColor,
      emissiveIntensity: 0.1 * levelRatio
    });
    
    branch.dataset.nodeId = node.id;
    branch.dataset.level = node.level;
    
    this.container.appendChild(branch);
    
    return branch;
  },

  createThorns: function() {
    if (!this.data.enableThorns) return;
    
    this.thorns = [];
    
    // Add thorns to branches
    this.branches.forEach(branch => {
      const level = parseInt(branch.dataset.level);
      const thornCount = level > 2 ? 3 : 2; // More thorns on outer branches
      
      for (let i = 0; i < thornCount; i++) {
        const thorn = document.createElement('a-cone');
        thorn.setAttribute('radius-bottom', 0.03);
        thorn.setAttribute('radius-top', 0);
        thorn.setAttribute('height', 0.15 + Math.random() * 0.1);
        
        // Random position along branch
        const t = 0.3 + Math.random() * 0.6;
        const pos = branch.getAttribute('position');
        thorn.setAttribute('position', {
          x: pos.x,
          y: pos.y + t * 0.2,
          z: pos.z
        });
        
        thorn.setAttribute('color', this.data.tipColor);
        thorn.setAttribute('material', {
          emissive: this.data.tipColor,
          emissiveIntensity: 0.8,
          metalness: 0.9,
          roughness: 0.1
        });
        
        this.container.appendChild(thorn);
        this.thorns.push(thorn);
      }
    });
  },

  setupAnimations: function() {
    // Sway animation for trunk and branches
    this.trunk.setAttribute('animation__sway', {
      property: 'rotation',
      from: `-${this.data.swayAmount} 0 0`,
      to: `${this.data.swayAmount} 0 0`,
      dur: this.data.swaySpeed * 1000 / 2,
      loop: true,
      dir: 'alternate',
      easing: 'easeInOutSine'
    });
  },

  startPulsing: function() {
    // Synchronized pulse through tree
    const pulse = () => {
      // Pulse intensity based on levels
      const intensity = 0.1 + Math.random() * 0.3;
      
      this.branches.forEach(branch => {
        const level = parseInt(branch.dataset.level);
        const levelIntensity = intensity * ((this.data.levels - level) / this.data.levels);
        
        branch.setAttribute('material', 'emissiveIntensity', levelIntensity);
      });
      
      // Brighter pulse on thorns
      this.thorns.forEach(thorn => {
        thorn.setAttribute('material', 'emissiveIntensity', 0.5 + Math.random() * 0.5);
      });
    };
    
    // Pulse interval
    this.pulseInterval = setInterval(pulse, this.data.pulseRate);
  },

  update: function(oldData) {
    if (oldData.data !== this.data.data) {
      this.treeData = this.parseData();
      // Rebuild tree
      this.branches = [];
      this.branchElements.clear();
      this.container.innerHTML = '';
      this.createTrunk();
      this.buildBranches();
      this.createThorns();
    }
  },

  remove: function() {
    clearInterval(this.pulseInterval);
    this.branches = [];
    this.branchElements.clear();
    this.container.innerHTML = '';
  }
});

console.log('[nemosyne-templar-tree] Component registered - "The Tree of Pain grows in silence"');
/**
 * nemosyne-memory-crystal: Hyperion-Cantos Mnemosyne Data Storage
 *
 * A crystalline data storage visualization inspired by the Mnemosyne references
 * throughout Hyperion Cantos - entities that preserve and transmit memories
 * through crystalline structures.
 *
 * Features:
 * - Crystal lattice geometry with internal refraction
 * - Memory playback visualization (animation through stored states)
 * - Refractive material effects
 * - Data density representation through crystal clarity
 * - Retrieval shimmer effects
 * - Cluster formations for related memories
 *
 * @author Nemosyne Framework
 * @version 0.2.0
 *
 * Usage:
 * ```html
 * <a-entity nemosyne-memory-crystal="
 *   data: { memories: [...], quality: 0.85 };
 *   crystalType: 'diamond';
 *   enablePlayback: true
 * "></a-entity>
 * ```
 */

AFRAME.registerComponent('nemosyne-memory-crystal', {
  schema: {
    // Data
    data: { type: 'string', default: '{}' },
    
    // Crystal configuration
    crystalType: { type: 'string', default: 'octahedron' }, // 'octahedron' | 'diamond' | 'quartz'
    size: { type: 'number', default: 1.0 },
    quality: { type: 'number', default: 1.0 },              // Data integrity (0-1)
    
    // Appearance
    baseColor: { type: 'color', default: '#e0e0ff' },       // Light blue-white
    tintColor: { type: 'color', default: '#a0a0ff' },       // Inner tint
    emissiveColor: { type: 'color', default: '#6060ff' },   // Memory glow
    
    // Refraction properties
    opacity: { type: 'number', default: 0.7 },
    transmission: { type: 'number', default: 0.9 },         // Light transmission
    refraction: { type: 'number', default: 0.5 },            // Refraction index
    
    // Memory playback
    enablePlayback: { type: 'boolean', default: true },
    playbackSpeed: { type: 'number', default: 2000 },        // ms per memory
    memoryStates: { type: 'number', default: 5 },          // Visible states inside
    
    // Animation
    rotationSpeed: { type: 'number', default: 5 },
    pulseRate: { type: 'number', default: 4000 },
    floatAmplitude: { type: 'number', default: 0.2 },
    
    // Cluster
    clusterMode: { type: 'boolean', default: false },      // Multiple crystals
    clusterSize: { type: 'number', default: 3 }             // Crystals in cluster
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);
    
    // Parse memory data
    this.memoryData = this.parseData();
    
    // Create structure
    this.createCrystal();
    this.createInternalMemories();
    this.createRefractiveLayers();
    
    // Setup effects
    this.setupAnimations();
    this.setupRefractiveEffects();
    
    // Start playback if enabled
    if (this.data.enablePlayback && this.memoryData.memories) {
      this.startMemoryPlayback();
    }
    
    console.log('[nemosyne-memory-crystal] Crystal formed', {
      type: this.data.crystalType,
      memories: this.memoryData.memories?.length || 0,
      quality: this.data.quality
    });
  },

  parseData: function() {
    try {
      const parsed = JSON.parse(this.data.data);
      return {
        memories: parsed.memories || [],
        tags: parsed.tags || [],
        timestamp: parsed.timestamp || Date.now(),
        quality: Math.max(0, Math.min(1, parsed.quality || this.data.quality))
      };
    } catch(e) {
      return {
        memories: [],
        tags: [],
        timestamp: Date.now(),
        quality: this.data.quality
      };
    }
  },

  createCrystal: function() {
    this.crystalContainer = document.createElement('a-entity');
    
    // Main crystal geometry based on type
    let geometry;
    switch(this.data.crystalType) {
      case 'diamond':
        geometry = document.createElement('a-icosahedron');
        geometry.setAttribute('radius', this.data.size * 0.7);
        break;
      case 'quartz':
        geometry = document.createElement('a-cylinder');
        geometry.setAttribute('radius', this.data.size * 0.4);
        geometry.setAttribute('height', this.data.size * 1.2);
        geometry.setAttribute('segments-radial', 6);
        break;
      case 'octahedron':
      default:
        geometry = document.createElement('a-octahedron');
        geometry.setAttribute('radius', this.data.size);
        break;
    }
    
    this.crystal = geometry;
    
    // Refractive material
    const quality = this.memoryData.quality || this.data.quality;
    this.crystal.setAttribute('color', this.data.baseColor);
    this.crystal.setAttribute('material', {
      color: this.data.baseColor,
      emissive: this.data.emissiveColor,
      emissiveIntensity: 0.2 * quality,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: this.data.opacity,
      side: 'double'
    });
    
    this.crystalContainer.appendChild(this.crystal);
    this.container.appendChild(this.crystalContainer);
  },

  createInternalMemories: function() {
    // Create floating memory representations inside crystal
    this.memoryElements = [];
    const memories = this.memoryData.memories || [];
    const count = Math.min(memories.length, this.data.memoryStates);
    
    for (let i = 0; i < count; i++) {
      const memory = document.createElement('a-sphere');
      const t = (i + 1) / (count + 1); // Position within crystal
      
      memory.setAttribute('radius', 0.1 * this.data.size);
      memory.setAttribute('position', {
        x: (Math.random() - 0.5) * this.data.size * 0.5,
        y: (t - 0.5) * this.data.size * 0.6,
        z: (Math.random() - 0.5) * this.data.size * 0.5
      });
      
      // Color based on memory properties
      const memoryData = memories[i] || {};
      const intensity = memoryData.importance || Math.random();
      
      memory.setAttribute('color', this.data.emissiveColor);
      memory.setAttribute('material', {
        emissive: this.data.emissiveColor,
        emissiveIntensity: 0.5 + intensity * 0.5,
        transparent: true,
        opacity: 0.8
      });
      
      memory.dataset.memoryIndex = i;
      memory.dataset.importance = intensity;
      
      this.crystal.appendChild(memory);
      this.memoryElements.push(memory);
    }
  },

  createRefractiveLayers: function() {
    // Outer refractive shell for enhanced crystal effect
    this.outerShell = document.createElement('a-entity');
    
    // Create facets based on crystal type
    let facetCount;
    switch(this.data.crystalType) {
      case 'diamond': facetCount = 20; break;
      case 'quartz': facetCount = 6; break;
      default: facetCount = 8;
    }
    
    for (let i = 0; i < facetCount; i++) {
      const angle = (i / facetCount) * Math.PI * 2;
      const facet = document.createElement('a-plane');
      
      facet.setAttribute('width', this.data.size * 0.6);
      facet.setAttribute('height', this.data.size);
      facet.setAttribute('color', this.data.tintColor);
      facet.setAttribute('material', {
        transparent: true,
        opacity: 0.1,
        side: 'double',
        blending: 'additive'
      });
      
      // Position around crystal
      const radius = this.data.size * 0.7;
      facet.setAttribute('position', {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius
      });
      facet.setAttribute('rotation', { x: 0, y: -angle * 180 / Math.PI, z: 0 });
      
      this.outerShell.appendChild(facet);
    }
    
    this.crystalContainer.appendChild(this.outerShell);
  },

  setupAnimations: function() {
    // Crystal rotation
    this.crystalContainer.setAttribute('animation__rotate', {
      property: 'rotation',
      to: '360 360 0',
      dur: 60000 / this.data.rotationSpeed,
      loop: true,
      easing: 'linear'
    });
    
    // Floating effect
    this.container.setAttribute('animation__float', {
      property: 'position.y',
      from: 0,
      to: this.data.floatAmplitude,
      dur: 3000 + Math.random() * 2000,
      loop: true,
      dir: 'alternate',
      easing: 'easeInOutSine'
    });
    
    // Pulse glow
    this.crystal.setAttribute('animation__pulse', {
      property: 'material.emissiveIntensity',
      from: 0.1,
      to: 0.4,
      dur: this.data.pulseRate,
      loop: true,
      dir: 'alternate',
      easing: 'easeInOutSine'
    });
  },

  setupRefractiveEffects: function() {
    // Add light rays / caustics effect
    this.lightRays = document.createElement('a-entity');
    
    for (let i = 0; i < 6; i++) {
      const ray = document.createElement('a-cone');
      const angle = (i / 6) * Math.PI * 2;
      
      ray.setAttribute('radius-bottom', 0.02);
      ray.setAttribute('radius-top', 0.05);
      ray.setAttribute('height', this.data.size * 2);
      ray.setAttribute('color', this.data.emissiveColor);
      ray.setAttribute('position', {
        x: Math.cos(angle) * this.data.size * 0.8,
        y: 0,
        z: Math.sin(angle) * this.data.size * 0.8
      });
      ray.setAttribute('rotation', { x: 90, y: -angle * 180 / Math.PI, z: 0 });
      ray.setAttribute('material', {
        emissive: this.data.emissiveColor,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.3,
        side: 'double'
      });
      
      // Twinkle animation
      ray.setAttribute('animation__twinkle', {
        property: 'material.opacity',
        from: 0.1,
        to: 0.4,
        dur: 1000 + Math.random() * 1000,
        loop: true,
        dir: 'alternate',
        easing: 'easeInOutSine'
      });
      
      this.lightRays.appendChild(ray);
    }
    
    this.crystalContainer.appendChild(this.lightRays);
  },

  startMemoryPlayback: function() {
    // Animate through memories sequentially
    let currentIndex = 0;
    const memories = this.memoryData.memories || [];
    
    const playNext = () => {
      if (memories.length === 0) return;
      
      // Highlight current memory
      this.memoryElements.forEach((el, i) => {
        const isCurrent = parseInt(el.dataset.memoryIndex) === currentIndex;
        
        if (isCurrent) {
          el.setAttribute('animation__focus', {
            property: 'scale',
            to: '1.5 1.5 1.5',
            dur: 500,
            easing: 'easeOutExpo'
          });
          el.setAttribute('material', 'emissiveIntensity', 1.5);
        } else {
          el.setAttribute('scale', '1 1 1');
          el.setAttribute('material', 'emissiveIntensity', 
            0.3* (parseFloat(el.dataset.importance) || 0.5));
        }
      });
      
      // Move to next
      currentIndex = (currentIndex + 1) % memories.length;
      
      // Schedule next
      setTimeout(playNext, this.data.playbackSpeed);
    };
    
    playNext();
  },

  triggerRetrieval: function() {
    // Retrieval shimmer effect
    this.crystal.setAttribute('animation__retrieve', {
      property: 'material.emissiveIntensity',
      from: 0.1,
      to: 2.0,
      dur: 300,
      easing: 'easeOutExpo'
    });
    
    // Scale pulse
    this.crystal.setAttribute('animation__flash', {
      property: 'scale',
      from: '1 1 1',
      to: '1.2 1.2 1.2',
      dur: 300,
      easing: 'easeOutExpo'
    });
    
    // Return to normal
    setTimeout(() => {
      this.crystal.setAttribute('material', 'emissiveIntensity', 0.2);
      this.crystal.setAttribute('scale', '1 1 1');
    }, 500);
    
    // Emit event
    this.el.emit('memory-retrieved', { data: this.memoryData });
  },

  update: function(oldData) {
    if (oldData.data !== this.data.data) {
      this.memoryData = this.parseData();
      // Refresh internal memories
      this.memoryElements = [];
      this.crystal.innerHTML = '';
      this.createInternalMemories();
    }
    
    if (oldData.quality !== this.data.quality) {
      // Update crystal clarity
      const quality = this.memoryData.quality || this.data.quality;
      this.crystal.setAttribute('material', 'opacity', 0.4 + quality * 0.5);
    }
  },

  remove: function() {
    this.memoryElements = [];
    this.container.innerHTML = '';
  }
});

console.log('[nemosyne-memory-crystal] Component registered - "Memories preserved in crystal lattice"');
