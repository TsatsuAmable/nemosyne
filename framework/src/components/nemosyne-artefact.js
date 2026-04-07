/**
 * Nemosyne Artefact Component
 * Main A-Frame component for rendering data as VR artefacts
 */

import { ArtefactBuilder } from './artefact-builder.js';
import { DataLoader } from '../utils/data-loader.js';

export const NemosyneArtefact = {
  schema: {
    // Source URLs or inline objects
    spec: { type: 'string', default: '' },      // Artefact specification JSON
    data: { type: 'string', default: '' },      // Data source
    
    // Inline configurations (alternative to URLs)
    specInline: { type: 'string', default: '' }, // JSON string
    dataInline: { type: 'string', default: '' },// JSON string
    
    // Layout/position
    layout: { type: 'string', default: 'default' }, // force-directed, grid, radial, timeline
    
    // Animation
    animateEntry: { type: 'boolean', default: true },
    entryDuration: { type: 'number', default: 1000 },
    
    // Interactions
    hoverable: { type: 'boolean', default: true },
    clickable: { type: 'boolean', default: true },
    draggable: { type: 'boolean', default: false }
  },

  init: function() {
    this.artefactBuilder = new ArtefactBuilder();
    this.artefacts = [];
    this.isLoaded = false;
    
    // Load spec and data
    this.loadConfiguration();
  },

  loadConfiguration: async function() {
    try {
      // Load spec
      let spec;
      if (this.data.specInline) {
        spec = JSON.parse(this.data.specInline);
      } else if (this.data.spec) {
        spec = await DataLoader.loadJSON(this.data.spec);
      } else {
        throw new Error('Nemosyne: No artefact specification provided');
      }
      
      // Load data
      let data;
      if (this.data.dataInline) {
        data = JSON.parse(this.data.dataInline);
      } else if (this.data.data) {
        data = await DataLoader.loadJSON(this.data.data);
      } else {
        data = { records: [] };
      }
      
      // Build artefacts
      await this.buildArtefacts(spec, data);
      
    } catch (error) {
      console.error('Nemosyne: Error loading configuration:', error);
      this.showError(error.message);
    }
  },

  buildArtefacts: async function(spec, data) {
    const records = data.records || data.nodes || data.data || [];
    
    // Apply layout to get positions
    const positions = this.calculateLayout(records, spec);
    
    // Create artefact for each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const position = positions[i] || { x: 0, y: 0, z: 0 };
      
      const artefact = this.artefactBuilder.build(spec, record, position, this.el);
      this.artefacts.push(artefact);
    }
    
    // If no records but we have spec, create a single demo artefact
    if (records.length === 0) {
      const demoRecord = { value: 42, label: 'Demo', category: 'default' };
      const artefact = this.artefactBuilder.build(spec, demoRecord, { x: 0, y: 0, z: 0 }, this.el);
      this.artefacts.push(artefact);
    }
    
    this.isLoaded = true;
    
    // Emit load event
    this.el.emit('nemosyne-loaded', { count: this.artefacts.length });
  },

  calculateLayout: function(records, spec) {
    const layout = this.data.layout;
    const count = records.length || 1;
    const positions = [];
    
    switch (layout) {
      case 'grid':
        const cols = Math.ceil(Math.sqrt(count));
        for (let i = 0; i < count; i++) {
          positions.push({
            x: (i % cols - cols / 2) * 3,
            y: Math.floor(i / cols) * -3,
            z: 0
          });
        }
        break;
        
      case 'radial':
        const radius = 5;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          positions.push({
            x: Math.cos(angle) * radius,
            y: 0,
            z: Math.sin(angle) * radius
          });
        }
        break;
        
      case 'timeline':
        const spacing = 3;
        for (let i = 0; i < count; i++) {
          positions.push({
            x: (i - count / 2) * spacing,
            y: 0,
            z: 0
          });
        }
        break;
        
      case 'force-directed':
        // Simplified: random positions for now
        for (let i = 0; i < count; i++) {
          positions.push({
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 5,
            z: (Math.random() - 0.5) * 10
          });
        }
        break;
        
      default:
        // Single or stacked
        for (let i = 0; i < count; i++) {
          positions.push({ x: 0, y: i * 2, z: 0 });
        }
    }
    
    return positions;
  },

  showError: function(message) {
    // Create error visualization
    const errorEl = document.createElement('a-text');
    errorEl.setAttribute('value', `Error: ${message}`);
    errorEl.setAttribute('color', '#ff3864');
    errorEl.setAttribute('align', 'center');
    errorEl.setAttribute('position', '0 2 0');
    this.el.appendChild(errorEl);
  },

  remove: function() {
    // Clean up artefacts
    this.artefacts.forEach(artefact => {
      if (artefact.el && artefact.el.parentNode) {
        artefact.el.parentNode.removeChild(artefact.el);
      }
    });
    this.artefacts = [];
  }
};
