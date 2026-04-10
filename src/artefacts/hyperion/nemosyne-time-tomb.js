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
