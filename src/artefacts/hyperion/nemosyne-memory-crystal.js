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
