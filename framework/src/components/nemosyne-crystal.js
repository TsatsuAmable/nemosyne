/**
 * Nemosyne Crystal v1.0
 * The foundational atomic unit of Nemosyne
 * 
 * Merges A-Frame (VR rendering) with D3.js (data transformation)
 * into a first-class, extensible, reactive VR data artefact.
 */

import * as d3 from 'd3-scale';
import * as d3Color from 'd3-color';
import * as d3Interpolate from 'd3-interpolate';

/**
 * Behaviour Base Class
 * All behaviours extend this
 */
class CrystalBehaviour {
  constructor(crystal) {
    this.crystal = crystal;
    this.el = crystal.el;
    this.isActive = false;
  }
  
  init() {}
  attach() {}
  detach() {}
  tick(time, delta) {}
}

/**
 * Built-in Behaviours
 */

class HoverBehaviour extends CrystalBehaviour {
  attach() {
    this.el.addEventListener('mouseenter', () => this.onEnter());
    this.el.addEventListener('mouseleave', () => this.onLeave());
  }
  
  onEnter() {
    this.crystal.setData('isHovered', true);
    this.crystal.setVisual('emissiveIntensity', 2.0);
    this.crystal.emit('hover', { element: this.el });
  }
  
  onLeave() {
    this.crystal.setData('isHovered', false);
    this.crystal.setVisual('emissiveIntensity', this.crystal.data.baseEmissiveIntensity);
    this.crystal.emit('hover-end', { element: this.el });
  }
}

class ClickBehaviour extends CrystalBehaviour {
  attach() {
    this.el.addEventListener('click', () => this.onClick());
  }
  
  onClick() {
    this.crystal.setData('isSelected', !this.crystal.data.isSelected);
    
    // Scale animation
    const targetScale = this.crystal.data.isSelected ? 1.3 : 1.0;
    this.crystal.animate('scale', targetScale, { dur: 200 });
    
    // Show label
    this.crystal.showLabel();
    
    this.crystal.emit('click', { 
      element: this.el,
      value: this.crystal.data.value,
      isSelected: this.crystal.data.isSelected
    });
  }
}

class IdleBehaviour extends CrystalBehaviour {
  init() {
    this.baseY = this.el.getAttribute('position').y;
  }
  
  tick(time, delta) {
    const data = this.crystal.data;
    
    // Auto-rotation
    if (data.autoRotate) {
      const currentRot = this.el.getAttribute('rotation');
      currentRot.y += data.rotateSpeed * (delta / 1000);
      this.el.setAttribute('rotation', currentRot);
    }
    
    // Floating bob
    if (data.float) {
      const bob = Math.sin(time * 0.001 * data.floatSpeed) * data.floatAmplitude;
      const pos = this.el.getAttribute('position');
      pos.y = this.baseY + bob;
      this.el.setAttribute('position', pos);
    }
  }
}

class DataChangeBehaviour extends CrystalBehaviour {
  onDataChange(oldValue, newValue) {
    const crystal = this.crystal;
    
    // Calculate new visual properties using D3
    const newColor = this.getColorForValue(newValue);
    const newScale = this.getScaleForValue(newValue);
    
    // Apply with animation
    crystal.animate('scale', newScale, { dur: 300, easing: 'easeOutElastic' });
    crystal.animate('color', newColor, { dur: 300 });
    
    crystal.emit('data-change', { oldValue, newValue });
  }
  
  getColorForValue(value) {
    const crystal = this.crystal;
    const scaleName = crystal.data.colourScale;
    
    switch(scaleName) {
      case 'viridis':
        return crystal.scales.viridis(value);
      case 'category10':
        return crystal.scales.category(value);
      case 'diverging-rdgy':
        return value >= 0 ? '#00d4aa' : '#ff3864';
      default:
        return crystal.data.color;
    }
  }
  
  getScaleForValue(value) {
    return this.crystal.scales.value(value);
  }
}

/**
 * Nemosyne Crystal Component
 */
