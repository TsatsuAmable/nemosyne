/**
 * nemosyne-grid-categorical: Grid Layout for Categorical Data
 *
 * Renders categorical data in a grid/trellis layout.
 * Useful for file browsers, image galleries, categorized datasets.
 *
 * Features:
 * - Grid layout by category or uniform
 * - Sortable by value/count/size
 * - Expand category to detailed view
 * - Hover previews for items
 * - Count/size badges per category
 * - Pagination for large datasets
 */

AFRAME.registerComponent('nemosyne-grid-categorical', {
  schema: {
    // Data
    items: { type: 'array', default: [] }, // Array of items
    categoryField: { type: 'string', default: 'category' }, // Field to group by

    // Layout
    layout: { type: 'string', default: 'categorical' }, // 'categorical', 'uniform'
    itemsPerRow: { type: 'number', default: 5 },
    itemSpacing: { type: 'number', default: 0.8 },
    categorySpacing: { type: 'number', default: 2 },

    // Item appearance
    itemSize: { type: 'number', default: 0.5 },
    itemGeometry: { type: 'string', default: 'box' },
    colorBy: { type: 'string', default: 'category' },

    // Category headers
    showHeaders: { type: 'boolean', default: true },
    headerHeight: { type: 'number', default: 0.3 },

    // Interaction
    expandable: { type: 'boolean', default: true },
    sortBy: { type: 'string', default: 'count' }, // 'count', 'value', 'name'
    sortOrder: { type: 'string', default: 'desc' }, // 'asc', 'desc'

    // Animation
    animateEntrance: { type: 'boolean', default: true },
    animateSort: { type: 'boolean', default: true }
  },

  init: function() {
    this.container = document.createElement('a-entity');
    this.el.appendChild(this.container);

    this.itemEntities = new Map();
    this.categoryEntities = new Map();
    this.expandedCategory = null;

    // Group items by category
    this.groupByCategory();

    // Sort categories
    this.sortCategories();

    // Render
    this.renderGrid();

    // Setup interactions
    this.setupInteractions();

    console.log('[nemosyne-grid-categorical] Initialized',
                this.itemsByCategory.size, 'categories');
  },

  groupByCategory: function() {
    this.itemsByCategory = new Map();

    this.data.items.forEach(item => {
      const category = item[this.data.categoryField] || 'Uncategorized';

      if (!this.itemsByCategory.has(category)) {
        this.itemsByCategory.set(category, {
          name: category,
          items: [],
          totalValue: 0,
          itemCount: 0
        });
      }

      const cat = this.itemsByCategory.get(category);
      cat.items.push(item);
      cat.itemCount++;
      cat.totalValue += item.value || 0;
    });
  },

  sortCategories: function() {
    this.sortedCategories = Array.from(this.itemsByCategory.values());

    this.sortedCategories.sort((a, b) => {
      let comparison = 0;

      switch (this.data.sortBy) {
        case 'count':
          comparison = a.itemCount - b.itemCount;
          break;
        case 'value':
          comparison = a.totalValue - b.totalValue;
          break;
        case 'name':
        default:
          comparison = a.name.localeCompare(b.name);
          break;
      }

      return this.data.sortOrder === 'desc' ? -comparison : comparison;
    });
  },

  renderGrid: function() {
    let yOffset = 0;

    this.sortedCategories.forEach((category, catIndex) => {
      // Category header
      if (this.data.showHeaders) {
        this.createCategoryHeader(category, yOffset, catIndex);
        yOffset -= this.data.headerHeight + 0.2;
      }

      // Category grid
      this.createCategoryGrid(category, yOffset, catIndex);

      // Calculate next Y position
      const rows = Math.ceil(category.items.length / this.data.itemsPerRow);
      yOffset -= (rows * this.data.itemSpacing) + this.data.categorySpacing;
    });
  },

  createCategoryHeader: function(category, y, index) {
    const header = document.createElement('a-entity');

    // Background
    const bg = document.createElement('a-plane');
    bg.setAttribute('width', this.data.itemsPerRow * this.data.itemSpacing);
    bg.setAttribute('height', this.data.headerHeight);
    bg.setAttribute('color', '#1a1a2e');
    bg.setAttribute('material', { opacity: 0.8, transparent: true });
    header.appendChild(bg);

    // Category name
    const label = document.createElement('a-text');
    label.setAttribute('value', `${category.name} (${category.itemCount})`);
    label.setAttribute('align', 'left');
    label.setAttribute('color', '#00d4aa');
    label.setAttribute('width', 6);
    label.setAttribute('position', {
      x: -(this.data.itemsPerRow * this.data.itemSpacing) / 2 + 0.1,
      y: 0,
      z: 0.1
    });
    header.appendChild(label);

    // Position
    header.setAttribute('position', {
      x: 0,
      y: y,
      z: 0
    });

    // Interaction
    if (this.data.expandable) {
      header.classList.add('clickable');
      header.addEventListener('click', () => {
        this.toggleCategory(category.name);
      });
    }

    this.container.appendChild(header);
    this.categoryEntities.set(category.name, header);
  },

  createCategoryGrid: function(category, startY, catIndex) {
    const cols = this.data.itemsPerRow;
    const spacing = this.data.itemSpacing;
    const totalWidth = cols * spacing;
    const startX = -totalWidth / 2 + spacing / 2;

    category.items.forEach((item, itemIndex) => {
      const col = itemIndex % cols;
      const row = Math.floor(itemIndex / cols);

      const x = startX + col * spacing;
      const y = startY - row * spacing;

      this.createGridItem(item, x, y, catIndex * 100 + itemIndex);
    });
  },

  createGridItem: function(item, x, y, index) {
    const entity = document.createElement(`a-${this.data.itemGeometry}`);

    // Position
    entity.setAttribute('position', { x, y, z: 0 });

    // Size
    const size = this.data.itemSize * (item.scale || 1);
    if (this.data.itemGeometry === 'box') {
      entity.setAttribute('width', size);
      entity.setAttribute('height', size);
      entity.setAttribute('depth', size * 0.5);
    } else {
      entity.setAttribute('radius', size / 2);
    }

    // Color
    const color = this.getItemColor(item);
    entity.setAttribute('material', {
      color: color,
      emissive: color,
      emissiveIntensity: 0.3
    });

    // Label (if item has name)
    if (item.name || item.label) {
      const label = document.createElement('a-text');
      label.setAttribute('value', item.name || item.label);
      label.setAttribute('align', 'center');
      label.setAttribute('color', '#ffffff');
      label.setAttribute('width', 2);
      label.setAttribute('position', { x: 0, y: -size / 2 - 0.15, z: 0 });
      label.setAttribute('billboard', true);
      entity.appendChild(label);
    }

    // Metadata
    entity.dataset.itemId = item.id;
    entity.itemData = item;
    entity.classList.add('clickable');

    // Events
    this.setupItemEvents(entity, item);

    // Animation
    if (this.data.animateEntrance) {
      entity.setAttribute('visible', false);
      setTimeout(() => {
        entity.setAttribute('visible', true);
        entity.setAttribute('animation__enter', {
          property: 'scale',
          from: '0 0 0',
          to: '1 1 1',
          dur: 300,
          easing: 'easeOutElastic'
        });
      }, index * 10);
    }

    this.container.appendChild(entity);
    this.itemEntities.set(item.id, entity);
  },

  getItemColor: function(item) {
    switch (this.data.colorBy) {
      case 'category':
        return this.hashToColor(item[this.data.categoryField] || 'default');
      case 'value':
        if (item.value) {
          const maxVal = Math.max(...this.data.items.map(i => i.value || 0));
          const t = (item.value / maxVal) || 0;
          return this.interpolateColor('#4477ff', '#ff4444', t);
        }
        return '#888888';
      default:
        return item.color || '#00d4aa';
    }
  },

  setupItemEvents: function(entity, item) {
    entity.addEventListener('mouseenter', () => {
      entity.setAttribute('scale', '1.2 1.2 1.2');
    });

    entity.addEventListener('mouseleave', () => {
      entity.setAttribute('scale', '1 1 1');
    });

    entity.addEventListener('click', () => {
      this.selectItem(item, entity);
    });
  },

  toggleCategory: function(categoryName) {
    // Collapse/expand logic would go here
    // For now, emit event
    this.el.emit('category-toggle', { category: categoryName });
  },

  selectItem: function(item, entity) {
    entity.setAttribute('animation__select', {
      property: 'material.emissiveIntensity',
      from: 2,
      to: 0.3,
      dur: 500
    });

    this.el.emit('item-select', { item });
  },

  hashToColor: function(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  },

  interpolateColor: function(c1, c2, t) {
    const r1 = parseInt(c1.substr(1, 2), 16);
    const g1 = parseInt(c1.substr(3, 2), 16);
    const b1 = parseInt(c1.substr(5, 2), 16);
    const r2 = parseInt(c2.substr(1, 2), 16);
    const g2 = parseInt(c2.substr(3, 2), 16);
    const b2 = parseInt(c2.substr(5, 2), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  },

  sortItems: function(sortBy) {
    this.data.sortBy = sortBy;
    this.sortCategories();
    this.renderGrid();
  },

  remove: function() {
    this.container.innerHTML = '';
  }
});


console.log('[nemosyne-grid-categorical] Component registered');
