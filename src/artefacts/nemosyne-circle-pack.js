/**
 * nemosyne-circle-pack: Hierarchical Circle Packing Visualization
 * 
 * Uses circle packing to show hierarchical data. Each circle fits
 * perfectly inside its parent. Space-efficient and visually elegant.
 * Perfect for:
 * - File system hierarchies
 * - Organizational structures
 * - Memory palace wings/rooms/drawers
 * - Nested categories
 */

AFRAME.registerComponent('nemosyne-circle-pack', {
  schema: {
    data: { type: 'string', default: '{}' },
    padding: { type: 'number', default: 2 },
    maxDepth: { type: 'number', default: 4 },
    colors: { type: 'array', default: ['#00d4aa', '#ff6b6b', '#4ecdc4', '#ffeaa7'] },
    showLabels: { type: 'boolean', default: true },
    hoverScale: { type: 'number', default: 1.1 },
    animateEntrance: { type: 'boolean', default: true },
    depthScale: { type: 'number', default: 0.7 }
  },

  init() {
    this.parsedData = {};
    this.circles = [];
    this.hoveredCircle = null;
    
    this.rootGroup = document.createElement('a-entity');
    this.el.appendChild(this.rootGroup);
    
    this.parseData();
    this.buildCirclePack();
    
    if (this.data.animateEntrance) {
      this.animateEntrance();
    }
  },

  parseData() {
    try {
      this.parsedData = JSON.parse(this.data.data);
    } catch (e) {
      console.error('[nemosyne-circle-pack] Parse error:', e);
      this.parsedData = {};
    }
  },

  buildCirclePack() {
    if (!this.parsedData.children) return;

    // Flatten and compute packing
    const packed = this.packCircle(this.parsedData, 0, null, { x: 0, y: 0, z: 0 }, 5);
    
    // Create circle entities
    packed.forEach((circle, i) => {
      this.createCircle(circle, i);
    });

    this.circles = packed;
  },

  packCircle(node, depth, parent, center, radius) {
    if (depth > this.data.maxDepth) return [];

    const circles = [{
      id: node.id || node.name || `circle-${depth}`,
      name: node.name || 'Root',
      value: node.value || 1,
      depth: depth,
      parent: parent,
      position: center,
      radius: Math.max(0.1, radius - this.data.padding / 10),
      color: this.data.colors[depth % this.data.colors.length],
      data: node
    }];

    if (node.children && depth < this.data.maxDepth) {
      // Compute child radii based on value
      const totalValue = node.children.reduce((sum, child) => sum + (child.value || 1), 0);
      
      // Use packCircles algorithm to fit children
      const childRadiuses = node.children.map(child => 
        Math.sqrt((child.value || 1) / totalValue) * radius * this.data.depthScale
      );
      
      const childPositions = this.packCircles(childRadiuses, { x: 0, y: 0 });
      
      node.children.forEach((child, i) => {
        if (i < childPositions.length) {
          const childCenter = {
            x: center.x + childPositions[i].x,
            y: center.y + childPositions[i].y,
            z: center.z + (depth + 1) * 0.1
          };
          
          const childCircles = this.packCircle(
            child, 
            depth + 1, 
            circles[0], 
            childCenter, 
            childRadiuses[i]
          );
          circles.push(...childCircles);
        }
      });
    }

    return circles;
  },

  packCircles(radiuses, center) {
    // Simple spiral packing
    const positions = [];
    let angle = 0;
    let radius = 0;
    
    radiuses.forEach((r, i) => {
      if (i === 0) {
        positions.push({ x: center.x, y: center.y });
      } else {
        // Golden angle spiral
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        angle += goldenAngle;
        radius += r * 0.5;
        
        positions.push({
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        });
        
        radius += r * 0.5;
      }
    });
    
    return positions;
  },

  createCircle(circleData, index) {
    const circle = document.createElement('a-circle');
    
    // Position
    circle.setAttribute('position', circleData.position);
    circle.setAttribute('radius', circleData.radius);
    
    // Material
    circle.setAttribute('material', {
      color: circleData.color,
      opacity: 0.7 - (circleData.depth * 0.1),
      transparent: true,
      side: 'double'
    });
    
    // Rotation to face camera
    circle.setAttribute('look-at', '[camera]');
    
    // Store data
    circle.userData = circleData;
    
    // Hover effects
    circle.addEventListener('mouseenter', () => {
      this.onCircleHover(circle);
    });
    
    circle.addEventListener('mouseleave', () => {
      this.onCircleLeave(circle);
    });
    
    // Label
    if (this.data.showLabels && circleData.radius > 0.3) {
      const label = document.createElement('a-text');
      label.setAttribute('value', circleData.name);
      label.setAttribute('align', 'center');
      label.setAttribute('position', `0 0 ${circleData.radius + 0.1}`);
      label.setAttribute('scale', `${circleData.radius * 0.15} ${circleData.radius * 0.15} 1`);
      label.setAttribute('visible', circleData.depth <= 1);
      label.setAttribute('look-at', '[camera]');
      circle.appendChild(label);
    }
    
    this.rootGroup.appendChild(circle);
  },

  onCircleHover(circle) {
    this.hoveredCircle = circle;
    
    circle.setAttribute('scale', 
      `${this.data.hoverScale} ${this.data.hoverScale} ${this.data.hoverScale}`
    );
    circle.setAttribute('material', 'opacity', 0.9);
    
    this.emit('circle-hover', circle.userData);
  },

  onCircleLeave(circle) {
    this.hoveredCircle = null;
    
    circle.setAttribute('scale', '1 1 1');
    circle.setAttribute('material', 'opacity', 0.7 - (circle.userData.depth * 0.1));
    
    this.emit('circle-leave', circle.userData);
  },

  animateEntrance() {
    const circles = this.rootGroup.querySelectorAll('a-circle');
    
    circles.forEach((circle, i) => {
      const depth = circle.userData.depth;
      const delay = depth * 200 + (i % 10) * 50;
      
      circle.setAttribute('scale', '0 0 0');
      
      setTimeout(() => {
        circle.setAttribute('animation', {
          property: 'scale',
          to: '1 1 1',
          dur: 300,
          easing: 'easeOutBack'
        });
      }, delay);
    });
  },

  emit(eventName, detail) {
    this.el.emit(eventName, detail);
  },

  update() {
    // Rebuild on data change
    while (this.rootGroup.firstChild) {
      this.rootGroup.removeChild(this.rootGroup.firstChild);
    }
    
    this.parseData();
    this.buildCirclePack();
    
    if (this.data.animateEntrance) {
      this.animateEntrance();
    }
  },

  remove() {
    if (this.rootGroup) {
      this.rootGroup.remove();
    }
  }
});

console.log('[nemosyne-circle-pack] Circle pack component registered');
