/**
 * nemosyne-graph-force: Force-Directed Graph Visualization
 * 
 * Renders network data as nodes and edges with physics-based layout.
 * Nodes repel, edges attract, system finds equilibrium.
 * 
 * Features:
 * - Real-time physics simulation using d3-force-3d concepts
 * - Interactive node dragging (via gestures)
 * - Dynamic edge creation on the fly
 * - Size/opacity based on node centrality
 * - Link thickness based on edge weight
 * - Cluster highlighting
 * 
 * Requires: Data packet with 'graph' structure and 'links'
 */

AFRAME.registerComponent('nemosyne-graph-force', {
  schema: {
    // Data
    nodes: { type: 'array', default: [] }, // Array of node data
    edges: { type: 'array', default: [] }, // Array of {source, target, weight}
    
    // Physics parameters
    chargeStrength: { type: 'number', default: -300 }, // Node repulsion
    linkDistance: { type: 'number', default: 2 },     // Ideal edge length
    linkStrength: { type: 'number', default: 1 },     // Edge pull strength
    gravity: { type: 'number', default: 0.1 },       // Pull to center
    friction: { type: 'number', default: 0.9 },       // Velocity damping
    iterations: { type: 'number', default: 300 },      // Layout iterations
    
    // Visualization
    nodeGeometry: { type: 'string', default: 'sphere' },
    nodeSize: { type: 'vec3', default: { x: 0.2, y: 0.2, z: 0.2 } },
    edgeThickness: { type: 'number', default: 0.02 },
    showLabels: { type: 'boolean', default: false },
    
    // Interaction
    draggable: { type: 'boolean', default: true },
    highlightNeighbors: { type: 'boolean', default: true },
    
    // Animation
    animateEntrance: { type: 'boolean', default: true },
    continuousPhysics: { type: 'boolean', default: false } // Run physics continuously?
  },

  init: function() {
    // State
    this.simulation = null;
    this.nodeMeshes = new Map();
    this.edgeMeshes = [];
    this.isRunning = true;
    this.draggedNode = null;
    
    // Create container
    this.nodesContainer = document.createElement('a-entity');
    this.edgesContainer = document.createElement('a-entity');
    this.el.appendChild(this.edgesContainer);
    this.el.appendChild(this.nodesContainer);
    
    // Initialize physics
    this.initSimulation();
    
    // Build visualization
    this.buildGraph();
    
    // Run initial layout
    this.runSimulation();
    
    // Setup interactions
    if (this.data.draggable) {
      this.setupInteractions();
    }
    
    console.log('[nemosyne-graph-force] Initialized with', 
                this.data.nodes.length, 'nodes,', 
                this.data.edges.length, 'edges');
  },

  initSimulation: function() {
    // Initialize node positions (sphere distribution)
    const nodeCount = this.data.nodes.length;
    this.data.nodes.forEach((node, i) => {
      if (!node.x || !node.y || !node.z) {
        // Random position on sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 5 * Math.random();
        
        node.x = r * Math.sin(phi) * Math.cos(theta);
        node.y = r * Math.sin(phi) * Math.sin(theta);
        node.z = r * Math.cos(phi);
        
        // Velocity
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
      }
    });
  },

  buildGraph: function() {
    // Create node meshes
    this.data.nodes.forEach(node => {
      this.createNode(node);
    });
    
    // Create edge meshes
    this.data.edges.forEach(edge => {
      this.createEdge(edge);
    });
  },

  createNode: function(nodeData) {
    const entity = document.createElement(`a-${this.data.nodeGeometry}`);
    
    // Position
    entity.setAttribute('position', {
      x: nodeData.x,
      y: nodeData.y,
      z: nodeData.z
    });
    
    // Size (can vary by degree/centrality)
    const degree = this.calculateDegree(nodeData.id);
    const sizeScale = 0.5 + (degree / this.data.nodes.length) * 1.5;
    
    entity.setAttribute('radius', this.data.nodeSize.x * sizeScale / 2);
    
    // Material
    entity.setAttribute('material', {
      color: nodeData.color || '#00d4aa',
      emissive: nodeData.color || '#00d4aa',
      emissiveIntensity: 0.3 + (degree / 10),
      metalness: 0.8,
      roughness: 0.2
    });
    
    // Metadata
    entity.dataset.nodeId = nodeData.id;
    entity.nodeData = nodeData;
    
    // Interaction
    entity.classList.add('clickable');
    entity.classList.add('graph-node');
    
    // Event handlers
    this.setupNodeEvents(entity, nodeData);
    
    this.nodesContainer.appendChild(entity);
    this.nodeMeshes.set(nodeData.id, entity);
  },

  createEdge: function(edgeData) {
    const sourceNode = this.data.nodes.find(n => n.id === edgeData.source);
    const targetNode = this.data.nodes.find(n => n.id === edgeData.target);
    
    if (!sourceNode || !targetNode) return;
    
    // Create line
    const line = document.createElement('a-entity');
    
    // Calculate positions
    const start = { x: sourceNode.x, y: sourceNode.y, z: sourceNode.z };
    const end = { x: targetNode.x, y: targetNode.y, z: targetNode.z };
    
    // Initial line
    line.setAttribute('line', {
      start: `${start.x} ${start.y} ${start.z}`,
      end: `${end.x} ${end.y} ${end.z}`,
      color: edgeData.color || '#444444',
      opacity: 0.3 + (edgeData.weight || 0.5) * 0.5
    });
    
    // Store references
    line.edgeData = edgeData;
    line.sourceNode = sourceNode;
    line.targetNode = targetNode;
    
    this.edgesContainer.appendChild(line);
    this.edgeMeshes.push(line);
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
    
    // Click/drag
    entity.addEventListener('click', () => {
      this.selectNode(nodeData);
    });
    
    // Gesture grab (integrated with gesture system)
    entity.addEventListener('gesture-grab', (e) => {
      this.startDrag(nodeData, e.detail.hand);
    });
    
    entity.addEventListener('gesture-release', () => {
      this.endDrag();
    });
  },

  setupInteractions: function() {
    // Update loop for dragging
    this.el.sceneEl.addEventListener('tick', () => {
      if (this.draggedNode) {
        this.updateDrag();
      }
      
      if (this.data.continuousPhysics && this.isRunning) {
        this.stepSimulation();
      }
    });
  },

  runSimulation: function() {
    // Run fixed iterations
    for (let i = 0; i < this.data.iterations; i++) {
      this.stepSimulation();
    }
    
    // Update visual positions
    this.updateVisualPositions();
    
    // Animate entrance
    if (this.data.animateEntrance) {
      this.animateEntrance();
    }
  },

  stepSimulation: function() {
    // Apply forces
    this.applyRepulsion();
    this.applyLinkAttraction();
    this.applyGravity();
    this.applyFriction();
    
    // Update positions
    this.data.nodes.forEach(node => {
      if (node !== this.draggedNode) {
        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;
      }
    });
  },

  applyRepulsion: function() {
    const k = Math.sqrt(4 * Math.PI * 25 / this.data.nodes.length); // Optimal distance
    
    this.data.nodes.forEach((node1, i) => {
      this.data.nodes.forEach((node2, j) => {
        if (i >= j) return;
        
        const dx = node1.x - node2.x;
        const dy = node1.y - node2.y;
        const dz = node1.z - node2.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.1;
        
        // Repulsion force (F = k² / dist)
        const force = (this.data.chargeStrength * this.data.chargeStrength) / dist;
        const fx = (dx / dist) * force * 0.01;
        const fy = (dy / dist) * force * 0.01;
        const fz = (dz / dist) * force * 0.01;
        
        node1.vx += fx;
        node1.vy += fy;
        node1.vz += fz;
        node2.vx -= fx;
        node2.vy -= fy;
        node2.vz -= fz;
      });
    });
  },

  applyLinkAttraction: function() {
    this.data.edges.forEach(edge => {
      const source = this.data.nodes.find(n => n.id === edge.source);
      const target = this.data.nodes.find(n => n.id === edge.target);
      
      if (!source || !target) return;
      
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dz = target.z - source.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.1;
      
      // Spring force (F = (dist - k) * strength)
      const force = (dist - this.data.linkDistance) * this.data.linkStrength * 0.01 * edge.weight;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      
      source.vx += fx;
      source.vy += fy;
      source.vz += fz;
      target.vx -= fx;
      target.vy -= fy;
      target.vz -= fz;
    });
  },

  applyGravity: function() {
    this.data.nodes.forEach(node => {
      const dist = Math.sqrt(node.x*node.x + node.y*node.y + node.z*node.z);
      const force = this.data.gravity * dist * 0.01;
      
      node.vx -= (node.x / dist) * force;
      node.vy -= (node.y / dist) * force;
      node.vz -= (node.z / dist) * force;
    });
  },

  applyFriction: function() {
    this.data.nodes.forEach(node => {
      node.vx *= this.data.friction;
      node.vy *= this.data.friction;
      node.vz *= this.data.friction;
    });
  },

  updateVisualPositions: function() {
    // Update node positions
    this.nodeMeshes.forEach((mesh, id) => {
      const node = this.data.nodes.find(n => n.id === id);
      if (node) {
        mesh.setAttribute('position', { x: node.x, y: node.y, z: node.z });
      }
    });
    
    // Update edge positions
    this.edgeMeshes.forEach(edge => {
      const sourcePos = this.nodeMeshes.get(edge.sourceNode.id)?.getAttribute('position');
      const targetPos = this.nodeMeshes.get(edge.targetNode.id)?.getAttribute('position');
      
      if (sourcePos && targetPos) {
        edge.setAttribute('line', {
          start: `${sourcePos.x} ${sourcePos.y} ${sourcePos.z}`,
          end: `${targetPos.x} ${targetPos.y} ${targetPos.z}`
        });
      }
    });
  },

  animateEntrance: function() {
    // Scale up nodes with delay
    let delay = 0;
    this.nodeMeshes.forEach(mesh => {
      const currentScale = mesh.getAttribute('scale') || { x: 1, y: 1, z: 1 };
      mesh.setAttribute('scale', '0.001 0.001 0.001');
      
      setTimeout(() => {
        mesh.setAttribute('animation', {
          property: 'scale',
          to: `${currentScale.x} ${currentScale.y} ${currentScale.z}`,
          dur: 600,
          easing: 'easeOutElastic'
        });
      }, delay);
      
      delay += 20;
    });
  },

  // Dragging
  startDrag: function(nodeData, hand) {
    this.draggedNode = nodeData;
    this.dragHand = hand;
    this.isRunning = false; // Pause physics while dragging
  },

  updateDrag: function() {
    if (!this.draggedNode || !this.dragHand) return;
    
    // Update node position to hand position
    this.draggedNode.x = this.dragHand.position.x;
    this.draggedNode.y = this.dragHand.position.y;
    this.draggedNode.z = this.dragHand.position.z;
    
    // Reset velocity
    this.draggedNode.vx = 0;
    this.draggedNode.vy = 0;
    this.draggedNode.vz = 0;
    
    // Update visual
    this.updateVisualPositions();
  },

  endDrag: function() {
    this.draggedNode = null;
    this.dragHand = null;
    this.isRunning = true;
  },

  // Selection and highlighting
  selectNode: function(nodeData) {
    this.el.emit('node-selected', { 
      nodeId: nodeData.id,
      nodeData: nodeData 
    });
  },

  highlightNeighbors: function(nodeId) {
    // Find connected edges
    const neighbors = new Set();
    this.data.edges.forEach(edge => {
      if (edge.source === nodeId) neighbors.add(edge.target);
      if (edge.target === nodeId) neighbors.add(edge.source);
    });
    
    // Dim non-neighbors
    this.nodeMeshes.forEach((mesh, id) => {
      if (id !== nodeId && !neighbors.has(id)) {
        mesh.setAttribute('material', 'opacity', 0.2);
      }
    });
    
    this.edgeMeshes.forEach(edge => {
      const isConnected = edge.sourceNode.id === nodeId || edge.targetNode.id === nodeId;
      edge.setAttribute('line', 'opacity', isConnected ? 0.8 : 0.1);
      
      if (isConnected) {
        edge.setAttribute('line', 'color', '#00d4aa');
      }
    });
  },

  clearHighlight: function() {
    this.nodeMeshes.forEach(mesh => {
      mesh.setAttribute('material', 'opacity', 1);
    });
    
    this.edgeMeshes.forEach(edge => {
      edge.setAttribute('line', 'opacity', 0.3 + (edge.edgeData.weight || 0.5) * 0.5);
      edge.setAttribute('line', 'color', edge.edgeData.color || '#444444');
    });
  },

  calculateDegree: function(nodeId) {
    return this.data.edges.filter(e => 
      e.source === nodeId || e.target === nodeId
    ).length;
  },

  remove: function() {
    this.isRunning = false;
    this.nodesContainer.innerHTML = '';
    this.edgesContainer.innerHTML = '';
  }
});


console.log('[nemosyne-graph-force] Component registered');
