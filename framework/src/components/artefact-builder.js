/**
 * ArtefactBuilder
 * Constructs 3D entities from specification and data
 */

import { MaterialFactory } from '../utils/material-factory.js';
import { TransformEngine } from '../transforms/transform-engine.js';
import { BehaviourEngine } from '../behaviours/behaviour-engine.js';

export class ArtefactBuilder {
  constructor() {
    this.materialFactory = new MaterialFactory();
    this.transformEngine = new TransformEngine();
    this.behaviourEngine = new BehaviourEngine();
  }

  /**
   * Build an artefact from specification and data
   * @param {Object} spec - Artefact specification
   * @param {Object} data - Data record
   * @param {Object} position - {x, y, z} position
   * @param {Element} container - Container element
   * @returns {Object} Built artefact with entity and handlers
   */
  build(spec, data, position, container) {
    // Create wrapper entity
    const wrapper = document.createElement('a-entity');
    wrapper.setAttribute('position', position);
    
    // Extract transforms from spec and data
    const transforms = this.transformEngine.extractTransforms(spec.transform, data);
    
    // Create geometry based on spec
    const geometryEl = this.createGeometry(spec.geometry, spec.material, data, transforms);
    
    // Create visual elements
    const visual = document.createElement('a-entity');
    visual.appendChild(geometryEl);
    
    // Add glow effect if specified
    if (spec.material?.properties?.emissive) {
      const glow = this.createGlow(spec.material.properties.emissive, transforms?.scale || 1);
      visual.appendChild(glow);
    }
    
    wrapper.appendChild(visual);
    
    // Add label if specified
    if (spec.labels) {
      const label = this.createLabel(spec.labels, data);
      if (label) wrapper.appendChild(label);
    }
    
    // Setup behaviours
    const behaviours = this.behaviourEngine.setup(wrapper, spec.behaviours, data);
    
    // Add to container
    container.appendChild(wrapper);
    
    // Apply animations
    this.applyAnimations(wrapper, transforms, spec.behaviours);
    
    return {
      el: wrapper,
      geometry: geometryEl,
      behaviours: behaviours,
      data: data,
      spec: spec
    };
  }

  /**
   * Create the main geometry entity
   */
  createGeometry(geometrySpec, materialSpec, data, transforms) {
    const type = geometrySpec?.type || 'octahedron';
    const radius = geometrySpec?.radius || 1;
    
    // Map geometry types to A-Frame primitives
    const primitiveMap = {
      'sphere': 'a-sphere',
      'box': 'a-box',
      'cylinder': 'a-cylinder',
      'octahedron': 'a-octahedron',
      'tetrahedron': 'a-tetrahedron',
      'dodecahedron': 'a-dodecahedron',
      'icosahedron': 'a-icosahedron',
      'torus': 'a-torus',
      'torusKnot': 'a-torus-knot',
      'plane': 'a-plane',
      'circle': 'a-circle',
      'ring': 'a-ring'
    };
    
    const primitive = primitiveMap[type] || 'a-octahedron';
    const el = document.createElement(primitive);
    
    // Set geometry attributes
    switch (type) {
      case 'sphere':
        el.setAttribute('radius', (transforms?.scale || 1) * radius);
        break;
      case 'box':
        const s = (transforms?.scale || 1) * radius;
        el.setAttribute('width', s * 1.5);
        el.setAttribute('height', s * 1.5);
        el.setAttribute('depth', s * 1.5);
        break;
      case 'cylinder':
        el.setAttribute('radius', radius * 0.5);
        el.setAttribute('height', (transforms?.scale || 1) * radius * 2);
        break;
      case 'octahedron':
        el.setAttribute('radius', (transforms?.scale || 1) * radius);
        break;
      default:
        el.setAttribute('radius', (transforms?.scale || 1) * radius);
    }
    
    // Apply material
    const material = this.materialFactory.create(materialSpec, data);
    el.setAttribute('material', material);
    
    // Apply rotation transforms
    if (transforms?.rotation) {
      el.setAttribute('rotation', transforms.rotation);
    }
    
    return el;
  }

  /**
   * Create glow effect entity
   */
  createGlow(emissiveColor, baseScale) {
    const glow = document.createElement('a-sphere');
    const glowScale = baseScale * 1.3;
    
    glow.setAttribute('radius', glowScale);
    glow.setAttribute('material', {
      color: emissiveColor,
      transparent: true,
      opacity: 0.15,
      emissive: emissiveColor,
      emissiveIntensity: 0.3
    });
    
    // Add idle pulse animation
    glow.setAttribute('animation', {
      property: 'scale',
      dir: 'alternate',
      to: `${glowScale * 1.1} ${glowScale * 1.1} ${glowScale * 1.1}`,
      dur: 2000,
      loop: true,
      easing: 'easeInOutSine'
    });
    
    return glow;
  }

  /**
   * Create label entity
   */
  createLabel(labelSpec, data) {
    if (!labelSpec.primary) return null;
    
    const text = this.resolveLabelContent(labelSpec.primary, data);
    
    const label = document.createElement('a-text');
    label.setAttribute('value', text);
    label.setAttribute('color', labelSpec.color || '#d4af37');
    label.setAttribute('align', 'center');
    label.setAttribute('width', labelSpec.width || 6);
    label.setAttribute('position', this.getLabelPosition(labelSpec.position));
    
    // Support visibility based on trigger
    if (labelSpec.visible?.$trigger === 'click') {
      label.setAttribute('visible', false);
    }
    
    return label;
  }

  /**
   * Resolve label content from data
   */
  resolveLabelContent(labelSpec, data) {
    if (typeof labelSpec === 'string') {
      return labelSpec;
    }
    
    if (labelSpec.$data) {
      return data[labelSpec.$data] || '';
    }
    
    if (labelSpec.$template) {
      let template = labelSpec.$template;
      // Simple template replacement
      template = template.replace(/{(\w+)}/g, (match, key) => data[key] || match);
      return template;
    }
    
    return '';
  }

  /**
   * Get label position relative to artefact
   */
  getLabelPosition(position) {
    const positions = {
      'above': '0 2 0',
      'below': '0 -1.5 0',
      'front': '0 0 1.5',
      'center': '0 0 0'
    };
    return positions[position] || positions['above'];
  }

  /**
   * Apply animations to entity
   */
  applyAnimations(entity, transforms, behaviours) {
    // Rotation animation from idle behaviour
    const idleBehaviour = behaviours?.find(b => b?.trigger === 'idle');
    if (idleBehaviour && idleBehaviour.action === 'rotate') {
      const speed = idleBehaviour.params?.speed || 0.5;
      const axis = idleBehaviour.params?.axis || 'y';
      
      const rotationProperty = axis === 'x' ? `360 0 0` :
                               axis === 'y' ? `0 360 0` :
                               `0 0 360`;
      
      entity.setAttribute('animation', {
        property: 'rotation',
        to: rotationProperty,
        loop: true,
        dur: 10000 / speed,
        easing: 'linear'
      });
    }
    
    // Entry animation
    entity.setAttribute('animation__entry', {
      property: 'scale',
      from: '0 0 0',
      to: '1 1 1',
      dur: 1000,
      easing: 'easeOutElastic'
    });
  }
}
