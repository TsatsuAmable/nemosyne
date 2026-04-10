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
