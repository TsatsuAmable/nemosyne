/**
 * Nemosyne v0.2.0 — Production Bundle
 * VR Artefacts for Real-World Data
 * https://nemosyne.world
 * License: MIT
 * 
 * Built: 2026-04-07
 * Includes:
 *   - nemosyne-artefact-v2 component
 *   - nemosyne-connector component  
 *   - nemosyne-scene component
 *   - Layout Engine (7 algorithms)
 *   - Quick Start API
 *   - Validation system
 */

(function(global) {
  'use strict';

  // Wait for A-Frame
  function initNemosyne() {
    if (!global.AFRAME) {
      setTimeout(initNemosyne, 50);
      return;
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================
    
    const MaterialFactory = {
      defaults: {
        shader: 'standard', color: '#00d4aa', emissive: '#000000',
        emissiveIntensity: 0, opacity: 1, transparent: false,
        metalness: 0.5, roughness: 0.5, wireframe: false
      },
      create(spec, data) {
        if (!spec) return { ...this.defaults };
        const props = spec.properties || spec;
        const material = { ...this.defaults };
        Object.keys(props).forEach(key => {
          const value = props[key];
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            material[key] = value;
          } else if (value?.['$data']) {
            const dataValue = data?.[value['$data']];
            if (key === 'color' && value['$map']) {
              material[key] = this.mapColor(dataValue, value['$map']);
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
          const colors = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
          if (typeof value === 'number') return colors[value % 10];
          if (typeof value === 'string') {
            let hash = 0; for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
            return colors[Math.abs(hash) % 10];
          }
        }
        if (scaleName === 'diverging-rdgy' || scaleName === 'rdgy') return value >= 0 ? '#00d4aa' : '#ff3864';
        if (scaleName === 'viridis' || scaleName === 'plasma' || scaleName === 'warm' || scaleName === 'cool') {
          return typeof value === 'number' ? `hsl(${160 + value * 80}, 70%, 50%)` : '#00d4aa';
        }
        return value || '#00d4aa';
      }
    };

    const TransformEngine = {
      extractTransforms(spec, data) {
        if (!spec) return {};
        return {
          scale: this.resolveScale(spec?.scale, data),
          color: this.resolveColor(spec?.color || spec, data)
        };
      },
      resolveScale(spec, data) {
        if (!spec) return 1;
        if (typeof spec === 'number') return spec;
        if (spec['$data'] && data) {
          const value = data[spec['$data']];
          const range = spec['$range'] || [0.5, 2];
          const domain = spec['$domain'] || [0, 100];
          return this.mapRange(value, domain, range);
        }
        return 1;
      },
      resolveColor(spec, data) {
        if (!spec) return '#00d4aa';
        if (typeof spec === 'string' && !spec.startsWith('$')) return spec;
        if (spec['$data'] && data) {
          const value = data[spec['$data']];
          if (spec['$map']) return MaterialFactory.mapColor(value, spec['$map']);
          return value || '#00d4aa';
        }
        return '#00d4aa';
      },
      mapRange(value, domain, range) {
        if (value === undefined || value === null) return range[0];
        const [dMin, dMax] = domain; const [rMin, rMax] = range;
        if (dMax === dMin) return rMin;
        const normalized = Math.max(0, Math.min(1, (value - dMin) / (dMax - dMin)));
        return rMin + normalized * (rMax - rMin);
      }
    };

    // =========================================================================
    // LAYOUT ENGINE
    // =========================================================================
    
    const LayoutEngine = {
      layouts: new Map(),
      init() {
        this.layouts.set('grid', this.gridLayout.bind(this));
        this.layouts.set('radial', this.radialLayout.bind(this));
        this.layouts.set('timeline', this.timelineLayout.bind(this));
        this.layouts.set('spiral', this.spiralLayout.bind(this));
        this.layouts.set('tree', this.treeLayout.bind(this));
        this.layouts.set('force', this.forceLayout.bind(this));
        this.layouts.set('scatter', this.scatterLayout.bind(this));
      },
      calculate(name, records, options = {}) {
        const fn = this.layouts.get(name);
        if (!fn) { console.warn(`Layout "${name}" not found, using scatter`); return this.scatterLayout(records, options); }
        return fn(records, options);
      },
      gridLayout(records, options = {}) {
        const cols = options.columns || Math.ceil(Math.sqrt(records.length));
        const spacing = options.spacing || 3;
        const offset = options.offset || { x: 0, y: 0, z: 0 };
        return records.map((_, i) => ({
          x: ((i % cols) - (cols - 1) / 2) * spacing + offset.x,
          y: (Math.floor(i / cols) - Math.floor((records.length - 1) / cols) / 2) * -spacing + offset.y,
          z: offset.z
        }));
      },
      radialLayout(records, options = {}) {
        const radius = options.radius || 5;
        const angleOffset = options.angleOffset || 0;
        const yOffset = options.yOffset || 0;
        return records.map((_, i) => {
          const angle = (i / records.length) * Math.PI * 2 + angleOffset;
          return { x: Math.cos(angle) * radius, y: yOffset, z: Math.sin(angle) * radius };
        });
      },
      timelineLayout(records, options = {}) {
        const spacing = options.spacing || 3;
        const totalWidth = (records.length - 1) * spacing;
        const yOffset = options.yOffset || 0, zOffset = options.zOffset || 0;
        return records.map((_, i) => ({ x: (i * spacing) - (totalWidth / 2), y: yOffset, z: zOffset }));
      },
      spiralLayout(records, options = {}) {
        const radius = options.radius || 5, heightStep = options.heightStep || 0.5;
        const rotations = options.rotations || 2, radiusShrink = options.radiusShrink || 0.3;
        return records.map((_, i) => {
          const t = i / records.length, angle = t * Math.PI * 2 * rotations, r = radius * (1 - t * radiusShrink);
          return { x: Math.cos(angle) * r, y: i * heightStep, z: Math.sin(angle) * r };
        });
      },
      treeLayout(records, options = {}) {
        const levelHeight = options.levelHeight || 3, siblingSpacing = options.siblingSpacing || 4;
        const nodes = records.map(r => ({ ...r, children: [], width: 1, x: 0, y: 0, z: 0 }));
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        nodes.forEach(node => { if (node.parent && nodeMap.has(node.parent)) nodeMap.get(node.parent).children.push(node); });
        const root = nodes.find(n => !n.parent) || nodes[0];
        const calcPos = (n, x, y, z) => {
          n.x = x; n.y = y; n.z = z;
          if (n.children.length > 0) {
            const totalWidth = (n.children.length - 1) * siblingSpacing, startX = x - totalWidth / 2;
            n.children.forEach((c, i) => calcPos(c, startX + i * siblingSpacing, y - levelHeight, z));
          }
        };
        calcPos(root, 0, 0, 0);
        return nodes.map(n => ({ x: n.x, y: n.y, z: n.z }));
      },
      forceLayout(records, options = {}) {
        const bounds = options.bounds || 10;
        return records.map(() => ({ x: (Math.random() - 0.5) * bounds, y: (Math.random() - 0.5) * bounds * 0.5, z: (Math.random() - 0.5) * bounds }));
      },
      scatterLayout(records, options = {}) {
        const bounds = options.bounds || 10;
        return records.map(() => ({ x: (Math.random() - 0.5) * bounds, y: (Math.random() - 0.5) * bounds * 0.5, z: (Math.random() - 0.5) * bounds }));
      },
      register(name, fn) { this.layouts.set(name, fn); }
    };
    LayoutEngine.init();

    // =========================================================================
    // BEHAVIOUR ENGINE
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
        return { trigger, action, params, cleanup: () => { if (eventName) entity.removeEventListener(eventName, callback); } };
      },
      executeAction(entity, action, params, data) {
        const getGeom = () => entity.querySelector('[geometry]') || entity.querySelector('a-octahedron,a-sphere,a-box') || entity.firstElementChild;
        switch (action) {
          case 'glow':
            const geom = getGeom();
            if (geom) geom.setAttribute('animation__glow', { property: 'material.emissiveIntensity', to: params?.intensity || 1, dur: 300, easing: 'easeInOutQuad' });
            break;
          case 'scale':
            const factor = params?.factor || 1.2;
            entity.setAttribute('animation__scale', { property: 'scale', to: `${factor} ${factor} ${factor}`, dur: 200, easing: 'easeOutElastic' });
            break;
          case 'show-label':
            let label = entity.querySelector('a-text');
            if (!label) { label = document.createElement('a-text'); label.setAttribute('align', 'center'); label.setAttribute('width', 6); entity.appendChild(label); }
            let content = ''; if (params?.content) { if (params.content['$data']) content = data?.[params.content['$data']] || ''; else if (typeof params.content === 'string') content = params.content; }
            label.setAttribute('value', content); label.setAttribute('visible', true);
            label.setAttribute('position', params?.position === 'below' ? '0 -1.5 0' : '0 2 0');
            if (params?.duration) setTimeout(() => label.setAttribute('visible', false), params.duration * 1000);
            break;
        }
      }
    };

    // =========================================================================
    // ARTEFACT BUILDER
    // =========================================================================
    
    const ArtefactBuilder = {
      build(spec, data, position, container) {
        const wrapper = document.createElement('a-entity');
        wrapper.setAttribute('position', position || '0 0 0');
        wrapper.classList.add('clickable');
        wrapper.dataset.artefactId = data?.id || '';
        
        const transforms = TransformEngine.extractTransforms(spec.transform, data);
        const geometryEl = this.createGeometry(spec.geometry, spec.material, data, transforms);
        const visual = document.createElement('a-entity');
        visual.appendChild(geometryEl);
        
        if (spec.material?.properties?.emissive) {
          const glow = this.createGlow(spec.material.properties.emissive, transforms?.scale || 1);
          visual.appendChild(glow);
        }
        
        wrapper.appendChild(visual);
        
        if (spec.labels) {
          const label = this.createLabel(spec.labels, data);
          if (label) wrapper.appendChild(label);
        }
        
        BehaviourEngine.setup(wrapper, spec.behaviours, data);
        
        if (spec.behaviours) {
          const idle = spec.behaviours.find(b => b.trigger === 'idle' && b.action === 'rotate');
          if (idle) {
            wrapper.setAttribute('animation', { property: 'rotation', to: idle.params?.axis === 'x' ? '360 0 0' : idle.params?.axis === 'z' ? '0 0 360' : '0 360 0', loop: true, dur: 10000 / (idle.params?.speed || 0.5), easing: 'linear' });
          }
        }
        
        wrapper.setAttribute('animation__entry', { property: 'scale', from: '0 0 0', to: '1 1 1', dur: 800, easing: 'easeOutElastic' });
        
        if (container) container.appendChild(wrapper);
        return { el: wrapper, geometry: geometryEl, spec, data };
      },
      createGeometry(geometrySpec, materialSpec, data, transforms) {
        const type = geometrySpec?.type || 'octahedron', radius = geometrySpec?.radius || 1, scale = transforms?.scale || 1;
        const map = { 'sphere': 'a-sphere', 'box': 'a-box', 'cylinder': 'a-cylinder', 'octahedron': 'a-octahedron', 'dodecahedron': 'a-dodecahedron', 'icosahedron': 'a-icosahedron', 'tetrahedron': 'a-tetrahedron' };
        const el = document.createElement(map[type] || 'a-octahedron');
        const baseScale = scale * radius;
        if (type === 'box') { el.setAttribute('width', baseScale * 1.5); el.setAttribute('height', baseScale * 1.5); el.setAttribute('depth', baseScale * 1.5); }
        else if (type === 'cylinder') { el.setAttribute('radius', radius * 0.5); el.setAttribute('height', baseScale * 2); }
        else { el.setAttribute('radius', baseScale); }
        const material = MaterialFactory.create(materialSpec, data);
        el.setAttribute('material', material);
        return el;
      },
      createGlow(color, baseScale) {
        const glow = document.createElement('a-sphere');
        const gs = baseScale * 1.3;
        glow.setAttribute('radius', gs);
        glow.setAttribute('material', { color: color, transparent: true, opacity: 0.15, emissive: color, emissiveIntensity: 0.3 });
        glow.setAttribute('animation', { property: 'scale', dir: 'alternate', to: `${gs * 1.1} ${gs * 1.1} ${gs * 1.1}`, dur: 2000, loop: true, easing: 'easeInOutSine' });
        return glow;
      },
      createLabel(labelSpec, data) {
        if (!labelSpec.primary) return null;
        let text = ''; if (typeof labelSpec.primary === 'string') text = labelSpec.primary; else if (labelSpec.primary?.['$data']) text = data?.[labelSpec.primary['$data']] || '';
        const label = document.createElement('a-text');
        label.setAttribute('value', text); label.setAttribute('color', labelSpec.color || '#d4af37'); label.setAttribute('align', 'center');
        label.setAttribute('width', labelSpec.width || 6); label.setAttribute('position', labelSpec.position === 'below' ? '0 -1.5 0' : '0 2 0');
        label.setAttribute('visible', false);
        return label;
      }
    };

    // =========================================================================
    // COMPONENTS
    // =========================================================================
    
    // Nemosyne Artefact v2
    global.AFRAME.registerComponent('nemosyne-artefact-v2', {
      schema: {
        spec: { type: 'string', default: '' },
        dataset: { type: 'string', default: '' },
        layout: { type: 'string', default: 'grid' },
        'layout-options': { type: 'string', default: '{}' },
        animate: { type: 'boolean', default: true },
        'entry-duration': { type: 'number', default: 800 },
        interactive: { type: 'boolean', default: true },
        debug: { type: 'boolean', default: false }
      },
      init() {
        this.artefacts = []; this.connectors = []; this.isLoaded = false;
        try { this.layoutOptions = JSON.parse(this.data['layout-options']); } catch(e) { this.layoutOptions = {}; }
        this.loadConfiguration();
      },
      async loadConfiguration() {
        try {
          let spec = this.data.spec ? JSON.parse(this.data.spec) : { id: 'default', geometry: { type: 'octahedron', radius: 1 }, material: { properties: { color: '#00d4aa' } } };
          let dataset = this.data.dataset ? JSON.parse(this.data.dataset) : { records: [{ value: 42, label: 'Default' }] };
          const records = dataset.records || dataset.nodes || dataset.data || [dataset];
          const positions = LayoutEngine.calculate(this.data.layout, records, this.layoutOptions);
          this.buildArtefacts(spec, records, positions);
          this.setupAutoConnections(spec, records);
          this.isLoaded = true; this.el.emit('nemosyne-loaded', { count: this.artefacts.length, layout: this.data.layout });
        } catch (error) { console.error('Nemosyne error:', error); this.showError(error.message); }
      },
      buildArtefacts(spec, records, positions) {
        records.forEach((record, i) => {
          const position = positions[i] || { x: 0, y: 0, z: 0 };
          const artefact = ArtefactBuilder.build(spec, record, position, this.el);
          this.artefacts.push(artefact);
        });
      },
      setupAutoConnections(spec, records) {
        if (spec.connections !== 'auto') return;
        records.forEach((record, i) => {
          if (record.parent) {
            const parentIdx = records.findIndex(r => r.id === record.parent);
            if (parentIdx >= 0 && i >= 0) {
              const parentEl = this.artefacts[parentIdx]?.el, childEl = this.artefacts[i]?.el;
              if (parentEl && childEl) this.createConnector(parentEl, childEl);
            }
          }
        });
      },
      createConnector(fromEl, toEl) {
        const connector = document.createElement('a-entity');
        connector.setAttribute('nemosyne-connector', { from: fromEl, to: toEl, color: '#00d4aa', thickness: 0.03 });
        this.el.appendChild(connector); this.connectors.push(connector);
      },
      showError(msg) {
        const el = document.createElement('a-text');
        el.setAttribute('value', `Error: ${msg}`); el.setAttribute('color', '#ff3864'); el.setAttribute('align', 'center');
        el.setAttribute('position', '0 2 0'); el.setAttribute('scale', '0.8 0.8 0.8'); this.el.appendChild(el);
        this.el.emit('nemosyne-error', { error: msg });
      },
      remove() {
        this.artefacts.forEach(a => a.el?.parentNode?.removeChild(a.el));
        this.connectors.forEach(c => c.parentNode?.removeChild(c));
      }
    });
    
    // Nemosyne Connector
    global.AFRAME.registerComponent('nemosyne-connector', {
      schema: {
        from: { type: 'selector' }, to: { type: 'selector' },
        type: { type: 'string', default: 'line' },
        thickness: { type: 'number', default: 0.03 },
        color: { type: 'string', default: '#00d4aa' },
        opacity: { type: 'number', default: 0.4 },
        emissive: { type: 'string', default: '#00d4aa' },
        emissiveIntensity: { type: 'number', default: 0.2 },
        animated: { type: 'boolean', default: false },
        pulse: { type: 'boolean', default: false }
      },
      init() {
        this.sourceEl = this.data.from; this.targetEl = this.data.to; this.connectorEl = null;
        if (this.sourceEl && this.targetEl) { this.createConnector(); this.tick = global.AFRAME.utils.throttleTick(this.updatePosition.bind(this), 100, this); }
      },
      createConnector() {
        if (this.connectorEl) this.connectorEl.parentNode.removeChild(this.connectorEl);
        const line = document.createElement('a-entity');
        line.setAttribute('geometry', { primitive: 'cylinder', radius: this.data.thickness, height: 1 });
        line.setAttribute('material', { color: this.data.color, opacity: this.data.opacity, transparent: true, emissive: this.data.emissive, emissiveIntensity: this.data.emissiveIntensity });
        if (this.data.pulse) line.setAttribute('animation', { property: 'material.emissiveIntensity', from: this.data.emissiveIntensity, to: this.data.emissiveIntensity * 2, dir: 'alternate', dur: 1000, loop: true });
        if (this.data.animated) line.setAttribute('animation__flow', { property: 'material.opacity', from: this.data.opacity, to: this.data.opacity * 1.5, dir: 'alternate', dur: 800, loop: true });
        this.connectorEl = line; this.el.appendChild(line); this.updatePosition();
      },
      updatePosition() {
        if (!this.sourceEl || !this.targetEl || !this.connectorEl) return;
        const posA = new global.THREE.Vector3(); this.sourceEl.object3D.getWorldPosition(posA);
        const posB = new global.THREE.Vector3(); this.targetEl.object3D.getWorldPosition(posB);
        const distance = Math.sqrt(Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2) + Math.pow(posB.z - posA.z, 2));
        const midX = (posA.x + posB.x) / 2, midY = (posA.y + posB.y) / 2, midZ = (posA.z + posB.z) / 2;
        this.connectorEl.setAttribute('position', `${midX} ${midY} ${midZ}`);
        this.connectorEl.setAttribute('geometry', 'height', distance);
        this.connectorEl.object3D.lookAt(posB.x, posB.y, posB.z); this.connectorEl.object3D.rotateX(Math.PI / 2);
      },
      remove() { if (this.connectorEl?.parentNode) this.connectorEl.parentNode.removeChild(this.connectorEl); }
    });
    
    // Nemosyne Scene
    global.AFRAME.registerComponent('nemosyne-scene', {
      schema: { theme: { type: 'string', default: 'void' } },
      init() {
        const theme = this.data.theme;
        if (theme === 'void') { this.el.setAttribute('background', { color: '#000205' }); this.el.setAttribute('fog', { type: 'exponential', color: '#000510', density: 0.02 }); }
        const ambient = document.createElement('a-light'); ambient.setAttribute('type', 'ambient'); ambient.setAttribute('color', '#001122'); ambient.setAttribute('intensity', '0.3'); this.el.appendChild(ambient);
        const main = document.createElement('a-light'); main.setAttribute('type', 'point'); main.setAttribute('position', '2 4 4'); main.setAttribute('intensity', '1'); this.el.appendChild(main);
      }
    });

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    
    const Nemosyne = {
      VERSION: '0.2.0',
      layoutEngine: LayoutEngine,
      MaterialFactory: MaterialFactory,
      TransformEngine: TransformEngine,
      BehaviourEngine: BehaviourEngine,
      ArtefactBuilder: ArtefactBuilder,
      
      quickStart(container, config) {
        const defaults = { type: 'crystal', data: [], layout: 'grid', color: '#00d4aa', labels: true, animate: true };
        const opts = { ...defaults, ...config };
        const records = opts.data.map((d, i) => ({ id: `item-${i}`, value: typeof d === 'number' ? d : d.value || 0, label: typeof d === 'object' ? d.label : String(d), ...(typeof d === 'object' && !d.value && !d.label ? d : {}) }));
        const geometry = ({ 'crystal': { type: 'octahedron', radius: 1 }, 'sphere': { type: 'sphere', radius: 0.8 }, 'bar': { type: 'box' }, 'node': { type: 'dodecahedron', radius: 0.7 }, 'orb': { type: 'sphere', radius: 1 } })[opts.type] || { type: 'octahedron', radius: 1 };
        const layoutMap = { 'bar': 'grid', 'line': 'timeline', 'scatter': 'scatter', 'network': 'force', 'tree': 'tree', 'spiral': 'spiral', 'grid': 'grid', 'radial': 'radial', 'timeline': 'timeline' };
        const spec = {
          id: `${opts.type}-${Date.now()}`, geometry,
          material: { properties: { color: opts.color, emissive: opts.color, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.2 } },
          transform: { scale: opts.type === 'bar' ? { $data: 'value', $range: [1, 5] } : { $data: 'value', $range: [0.5, 1.5] } },
          behaviours: [
            { trigger: 'hover', action: 'glow', params: { intensity: 2 } },
            { trigger: 'hover-leave', action: 'glow', params: { intensity: 0.4 } },
            { trigger: 'click', action: opts.labels ? 'show-label' : 'scale', params: { factor: 1.3, content: { $data: 'label' } } },
            { trigger: 'idle', action: 'rotate', params: { speed: 0.2, axis: 'y' } }
          ],
          labels: opts.labels ? { primary: { $data: 'label' }, color: '#fff', position: opts.type === 'bar' ? 'below' : 'above' } : null
        };
        const el = document.createElement('a-entity');
        el.setAttribute('nemosyne-artefact-v2', { spec: JSON.stringify(spec), dataset: JSON.stringify({ records }), layout: layoutMap[opts.layout] || 'grid', animate: opts.animate });
        container.appendChild(el);
        return el;
      },
      
      presets: {
        barChart: (data, options = {}) => ({ type: 'bar', data, layout: 'bar', color: options.color || '#00d4aa', ...options }),
        network: (nodes, edges, options = {}) => ({ type: 'node', data: nodes.map((n, i) => ({ id: i, ...n })), layout: 'network', connections: edges, color: options.color || 'category10', ...options }),
        timeline: (data, options = {}) => ({ type: 'crystal', data, layout: 'timeline', color: options.color || 'viridis', ...options }),
        scatter: (data, options = {}) => ({ type: 'sphere', data, layout: 'scatter', color: options.color || 'category10', ...options })
      },
      
      async loadData(source) {
        if (typeof source === 'string') { const res = await fetch(source); return await res.json(); }
        if (typeof source === 'object') return source;
        throw new Error('Data source must be URL or object');
      },
      
      create(container, spec, data, options = {}) {
        const el = document.createElement('a-entity');
        el.setAttribute('nemosyne-artefact-v2', { spec: JSON.stringify(spec), dataset: JSON.stringify(data), layout: options.layout || 'grid', animate: options.animate !== false, interactive: options.interactive !== false, debug: options.debug || false });
        container.appendChild(el);
        return el;
      },
      
      registerLayout(name, fn) { LayoutEngine.register(name, fn); },
      
      connect(fromEl, toEl, style = {}) {
        const connector = document.createElement('a-entity');
        connector.setAttribute('nemosyne-connector', { from: fromEl, to: toEl, ...style });
        (fromEl.sceneEl || toEl.sceneEl).appendChild(connector);
        return connector;
      }
    };
    
    global.Nemosyne = Nemosyne;
    console.log('🐾 Nemosyne v0.2.0 — Production Ready');
    console.log('Components: nemosyne-artefact-v2, nemosyne-connector, nemosyne-scene');
  }

  initNemosyne();

})(typeof window !== 'undefined' ? window : global);
