/**
 * nemosyne-artefact-v2: Unified Data Visualization Component
 * 
 * The main public API component as documented in README.
 * Wraps topology-specific implementations with a unified interface.
 * 
 * Usage:
 * <a-entity nemosyne-artefact-v2="
 *   spec: { id: 'demo', geometry: {...}, material: {...} };
 *   dataset: { records: [...] };
 *   layout: grid
 * "></a-entity>
 */

import { DataNativeEngine } from '../core/DataNativeEngine.js';
import { LayoutEngine } from '../core/LayoutEngine.js';
import { PropertyMapper } from '../core/PropertyMapper.js';
import { TransformDSL } from '../core/TransformDSL.js';

AFRAME.registerComponent('nemosyne-artefact-v2', {
  schema: {
    // Configuration
    spec: { type: 'string', default: '{}' },
    dataset: { type: 'string', default: '{}' },
    layout: { type: 'string', default: 'grid' },
    'layout-options': { type: 'string', default: '{}' },
    
    // Behavior
    animate: { type: 'boolean', default: true },
    'entry-duration': { type: 'number', default: 800 },
    interactive: { type: 'boolean', default: true },
    debug: { type: 'boolean', default: false }
  },

  init: function() {
    this.engine = new DataNativeEngine();
    this.layoutEngine = new LayoutEngine();
    this.mapper = new PropertyMapper();
    this.artefacts = [];
    
    this.loadData();
  },

  loadData: async function() {
    try {
      const spec = JSON.parse(this.data.spec);
      const dataset = JSON.parse(this.data.dataset);
      const layoutOptions = JSON.parse(this.data['layout-options']);
      
      // Process data through engine
      const packets = await this.engine.ingest(dataset.records || dataset);
      
      // Calculate layout positions
      const positions = this.layoutEngine.calculatePositions(
        packets,
        this.data.layout
      );
      
      // Build visual artefacts
      packets.forEach((packet, i) => {
        const pos = positions.get(packet.id);
        const artefact = this.buildArtefact(spec, packet, pos);
        this.el.appendChild(artefact);
        this.artefacts.push(artefact);
      });
      
      // Emit loaded event
      this.el.emit('nemosyne-loaded', { 
        count: this.artefacts.length,
        layout: this.data.layout 
      });
      
    } catch (error) {
      console.error('[nemosyne-artefact-v2] Error:', error);
      this.el.emit('nemosyne-error', { error: error.message });
    }
  },

  buildArtefact: function(spec, packet, position) {
    const entity = document.createElement('a-entity');
    
    // Apply layout position
    entity.setAttribute('position', position);
    
    // Apply geometry
    if (spec.geometry) {
      const geoType = spec.geometry.type || 'box';
      const primitive = this.mapGeometryType(geoType);
      entity.setAttribute(primitive, spec.geometry);
    }
    
    // Apply material through PropertyMapper
    const material = this.mapper.map(packet);
    entity.setAttribute('material', material);
    
    // Apply transforms if present
    if (spec.transform) {
      this.applyTransforms(entity, spec.transform, packet);
    }
    
    // Animate entrance
    if (this.data.animate) {
      entity.setAttribute('animation__entry', {
        property: 'scale',
        from: '0 0 0',
        to: '1 1 1',
        dur: this.data['entry-duration'],
        easing: 'easeOutElastic'
      });
    }
    
    // Setup interactions
    if (this.data.interactive && spec.behaviours) {
      this.setupBehaviours(entity, spec.behaviours, packet);
    }
    
    return entity;
  },

  mapGeometryType: function(type) {
    const mapping = {
      'sphere': 'a-sphere',
      'box': 'a-box',
      'cylinder': 'a-cylinder',
      'octahedron': 'a-octahedron',
      'tetrahedron': 'a-tetrahedron',
      'dodecahedron': 'a-dodecahedron',
      'icosahedron': 'a-icosahedron',
      'torus': 'a-torus',
      'plane': 'a-plane',
      'circle': 'a-circle'
    };
    return mapping[type] || 'a-box';
  },

  applyTransforms: function(entity, transform, packet) {
    // Handle TransformDSL transforms
    if (transform.scale) {
      const scale = TransformDSL.executeTransform(transform.scale, packet);
      entity.setAttribute('scale', `${scale} ${scale} ${scale}`);
    }
    
    if (transform.rotation) {
      const rot = TransformDSL.executeTransform(transform.rotation, packet);
      entity.setAttribute('rotation', `${rot.x} ${rot.y} ${rot.z}`);
    }
    
    if (transform.color) {
      const color = TransformDSL.executeTransform(transform.color, packet);
      entity.setAttribute('material', 'color', color);
    }
  },

  setupBehaviours: function(entity, behaviours, packet) {
    behaviours.forEach(behaviour => {
      switch (behaviour.trigger) {
        case 'hover':
          entity.addEventListener('mouseenter', () => {
            this.executeBehaviour(entity, behaviour.action, behaviour.params);
          });
          break;
        case 'click':
          entity.addEventListener('click', () => {
            this.executeBehaviour(entity, behaviour.action, behaviour.params);
          });
          break;
        case 'idle':
          if (behaviour.action === 'rotate') {
            entity.setAttribute('animation__idle', {
              property: 'rotation',
              to: '0 360 0',
              loop: true,
              dur: 10000 / (behaviour.params?.speed || 0.5),
              easing: 'linear'
            });
          }
          break;
      }
    });
  },

  executeBehaviour: function(entity, action, params) {
    switch (action) {
      case 'glow':
        entity.setAttribute('animation__glow', {
          property: 'material.emissiveIntensity',
          to: params?.intensity || 2,
          dur: 300,
          easing: 'easeInOutQuad'
        });
        break;
      case 'scale':
        const factor = params?.factor || 1.2;
        entity.setAttribute('animation__scale', {
          property: 'scale',
          to: `${factor} ${factor} ${factor}`,
          dur: 200,
          easing: 'easeOutElastic'
        });
        break;
    }
  },

  remove: function() {
    this.artefacts.forEach(artefact => {
      if (artefact.parentNode) {
        artefact.parentNode.removeChild(artefact);
      }
    });
  }
});

console.log('[nemosyne-artefact-v2] Component registered');
