/**
 * nemosyne-tree-hierarchical: Tree Layout Visualization
 *
 * Renders hierarchical data (org charts, file systems, taxonomies)
 * as a collapsible tree with orthogonal or radial layout options.
 *
 * Features:
 * - Fold/unfold branches with animation
 * - Depth-based sizing and coloring
 * - Path highlighting to root
 * - Orthogonal or vertical layout modes
 * - Level-of-detail for deep trees
 */

AFRAME.registerComponent('nemosyne-tree-hierarchical', {
  schema: {
    // Data
    rootNode: { type: 'string', default: '' }, // Root node ID
    nodes: { type: 'array', default: [] },
    edges: { type: 'array', default: [] }, // parent-child relationships

    // Layout
    layout: { type: 'string', default: 'orthogonal' }, // 'orthogonal', 'vertical', 'radial'
    levelSpacing: { type: 'number', default: 2 }, // Space between tree levels
    siblingSpacing: { type: 'number', default: 1.5 }, // Space between siblings
    orientation: { type: 'string', default: 'top-down' }, // 'top-down', 'left-right'

    // Node appearance
    nodeSize: { type: 'number', default: 0.3 },
    nodeGeometry: { type: 'string', default: 'box' },
    depthColors: { type: 'boolean', default: true }, // Color by depth

    // Interaction
    collapsible: { type: 'boolean', default: true },
    expandToDepth: { type: 'number', default: 2 }, // Initial expansion level
    highlightPath: { type: 'boolean', default: true },

    // Animation
    animateTransitions: { type: 'boolean', default: true },
    animationDuration: { type: 'number', default: 400 }
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);

    this.nodeEntities = new Map();
    this.edgeEntities = [];
    this.expandedNodes = new Set();
    this.nodeData = new Map();

    // Build tree structure
    this.buildTreeStructure();

    // Set initial expansion
    this.setInitialExpansion();

    // Render tree
    this.renderTree();

    // Setup interactions
    this.setupInteractions();

    console.log('[nemosyne-tree-hierarchical] Initialized',
                this.data.nodes.length, 'nodes');
  },

  buildTreeStructure: function() {
    // Index nodes by ID
    this.data.nodes.forEach(node => {
      this.nodeData.set(node.id, {
        ...node,
        children: [],
        parent: null,
        depth: 0
      });
    });

    // Build parent-child relationships
    this.data.edges.forEach(edge => {
      const parent = this.nodeData.get(edge.source);
      const child = this.nodeData.get(edge.target);

      if (parent && child) {
        parent.children.push(child);
        child.parent = parent;
      }
    });

    // Calculate depths
    this.data.nodes.forEach(node => {
      const data = this.nodeData.get(node.id);
      data.depth = this.calculateDepth(data);
    });

    // Find root
    this.root = this.nodeData.get(this.data.rootNode) ||
                Array.from(this.nodeData.values()).find(n => !n.parent);
  },

  calculateDepth: function(node, visited = new Set()) {
    if (!node.parent) return 0;
    if (visited.has(node.id)) return 0; // Cycle detection

    visited.add(node.id);
    return 1 + this.calculateDepth(node.parent, visited);
  },

  setInitialExpansion: function() {
    // Expand nodes up to specified depth
    const expandRecursive = (node, currentDepth) => {
      if (currentDepth <= this.data.expandToDepth) {
        this.expandedNodes.add(node.id);
        node.children.forEach(child =>
          expandRecursive(child, currentDepth + 1));
      }
    };

    if (this.root) {
      expandRecursive(this.root, 0);
    }
  },

  renderTree: function() {
    if (!this.root) return;

    // Clear existing
    this.container.innerHTML = '';
    this.nodeEntities.clear();
    this.edgeEntities = [];

    // Calculate positions based on layout
    const positions = this.calculateLayout();

    // Create edges first (so they're behind nodes)
    this.createEdges(this.root, positions);

    // Create nodes
    this.createNodes(positions);
  },

  calculateLayout: function() {
    const positions = new Map();

    if (this.data.layout === 'orthogonal') {
      this.calculateOrthogonalLayout(this.root, 0, 0, positions);
    } else if (this.data.layout === 'vertical') {
      this.calculateVerticalLayout(this.root, 0, 0, positions);
    } else if (this.data.layout === 'radial') {
      this.calculateRadialLayout(positions);
    }

    return positions;
  },

  calculateOrthogonalLayout: function(node, x, y, positions, siblingIndex = 0) {
    if (!this.isVisible(node)) return;

    const data = this.nodeData.get(node.id);
    const isHorizontal = this.data.orientation === 'left-right';

    // Calculate position
    const pos = isHorizontal
      ? { x: y * this.data.levelSpacing, y: x, z: 0 }
      : { x: x, y: -y * this.data.levelSpacing, z: 0 };

    positions.set(node.id, pos);

    // Calculate children positions
    if (this.isExpanded(node) && data.children.length > 0) {
      const childYStart = y - ((data.children.length - 1) * this.data.siblingSpacing) / 2;

      data.children.forEach((child, i) => {
        this.calculateOrthogonalLayout(
          child,
          isHorizontal ? x + ((i - data.children.length/2) * this.data.siblingSpacing) : pos.x,
          isHorizontal ? y + this.data.levelSpacing : childYStart + (i * this.data.siblingSpacing),
          positions,
          i
        );
      });
    }
  },

  calculateVerticalLayout: function(node, x, y, positions) {
    if (!this.isVisible(node)) return;

    positions.set(node.id, { x, y: -y * this.data.levelSpacing, z: 0 });

    const data = this.nodeData.get(node.id);
    if (this.isExpanded(node) && data.children.length > 0) {
      let childX = x - ((data.children.length - 1) * this.data.siblingSpacing) / 2;

      data.children.forEach(child => {
        this.calculateVerticalLayout(child, childX, y + 1, positions);
        childX += this.data.siblingSpacing;
      });
    }
  },

  calculateRadialLayout: function(positions) {
    // Root at center, children in concentric circles
    const layoutNode = (node, angle, radius, arcSize) => {
      if (!this.isVisible(node)) return;

      const pos = {
        x: radius * Math.cos(angle),
        y: 0,
        z: radius * Math.sin(angle)
      };
      positions.set(node.id, pos);

      const data = this.nodeData.get(node.id);
      if (this.isExpanded(node) && data.children.length > 0) {
        const childArc = arcSize / data.children.length;

        data.children.forEach((child, i) => {
          const childAngle = angle - (arcSize/2) + (childArc * (i + 0.5));
          layoutNode(child, childAngle, radius + this.data.levelSpacing, childArc);
        });
      }
    };

    layoutNode(this.root, 0, 0, Math.PI * 2);
  },

  createNodes: function(positions) {
    this.data.nodes.forEach(node => {
      if (!this.isVisible(node)) return;

      const data = this.nodeData.get(node.id);
      const pos = positions.get(node.id);
      if (!pos) return;

      const entity = document.createElement(`a-${this.data.nodeGeometry}`);

      // Position
      entity.setAttribute('position', pos);

      // Size (decreases with depth)
      const sizeScale = 1 - (data.depth * 0.1);
      const size = this.data.nodeSize * sizeScale;

      if (this.data.nodeGeometry === 'box') {
        entity.setAttribute('width', size);
        entity.setAttribute('height', size * 0.6);
        entity.setAttribute('depth', size);
      } else {
        entity.setAttribute('radius', size / 2);
      }

      // Color based on depth or data
      const color = this.getNodeColor(data);
      entity.setAttribute('material', {
        color: color,
        emissive: color,
        emissiveIntensity: 0.3 + (1 - data.depth * 0.1) * 0.4
      });

      // Label
      if (node.label || node.name) {
        const label = document.createElement('a-text');
        label.setAttribute('value', node.label || node.name);
        label.setAttribute('align', 'center');
        label.setAttribute('color', '#ffffff');
        label.setAttribute('width', 4);
        label.setAttribute('position', { x: 0, y: size + 0.2, z: 0 });
        label.setAttribute('billboard', true);
        entity.appendChild(label);
      }

      // Metadata
      entity.dataset.nodeId = node.id;
      entity.dataset.depth = data.depth;
      entity.nodeData = data;

      // Interaction
      entity.classList.add('clickable');
      this.setupNodeEvents(entity, data);

      // Animation
      if (this.data.animateTransitions) {
        entity.setAttribute('animation__enter', {
          property: 'scale',
          from: '0 0 0',
          to: '1 1 1',
          dur: this.data.animationDuration,
          easing: 'easeOutElastic'
        });
      }

      this.container.appendChild(entity);
      this.nodeEntities.set(node.id, entity);
    });
  },

  createEdges: function(node, positions) {
    if (!this.isExpanded(node)) return;

    const data = this.nodeData.get(node.id);
    const parentPos = positions.get(node.id);

    if (!parentPos) return;

    data.children.forEach(child => {
      if (!this.isVisible(child)) return;

      const childPos = positions.get(child.id);
      if (!childPos) return;

      // Create edge
      const edge = document.createElement('a-entity');

      if (this.data.layout === 'orthogonal') {
        // Elbow connection
        this.createElbowEdge(edge, parentPos, childPos);
      } else {
        // Straight line
        edge.setAttribute('line', {
          start: `${parentPos.x} ${parentPos.y} ${parentPos.z}`,
          end: `${childPos.x} ${childPos.y} ${childPos.z}`,
          color: '#448888',
          opacity: 0.5
        });
      }

      this.container.appendChild(edge);
      this.edgeEntities.push(edge);

      // Recurse to grandchildren
      this.createEdges(child, positions);
    });
  },

  createElbowEdge: function(edge, parentPos, childPos) {
    const isHorizontal = this.data.orientation === 'left-right';

    if (isHorizontal) {
      const midX = (parentPos.x + childPos.x) / 2;

      // Two segments: parent to midpoint x, then to child
      const path = [
        { x: parentPos.x, y: parentPos.y, z: 0 },
        { x: midX, y: parentPos.y, z: 0 },
        { x: midX, y: childPos.y, z: 0 },
        { x: childPos.x, y: childPos.y, z: 0 }
      ];

      this.createPathLine(edge, path);
    } else {
      const midY = (parentPos.y + childPos.y) / 2;

      const path = [
        { x: parentPos.x, y: parentPos.y, z: 0 },
        { x: parentPos.x, y: midY, z: 0 },
        { x: childPos.x, y: midY, z: 0 },
        { x: childPos.x, y: childPos.y, z: 0 }
      ];

      this.createPathLine(edge, path);
    }
  },

  createPathLine: function(container, points) {
    for (let i = 0; i < points.length - 1; i++) {
      const line = document.createElement('a-entity');
      line.setAttribute('line', {
        start: `${points[i].x} ${points[i].y} ${points[i].z}`,
        end: `${points[i+1].x} ${points[i+1].y} ${points[i+1].z}`,
        color: '#448888',
        opacity: 0.5
      });
      container.appendChild(line);
    }
  },

  getNodeColor: function(data) {
    if (!this.data.depthColors) {
      return data.color || '#00d4aa';
    }

    const colors = [
      '#ff6b6b', // Level 0: Red
      '#4ecdc4', // Level 1: Teal
      '#45b7d1', // Level 2: Blue
      '#96ceb4', // Level 3: Green
      '#ffeaa7', // Level 4: Yellow
      '#dfe6e9', // Level 5+: Gray
      '#74b9ff',
      '#a29bfe'
    ];

    return colors[Math.min(data.depth, colors.length - 1)];
  },

  setupNodeEvents: function(entity, data) {
    // Hover
    entity.addEventListener('mouseenter', () => {
      entity.setAttribute('scale', '1.2 1.2 1.2');

      if (this.data.highlightPath) {
        this.highlightPathToRoot(data);
      }
    });

    entity.addEventListener('mouseleave', () => {
      entity.setAttribute('scale', '1 1 1');
      this.clearHighlight();
    });

    // Click to expand/collapse
    entity.addEventListener('click', () => {
      if (this.data.collapsible && data.children.length > 0) {
        this.toggleNode(data);
      }
      this.selectNode(data);
    });
  },

  toggleNode: function(data) {
    if (this.isExpanded(data)) {
      this.expandedNodes.delete(data.id);
    } else {
      this.expandedNodes.add(data.id);
    }

    // Re-render with animation
    this.renderTree();

    this.el.emit('node-toggle', { nodeId: data.id, expanded: this.isExpanded(data) });
  },

  selectNode: function(data) {
    const entity = this.nodeEntities.get(data.id);
    if (entity) {
      entity.setAttribute('animation__select', {
        property: 'material.emissiveIntensity',
        from: 2,
        to: 0.5,
        dur: 500
      });
    }

    this.el.emit('node-select', {
      nodeId: data.id,
      nodeData: data,
      path: this.getPathToRoot(data)
    });
  },

  highlightPathToRoot: function(node) {
    const path = this.getPathToRoot(node);

    path.forEach(nodeId => {
      const entity = this.nodeEntities.get(nodeId);
      if (entity) {
        entity.setAttribute('material', 'emissiveIntensity', 1.5);
      }
    });
  },

  clearHighlight: function() {
    this.nodeEntities.forEach((entity, id) => {
      const data = this.nodeData.get(id);
      entity.setAttribute('material', 'emissiveIntensity', 0.3 + (1 - data.depth * 0.1) * 0.4);
    });
  },

  getPathToRoot: function(node) {
    const path = [node.id];
    let current = node;

    while (current.parent) {
      path.unshift(current.parent.id);
      current = current.parent;
    }

    return path;
  },

  isVisible: function(node) {
    // Visible if no ancestor is collapsed
    let current = this.nodeData.get(node.id);

    while (current.parent) {
      if (!this.isExpanded(current.parent)) {
        return false;
      }
      current = current.parent;
    }

    return true;
  },

  isExpanded: function(node) {
    return this.expandedNodes.has(node.id);
  },

  expandAll: function() {
    this.data.nodes.forEach(node => this.expandedNodes.add(node.id));
    this.renderTree();
  },

  collapseAll: function() {
    this.expandedNodes.clear();
    if (this.root) this.expandedNodes.add(this.root.id);
    this.renderTree();
  },

  remove: function() {
    this.container.innerHTML = '';
  }
});


console.log('[nemosyne-tree-hierarchical] Component registered');
