/**
 * nemosyne-sankey-flow: Sankey Diagram for Flow Visualization
 * 
 * Visualizes flow magnitude between nodes with proportional width paths.
 * Perfect for:
 * - Energy flows
 * - Budget distributions  
 * - Traffic patterns
 * - Data flow diagrams
 */

AFRAME.registerComponent('nemosyne-sankey-flow', {
  schema: {
    data: { type: 'string', default: '[]' },
    nodeWidth: { type: 'number', default: 0.3 },
    linkOpacity: { type: 'number', default: 0.6 },
    colors: { type: 'array', default: [] },
    showLabels: { type: 'boolean', default: true },
    animate: { type: 'boolean', default: true },
    curveType: { type: 'string', default: 'basis' } // basis, cardinal, linear
  },

  init() {
    this.parsedData = { nodes: [], links: [] };
    this.nodePositions = new Map();
    
    // Color palette
    this.colorPalette = this.data.colors.length > 0 ? this.data.colors : [
      '#00d4aa', '#ff6b6b', '#4ecdc4', '#ffeaa7', '#a29bfe',
      '#fd79a8', '#00b894', '#e17055', '#74b9ff', '#55efc4'
    ];

    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);

    this.parseData();
    this.buildSankey();
  },

  parseData() {
    try {
      this.parsedData = JSON.parse(this.data.data);
    } catch (e) {
      console.error('[nemosyne-sankey-flow] Parse error:', e);
    }
  },

  buildSankey() {
    if (!this.parsedData.nodes || !this.parsedData.links) return;

    const { nodes, links } = this.parsedData;
    
    // Calculate node positions (simplified Sankey layout)
    this.calculateNodePositions(nodes);
    
    // Draw nodes
    nodes.forEach((node, i) => {
      this.createNode(node, i);
    });

    // Draw links
    links.forEach((link, i) => {
      this.createLink(link, i);
    });

    // Add labels
    if (this.data.showLabels) {
      nodes.forEach((node, i) => {
        this.createNodeLabel(node, i);
      });
    }
  },

  calculateNodePositions(nodes) {
    // Simple layout: position nodes in columns by their level/order
    const levels = this.groupNodesByLevel(nodes);
    
    levels.forEach((levelNodes, levelIndex) => {
      const totalHeight = levelNodes.length * 1.5;
      const startY = totalHeight / 2;
      
      levelNodes.forEach((node, i) => {
        this.nodePositions.set(node.id, {
          x: levelIndex * 4 - (levels.length - 1) * 2,
          y: startY - i * 1.5,
          z: 0,
          level: levelIndex
        });
      });
    });
  },

  groupNodesByLevel(nodes) {
    // Group nodes into levels based on their connections
    const levels = [];
    const visited = new Set();
    
    // Find source nodes (no incoming links)
    let currentLevel = nodes.filter(n => 
      !this.parsedData.links.some(l => l.target === n.id)
    );
    
    if (currentLevel.length === 0) {
      currentLevel = [nodes[0]]; // Fallback
    }
    
    while (currentLevel.length > 0 && levels.length < 10) {
      levels.push(currentLevel);
      currentLevel.forEach(n => visited.add(n.id));
      
      // Find next level (targets of current level)
      const nextLevelIds = new Set();
      this.parsedData.links
        .filter(l => currentLevel.some(n => n.id === l.source))
        .forEach(l => nextLevelIds.add(l.target));
      
      currentLevel = nodes.filter(n => 
        nextLevelIds.has(n.id) && !visited.has(n.id)
      );
    }
    
    return levels;
  },

  createNode(node, index) {
    const pos = this.nodePositions.get(node.id);
    if (!pos) return;

    const nodeEl = document.createElement('a-box');
    nodeEl.setAttribute('position', pos);
    
    const height = (node.value || 1) * 0.5;
    nodeEl.setAttribute('width', this.data.nodeWidth);
    nodeEl.setAttribute('height', height);
    nodeEl.setAttribute('depth', this.data.nodeWidth);
    
    const color = this.colorPalette[index % this.colorPalette.length];
    nodeEl.setAttribute('color', color);
    nodeEl.setAttribute('material', {
      opacity: 0.9,
      transparent: true
    });
    
    nodeEl.classList.add('clickable');
    nodeEl.userData = { node, index };
    
    // Hover effect
    nodeEl.addEventListener('mouseenter', () => {
      nodeEl.setAttribute('scale', '1.1 1.1 1.1');
    });
    
    nodeEl.addEventListener('mouseleave', () => {
      nodeEl.setAttribute('scale', '1 1 1');
    });
    
    this.container.appendChild(nodeEl);
  },

  createLink(link, index) {
    const sourcePos = this.nodePositions.get(link.source);
    const targetPos = this.nodePositions.get(link.target);
    
    if (!sourcePos || !targetPos) return;

    const thickness = Math.max(0.05, (link.value || 1) * 0.1);
    const color = this.getLinkColor(link, index);
    
    // Create curved path
    const curve = this.createCurvePath(sourcePos, targetPos);
    const points = curve.getPoints(20);
    
    // Create tube along path
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      const segment = document.createElement('a-cylinder');
      segment.setAttribute('position', {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: (p1.z + p2.z) / 2
      });
      
      const distance = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) +
        Math.pow(p2.y - p1.y, 2) +
        Math.pow(p2.z - p1.z, 2)
      );
      
      segment.setAttribute('height', distance);
      segment.setAttribute('radius', thickness / 2);
      segment.setAttribute('color', color);
      segment.setAttribute('material', {
        opacity: this.data.linkOpacity,
        transparent: true
      });
      
      // Orient cylinder
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      segment.setAttribute('rotation', {
        x: 0,
        y: 0,
        z: angle * 180 / Math.PI - 90
      });
      
      this.container.appendChild(segment);
    }
    
    // Animation
    if (this.data.animate) {
      this.animateFlow(link, color);
    }
  },

  createCurvePath(source, target) {
    // Create smooth curve with control points
    const midX = (source.x + target.x) / 2;
    
    return {
      getPoints: (count) => {
        const points = [];
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          
          // Cubic Bezier curve
          const x = this.cubicBezier(t, source.x, midX, midX, target.x);
          const y = this.cubicBezier(t, source.y, source.y, target.y, target.y);
          const z = 0;
          
          points.push({ x, y, z });
        }
        return points;
      }
    };
  },

  cubicBezier(t, p0, p1, p2, p3) {
    const oneMinusT = 1 - t;
    return (
      Math.pow(oneMinusT, 3) * p0 +
      3 * Math.pow(oneMinusT, 2) * t * p1 +
      3 * oneMinusT * Math.pow(t, 2) * p2 +
      Math.pow(t, 3) * p3
    );
  },

  animateFlow(link, color) {
    // Create animated particles showing flow direction
    const particle = document.createElement('a-sphere');
    particle.setAttribute('radius', 0.08);
    particle.setAttribute('color', color);
    particle.setAttribute('material', {
      emissive: color,
      emissiveIntensity: 0.5
    });
    
    this.container.appendChild(particle);
    
    // Animate along path
    let progress = 0;
    const speed = 0.02;
    
    const animate = () => {
      progress += speed;
      if (progress > 1) progress = 0;
      
      const sourcePos = this.nodePositions.get(link.source);
      const targetPos = this.nodePositions.get(link.target);
      
      if (sourcePos && targetPos) {
        const midX = (sourcePos.x + targetPos.x) / 2;
        const x = this.cubicBezier(progress, sourcePos.x, midX, midX, targetPos.x);
        const y = this.cubicBezier(progress, sourcePos.y, sourcePos.y, targetPos.y, targetPos.y);
        
        particle.setAttribute('position', { x, y, z: 0 });
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
  },

  getLinkColor(link, index) {
    // Match source or target node color
    const sourceIndex = this.parsedData.nodes.findIndex(n => n.id === link.source);
    if (sourceIndex >= 0) {
      return this.colorPalette[sourceIndex % this.colorPalette.length];
    }
    return this.colorPalette[index % this.colorPalette.length];
  },

  createNodeLabel(node, index) {
    const pos = this.nodePositions.get(node.id);
    if (!pos) return;

    const label = document.createElement('a-text');
    label.setAttribute('value', node.name || node.id);
    label.setAttribute('align', 'center');
    label.setAttribute('position', {
      x: pos.x,
      y: pos.y,
      z: pos.z + 0.5
    });
    label.setAttribute('scale', '0.5 0.5 0.5');
    label.setAttribute('look-at', '[camera]');
    
    this.container.appendChild(label);
  },

  update() {
    // Rebuild on data change
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    
    this.parseData();
    this.buildSankey();
  },

  remove() {
    if (this.container) {
      this.container.remove();
    }
  }
});

console.log('[nemosyne-sankey-flow] Sankey flow component registered');
