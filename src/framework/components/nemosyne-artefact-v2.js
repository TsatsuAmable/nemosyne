/**
 * Nemosyne Artefact Component v0.2
 * Stabilized API with layout engine and connector support
 */

import { ArtefactBuilder } from './artefact-builder.js';
import { DataLoader } from '../utils/data-loader.js';
import { layoutEngine } from '../layouts/layout-engine.js';
import { validateSpec, validateData } from '../utils/validator.js';

export const NemosyneArtefactV2 = {
  schema: {
    // Primary configuration
    src: { type: 'string', default: '' },      // URL to artefact spec
    data: { type: 'string', default: '' },      // URL to data
    
    // Inline configuration (alternative to src/data)
    spec: { type: 'string', default: '' },      // JSON string or object
    dataset: { type: 'string', default: '' },   // JSON string or object
    
    // Layout configuration
    layout: { type: 'string', default: 'grid' },// grid, radial, timeline, spiral, tree, force
    'layout-options': { type: 'string', default: '{}' }, // JSON string of options
    
    // Rendering options
    animate: { type: 'boolean', default: true },
    'entry-duration': { type: 'number', default: 800 },
    
    // Interactions
    interactive: { type: 'boolean', default: true },
    
    // Debug
    debug: { type: 'boolean', default: false }
  },

  init: function() {
    this.artefacts = [];
    this.connectors = [];
    this.isLoaded = false;
    
    // Parse layout options
    try {
      this.layoutOptions = JSON.parse(this.data['layout-options']);
    } catch(e) {
      this.layoutOptions = {};
    }
    
    this.loadConfiguration();
  },

  loadConfiguration: async function() {
    try {
      // Load spec
      let spec = await this.loadSpec();
      
      // Load data
      let dataset = await this.loadData();
      
      // Validate
      if (this.debug) {
        validateSpec(spec);
        validateData(dataset);
      }
      
      // Extract records
      const records = this.extractRecords(dataset);
      
      // Calculate positions using layout engine
      const positions = layoutEngine.calculate(
        this.data.layout,
        records,
        this.layoutOptions
      );
      
      // Build artefacts
      await this.buildArtefacts(spec, records, positions);
      
      // Set up connections if specified
      await this.setupConnections(spec, records);
      
      this.isLoaded = true;
      this.el.emit('nemosyne-loaded', { 
        count: this.artefacts.length,
        layout: this.data.layout 
      });
      
    } catch (error) {
      console.error('Nemosyne: Error loading configuration:', error);
      this.showError(error.message);
      this.el.emit('nemosyne-error', { error: error.message });
    }
  },

  loadSpec: async function() {
    if (this.data.spec) {
      try {
        return JSON.parse(this.data.spec);
      } catch(e) {
        throw new Error('Invalid JSON in spec: ' + e.message);
      }
    }
    
    if (this.data.src) {
      return await DataLoader.loadJSON(this.data.src);
    }
    
    // Default spec
    return {
      id: 'default',
      geometry: { type: 'octahedron', radius: 1 },
      material: { properties: { color: '#00d4aa' } }
    };
  },

  loadData: async function() {
    if (this.data.dataset) {
      try {
        return JSON.parse(this.data.dataset);
      } catch(e) {
        throw new Error('Invalid JSON in dataset: ' + e.message);
      }
    }
    
    if (this.data.data) {
      return await DataLoader.loadJSON(this.data.data);
    }
    
    // Default data
    return { records: [{ value: 42, label: 'Default' }] };
  },

  extractRecords: function(dataset) {
    return dataset.records || 
           dataset.nodes || 
           dataset.data || 
           (Array.isArray(dataset) ? dataset : [dataset]);
  },

  buildArtefacts: function(spec, records, positions) {
    const builder = new ArtefactBuilder();
    
    records.forEach((record, i) => {
      const position = positions[i] || { x: 0, y: 0, z: 0 };
      
      const artefact = builder.build(spec, record, position, this.el);
      
      // Store original data on element for connectors
      artefact.el.dataset.artefactId = record.id || i;
      
      this.artefacts.push(artefact);
    });
  },

  setupConnections: function(spec, records) {
    // Auto-connect based on data relationships
    if (spec.connections === 'auto' && records.some(r => r.parent)) {
      this.createParentChildConnections(records);
    }
    
    // Explicit connections from spec
    if (spec.edges && Array.isArray(spec.edges)) {
      spec.edges.forEach(edge => {
        this.createExplicitConnection(edge);
      });
    }
  },

  createParentChildConnections: function(records) {
    records.forEach(record => {
      if (record.parent) {
        const parentIndex = records.findIndex(r => r.id === record.parent);
        const childIndex = records.findIndex(r => r.id === record.id);
        
        if (parentIndex >= 0 && childIndex >= 0) {
          const parentEl = this.artefacts[parentIndex]?.el;
          const childEl = this.artefacts[childIndex]?.el;
          
          if (parentEl && childEl) {
            this.createConnector(parentEl, childEl);
          }
        }
      }
    });
  },

  createExplicitConnection: function(edgeSpec) {
    const fromIndex = this.artefacts.findIndex(a => 
      a.data.id === edgeSpec.from || a.data.id === edgeSpec.source
    );
    const toIndex = this.artefacts.findIndex(a => 
      a.data.id === edgeSpec.to || a.data.id === edgeSpec.target
    );
    
    if (fromIndex >= 0 && toIndex >= 0) {
      this.createConnector(
        this.artefacts[fromIndex].el,
        this.artefacts[toIndex].el,
        edgeSpec.style || {}
      );
    }
  },

  createConnector: function(fromEl, toEl, style = {}) {
    const connector = document.createElement('a-entity');
    connector.setAttribute('nemosyne-connector', {
      from: fromEl,
      to: toEl,
      color: style.color || '#00d4aa',
      thickness: style.thickness || 0.03,
      opacity: style.opacity || 0.4,
      animated: style.animated || false,
      pulse: style.pulse || false
    });
    
    this.el.appendChild(connector);
    this.connectors.push(connector);
  },

  showError: function(message) {
    const errorEl = document.createElement('a-text');
    errorEl.setAttribute('value', `Nemosyne Error: ${message}`);
    errorEl.setAttribute('color', '#ff3864');
    errorEl.setAttribute('align', 'center');
    errorEl.setAttribute('position', '0 2 0');
    errorEl.setAttribute('scale', '0.8 0.8 0.8');
    this.el.appendChild(errorEl);
  },

  remove: function() {
    this.artefacts.forEach(a => {
      if (a.el?.parentNode) a.el.parentNode.removeChild(a.el);
    });
    this.connectors.forEach(c => {
      if (c.parentNode) c.parentNode.removeChild(c);
    });
    this.artefacts = [];
    this.connectors = [];
  }
};
