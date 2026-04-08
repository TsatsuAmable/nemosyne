/**
 * Nemosyne v0.2.0
 * VR Artefacts for Real-World Data
 * https://nemosyne.world
 * License: MIT
 */
import "https://cdn.jsdelivr.net/npm/d3-scale@4/dist/d3-scale.min.js";
import "https://cdn.jsdelivr.net/npm/d3-color@3/dist/d3-color.min.js";
class MaterialFactory {
  constructor() {
    this.defaults = {
      shader: "standard",
      color: "#00d4aa",
      emissive: "#000000",
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      metalness: 0.5,
      roughness: 0.5,
      wireframe: false
    };
  }
  /**
   * Create material properties for A-Frame
   * @param {Object} spec - Material specification
   * @param {Object} data - Data record for dynamic values
   * @returns {Object} Material properties
   */
  create(spec, data) {
    if (!spec) {
      return { ...this.defaults };
    }
    const props = spec.properties || spec;
    const material = { ...this.defaults };
    Object.keys(props).forEach((key) => {
      const value = props[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        material[key] = value;
      } else if (value == null ? void 0 : value.$data) {
        const dataValue = data == null ? void 0 : data[value.$data];
        if (key === "color" && value.$map) {
          material[key] = this.mapColor(dataValue, value.$map);
        } else if (key === "scale" && value.$range) {
          material[key] = this.mapRange(dataValue, value.$domain, value.$range);
        } else {
          material[key] = dataValue || value.default || this.defaults[key];
        }
      }
    });
    if (material.opacity < 1) {
      material.transparent = true;
    }
    return material;
  }
  /**
   * Map value to color using named scale
   */
  mapColor(value, scaleName) {
    const palettes = {
      "viridis": this.interpolateViridis.bind(this),
      "plasma": this.interpolatePlasma.bind(this),
      "warm": this.interpolateWarm.bind(this),
      "cool": this.interpolateCool.bind(this),
      "category10": this.categoricalColors.bind(this),
      "rdgy": this.redGrey.bind(this),
      // diverging
      "diverging-rdgy": this.redGrey.bind(this)
    };
    const interpolator = palettes[scaleName];
    if (interpolator) {
      return interpolator(value);
    }
    return value || "#00d4aa";
  }
  /**
   * Simple categorical colors
   */
  categoricalColors(value) {
    const colors = [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf"
    ];
    if (typeof value === "number") {
      return colors[value % 10];
    }
    if (typeof value === "string") {
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % 10];
    }
    return colors[0];
  }
  /**
   * Diverging red-grey for positive/negative
   */
  redGrey(value) {
    if (value >= 0) {
      return "#00d4aa";
    }
    return "#ff3864";
  }
  /**
   * Simple viridis approximation
   */
  interpolateViridis(t) {
    t = Math.max(0, Math.min(1, t));
    const r = Math.floor(68 + t * 220);
    const g = Math.floor(1 + t * 180);
    const b = Math.floor(84 + (1 - t) * 80);
    return `rgb(${r},${g},${b})`;
  }
  /**
   * Simple plasma approximation
   */
  interpolatePlasma(t) {
    t = Math.max(0, Math.min(1, t));
    const r = Math.floor(63 + t * 250);
    const g = Math.floor(1 + t * 200);
    const b = Math.floor(150 + (1 - t) * 100);
    return `rgb(${r},${g},${b})`;
  }
  /**
   * Warm colors
   */
  interpolateWarm(t) {
    t = Math.max(0, Math.min(1, t));
    const r = 255;
    const g = Math.floor(100 + t * 155);
    const b = Math.floor(t * 100);
    return `rgb(${r},${g},${b})`;
  }
  /**
   * Cool colors
   */
  interpolateCool(t) {
    t = Math.max(0, Math.min(1, t));
    const r = Math.floor(t * 100);
    const g = Math.floor(150 + t * 105);
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}
class TransformEngine {
  constructor() {
    var _a, _b, _c, _d, _e, _f, _g;
    this.scales = /* @__PURE__ */ new Map();
    this.defaultScales = {
      "viridis": ((_a = d3 == null ? void 0 : d3.scaleSequential) == null ? void 0 : _a.call(d3, d3.interpolateViridis)) || null,
      "plasma": ((_b = d3 == null ? void 0 : d3.scaleSequential) == null ? void 0 : _b.call(d3, d3.interpolatePlasma)) || null,
      "warm": ((_c = d3 == null ? void 0 : d3.scaleSequential) == null ? void 0 : _c.call(d3, d3.interpolateWarm)) || null,
      "cool": ((_d = d3 == null ? void 0 : d3.scaleSequential) == null ? void 0 : _d.call(d3, d3.interpolateCool)) || null,
      "blues": ((_e = d3 == null ? void 0 : d3.scaleSequential) == null ? void 0 : _e.call(d3, d3.interpolateBlues)) || null,
      "reds": ((_f = d3 == null ? void 0 : d3.scaleSequential) == null ? void 0 : _f.call(d3, d3.interpolateReds)) || null,
      "greens": ((_g = d3 == null ? void 0 : d3.scaleSequential) == null ? void 0 : _g.call(d3, d3.interpolateGreens)) || null
    };
  }
  /**
   * Extract transforms from spec and data
   * @param {Object} transformSpec - Transform specification
   * @param {Object} data - Data record
   * @returns {Object} Resolved transforms
   */
  extractTransforms(transformSpec, data) {
    if (!transformSpec) return {};
    return {
      scale: this.resolveScale(transformSpec == null ? void 0 : transformSpec.scale, data),
      position: this.resolvePosition(transformSpec == null ? void 0 : transformSpec.position, data),
      rotation: this.resolveRotation(transformSpec == null ? void 0 : transformSpec.rotation, data),
      color: this.resolveColor((transformSpec == null ? void 0 : transformSpec.color) || transformSpec, data)
    };
  }
  /**
   * Resolve scale transform
   */
  resolveScale(scaleSpec, data) {
    if (!scaleSpec) return 1;
    if (typeof scaleSpec === "number") {
      return scaleSpec;
    }
    if (scaleSpec.$data && data) {
      const value = this.getNestedValue(data, scaleSpec.$data);
      const range = scaleSpec.$range || [0.5, 2];
      const domain = scaleSpec.$domain || this.estimateDomain(data.$dataset, scaleSpec.$data);
      return this.mapRange(value, domain, range);
    }
    return 1;
  }
  /**
   * Resolve position transform
   */
  resolvePosition(positionSpec, data) {
    if (!positionSpec) return null;
    if (positionSpec.$layout) {
      return null;
    }
    return {
      x: positionSpec.x || 0,
      y: positionSpec.y || 0,
      z: positionSpec.z || 0
    };
  }
  /**
   * Resolve rotation transform
   */
  resolveRotation(rotationSpec, data) {
    if (!rotationSpec) return null;
    const rotation = { x: 0, y: 0, z: 0 };
    ["x", "y", "z"].forEach((axis) => {
      const val = rotationSpec[axis];
      if (typeof val === "number") {
        rotation[axis] = val;
      } else if (val == null ? void 0 : val.$data) {
        const value = this.getNestedValue(data, val.$data);
        rotation[axis] = value || 0;
      }
    });
    return rotation;
  }
  /**
   * Resolve color transform
   */
  resolveColor(colorSpec, data) {
    var _a, _b;
    if (!colorSpec) return "#00d4aa";
    if (typeof colorSpec === "string" && !colorSpec.startsWith("$")) {
      return colorSpec;
    }
    if (colorSpec.$data) {
      const value = this.getNestedValue(data, colorSpec.$data);
      const map = colorSpec.$map;
      if (map && this.defaultScales[map]) {
        return this.defaultScales[map](value) || "#00d4aa";
      }
      if (map === "category10") {
        const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
        return colors[Math.abs(((_b = (_a = value == null ? void 0 : value.toString) == null ? void 0 : _a.call(value)) == null ? void 0 : _b.charCodeAt(0)) || 0) % 10];
      }
      if ((map == null ? void 0 : map.includes("diverging")) || (map == null ? void 0 : map.includes("rdgy"))) {
        return value >= 0 ? "#00d4aa" : "#ff3864";
      }
    }
    return "#00d4aa";
  }
  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!obj || !path) return void 0;
    return path.split(".").reduce((curr, key) => curr == null ? void 0 : curr[key], obj);
  }
  /**
   * Map value from one range to another
   */
  mapRange(value, domain, range) {
    if (value === void 0 || value === null) return range[0];
    const [dMin, dMax] = domain;
    const [rMin, rMax] = range;
    if (dMax === dMin) return rMin;
    const normalized = Math.max(0, Math.min(1, (value - dMin) / (dMax - dMin)));
    return rMin + normalized * (rMax - rMin);
  }
  /**
   * Estimate domain from dataset (would be calculated from full data in real implementation)
   */
  estimateDomain(dataset, field) {
    return [0, 100];
  }
}
class BehaviourEngine {
  constructor() {
    this.handlers = /* @__PURE__ */ new Map();
    this.setupDefaultHandlers();
  }
  setupDefaultHandlers() {
    this.handlers.set("hover", this.handleHover.bind(this));
    this.handlers.set("hover-leave", this.handleHoverLeave.bind(this));
    this.handlers.set("click", this.handleClick.bind(this));
    this.handlers.set("idle", this.handleIdle.bind(this));
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
    behaviours.forEach((behaviour) => {
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
    if (trigger === "idle") {
      return { trigger, action, params };
    }
    const callback = () => {
      if (sequence) {
        this.executeSequence(entity, sequence, data);
      } else {
        this.executeAction(entity, action, params, data);
      }
    };
    const eventMap = {
      "hover": "mouseenter",
      "hover-leave": "mouseleave",
      "click": "click"
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
      case "glow":
        this.actionGlow(entity, params);
        break;
      case "scale":
        this.actionScale(entity, params);
        break;
      case "move":
        this.actionMove(entity, params);
        break;
      case "show-label":
        this.actionShowLabel(entity, params, data);
        break;
      case "hide-label":
        this.actionHideLabel(entity, params);
        break;
      case "highlight-path":
        this.actionHighlightPath(entity, params, data);
        break;
      case "reveal":
        this.actionReveal(entity, params);
        break;
      case "emit":
        this.actionEmit(entity, params);
        break;
      case "color-shift":
        this.actionColorShift(entity, params);
        break;
      default:
        console.warn(`Nemosyne: Unknown action "${action}"`);
    }
  }
  /**
   * Execute a sequence of actions
   */
  static executeSequence(entity, sequence, data) {
    sequence.forEach((step, index) => {
      setTimeout(() => {
        this.executeAction(entity, step.action, step.params, data);
      }, index * (step.delay || 0));
    });
  }
  // Action implementations
  actionGlow(entity, params) {
    const geometryEl = entity.querySelector("[geometry]");
    if (!geometryEl) return;
    const intensity = (params == null ? void 0 : params.intensity) || 1;
    const duration = ((params == null ? void 0 : params.duration) || 0.3) * 1e3;
    geometryEl.setAttribute("animation__glow", {
      property: "material.emissiveIntensity",
      to: intensity,
      dur: duration,
      easing: "easeInOutQuad"
    });
  }
  actionScale(entity, params) {
    const factor = (params == null ? void 0 : params.factor) || 1;
    const duration = ((params == null ? void 0 : params.duration) || 0.2) * 1e3;
    entity.setAttribute("animation__scale", {
      property: "scale",
      to: `${factor} ${factor} ${factor}`,
      dur: duration,
      easing: "easeOutElastic"
    });
  }
  actionMove(entity, params) {
    const to = (params == null ? void 0 : params.to) || { x: 0, y: 0, z: 0 };
    const duration = ((params == null ? void 0 : params.duration) || 0.5) * 1e3;
    entity.setAttribute("animation__move", {
      property: "position",
      to: `${to.x} ${to.y} ${to.z}`,
      dur: duration,
      easing: "easeInOutQuad"
    });
  }
  actionShowLabel(entity, params, data) {
    let label = entity.querySelector("a-text");
    if (!label) {
      label = document.createElement("a-text");
      label.setAttribute("align", "center");
      label.setAttribute("width", (params == null ? void 0 : params.width) || 6);
      entity.appendChild(label);
    }
    let content = "";
    if (params == null ? void 0 : params.content) {
      if (params.content.$data) {
        content = (data == null ? void 0 : data[params.content.$data]) || "";
      } else if (typeof params.content === "string") {
        content = params.content;
      }
    }
    label.setAttribute("value", content);
    label.setAttribute("visible", true);
    label.setAttribute("position", (params == null ? void 0 : params.position) === "above" ? "0 2 0" : "0 0 0");
    if (params == null ? void 0 : params.duration) {
      setTimeout(() => {
        label.setAttribute("visible", false);
      }, params.duration * 1e3);
    }
  }
  actionHideLabel(entity, params) {
    const label = entity.querySelector("a-text");
    if (label) {
      label.setAttribute("visible", false);
    }
  }
  actionHighlightPath(entity, params, data) {
    console.log("Highlight path:", params);
  }
  actionReveal(entity, params) {
    const children = entity.querySelectorAll("[data-artefact-child]");
    children.forEach((child) => {
      child.setAttribute("visible", true);
      child.setAttribute("animation__reveal", {
        property: "scale",
        from: "0 0 0",
        to: "1 1 1",
        dur: 500,
        easing: "easeOutBack"
      });
    });
  }
  actionEmit(entity, params) {
    console.log("Emit particles:", params);
  }
  actionColorShift(entity, params) {
    const geometryEl = entity.querySelector("[geometry]");
    if (!geometryEl) return;
    const to = (params == null ? void 0 : params.to) || "#ffffff";
    const duration = ((params == null ? void 0 : params.duration) || 0.3) * 1e3;
    geometryEl.setAttribute("animation__color", {
      property: "material.color",
      to,
      dur: duration
    });
  }
  // Event handlers
  handleHover(event, entity, params) {
    this.actionGlow(entity, params);
  }
  handleHoverLeave(event, entity, params) {
    const defaultIntensity = (params == null ? void 0 : params.defaultIntensity) || 0.5;
    this.actionGlow(entity, { intensity: defaultIntensity });
  }
  handleClick(event, entity, params) {
    this.actionScale(entity, { factor: 1.2, duration: 0.2 });
  }
  handleIdle(entity, params) {
  }
}
class ArtefactBuilder {
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
    var _a, _b;
    const wrapper = document.createElement("a-entity");
    wrapper.setAttribute("position", position);
    const transforms = this.transformEngine.extractTransforms(spec.transform, data);
    const geometryEl = this.createGeometry(spec.geometry, spec.material, data, transforms);
    const visual = document.createElement("a-entity");
    visual.appendChild(geometryEl);
    if ((_b = (_a = spec.material) == null ? void 0 : _a.properties) == null ? void 0 : _b.emissive) {
      const glow = this.createGlow(spec.material.properties.emissive, (transforms == null ? void 0 : transforms.scale) || 1);
      visual.appendChild(glow);
    }
    wrapper.appendChild(visual);
    if (spec.labels) {
      const label = this.createLabel(spec.labels, data);
      if (label) wrapper.appendChild(label);
    }
    const behaviours = this.behaviourEngine.setup(wrapper, spec.behaviours, data);
    container.appendChild(wrapper);
    this.applyAnimations(wrapper, transforms, spec.behaviours);
    return {
      el: wrapper,
      geometry: geometryEl,
      behaviours,
      data,
      spec
    };
  }
  /**
   * Create the main geometry entity
   */
  createGeometry(geometrySpec, materialSpec, data, transforms) {
    const type = (geometrySpec == null ? void 0 : geometrySpec.type) || "octahedron";
    const radius = (geometrySpec == null ? void 0 : geometrySpec.radius) || 1;
    const primitiveMap = {
      "sphere": "a-sphere",
      "box": "a-box",
      "cylinder": "a-cylinder",
      "octahedron": "a-octahedron",
      "tetrahedron": "a-tetrahedron",
      "dodecahedron": "a-dodecahedron",
      "icosahedron": "a-icosahedron",
      "torus": "a-torus",
      "torusKnot": "a-torus-knot",
      "plane": "a-plane",
      "circle": "a-circle",
      "ring": "a-ring"
    };
    const primitive = primitiveMap[type] || "a-octahedron";
    const el = document.createElement(primitive);
    switch (type) {
      case "sphere":
        el.setAttribute("radius", ((transforms == null ? void 0 : transforms.scale) || 1) * radius);
        break;
      case "box":
        const s = ((transforms == null ? void 0 : transforms.scale) || 1) * radius;
        el.setAttribute("width", s * 1.5);
        el.setAttribute("height", s * 1.5);
        el.setAttribute("depth", s * 1.5);
        break;
      case "cylinder":
        el.setAttribute("radius", radius * 0.5);
        el.setAttribute("height", ((transforms == null ? void 0 : transforms.scale) || 1) * radius * 2);
        break;
      case "octahedron":
        el.setAttribute("radius", ((transforms == null ? void 0 : transforms.scale) || 1) * radius);
        break;
      default:
        el.setAttribute("radius", ((transforms == null ? void 0 : transforms.scale) || 1) * radius);
    }
    const material = this.materialFactory.create(materialSpec, data);
    el.setAttribute("material", material);
    if (transforms == null ? void 0 : transforms.rotation) {
      el.setAttribute("rotation", transforms.rotation);
    }
    return el;
  }
  /**
   * Create glow effect entity
   */
  createGlow(emissiveColor, baseScale) {
    const glow = document.createElement("a-sphere");
    const glowScale = baseScale * 1.3;
    glow.setAttribute("radius", glowScale);
    glow.setAttribute("material", {
      color: emissiveColor,
      transparent: true,
      opacity: 0.15,
      emissive: emissiveColor,
      emissiveIntensity: 0.3
    });
    glow.setAttribute("animation", {
      property: "scale",
      dir: "alternate",
      to: `${glowScale * 1.1} ${glowScale * 1.1} ${glowScale * 1.1}`,
      dur: 2e3,
      loop: true,
      easing: "easeInOutSine"
    });
    return glow;
  }
  /**
   * Create label entity
   */
  createLabel(labelSpec, data) {
    var _a;
    if (!labelSpec.primary) return null;
    const text = this.resolveLabelContent(labelSpec.primary, data);
    const label = document.createElement("a-text");
    label.setAttribute("value", text);
    label.setAttribute("color", labelSpec.color || "#d4af37");
    label.setAttribute("align", "center");
    label.setAttribute("width", labelSpec.width || 6);
    label.setAttribute("position", this.getLabelPosition(labelSpec.position));
    if (((_a = labelSpec.visible) == null ? void 0 : _a.$trigger) === "click") {
      label.setAttribute("visible", false);
    }
    return label;
  }
  /**
   * Resolve label content from data
   */
  resolveLabelContent(labelSpec, data) {
    if (typeof labelSpec === "string") {
      return labelSpec;
    }
    if (labelSpec.$data) {
      return data[labelSpec.$data] || "";
    }
    if (labelSpec.$template) {
      let template = labelSpec.$template;
      template = template.replace(/{(\w+)}/g, (match, key) => data[key] || match);
      return template;
    }
    return "";
  }
  /**
   * Get label position relative to artefact
   */
  getLabelPosition(position) {
    const positions = {
      "above": "0 2 0",
      "below": "0 -1.5 0",
      "front": "0 0 1.5",
      "center": "0 0 0"
    };
    return positions[position] || positions["above"];
  }
  /**
   * Apply animations to entity
   */
  applyAnimations(entity, transforms, behaviours) {
    var _a, _b;
    const idleBehaviour = behaviours == null ? void 0 : behaviours.find((b) => (b == null ? void 0 : b.trigger) === "idle");
    if (idleBehaviour && idleBehaviour.action === "rotate") {
      const speed = ((_a = idleBehaviour.params) == null ? void 0 : _a.speed) || 0.5;
      const axis = ((_b = idleBehaviour.params) == null ? void 0 : _b.axis) || "y";
      const rotationProperty = axis === "x" ? `360 0 0` : axis === "y" ? `0 360 0` : `0 0 360`;
      entity.setAttribute("animation", {
        property: "rotation",
        to: rotationProperty,
        loop: true,
        dur: 1e4 / speed,
        easing: "linear"
      });
    }
    entity.setAttribute("animation__entry", {
      property: "scale",
      from: "0 0 0",
      to: "1 1 1",
      dur: 1e3,
      easing: "easeOutElastic"
    });
  }
}
class DataLoader {
  /**
   * Load JSON from URL
   * @param {string} url - URL to load from
   * @returns {Promise<Object>} Loaded data
   */
  static async loadJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Nemosyne: Failed to load ${url}:`, error);
      throw error;
    }
  }
  /**
   * Load CSV data
   * @param {string} url - URL to load from
   * @returns {Promise<Object>} Parsed CSV as array of records
   */
  static async loadCSV(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      return this.parseCSV(text);
    } catch (error) {
      console.error(`Nemosyne: Failed to load CSV ${url}:`, error);
      throw error;
    }
  }
  /**
   * Parse CSV text to array of objects
   * @param {string} text - CSV text
   * @returns {Object} Parsed data
   */
  static parseCSV(text) {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return { records: [] };
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const records = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const record = {};
      headers.forEach((header, i) => {
        const numValue = Number(values[i]);
        record[header] = isNaN(numValue) ? values[i] : numValue;
      });
      return record;
    });
    return { records };
  }
  /**
   * Load from WebSocket for real-time data
   * @param {string} url - WebSocket URL
   * @param {Function} callback - Callback for new data
   * @returns {WebSocket} WebSocket instance
   */
  static loadWebSocket(url, callback) {
    const ws = new WebSocket(url);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error("Nemosyne: WebSocket parse error:", error);
      }
    };
    ws.onerror = (error) => {
      console.error("Nemosyne: WebSocket error:", error);
    };
    return ws;
  }
  /**
   * Generate sample/demo data
   * @param {string} type - Type of sample data
   * @param {number} count - Number of records
   * @returns {Object} Sample data
   */
  static generateSample(type = "random", count = 10) {
    const records = [];
    switch (type) {
      case "network":
        for (let i = 0; i < count; i++) {
          records.push({
            id: `node-${i}`,
            value: Math.floor(Math.random() * 100),
            connections: Math.floor(Math.random() * 5),
            category: ["A", "B", "C"][Math.floor(Math.random() * 3)]
          });
        }
        break;
      case "timeline":
        const baseDate = /* @__PURE__ */ new Date();
        for (let i = 0; i < count; i++) {
          const date = new Date(baseDate);
          date.setDate(date.getDate() - i);
          records.push({
            date: date.toISOString().split("T")[0],
            value: 50 + Math.random() * 50,
            change: (Math.random() - 0.5) * 20
          });
        }
        break;
      case "hierarchy":
        const buildTree = (id, depth) => {
          const node = { id, value: Math.random() * 100 };
          if (depth > 0) {
            node.children = [];
            for (let i = 0; i < 3; i++) {
              node.children.push(buildTree(`${id}-${i}`, depth - 1));
            }
          }
          return node;
        };
        return { root: buildTree("root", 3) };
      case "random":
      default:
        for (let i = 0; i < count; i++) {
          records.push({
            id: i,
            value: Math.random() * 100,
            label: `Item ${i}`,
            category: Math.floor(Math.random() * 5)
          });
        }
    }
    return { records };
  }
}
class LayoutEngine {
  constructor() {
    this.layouts = /* @__PURE__ */ new Map();
    this.registerDefaultLayouts();
  }
  registerDefaultLayouts() {
    this.layouts.set("grid", this.gridLayout.bind(this));
    this.layouts.set("radial", this.radialLayout.bind(this));
    this.layouts.set("timeline", this.timelineLayout.bind(this));
    this.layouts.set("spiral", this.spiralLayout.bind(this));
    this.layouts.set("tree", this.treeLayout.bind(this));
    this.layouts.set("force", this.forceLayout.bind(this));
    this.layouts.set("scatter", this.scatterLayout.bind(this));
  }
  /**
   * Calculate positions for data records
   * @param {string} layoutName - Layout algorithm name
   * @param {Array} records - Data records
   * @param {Object} options - Layout-specific options
   * @returns {Array} Array of {x, y, z} positions
   */
  calculate(layoutName, records, options = {}) {
    const layoutFn = this.layouts.get(layoutName);
    if (!layoutFn) {
      console.warn(`Nemosyne: Unknown layout "${layoutName}". Using scatter.`);
      return this.scatterLayout(records, options);
    }
    return layoutFn(records, options);
  }
  /**
   * Grid layout - rows and columns
   */
  gridLayout(records, options = {}) {
    const cols = options.columns || Math.ceil(Math.sqrt(records.length));
    const spacing = options.spacing || 3;
    const offset = options.offset || { x: 0, y: 0, z: 0 };
    return records.map((_, i) => ({
      x: (i % cols - (cols - 1) / 2) * spacing + offset.x,
      y: (Math.floor(i / cols) - Math.floor((records.length - 1) / cols) / 2) * -spacing + offset.y,
      z: offset.z
    }));
  }
  /**
   * Radial layout - circular arrangement
   */
  radialLayout(records, options = {}) {
    const radius = options.radius || 5;
    const angleOffset = options.angleOffset || 0;
    const yOffset = options.yOffset || 0;
    return records.map((_, i) => {
      const angle = i / records.length * Math.PI * 2 + angleOffset;
      return {
        x: Math.cos(angle) * radius,
        y: yOffset,
        z: Math.sin(angle) * radius
      };
    });
  }
  /**
   * Timeline layout - linear arrangement along X axis
   */
  timelineLayout(records, options = {}) {
    const spacing = options.spacing || 3;
    const totalWidth = (records.length - 1) * spacing;
    const yOffset = options.yOffset || 0;
    const zOffset = options.zOffset || 0;
    return records.map((_, i) => ({
      x: i * spacing - totalWidth / 2,
      y: yOffset,
      z: zOffset
    }));
  }
  /**
   * Spiral layout - rising spiral
   */
  spiralLayout(records, options = {}) {
    const radius = options.radius || 5;
    const heightStep = options.heightStep || 0.5;
    const rotations = options.rotations || 2;
    const radiusShrink = options.radiusShrink || 0.3;
    return records.map((_, i) => {
      const t = i / records.length;
      const angle = t * Math.PI * 2 * rotations;
      const r = radius * (1 - t * radiusShrink);
      return {
        x: Math.cos(angle) * r,
        y: i * heightStep,
        z: Math.sin(angle) * r
      };
    });
  }
  /**
   * Tree layout - hierarchical arrangement
   */
  treeLayout(records, options = {}) {
    options.levelHeight || 3;
    const siblingSpacing = options.siblingSpacing || 4;
    const nodes = records.map((r) => ({ ...r, children: [], width: 1 }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    nodes.forEach((node) => {
      if (node.parent && nodeMap.has(node.parent)) {
        const parent = nodeMap.get(node.parent);
        parent.children.push(node);
      }
    });
    const root = nodes.find((n) => !n.parent) || nodes[0];
    this.calculateTreePositions(root, 0, 0, 0, siblingSpacing);
    return nodes.map((n) => ({ x: n.x, y: n.y, z: n.z }));
  }
  calculateTreePositions(node, x, y, z, siblingSpacing) {
    node.x = x;
    node.y = y;
    node.z = z;
    if (node.children.length > 0) {
      const totalWidth = (node.children.length - 1) * siblingSpacing;
      const startX = x - totalWidth / 2;
      node.children.forEach((child, i) => {
        this.calculateTreePositions(
          child,
          startX + i * siblingSpacing,
          y - 3,
          // Lower levels
          z,
          siblingSpacing
        );
      });
    }
  }
  /**
   * Force layout - simple force-directed (placeholder for full implementation)
   */
  forceLayout(records, options = {}) {
    const bounds = options.bounds || 10;
    return records.map(() => ({
      x: (Math.random() - 0.5) * bounds,
      y: (Math.random() - 0.5) * bounds * 0.5,
      z: (Math.random() - 0.5) * bounds
    }));
  }
  /**
   * Scatter layout - random positions
   */
  scatterLayout(records, options = {}) {
    const bounds = options.bounds || 10;
    return records.map(() => ({
      x: (Math.random() - 0.5) * bounds,
      y: (Math.random() - 0.5) * bounds * 0.5,
      z: (Math.random() - 0.5) * bounds
    }));
  }
  /**
   * Register custom layout
   * @param {string} name - Layout name
   * @param {Function} fn - Layout function (records, options) => positions
   */
  register(name, fn) {
    this.layouts.set(name, fn);
  }
}
const layoutEngine = new LayoutEngine();
class Validator {
  static validateSpec(spec) {
    var _a;
    const errors = [];
    if (!spec) {
      errors.push("Spec is required");
      return errors;
    }
    if (!spec.id) {
      errors.push('Spec must have an "id"');
    }
    if (spec.geometry) {
      const validTypes = [
        "sphere",
        "box",
        "cylinder",
        "octahedron",
        "tetrahedron",
        "dodecahedron",
        "icosahedron",
        "torus",
        "plane",
        "circle"
      ];
      if (spec.geometry.type && !validTypes.includes(spec.geometry.type)) {
        errors.push(`Invalid geometry type: ${spec.geometry.type}`);
      }
    }
    if (spec.material) {
      if ((_a = spec.material.properties) == null ? void 0 : _a.color) {
        const color = spec.material.properties.color;
        if (typeof color === "string" && !this.isValidColor(color)) {
          errors.push(`Invalid color: ${color}`);
        }
      }
    }
    if (spec.behaviours) {
      if (!Array.isArray(spec.behaviours)) {
        errors.push("Behaviours must be an array");
      } else {
        const validTriggers = ["hover", "hover-leave", "click", "idle", "data-update"];
        const validActions = [
          "glow",
          "scale",
          "move",
          "rotate",
          "color-shift",
          "show-label",
          "hide-label",
          "pulse",
          "emit",
          "reveal"
        ];
        spec.behaviours.forEach((b, i) => {
          if (b.trigger && !validTriggers.includes(b.trigger)) {
            errors.push(`Behaviour ${i}: Invalid trigger "${b.trigger}"`);
          }
          if (b.action && !validActions.includes(b.action)) {
            errors.push(`Behaviour ${i}: Invalid action "${b.action}"`);
          }
        });
      }
    }
    if (errors.length > 0) {
      console.warn("Nemosyne spec validation errors:", errors);
      throw new Error(`Spec validation failed: ${errors.join(", ")}`);
    }
    return true;
  }
  static validateData(data) {
    const errors = [];
    if (!data) {
      errors.push("Data is required");
      return errors;
    }
    const records = data.records || data.nodes || data.data;
    if (!records) {
      errors.push('Data must contain "records", "nodes", or "data" array');
    } else if (!Array.isArray(records)) {
      errors.push("Records must be an array");
    }
    if (errors.length > 0) {
      console.warn("Nemosyne data validation errors:", errors);
      throw new Error(`Data validation failed: ${errors.join(", ")}`);
    }
    return true;
  }
  static isValidColor(color) {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) return true;
    if (/^#[0-9A-Fa-f]{3}$/.test(color)) return true;
    if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) return true;
    const namedColors = [
      "red",
      "green",
      "blue",
      "yellow",
      "cyan",
      "magenta",
      "white",
      "black",
      "gray",
      "grey",
      "orange",
      "purple",
      "pink",
      "teal"
    ];
    if (namedColors.includes(color.toLowerCase())) return true;
    return false;
  }
}
const validateSpec = Validator.validateSpec.bind(Validator);
const validateData = Validator.validateData.bind(Validator);
const NemosyneArtefactV2 = {
  schema: {
    // Primary configuration
    src: { type: "string", default: "" },
    // URL to artefact spec
    data: { type: "string", default: "" },
    // URL to data
    // Inline configuration (alternative to src/data)
    spec: { type: "string", default: "" },
    // JSON string or object
    dataset: { type: "string", default: "" },
    // JSON string or object
    // Layout configuration
    layout: { type: "string", default: "grid" },
    // grid, radial, timeline, spiral, tree, force
    "layout-options": { type: "string", default: "{}" },
    // JSON string of options
    // Rendering options
    animate: { type: "boolean", default: true },
    "entry-duration": { type: "number", default: 800 },
    // Interactions
    interactive: { type: "boolean", default: true },
    // Debug
    debug: { type: "boolean", default: false }
  },
  init: function() {
    this.artefacts = [];
    this.connectors = [];
    this.isLoaded = false;
    try {
      this.layoutOptions = JSON.parse(this.data["layout-options"]);
    } catch (e) {
      this.layoutOptions = {};
    }
    this.loadConfiguration();
  },
  loadConfiguration: async function() {
    try {
      let spec = await this.loadSpec();
      let dataset = await this.loadData();
      if (this.debug) {
        validateSpec(spec);
        validateData(dataset);
      }
      const records = this.extractRecords(dataset);
      const positions = layoutEngine.calculate(
        this.data.layout,
        records,
        this.layoutOptions
      );
      await this.buildArtefacts(spec, records, positions);
      await this.setupConnections(spec, records);
      this.isLoaded = true;
      this.el.emit("nemosyne-loaded", {
        count: this.artefacts.length,
        layout: this.data.layout
      });
    } catch (error) {
      console.error("Nemosyne: Error loading configuration:", error);
      this.showError(error.message);
      this.el.emit("nemosyne-error", { error: error.message });
    }
  },
  loadSpec: async function() {
    if (this.data.spec) {
      try {
        return JSON.parse(this.data.spec);
      } catch (e) {
        throw new Error("Invalid JSON in spec: " + e.message);
      }
    }
    if (this.data.src) {
      return await DataLoader.loadJSON(this.data.src);
    }
    return {
      id: "default",
      geometry: { type: "octahedron", radius: 1 },
      material: { properties: { color: "#00d4aa" } }
    };
  },
  loadData: async function() {
    if (this.data.dataset) {
      try {
        return JSON.parse(this.data.dataset);
      } catch (e) {
        throw new Error("Invalid JSON in dataset: " + e.message);
      }
    }
    if (this.data.data) {
      return await DataLoader.loadJSON(this.data.data);
    }
    return { records: [{ value: 42, label: "Default" }] };
  },
  extractRecords: function(dataset) {
    return dataset.records || dataset.nodes || dataset.data || (Array.isArray(dataset) ? dataset : [dataset]);
  },
  buildArtefacts: function(spec, records, positions) {
    const builder = new ArtefactBuilder();
    records.forEach((record, i) => {
      const position = positions[i] || { x: 0, y: 0, z: 0 };
      const artefact = builder.build(spec, record, position, this.el);
      artefact.el.dataset.artefactId = record.id || i;
      this.artefacts.push(artefact);
    });
  },
  setupConnections: function(spec, records) {
    if (spec.connections === "auto" && records.some((r) => r.parent)) {
      this.createParentChildConnections(records);
    }
    if (spec.edges && Array.isArray(spec.edges)) {
      spec.edges.forEach((edge) => {
        this.createExplicitConnection(edge);
      });
    }
  },
  createParentChildConnections: function(records) {
    records.forEach((record) => {
      var _a, _b;
      if (record.parent) {
        const parentIndex = records.findIndex((r) => r.id === record.parent);
        const childIndex = records.findIndex((r) => r.id === record.id);
        if (parentIndex >= 0 && childIndex >= 0) {
          const parentEl = (_a = this.artefacts[parentIndex]) == null ? void 0 : _a.el;
          const childEl = (_b = this.artefacts[childIndex]) == null ? void 0 : _b.el;
          if (parentEl && childEl) {
            this.createConnector(parentEl, childEl);
          }
        }
      }
    });
  },
  createExplicitConnection: function(edgeSpec) {
    const fromIndex = this.artefacts.findIndex(
      (a) => a.data.id === edgeSpec.from || a.data.id === edgeSpec.source
    );
    const toIndex = this.artefacts.findIndex(
      (a) => a.data.id === edgeSpec.to || a.data.id === edgeSpec.target
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
    const connector = document.createElement("a-entity");
    connector.setAttribute("nemosyne-connector", {
      from: fromEl,
      to: toEl,
      color: style.color || "#00d4aa",
      thickness: style.thickness || 0.03,
      opacity: style.opacity || 0.4,
      animated: style.animated || false,
      pulse: style.pulse || false
    });
    this.el.appendChild(connector);
    this.connectors.push(connector);
  },
  showError: function(message) {
    const errorEl = document.createElement("a-text");
    errorEl.setAttribute("value", `Nemosyne Error: ${message}`);
    errorEl.setAttribute("color", "#ff3864");
    errorEl.setAttribute("align", "center");
    errorEl.setAttribute("position", "0 2 0");
    errorEl.setAttribute("scale", "0.8 0.8 0.8");
    this.el.appendChild(errorEl);
  },
  remove: function() {
    this.artefacts.forEach((a) => {
      var _a;
      if ((_a = a.el) == null ? void 0 : _a.parentNode) a.el.parentNode.removeChild(a.el);
    });
    this.connectors.forEach((c) => {
      if (c.parentNode) c.parentNode.removeChild(c);
    });
    this.artefacts = [];
    this.connectors = [];
  }
};
const NemosyneConnector = {
  schema: {
    // Source and target artefact selectors
    from: { type: "selector", default: "" },
    to: { type: "selector", default: "" },
    // Connection style
    type: { type: "string", default: "line" },
    // line, curve, tube, beam
    thickness: { type: "number", default: 0.03 },
    // Appearance
    color: { type: "string", default: "#00d4aa" },
    opacity: { type: "number", default: 0.4 },
    emissive: { type: "string", default: "#00d4aa" },
    emissiveIntensity: { type: "number", default: 0.2 },
    // Animation
    animated: { type: "boolean", default: false },
    pulse: { type: "boolean", default: false }
  },
  init: function() {
    this.sourceEl = null;
    this.targetEl = null;
    this.connectorEl = null;
    this.findEndpoints();
    this.createConnector();
    this.setupObservers();
  },
  findEndpoints: function() {
    this.sourceEl = this.data.from;
    this.targetEl = this.data.to;
    if (!this.sourceEl || !this.targetEl) {
      console.warn("Nemosyne connector: Could not find source or target");
      return;
    }
  },
  createConnector: function() {
    if (!this.sourceEl || !this.targetEl) return;
    if (this.connectorEl) {
      this.connectorEl.parentNode.removeChild(this.connectorEl);
    }
    const type = this.data.type;
    switch (type) {
      case "line":
        this.connectorEl = this.createLine();
        break;
      case "curve":
        this.connectorEl = this.createCurve();
        break;
      case "tube":
        this.connectorEl = this.createTube();
        break;
      case "beam":
        this.connectorEl = this.createBeam();
        break;
      default:
        this.connectorEl = this.createLine();
    }
    if (this.connectorEl) {
      this.el.appendChild(this.connectorEl);
      this.updatePosition();
    }
  },
  createLine: function() {
    const line = document.createElement("a-entity");
    line.setAttribute("geometry", {
      primitive: "cylinder",
      radius: this.data.thickness,
      height: 1
      // Will be updated
    });
    line.setAttribute("material", {
      color: this.data.color,
      opacity: this.data.opacity,
      transparent: true,
      emissive: this.data.emissive,
      emissiveIntensity: this.data.emissiveIntensity
    });
    if (this.data.pulse) {
      line.setAttribute("animation", {
        property: "material.emissiveIntensity",
        from: this.data.emissiveIntensity,
        to: this.data.emissiveIntensity * 2,
        dir: "alternate",
        dur: 1e3,
        loop: true,
        easing: "easeInOutSine"
      });
    }
    if (this.data.animated) {
      line.setAttribute("animation__flow", {
        property: "material.opacity",
        from: this.data.opacity,
        to: this.data.opacity * 1.5,
        dir: "alternate",
        dur: 800,
        loop: true
      });
    }
    return line;
  },
  createCurve: function() {
    return this.createLine();
  },
  createTube: function() {
    return this.createLine();
  },
  createBeam: function() {
    const beam = this.createLine();
    beam.setAttribute("geometry", "radius", this.data.thickness * 2);
    beam.setAttribute("material", "emissiveIntensity", this.data.emissiveIntensity * 2);
    return beam;
  },
  updatePosition: function() {
    if (!this.sourceEl || !this.targetEl || !this.connectorEl) return;
    const posA = this.getWorldPosition(this.sourceEl);
    const posB = this.getWorldPosition(this.targetEl);
    const distance = Math.sqrt(
      Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2) + Math.pow(posB.z - posA.z, 2)
    );
    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;
    const midZ = (posA.z + posB.z) / 2;
    this.connectorEl.setAttribute("position", `${midX} ${midY} ${midZ}`);
    this.connectorEl.setAttribute("geometry", "height", distance);
    this.connectorEl.object3D.lookAt(posB.x, posB.y, posB.z);
    this.connectorEl.object3D.rotateX(Math.PI / 2);
  },
  getWorldPosition: function(el) {
    const position = new THREE.Vector3();
    el.object3D.getWorldPosition(position);
    return position;
  },
  setupObservers: function() {
    this.tick = AFRAME.utils.throttleTick(this.updatePosition.bind(this), 100, this);
  },
  remove: function() {
    if (this.connectorEl && this.connectorEl.parentNode) {
      this.connectorEl.parentNode.removeChild(this.connectorEl);
    }
  }
};
const NemosyneScene = {
  schema: {
    theme: { type: "string", default: "void" },
    // void, light, color
    fog: { type: "boolean", default: true },
    fogDensity: { type: "number", default: 0.02 },
    grid: { type: "boolean", default: false },
    shadows: { type: "boolean", default: true }
  },
  init: function() {
    this.applyTheme();
    this.setupLighting();
    this.setupEnvironment();
  },
  applyTheme: function() {
    const theme2 = this.data.theme;
    switch (theme2) {
      case "void":
        this.el.setAttribute("background", { color: "#000205" });
        this.el.setAttribute("fog", {
          type: "exponential",
          color: "#000510",
          density: this.data.fogDensity
        });
        break;
      case "light":
        this.el.setAttribute("background", { color: "#f5f5f7" });
        this.el.setAttribute("fog", {
          type: "linear",
          color: "#ffffff",
          near: 10,
          far: 50
        });
        break;
      case "color":
        this.el.setAttribute("background", { color: "#0a0a1a" });
        break;
    }
    this.el.setAttribute("renderer", {
      colorManagement: true,
      physicallyCorrectLights: true
    });
  },
  setupLighting: function() {
    if (!this.el.querySelector('a-light[type="ambient"]')) {
      const ambient = document.createElement("a-light");
      ambient.setAttribute("type", "ambient");
      ambient.setAttribute("color", theme === "void" ? "#001122" : "#ffffff");
      ambient.setAttribute("intensity", theme === "void" ? "0.3" : "0.6");
      this.el.appendChild(ambient);
    }
    if (!this.el.querySelector("a-light[main-light]")) {
      const main = document.createElement("a-light");
      main.setAttribute("type", "point");
      main.setAttribute("position", "2 4 4");
      main.setAttribute("intensity", "1.5");
      main.setAttribute("color", "#ffffff");
      main.setAttribute("cast-shadow", this.data.shadows);
      main.setAttribute("main-light", "");
      this.el.appendChild(main);
    }
  },
  setupEnvironment: function() {
    if (this.data.grid) {
      const grid = document.createElement("a-grid");
      grid.setAttribute("id", "ground");
      grid.setAttribute("static-body", "");
      this.el.appendChild(grid);
    }
  }
};
function quickStart(container, config) {
  const defaults = {
    type: "crystal",
    data: [],
    layout: "grid",
    color: "#00d4aa",
    labels: true,
    animate: true
  };
  const opts = { ...defaults, ...config };
  const records = opts.data.map((d, i) => ({
    id: `item-${i}`,
    value: typeof d === "number" ? d : d.value || 0,
    label: typeof d === "object" ? d.label : String(d),
    ...typeof d === "object" && !d.value && !d.label ? d : {}
  }));
  const geometry = getGeometryForType(opts.type);
  const spec = {
    id: `${opts.type}-${Date.now()}`,
    geometry,
    material: {
      properties: {
        color: opts.color,
        emissive: opts.color,
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.2
      }
    },
    transform: {
      scale: opts.type === "bar" ? { $data: "value", $range: [1, 5] } : { $data: "value", $range: [0.5, 1.5] }
    },
    behaviours: [
      { trigger: "hover", action: "glow", params: { intensity: 2 } },
      { trigger: "hover-leave", action: "glow", params: { intensity: 0.4 } },
      { trigger: "click", action: opts.labels ? "show-label" : "scale", params: { factor: 1.3 } },
      { trigger: "idle", action: "rotate", params: { speed: 0.2, axis: "y" } }
    ],
    labels: opts.labels ? {
      primary: { $data: "label" },
      color: "#fff",
      position: opts.type === "bar" ? "below" : "above"
    } : null
  };
  const layoutMap = {
    "bar": "grid",
    "line": "timeline",
    "scatter": "scatter",
    "network": "force",
    "tree": "tree",
    "spiral": "spiral",
    "grid": "grid",
    "radial": "radial",
    "timeline": "timeline"
  };
  const el = document.createElement("a-entity");
  el.setAttribute("nemosyne-artefact-v2", {
    spec: JSON.stringify(spec),
    dataset: JSON.stringify({ records }),
    layout: layoutMap[opts.layout] || "grid",
    animate: opts.animate
  });
  container.appendChild(el);
  return el;
}
function getGeometryForType(type) {
  const map = {
    "crystal": { type: "octahedron", radius: 1 },
    "sphere": { type: "sphere", radius: 0.8 },
    "bar": { type: "box" },
    "node": { type: "dodecahedron", radius: 0.7 },
    "orb": { type: "sphere", radius: 1 }
  };
  return map[type] || map["crystal"];
}
const presets = {
  /**
   * Bar chart preset
   */
  barChart(data, options = {}) {
    return {
      type: "bar",
      data,
      layout: "bar",
      color: options.color || "#00d4aa",
      ...options
    };
  },
  /**
   * Network graph preset
   */
  network(nodes, edges, options = {}) {
    return {
      type: "node",
      data: nodes.map((n, i) => ({ id: i, ...n })),
      layout: "network",
      connections: edges,
      color: options.color || "category10",
      ...options
    };
  },
  /**
   * Timeline preset
   */
  timeline(data, options = {}) {
    return {
      type: "crystal",
      data,
      layout: "timeline",
      color: options.color || "viridis",
      ...options
    };
  },
  /**
   * Scatter plot preset
   */
  scatter(data, options = {}) {
    return {
      type: "sphere",
      data,
      layout: "scatter",
      color: options.color || "category10",
      ...options
    };
  }
};
async function loadData(source) {
  if (typeof source === "string") {
    const res = await fetch(source);
    return await res.json();
  }
  if (typeof source === "object") {
    return source;
  }
  throw new Error("Data source must be a URL or object");
}
if (typeof AFRAME !== "undefined") {
  AFRAME.registerComponent("nemosyne-artefact-v2", NemosyneArtefactV2);
  AFRAME.registerComponent("nemosyne-connector", NemosyneConnector);
  AFRAME.registerComponent("nemosyne-scene", NemosyneScene);
  console.log("🐾 Nemosyne v0.2.0 loaded. Components: nemosyne-artefact-v2, nemosyne-connector, nemosyne-scene");
} else {
  console.warn("Nemosyne: AFRAME not found. Make sure to load A-Frame before Nemosyne.");
}
const Nemosyne = {
  // Version
  VERSION: "0.2.0",
  // Quick start
  quickStart,
  presets,
  loadData,
  // Core modules
  LayoutEngine,
  layoutEngine,
  ArtefactBuilder,
  TransformEngine,
  BehaviourEngine,
  DataLoader,
  MaterialFactory,
  Validator,
  // Validation helpers
  validateSpec,
  validateData,
  /**
   * Create a visualization programmatically
   * @param {HTMLElement} container - Container element
   * @param {Object} spec - Artefact specification
   * @param {Object} data - Data object
   * @param {Object} options - Additional options
   */
  create(container, spec, data, options = {}) {
    const el = document.createElement("a-entity");
    el.setAttribute("nemosyne-artefact-v2", {
      spec: JSON.stringify(spec),
      dataset: JSON.stringify(data),
      layout: options.layout || "grid",
      animate: options.animate !== false,
      interactive: options.interactive !== false,
      debug: options.debug || false
    });
    container.appendChild(el);
    return el;
  },
  /**
   * Register a custom layout
   * @param {string} name - Layout name
   * @param {Function} fn - Layout function
   */
  registerLayout(name, fn) {
    layoutEngine.register(name, fn);
  },
  /**
   * Create connector between two elements
   * @param {HTMLElement} fromEl - Source element
   * @param {HTMLElement} toEl - Target element
   * @param {Object} style - Connector style
   */
  connect(fromEl, toEl, style = {}) {
    const connector = document.createElement("a-entity");
    connector.setAttribute("nemosyne-connector", {
      from: fromEl,
      to: toEl,
      ...style
    });
    const scene = fromEl.sceneEl || toEl.sceneEl;
    if (scene) {
      scene.appendChild(connector);
    }
    return connector;
  }
};
if (typeof window !== "undefined") {
  window.Nemosyne = Nemosyne;
}
export {
  Nemosyne,
  Nemosyne as default
};
//# sourceMappingURL=nemosyne.es.js.map
