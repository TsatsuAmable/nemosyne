/**
 * Nemosyne Framework v0.1.0
 * VR Artefacts for Real-World Data
 */

(function(global) {
  'use strict';

  // Wait for A-Frame to load
  function initNemosyne() {
    if (!global.AFRAME) {
      console.warn('Nemosyne: Waiting for A-Frame...');
      setTimeout(initNemosyne, 100);
      return;
    }

    // =========================================================================
    // Utils: Material Factory
    // =========================================================================
    const MaterialFactory = {
      defaults: {
        shader: 'standard',
        color: '#00d4aa',
        emissive: '#000000',
        emissiveIntensity: 0,
        opacity: 1,
        transparent: false,
        metalness: 0.5,
        roughness: 0.5,
        wireframe: false
      },

      create(spec, data) {
        if (!spec) return { ...this.defaults };
        
        const props = spec.properties || spec;
        const material = { ...this.defaults };
        
        Object.keys(props).forEach(key => {
          const value = props[key];
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            material[key] = value;
          } else if (value && value.$data) {
            const dataValue = data && data[value.$data];
            if (key === 'color' && value.$map) {
              material[key] = this.mapColor(dataValue, value.$map);
            } else {
              material[key] = dataValue || value.default || this.defaults[key];
            }
          }
        });
        
        if (material.opacity < 1) material.transparent = true;
        return material;
      },

      mapColor(value, scaleName) {
        if (scaleName === 'category10') {
          const colors = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', 
            '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', 
            '#bcbd22', '#17becf'
          ];
          if (typeof value === 'number') return colors[value % 10];
          if (typeof value === 'string') {
            let hash = 0;
            for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
            return colors[Math.abs(hash) % 10];
          }
        }
        if (scaleName === 'diverging-rdgy' || scaleName === 'rdgy') {
          return value >= 0 ? '#00d4aa' : '#ff3864';
        }
        return value || '#00d4aa';
      }
    };

    // =========================================================================
    // Transform Engine
    // =========================================================================
    const TransformEngine = {
      extractTransforms(spec, data) {
        if (!spec) return {};
        return {
          scale: this.resolveScale(spec.scale, data),
          color: this.resolveColor(spec.color || spec, data)
        };
      },

      resolveScale(spec, data) {
        if (!spec) return 1;
        if (typeof spec === 'number') return spec;
        if (spec.$data && data) {
          const value = data[spec.$data];
          const range = spec.$range || [0.5, 2];
          const domain = spec.$domain || [0, 100];
          if (domain[1] === domain[0]) return range[0];
          const normalized = Math.max(0, Math.min(1, (value - domain[0]) / (domain[1] - domain[0])));
          return range[0] + normalized * (range[1] - range[0]);
        }
        return 1;
      },

      resolveColor(spec, data) {
        if (!spec) return '#00d4aa';
        if (typeof spec === 'string' && !spec.startsWith('$')) return spec;
        if (spec.$data && data) {
          const value = data[spec.$data];
          if (spec.$map) return MaterialFactory.mapColor(value, spec.$map);
          return value || '#00d4aa';
        }
        return '#00d4aa';
      }
    };

    // =========================================================================
    // Behaviour Engine
    // =========================================================================
    const BehaviourEngine = {
      setup(entity, behaviours, data) {
        const active = [];
        if (!behaviours || !Array.isArray(behaviours)) return active;
        
        behaviours.forEach(behaviour => {
          const handler = this.applyBehaviour(entity, behaviour, data);
          if (handler) active.push(handler);
        });
        return active;
      },

      applyBehaviour(entity, behaviour, data) {
        const { trigger, action, params } = behaviour;
        if (trigger === 'idle') return { trigger, action, params };

        const callback = () => this.executeAction(entity, action, params, data);
        const eventMap = { 'hover': 'mouseenter', 'hover-leave': 'mouseleave', 'click': 'click' };
        const eventName = eventMap[trigger];
        
        if (eventName) entity.addEventListener(eventName, callback);
        
        return { trigger, action, params, cleanup: () => {
          if (eventName) entity.removeEventListener(eventName, callback);
        }};
      },

      executeAction(entity, action, params, data) {
        const getGeometry = () => entity.querySelector('[geometry]') || entity.querySelector('a-octahedron') || entity.querySelector('a-sphere') || entity.firstElementChild;

        switch (action) {
          case 'glow':
            const geom = getGeometry();
            if (geom) {
              const intensity = params?.intensity || 1;
              geom.setAttribute('animation__glow', {
                property: 'material.emissiveIntensity',
                to: intensity,
                dur: 300,
                easing: 'easeInOutQuad'
              });
            }
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

          case 'show-label':
            let label = entity.querySelector('a-text');
            if (!label) {
              label = document.createElement('a-text');
              label.setAttribute('align', 'center');
              label.setAttribute('width', 6);
              entity.appendChild(label);
            }
            let content = '';
            if (params?.content) {
              if (params.content.$data) content = data?.[params.content.$data] || '';
              else if (typeof params.content === 'string') content = params.content;
            }
            label.setAttribute('value', content);
            label.setAttribute('visible', true);
            label.setAttribute('position', params?.position === 'below' ? '0 -1.5 0' : '0 2 0');
            if (params?.duration) {
              setTimeout(() => label.setAttribute('visible', false), params.duration * 1000);
            }
            break;
        }
      }
    };

    // =========================================================================
    // Artefact Builder
    // =========================================================================
    const ArtefactBuilder = {
      build(spec, data, position, container) {
        const wrapper = document.createElement('a-entity');
        wrapper.setAttribute('position', position || '0 0 0');
        wrapper.classList.add('clickable');

        const transforms = TransformEngine.extractTransforms(spec.transform, data);
        const geometryEl = this.createGeometry(spec.geometry, spec.material, data, transforms);
        const visual = document.createElement('a-entity');
        visual.appendChild(geometryEl);

        if (spec.material?.properties?.emissive) {
          visual.appendChild(this.createGlow(spec.material.properties.emissive, transforms?.scale || 1));
        }

        wrapper.appendChild(visual);

        if (spec.labels) {
          const label = this.createLabel(spec.labels, data);
          if (label) wrapper.appendChild(label);
        }

        BehaviourEngine.setup(wrapper, spec.behaviours, data);
        
        // Apply idle rotation
        if (spec.behaviours) {
          const idle = spec.behaviours.find(b => b.trigger === 'idle' && b.action === 'rotate');
          if (idle) {
            wrapper.setAttribute('animation', {
              property: 'rotation',
              to: idle.params?.axis === 'x' ? '360 0 0' : idle.params?.axis === 'z' ? '0 0 360' : '0 360 0',
              loop: true,
              dur: 10000 / (idle.params?.speed || 0.5),
              easing: 'linear'
            });
          }
        }

        // Entry animation
        wrapper.setAttribute('animation__entry', {
          property: 'scale',
          from: '0 0 0',
          to: '1 1 1',
          dur: 800,
          easing: 'easeOutElastic'
        });

        if (container) container.appendChild(wrapper);
        return { el: wrapper, geometry: geometryEl, spec, data };
      },

      createGeometry(geometrySpec, materialSpec, data, transforms) {
        const type = geometrySpec?.type || 'octahedron';
        const radius = geometrySpec?.radius || 1;
        const scale = transforms?.scale || 1;
        
        const map = {
          'sphere': 'a-sphere',
          'box': 'a-box',
          'cylinder': 'a-cylinder',
          'octahedron': 'a-octahedron',
          'dodecahedron': 'a-dodecahedron',
          'icosahedron': 'a-icosahedron',
          'tetrahedron': 'a-tetrahedron'
        };
        
        const el = document.createElement(map[type] || 'a-octahedron');
        const baseScale = scale * radius;

        if (type === 'box') {
          el.setAttribute('width', baseScale * 1.5);
          el.setAttribute('height', baseScale * 1.5);
          el.setAttribute('depth', baseScale * 1.5);
        } else if (type === 'cylinder') {
          el.setAttribute('radius', radius * 0.5);
          el.setAttribute('height', baseScale * 2);
        } else {
          el.setAttribute('radius', baseScale);
        }

        const material = MaterialFactory.create(materialSpec, data);
        el.setAttribute('material', material);
        return el;
      },

      createGlow(color, baseScale) {
        const glow = document.createElement('a-sphere');
        const gs = baseScale * 1.3;
        glow.setAttribute('radius', gs);
        glow.setAttribute('material', {
          color: color,
          transparent: true,
          opacity: 0.15,
          emissive: color,
          emissiveIntensity: 0.3
        });
        glow.setAttribute('animation', {
          property: 'scale',
          dir: 'alternate',
          to: `${gs * 1.1} ${gs * 1.1} ${gs * 1.1}`,
          dur: 2000,
          loop: true,
          easing: 'easeInOutSine'
        });
        return glow;
      },

      createLabel(labelSpec, data) {
        if (!labelSpec.primary) return null;
        const text = this.resolveLabel(labelSpec.primary, data);
        const label = document.createElement('a-text');
        label.setAttribute('value', text);
        label.setAttribute('color', labelSpec.color || '#d4af37');
        label.setAttribute('align', 'center');
        label.setAttribute('width', labelSpec.width || 6);
        label.setAttribute('position', labelSpec.position === 'below' ? '0 -1.5 0' : '0 2 0');
        label.setAttribute('visible', false);
        return label;
      },

      resolveLabel(spec, data) {
        if (typeof spec === 'string') return spec;
        if (spec.$data) return data?.[spec.$data] || '';
        return '';
      }
    };

    // =========================================================================
    // Nemosyne Artefact Component
    // =========================================================================
    global.AFRAME.registerComponent('nemosyne-artefact', {
      schema: {
        src: { type: 'string', default: '' },
        data: { type: 'string', default: '' },
        'spec-inline': { type: 'string', default: '' },
        'data-inline': { type: 'string', default: '' },
        layout: { type: 'string', default: 'default' }
      },

      init() {
        this.loadConfig();
      },

      async loadConfig() {
        try {
          let spec, data;
          
          if (this.data['spec-inline']) {
            spec = JSON.parse(this.data['spec-inline']);
          } else if (this.data.src) {
            const res = await fetch(this.data.src);
            spec = await res.json();
          } else {
            spec = { id: 'default', geometry: { type: 'octahedron' }, material: { color: '#00d4aa' } };
          }
          
          if (this.data['data-inline']) {
            data = JSON.parse(this.data['data-inline']);
          } else if (this.data.data) {
            const res = await fetch(this.data.data);
            data = await res.json();
          } else {
            data = { records: [{ value: 42, label: 'Default' }] };
          }

          const records = data.records || data.nodes || data.data || [data];
          records.forEach((record, i) => {
            const pos = this.calcPosition(i, records.length);
            ArtefactBuilder.build(spec, record, pos, this.el);
          });

          this.el.emit('nemosyne-loaded', { count: records.length });

        } catch (err) {
          console.error('Nemosyne error:', err);
          this.showError(err.message);
        }
      },

      calcPosition(index, total) {
        if (total === 1) return '0 1.5 0';
        const angle = (index / total) * Math.PI * 2;
        const r = 3;
        return `${Math.cos(angle) * r} 1.5 ${Math.sin(angle) * r}`;
      },

      showError(msg) {
        const el = document.createElement('a-text');
        el.setAttribute('value', `Error: ${msg}`);
        el.setAttribute('color', '#ff3864');
        el.setAttribute('align', 'center');
        el.setAttribute('position', '0 2 0');
        this.el.appendChild(el);
      }
    });

    // =========================================================================
    // Nemosyne Scene Component
    // =========================================================================
    global.AFRAME.registerComponent('nemosyne-scene', {
      schema: {
        theme: { type: 'string', default: 'void' }
      },
      
      init() {
        const theme = this.data.theme;
        if (theme === 'void') {
          this.el.setAttribute('background', { color: '#000205' });
          this.el.setAttribute('fog', { type: 'exponential', color: '#000510', density: 0.02 });
        }
        
        // Add ambient light
        const ambient = document.createElement('a-light');
        ambient.setAttribute('type', 'ambient');
        ambient.setAttribute('color', '#001122');
        ambient.setAttribute('intensity', '0.3');
        this.el.appendChild(ambient);
        
        // Add main light
        const main = document.createElement('a-light');
        main.setAttribute('type', 'point');
        main.setAttribute('position', '2 4 4');
        main.setAttribute('intensity', '1');
        this.el.appendChild(main);
      }
    });

    // Version export
    global.Nemosyne = { VERSION: '0.1.0' };
    console.log('🐾 Nemosyne v0.1.0 loaded');
  }

  initNemosyne();

})(typeof window !== 'undefined' ? window : global);
