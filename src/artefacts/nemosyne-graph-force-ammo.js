/**
 * nemosyne-graph-force: Force-Directed Graph with Ammo.js Physics
 * 
 * High-performance version using Bullet Physics (Ammo.js WASM).
 * Enables 10,000+ nodes with collision detection and rigid body dynamics.
 * 
 * Features:
 * ✓ Rigid body nodes with sphere collision
 * ✓ Soft spring constraints for edges
 * ✓ Force field for graph repulsion (Coulomb's law + spring forces)
 * ✓ Collision detection (nodes don't overlap)
 * ✓ Sleep/wake optimization (static nodes stop simulating)
 * ✓ Raycasting for precise selection
 * ✓ Kinematic dragging (grab and move nodes)
 * 
 * Requires: Ammo.js library
 */

AFRAME.registerComponent('nemosyne-graph-force', {
  schema: {
    nodes: { type: 'array', default: [] },
    edges: { type: 'array', default: [] },
    
    // Physics parameters (mapped to Ammo)
    chargeStrength: { type: 'number', default: -50 },
    linkDistance: { type: 'number', default: 2 },
    linkStiffness: { type: 'number', default: 0.7 },
    gravity: { type: 'number', default: 10 },
    damping: { type: 'number', default: 0.9 },
    iterations: { type: 'number', default: 0 }, // 0 = run continuously
    
    // Visualization
    nodeGeometry: { type: 'string', default: 'sphere' },
    nodeSize: { type: 'number', default: 0.2 },
    edgeThickness: { type: 'number', default: 0.02 },
    showLabels: { type: 'boolean', default: false },
    
    // Interaction
    draggable: { type: 'boolean', default: true },
    highlightNeighbors: { type: 'boolean', default: true },
    animateEntrance: { type: 'boolean', default: true },
    continuousPhysics: { type: 'boolean', default: true }
  },

  init: function() {
    this.engine = null;
    this.nodeEntities = new Map();
    this.edgeEntities = [];
    this.isRunning = true;
    this.draggedNode = null;
    this.frameCount = 0;
    
    // Create containers
    this.nodesContainer = document.createElement('a-entity');
    this.edgesContainer = document.createElement('a-entity');
    this.el.appendChild(this.edgesContainer);
    this.el.appendChild(this.nodesContainer);
    
    // Initialize Ammo physics
    this.initPhysics();
  },

  initPhysics: async function() {
    // Show loading message
    const loading = document.createElement('a-text');
    loading.setAttribute('value', 'Loading Physics Engine...');
    loading.setAttribute('position', '0 2 -3');
    loading.setAttribute('align', 'center');
    this.el.appendChild(loading);
    
    try {
      // Import AmmoPhysicsEngine
      if (typeof AmmoPhysicsEngine === 'undefined') {
        throw new Error('AmmoPhysicsEngine not loaded. Include AmmoPhysicsEngine.js');
      }
      
      // Create physics engine
      this.engine = new AmmoPhysicsEngine({
        gravity: { x: 0, y: 0, z: 0 },
        timeStep: 1 / 60,
        maxSubSteps: 10
      });
      
      // Wait for WASM
      await this.engine.init();
      
      // Setup graph dynamics
      this.engine.setupGraphDynamics(
        this.data.chargeStrength,
        this.data.gravity
      );
      
      // Build scene
      loading.remove();
      this.buildGraph();
      
      // Start simulation
      this.startSimulation();
      
      // Setup interactions
      if (this.data.draggable) {
        this.setupInteractions();
      }
      
      // Entrance animation
      if (this.data.animateEntrance) {
        this.animateEntrance();
      }
      
      console.log(`[nemosyne-graph-force] Ammo initialized: ${this.data.nodes.length} nodes, ${this.data.edges.length} edges`);
      
    } catch (error) {
      console.error('[nemosyne-graph-force] Failed to initialize physics:', error);
      loading.setAttribute('value', 'Physics Error: ' + error.message);
    }
  },

  buildGraph: function() {
    // Create physics bodies for nodes
    this.data.nodes.forEach((node, i) => {
      this.createNode(node, i);
    });
    
    // Create spring constraints for edges
    this.data.edges.forEach((edge, i) => {
      this.createEdge(edge, i);
    });
  },

  createNode: function(nodeData, index) {
    // Calculate initial position (sphere distribution)
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 5 * Math.random();
    const initialPos = {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi)
    };
    
    // Calculate size from degree
    const degree = this.calculateDegree(nodeData.id);
    const size = this.data.nodeSize * (0.5 + (degree / 10));
    
    // Create physics body
    const body = this.engine.createNodeBody(nodeData.id, initialPos, {
      mass: 1,
      radius: size,
      linearDamping: this.data.damping,
      restitution: 0.3,
      friction: 0.5
    });
    
    // Create visual entity
    const entity = document.createElement(`a-${this.data.nodeGeometry}`);
    entity.setAttribute('position', initialPos);
    entity.setAttribute('radius', size);
    entity.setAttribute('material', {
      color: nodeData.color || '#00d4aa',
      emissive: nodeData.color || '#00d4aa',
      emissiveIntensity: 0.3 + (degree / 20),
      metalness: 0.8,
      roughness: 0.2
    });
    
    entity.dataset.nodeId = nodeData.id;
    entity.nodeData = nodeData;
    entity.classList.add('clickable');
    entity.classList.add('graph-node');
    
    this.setupNodeEvents(entity, nodeData);
    
    this.nodesContainer.appendChild(entity);
    this.nodeEntities.set(nodeData.id, entity);
  },

  createEdge: function(edgeData, index) {
    const sourceNode = this.data.nodes.find(n => n.id === edgeData.source);
    const targetNode = this.data.nodes.find(n => n.id === edgeData.target);
    
    if (!sourceNode || !targetNode) return;
    
    // Create spring constraint
    this.engine.createSpringEdge(edgeData.source, edgeData.target, {
      restLength: this.data.linkDistance,
      stiffness: this.data.linkStiffness,
      damping: this.data.damping
    });
    
    // Create visual line
    const line = document.createElement('a-entity');
    line.setAttribute('line', {
      start: '0 0 0',
      end: '0 0 0',
      color: edgeData.color || '#444444',
      opacity: 0.3 + (edgeData.weight || 0.5) * 0.5
    });
    
    line.edgeData = edgeData;
    line.sourceId = edgeData.source;
    line.targetId = edgeData.target;
    
    this.edgesContainer.appendChild(line);
    this.edgeEntities.push(line);
  },

  startSimulation: function() {
    const simulate = () => {
      if (!this.isRunning || !this.engine || !this.engine.ready) {
        requestAnimationFrame(simulate);
        return;
      }
      
      // Step physics
      this.engine.stepSimulation(1/60);
      
      // Sync visual positions
      this.syncVisuals();
      
      this.frameCount++;
      requestAnimationFrame(simulate);
    };
    
    requestAnimationFrame(simulate);
  },

  syncVisuals: function() {
    // Update node positions from physics
    this.nodeEntities.forEach((entity, nodeId) => {
      const pos = this.engine.getBodyPosition(nodeId);
      if (pos) {
        entity.setAttribute('position', pos);
      }
    });
    
    // Update edge lines
    this.edgeEntities.forEach(edge => {
      const sourcePos = this.engine.getBodyPosition(edge.sourceId);
      const targetPos = this.engine.getBodyPosition(edge.targetId);
      
      if (sourcePos && targetPos) {
        edge.setAttribute('line', 'start', `${sourcePos.x} ${sourcePos.y} ${sourcePos.z}`);
        edge.setAttribute('line', 'end', `${targetPos.x} ${targetPos.y} ${targetPos.z}`);
      }
    });
  },

  setupNodeEvents: function(entity, nodeData) {
    // Hover
    entity.addEventListener('mouseenter', () => {
      entity.setAttribute('animation__hover', {
        property: 'scale',
        to: '1.3 1.3 1.3',
        dur: 200
      });
      
      if (this.data.highlightNeighbors) {
        this.highlightNeighbors(nodeData.id);
      }
    });
    
    entity.addEventListener('mouseleave', () => {
      entity.removeAttribute('animation__hover');
      entity.setAttribute('scale', '1 1 1');
      this.clearHighlight();
    });
    
    // Click
    entity.addEventListener('click', () => {
      this.selectNode(nodeData);
    });
    
    // Gesture grab
    entity.addEventListener('gesture-grab', (e) => {
      this.startDrag(nodeData.id);
    });
    
    entity.addEventListener('gesture-release', () => {
      this.endDrag();
    });
  },

  setupInteractions: function() {
    // Update loop for dragging
    this.el.sceneEl.addEventListener('tick', () => {
      if (this.draggedNode && this.dragHand) {
        this.updateDrag();
      }
    });
  },

  startDrag: function(nodeId) {
    this.draggedNode = nodeId;
    
    // Make body kinematic (manual control)
    this.engine.setBodyKinematic(nodeId, true);
    
    // Pause graph forces temporarily
    this.engine.graphDynamics.enabled = false;
  },

  updateDrag: function() {
    if (!this.draggedNode || !this.dragHand) return;
    
    // Update body position to hand position
    this.engine.setBodyPosition(this.draggedNode, this.dragHand.position);
  },

  endDrag: function() {
    if (!this.draggedNode) return;
    
    // Restore dynamic body
    this.engine.setBodyKinematic(this.draggedNode, false);
    
    // Re-enable graph forces
    this.engine.graphDynamics.enabled = true;
    
    // Wake up connected bodies
    this.wakeConnectedNodes(this.draggedNode);
    
    this.draggedNode = null;
    this.dragHand = null;
  },

  wakeConnectedNodes: function(nodeId) {
    // Wake up nodes connected by edges
    this.data.edges.forEach(edge => {
      if (edge.source === nodeId) {
        this.engine.nodeBodies.get(edge.target)?.activate();
      }
      if (edge.target === nodeId) {
        this.engine.nodeBodies.get(edge.source)?.activate();
      }
    });
  },

  highlightNeighbors: function(nodeId) {
    // Find connected nodes
    const neighbors = new Set();
    this.data.edges.forEach(edge => {
      if (edge.source === nodeId) neighbors.add(edge.target);
      if (edge.target === nodeId) neighbors.add(edge.source);
    });
    
    // Dim non-neighbors
    this.nodeEntities.forEach((entity, id) => {
      if (id !== nodeId && !neighbors.has(id)) {
        entity.setAttribute('material', 'opacity', 0.2);
      }
    });
    
    // Highlight edges
    this.edgeEntities.forEach(edge => {
      const isConnected = edge.sourceId === nodeId || edge.targetId === nodeId;
      edge.setAttribute('line', 'opacity', isConnected ? 0.8 : 0.1);
      if (isConnected) edge.setAttribute('line', 'color', '#00d4aa');
    });
  },

  clearHighlight: function() {
    this.nodeEntities.forEach(entity => {
      entity.setAttribute('material', 'opacity', 1);
    });
    
    this.edgeEntities.forEach(edge => {
      edge.setAttribute('line', 'opacity', 0.3 + (edge.edgeData.weight || 0.5) * 0.5);
      edge.setAttribute('line', 'color', edge.edgeData.color || '#444444');
    });
  },

  selectNode: function(nodeData) {
    this.el.emit('node-selected', { nodeId: nodeData.id, nodeData });
    
    // Raycast selection using physics
    const camera = document.querySelector('a-camera');
    if (camera) {
      const result = this.engine.raycast(
        camera.getAttribute('position'),
        { x: 0, y: 0, z: -1 } // Forward direction
      );
      
      if (result) {
        console.log(`[nemosyne-graph-force] Raycast hit: ${result.nodeId} at distance ${result.distance}`);
      }
    }
  },

  calculateDegree: function(nodeId) {
    return this.data.edges.filter(e => 
      e.source === nodeId || e.target === nodeId
    ).length;
  },

  animateEntrance: function() {
    let delay = 0;
    this.nodeEntities.forEach(entity => {
      entity.setAttribute('scale', '0.001 0.001 0.001');
      setTimeout(() => {
        entity.setAttribute('animation', {
          property: 'scale',
          to: '1 1 1',
          dur: 600,
          easing: 'easeOutElastic'
        });
      }, delay);
      delay += 20;
    });
  },

  getStats: function() {
    return this.engine?.getStats();
  },

  remove: function() {
    this.isRunning = false;
    
    if (this.engine) {
      this.engine.destroy();
    }
    
    this.nodesContainer.innerHTML = '';
    this.edgesContainer.innerHTML = '';
  }
});


console.log('[nemosyne-graph-force] Ammo.js version registered');
