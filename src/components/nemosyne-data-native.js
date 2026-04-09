/**
 * nemosyne-data-native: A-Frame component for automatic data visualization
 * 
 * Usage:
 * <a-scene>
 *   <a-entity nemosyne-data-native="source: #myData; autoLayout: true"></a-entity>
 * </a-scene>
 * 
 * Combined with gestures and telemetry for hand-driven data manipulation.
 */

AFRAME.registerComponent('nemosyne-data-native', {
  schema: {
    // Data source (selector to script tag, or direct data)
    source: { type: 'selector' },
    dataUrl: { type: 'string' },
    
    // Layout options
    autoLayout: { type: 'boolean', default: true },
    topology: { type: 'string', default: 'auto' }, // 'auto' or specific
    
    // Gesture integration
    gestureEnabled: { type: 'boolean', default: true },
    telemetryEnabled: { type: 'boolean', default: true },
    
    // Interaction options
    grabable: { type: 'boolean', default: true },
    scalable: { type: 'boolean', default: true },
    hoverEffect: { type: 'string', default: 'glow' },
    
    // Animation
    animateEntrance: { type: 'boolean', default: true },
    animateUpdates: { type: 'boolean', default: true },
    
    // Performance
    maxVisible: { type: 'number', default: 1000 },
    lodDistance: { type: 'number', default: 50 }
  },

  init: function() {
    // Initialize the data-native engine
    this.engine = new DataNativeEngine({
      scene: this.el.sceneEl,
      gestureEnabled: this.data.gestureEnabled,
      telemetryEnabled: this.data.telemetryEnabled
    });
    
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);
    
    // Load data
    this.loadData();
    
    // Setup gesture interactions if enabled
    if (this.data.gestureEnabled) {
      this.setupGestureInteractions();
    }
    
    console.log('[nemosyne-data-native] Component initialized');
  },

  loadData: function() {
    if (this.data.source) {
      // Load from script tag
      const content = this.data.source.textContent;
      try {
        const data = JSON.parse(content);
        this.ingestData(data);
      } catch (e) {
        console.error('[nemosyne-data-native] Failed to parse data:', e);
      }
    } else if (this.data.dataUrl) {
      // Load from URL
      fetch(this.data.dataUrl)
        .then(r => r.json())
        .then(data => this.ingestData(data))
        .catch(e => console.error('[nemosyne-data-native] Failed to load data:', e));
    }
  },

  ingestData: function(rawData) {
    // Convert to packets and visualize
    this.engine.ingest(rawData).then(artefacts => {
      artefacts.forEach(a => this.container.appendChild(a));
      
      if (this.data.animateEntrance) {
        this.animateEntrance(artefacts);
      }
      
      this.emit('data-loaded', { count: artefacts.length });
    });
  },

  setupGestureInteractions: function() {
    // Listen for gesture events from hand controllers
    this.el.sceneEl.addEventListener('gesture-recognized', (e) => {
      this.handleGesture(e.detail);
    });
    
    // Listen for telemetry
    this.el.sceneEl.addEventListener('telemetry-update', (e) => {
      this.engine.handleTelemetry(e.detail);
    });
  },

  handleGesture: function(gestureData) {
    // Forward to engine's gesture handler
    this.engine.handleGesture(gestureData);
  },

  animateEntrance: function(artefacts) {
    // Staggered entrance animation
    artefacts.forEach((a, i) => {
      const finalScale = a.getAttribute('scale');
      
      // Start small
      a.setAttribute('scale', '0.001 0.001 0.001');
      
      // Scale up with elastic effect
      setTimeout(() => {
        a.setAttribute('animation', {
          property: 'scale',
          to: `${finalScale.x} ${finalScale.y} ${finalScale.z}`,
          dur: 600,
          easing: 'easeOutElastic'
        });
      }, i * 30);
    });
  },

  update: function(oldData) {
    // Handle data source changes
    if (this.data.source !== oldData.source) {
      this.loadData();
    }
  },

  remove: function() {
    // Cleanup
    this.container.innerHTML = '';
  },

  emit: function(eventName, detail) {
    this.el.emit(eventName, detail);
  }
});


/**
 * Specific topology components
 */

// Graph force layout
AFRAME.registerComponent('nemosyne-graph-force', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  },
  
  init: function() {
    // Parse stored packet data
    this.packetData = JSON.parse(this.data.data || '{}');
  }
});

// Tree hierarchical
AFRAME.registerComponent('nemosyne-tree-hierarchical', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  }
});

// Timeline spiral
AFRAME.registerComponent('nemosyne-timeline-spiral', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  }
});

// Scatter semantic
AFRAME.registerComponent('nemosyne-scatter-semantic', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  }
});

// Geo globe
AFRAME.registerComponent('nemosyne-geo-globe', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  }
});

// Grid categorical
AFRAME.registerComponent('nemosyne-grid-categorical', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  }
});

// Default crystal
AFRAME.registerComponent('nemosyne-crystal-default', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  },
  
  init: function() {
    // Make interactable
    this.el.classList.add('clickable');
    this.el.classList.add('data-crystal');
    
    // Store reference
    this.el.dataset.packetId = this.data.packetId;
  }
});


// Data crystal (full 6DOF with gesture support)
AFRAME.registerComponent('nemosyne-data-crystal', {
  schema: {
    packetId: { type: 'string' },
    data: { type: 'string' }
  },
  
  init: function() {
    this.el.classList.add('clickable');
    this.el.classList.add('data-crystal');
    this.el.dataset.packetId = this.data.packetId;
    
    // Parse packet data for interaction
    try {
      this.packet = JSON.parse(this.data.data);
    } catch (e) {
      this.packet = null;
    }
    
    // Setup interactions
    this.setupInteractions();
  },
  
  setupInteractions: function() {
    // Hover
    this.el.addEventListener('mouseenter', () => {
      this.el.setAttribute('animation__hover', {
        property: 'material.emissiveIntensity',
        to: 1.5,
        dur: 200
      });
      
      this.el.emit('crystal-hover', { 
        packetId: this.data.packetId,
        packet: this.packet 
      });
    });
    
    this.el.addEventListener('mouseleave', () => {
      this.el.removeAttribute('animation__hover');
      this.el.emit('crystal-hover-end', { packetId: this.data.packetId });
    });
    
    // Select
    this.el.addEventListener('click', () => {
      this.el.emit('crystal-select', { 
        packetId: this.data.packetId,
        packet: this.packet 
      });
    });
    
    // Gesture grab
    this.el.addEventListener('gesture-grab', (e) => {
      this.isGrabbed = true;
      this.el.emit('crystal-grab', { packetId: this.data.packetId, hand: e.detail.hand });
    });
    
    this.el.addEventListener('gesture-release', () => {
      this.isGrabbed = false;
      this.el.emit('crystal-release', { packetId: this.data.packetId });
    });
  },
  
  tick: function() {
    // Update position if being grabbed
    if (this.isGrabbed) {
      // Position is updated by gesture controller
      this.el.emit('crystal-moved', { 
        packetId: this.data.packetId,
        position: this.el.getAttribute('position')
      });
    }
  }
});


console.log('[nemosyne-data-native] Component registered');
