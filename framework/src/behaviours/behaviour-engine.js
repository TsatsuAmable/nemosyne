/**
 * Behaviour Engine
 * Manages interactive behaviours for artefacts
 */

export class BehaviourEngine {
  constructor() {
    this.handlers = new Map();
    this.setupDefaultHandlers();
  }

  setupDefaultHandlers() {
    // Trigger → handler mapping
    this.handlers.set('hover', this.handleHover.bind(this));
    this.handlers.set('hover-leave', this.handleHoverLeave.bind(this));
    this.handlers.set('click', this.handleClick.bind(this));
    this.handlers.set('idle', this.handleIdle.bind(this));
  }

  /**
   * Setup behaviours for an entity
   * @param {Element} entity - The A-Frame entity
   * @param {Array} behaviours - Array of behaviour specifications
   * @param {Object} data - Associated data
   * @returns {Array} List of active behaviour handlers
   */
  setup(entity, behaviours, data) {
    const activeBehaviours = [];
    
    if (!behaviours || !Array.isArray(behaviours)) {
      return activeBehaviours;
    }
    
    behaviours.forEach(behaviour => {
      const handler = this.applyBehaviour(entity, behaviour, data);
      if (handler) {
        activeBehaviours.push(handler);
      }
    });
    
    return activeBehaviours;
  }

  /**
   * Apply a single behaviour to entity
   */
  applyBehaviour(entity, behaviour, data) {
    const { trigger, action, params, sequence } = behaviour;
    
    // Skip idle behaviours - they're handled by animation loop
    if (trigger === 'idle') {
      return { trigger, action, params };
    }
    
    // Setup event listeners for interactive triggers
    const callback = () => {
      if (sequence) {
        this.executeSequence(entity, sequence, data);
      } else {
        this.executeAction(entity, action, params, data);
      }
    };
    
    // Map trigger to A-Frame event
    const eventMap = {
      'hover': 'mouseenter',
      'hover-leave': 'mouseleave',
      'click': 'click'
    };
    
    const eventName = eventMap[trigger];
    if (eventName) {
      entity.addEventListener(eventName, callback);
    }
    
    return {
      trigger,
      action,
      params,
      cleanup: () => {
        if (eventName) {
          entity.removeEventListener(eventName, callback);
        }
      }
    };
  }

  /**
   * Execute an action
   */
  executeAction(entity, action, params, data) {
    switch (action) {
      case 'glow':
        this.actionGlow(entity, params);
        break;
      case 'scale':
        this.actionScale(entity, params);
        break;
      case 'move':
        this.actionMove(entity, params);
        break;
      case 'show-label':
        this.actionShowLabel(entity, params, data);
        break;
      case 'hide-label':
        this.actionHideLabel(entity, params);
        break;
      case 'highlight-path':
        this.actionHighlightPath(entity, params, data);
        break;
      case 'reveal':
        this.actionReveal(entity, params);
        break;
      case 'emit':
        this.actionEmit(entity, params);
        break;
      case 'color-shift':
        this.actionColorShift(entity, params);
        break;
      default:
        console.warn(`Nemosyne: Unknown action "${action}"`);
    }
  }

  /**
   * Execute a sequence of actions
   */
.executeSequence(entity, sequence, data) {
  sequence.forEach((step, index) => {
    setTimeout(() => {
      this.executeAction(entity, step.action, step.params, data);
    }, index * (step.delay || 0));
  });
}

  // Action implementations

  actionGlow(entity, params) {
    const geometryEl = entity.querySelector('[geometry]');
    if (!geometryEl) return;
    
    const intensity = params?.intensity || 1;
    const duration = (params?.duration || 0.3) * 1000;
    
    geometryEl.setAttribute('animation__glow', {
      property: 'material.emissiveIntensity',
      to: intensity,
      dur: duration,
      easing: 'easeInOutQuad'
    });
  }

  actionScale(entity, params) {
    const factor = params?.factor || 1;
    const duration = (params?.duration || 0.2) * 1000;
    
    entity.setAttribute('animation__scale', {
      property: 'scale',
      to: `${factor} ${factor} ${factor}`,
      dur: duration,
      easing: 'easeOutElastic'
    });
  }

  actionMove(entity, params) {
    const to = params?.to || { x: 0, y: 0, z: 0 };
    const duration = (params?.duration || 0.5) * 1000;
    
    entity.setAttribute('animation__move', {
      property: 'position',
      to: `${to.x} ${to.y} ${to.z}`,
      dur: duration,
      easing: 'easeInOutQuad'
    });
  }

  actionShowLabel(entity, params, data) {
    let label = entity.querySelector('a-text');
    
    // Create label if doesn't exist
    if (!label) {
      label = document.createElement('a-text');
      label.setAttribute('align', 'center');
      label.setAttribute('width', params?.width || 6);
      entity.appendChild(label);
    }
    
    // Set content
    let content = '';
    if (params?.content) {
      if (params.content.$data) {
        content = data?.[params.content.$data] || '';
      } else if (typeof params.content === 'string') {
        content = params.content;
      }
    }
    
    label.setAttribute('value', content);
    label.setAttribute('visible', true);
    label.setAttribute('position', params?.position === 'above' ? '0 2 0' : '0 0 0');
    
    // Auto-hide after duration
    if (params?.duration) {
      setTimeout(() => {
        label.setAttribute('visible', false);
      }, params.duration * 1000);
    }
  }

  actionHideLabel(entity, params) {
    const label = entity.querySelector('a-text');
    if (label) {
      label.setAttribute('visible', false);
    }
  }

  actionHighlightPath(entity, params, data) {
    // Placeholder: Would highlight connected nodes in a graph
    console.log('Highlight path:', params);
  }

  actionReveal(entity, params) {
    // Show children or expanded details
    const children = entity.querySelectorAll('[data-artefact-child]');
    children.forEach(child => {
      child.setAttribute('visible', true);
      child.setAttribute('animation__reveal', {
        property: 'scale',
        from: '0 0 0',
        to: '1 1 1',
        dur: 500,
        easing: 'easeOutBack'
      });
    });
  }

  actionEmit(entity, params) {
    // Placeholder: Particle emission
    console.log('Emit particles:', params);
  }

  actionColorShift(entity, params) {
    const geometryEl = entity.querySelector('[geometry]');
    if (!geometryEl) return;
    
    const to = params?.to || '#ffffff';
    const duration = (params?.duration || 0.3) * 1000;
    
    geometryEl.setAttribute('animation__color', {
      property: 'material.color',
      to: to,
      dur: duration
    });
  }

  // Event handlers

  handleHover(event, entity, params) {
    this.actionGlow(entity, params);
  }

  handleHoverLeave(event, entity, params) {
    const defaultIntensity = params?.defaultIntensity || 0.5;
    this.actionGlow(entity, { intensity: defaultIntensity });
  }

  handleClick(event, entity, params) {
    this.actionScale(entity, { factor: 1.2, duration: 0.2 });
  }

  handleIdle(entity, params) {
    // Idle animations are applied at build time
  }
}
