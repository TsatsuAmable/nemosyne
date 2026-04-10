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