export const NemosyneCrystal = {
  // Component metadata
  name: 'nemosyne-crystal',
  
  // A-Frame schema
  schema: {
    // Core data
    value: { type: 'string', default: '42' },
    valueAccessor: { type: 'string', default: 'value' },
    
    // Geometry
    geometry: { type: 'string', default: 'octahedron' },
    radius: { type: 'number', default: 1.0 },
    
    // Material
    color: { type: 'string', default: '#00d4aa' },
    emissive: { type: 'string', default: '#00d4aa' },
    emissiveIntensity: { type: 'number', default: 0.5 },
    metalness: { type: 'number', default: 0.8 },
    roughness: { type: 'number', default: 0.2 },
    opacity: { type: 'number', default: 1.0 },
    
    // D3.js Scales
    scaleDomain: { type: 'string', default: '[0,100]' },
    scaleRange: { type: 'string', default: '[0.5,2]' },
    colourScale: { type: 'string', default: 'viridis' },
    categoryField: { type: 'string', default: 'category' },
    
    // Animation
    autoRotate: { type: 'boolean', default: true },
    rotateSpeed: { type: 'number', default: 10 },
    float: { type: 'boolean', default: true },
    floatSpeed: { type: 'number', default: 1 },
    floatAmplitude: { type: 'number', default: 0.2 },
    
    // Behaviours (comma-separated list)
    behaviours: { type: 'string', default: 'hover,click,idle,data-change' }
  },
  
  // Lifecycle: Initialize
  init() {
    // Parse D3 domains/ranges
    this.data.baseEmissiveIntensity = this.data.emissiveIntensity;
    
    // Initialize D3 scales
    this.initScales();
    
    // Create geometry
    this.createGeometry();
    
    // Create material
    this.createMaterial();
    
    // Initialize behaviours
    this.initBehaviours();
    
    // Store base position for animations
    this.basePosition = { ...this.el.getAttribute('position') };
    
    // Set initial value
    this.setValue(this.data.value);
  },
  
  // Initialize D3 scales
  initScales() {
    const domain = JSON.parse(this.data.scaleDomain);
    const range = JSON.parse(this.data.scaleRange);
    
    this.scales = {
      // Value → Size
      value: d3.scaleLinear()
        .domain(domain)
        .range(range),
      
      // Category → Color
      category: d3.scaleOrdinal(d3.schemeCategory10),
      
      // Sequential → Color
      viridis: d3.scaleSequential(d3.interpolateViridis)
        .domain(domain),
      
      // Diverging
      diverging: d3.scaleDiverging(d3.interpolateRdBu)
        .domain([domain[0], (domain[0] + domain[1]) / 2, domain[1]])
    };
  },
  
  // Create 3D Geometry
  createGeometry() {
    const type = this.data.geometry;
    const radius = this.data.radius;
    
    const geometryMap = {
      'sphere': 'a-sphere',
      'box': 'a-box',
      'crystal': 'a-octahedron',
      'octahedron': 'a-octahedron',
      'dodecahedron': 'a-dodecahedron',
      'icosahedron': 'a-icosahedron'
    };
    
    const primitive = geometryMap[type] || 'a-octahedron';
    this.geometryEl = document.createElement(primitive);
    
    // Set geometry attributes
    if (primitive === 'a-box') {
      this.geometryEl.setAttribute('width', radius * 1.5);
      this.geometryEl.setAttribute('height', radius * 1.5);
      this.geometryEl.setAttribute('depth', radius * 1.5);
    } else {
      this.geometryEl.setAttribute('radius', radius);
    }
    
    this.el.appendChild(this.geometryEl);
  },
  
  // Create Material
  createMaterial() {
    const material = {
      color: this.data.color,
      emissive: this.data.emissive,
      emissiveIntensity: this.data.emissiveIntensity,
      metalness: this.data.metalness,
      roughness: this.data.roughness,
      opacity: this.data.opacity,
      transparent: this.data.opacity < 1
    };
    
    this.geometryEl.setAttribute('material', material);
    
    // Add glow halo
    const halo = document.createElement('a-sphere');
    halo.setAttribute('radius', this.data.radius * 1.3);
    halo.setAttribute('material', {
      color: this.data.emissive,
      transparent: true,
      opacity: 0.15,
      emissive: this.data.emissive,
      emissiveIntensity: 0.3
    });
    halo.classList.add('crystal-halo');
    this.el.appendChild(halo);
  },
  
  // Initialize Behaviour System
  initBehaviours() {
    this.behaviours = new Map();
    this.activeBehaviours = [];
    
    // Register built-in behaviours
    this.registerBuiltInBehaviours();
    
    // Attach requested behaviours
    const requested = this.data.behaviours.split(',').map(b => b.trim());
    requested.forEach(name => this.attachBehaviour(name));
  },
  
  // Register built-in behaviours
  registerBuiltInBehaviours() {
    this.behaviourConstructors = {
      'hover': HoverBehaviour,
      'click': ClickBehaviour,
      'idle': IdleBehaviour,
      'data-change': DataChangeBehaviour
    };
  },
  
  // Attach a behaviour
  attachBehaviour(name) {
    const Constructor = this.behaviourConstructors[name];
    if (!Constructor) {
      console.warn(`NemosyneCrystal: Unknown behaviour "${name}"`);
      return;
    }
    
    const behaviour = new Constructor(this);
    behaviour.attach();
    this.activeBehaviours.push(behaviour);
    this.behaviours.set(name, behaviour);
  },
  
  // Update tick (called every frame)
  tick(time, delta) {
    this.activeBehaviours.forEach(b => {
      if (b.tick) b.tick(time, delta);
    });
  },
  
  // API: Set Data Value
  setValue(newValue) {
    const oldValue = this.data.value;
    this.data.value = newValue;
    
    // Notify data-change behaviour
    const dataChange = this.behaviours.get('data-change');
    if (dataChange) {
      dataChange.onDataChange(oldValue, newValue);
    }
  },
  
  // API: Set Visual Property
  setVisual(property, value) {
    switch(property) {
      case 'color':
        this.geometryEl.setAttribute('material', 'color', value);
        break;
      case 'emissiveIntensity':
        this.geometryEl.setAttribute('material', 'emissiveIntensity', value);
        break;
      case 'scale':
        this.el.setAttribute('scale', `${value} ${value} ${value}`);
        break;
      default:
        this.data[property] = value;
    }
  },
  
  // API: Animate Property
  animate(property, targetValue, options = {}) {
    const { dur = 300, easing = 'easeOutElastic' } = options;
    
    let animateConfig;
    
    if (property === 'scale') {
      animateConfig = {
        property: 'scale',
        to: `${targetValue} ${targetValue} ${targetValue}`,
        dur: dur,
        easing: easing
      };
    } else if (property === 'color') {
      animateConfig = {
        property: 'material.color',
        to: targetValue,
        dur: dur
      };
    }
    
    if (animateConfig) {
      this.el.setAttribute('animation', animateConfig);
    }
  },
  
  // API: Show Label
  showLabel() {
    // Remove existing label
    const existing = this.el.querySelector('.crystal-label');
    if (existing) existing.remove();
    
    // Create new label
    const label = document.createElement('a-text');
    label.classList.add('crystal-label');
    label.setAttribute('value', `Value: ${this.data.value}`);
    label.setAttribute('align', 'center');
    label.setAttribute('width', 4);
    label.setAttribute('color', '#ffffff');
    label.setAttribute('position', `0 ${this.data.radius * 2.5} 0`);
    label.setAttribute('visible', true);
    
    this.el.appendChild(label);
    
    // Auto-hide after delay
    setTimeout(() => {
      if (label.parentNode) label.remove();
    }, 5000);
  },
  
  // API: Set Data Property
  setData(key, value) {
    this.data[key] = value;
  },
  
  // API: Emit Event
  emit(eventName, detail = {}) {
    this.el.emit(eventName, detail);
  },
  
  // API: Register Custom Behaviour (static method)
  static registerBehaviour(name, Constructor) {
    // Store in component prototype
    if (!NemosyneCrystal.prototype.customBehaviours) {
      NemosyneCrystal.prototype.customBehaviours = new Map();
    }
    NemosyneCrystal.prototype.customBehaviours.set(name, Constructor);
  },
  
  // Lifecycle: Remove
  remove() {
    this.activeBehaviours.forEach(b => {
      if (b.detach) b.detach();
    });
    this.activeBehaviours = [];
  }
};

// Register with A-Frame
if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('nemosyne-crystal', NemosyneCrystal);
}

// Export for module systems
export default NemosyneCrystal;
