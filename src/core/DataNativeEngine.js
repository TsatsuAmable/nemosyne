/**
 * DataNativeEngine: Core System for Gesture-Driven Data Visualization
 * 
 * Combines:
 * - Data-native automatic visualization (topology → artefacts)
 * - Gesture recognition for data manipulation
 * - VR headset telemetry for spatial interaction
 * - Real-time data transformation via hand movements
 * 
 * Architecture:
 * DataPacket → TopologyDetector → LayoutEngine → GestureController → Render
 * 
 * @typedef {import('../types/index.ts').DataNativeEngineOptions} DataNativeEngineOptions
 * @typedef {import('../types/index.ts').NemosynePacketData} NemosynePacketData
 * @typedef {import('../types/index.ts').QueryConditions} QueryConditions
 * @typedef {import('../types/index.ts').Entity} Entity
 * @typedef {import('../types/index.ts').GestureEvent} GestureEvent
 * @typedef {import('../types/index.ts').TelemetryData} TelemetryData
 * @typedef {import('../types/index.ts').VisualProperties} VisualProperties
 * @typedef {import('../types/index.ts').AnimationConfig} AnimationConfig
 * @typedef {import('./LayoutEngine.js').LayoutEngine} _LayoutEngine
 */

import { TopologyDetector } from './TopologyDetector.js';
import { PropertyMapper } from './PropertyMapper.js';
import { LayoutEngine } from './LayoutEngine.js';
import { NemosyneDataPacket } from './NemosyneDataPacket.js';
import { Animator } from './AnimationEngine.js';
import { GestureDataController } from './GestureController.js';
import { TelemetryAnalyzer } from './TelemetryEngine.js';

class DataNativeEngine extends EventTarget {
  /**
   * @param {DataNativeEngineOptions} [options={}]
   */
  constructor(options = {}) {
    super();
    
    // Core transformation components
    this.topologyDetector = new TopologyDetector();
    this.propertyMapper = new PropertyMapper();
    this.layoutEngine = new LayoutEngine(options.layout);
    this.animator = new Animator();
    
    // Gesture + Telemetry integration
    this.gestureController = new GestureDataController(this);
    this.telemetryAnalyzer = new TelemetryAnalyzer();
    
    // State
    /** @type {Map<string, NemosynePacketData>} */
    this.dataPackets = new Map(); // id -> NemosyneDataPacket
    /** @type {Map<string, Entity>} */
    this.artefacts = new Map();   // id -> Entity
    /** @type {Set<string>} */
    this.selection = new Set();   // Set of selected IDs
    this.scene = options.scene || document.querySelector('a-scene');
    
    // Configuration
    this.autoUpdate = options.autoUpdate !== false;
    this.gestureEnabled = options.gestureEnabled !== false;
    this.telemetryEnabled = options.telemetryEnabled !== false;
    
    // Bind methods
    this.handleGesture = this.handleGesture.bind(this);
    this.handleTelemetry = this.handleTelemetry.bind(this);
    
    console.log('[DataNativeEngine] Initialized');
  }

  /**
   * Ingest data and auto-visualize
   * @param {Array<unknown>|Object} rawData - Raw data to visualize
   * @param {Object} [schema={}] - Optional schema hints
   * @returns {Promise<Entity[]>} Created artefacts
   */
  async ingest(rawData, schema = {}) {
    console.log('[DataNativeEngine] Ingesting data...');
    
    // Normalize to NemosyneDataPackets
    const packets = this.normalizeData(rawData, schema);
    
    // Detect topology
    const topology = this.topologyDetector.detect(packets);
    console.log(`[DataNativeEngine] Detected topology: ${topology}`);
    
    // Calculate layout
    const positions = this.layoutEngine.calculatePositions(packets, topology);
    
    // Create artefacts
    const artefacts = [];
    
    for (const packet of packets) {
      // Map properties
      const visualProps = this.propertyMapper.map(packet);
      
      // Get position
      const position = positions.get(packet.id);
      
      // Determine animation
      const animation = this.animator.determineAnimation(packet);
      
      // Create entity
      const artefact = this.createArtefact(packet, topology, visualProps, position, animation);
      
      // Store
      this.dataPackets.set(packet.id, packet);
      this.artefacts.set(packet.id, artefact);
      
      // Add to scene
      this.scene.appendChild(artefact);
      
      artefacts.push(artefact);
    }
    
    // Create gesture interaction zones
    if (this.gestureEnabled) {
      this.gestureController.initializeInteractionZones(artefacts);
    }
    
    // Emit event
    this.emit('data-ingested', { 
      count: artefacts.length, 
      topology,
      packets 
    });
    
    return artefacts;
  }

  /**
   * Normalize raw data to NemosyneDataPacket format
   * @param {Array<unknown>|Object} rawData
   * @param {Object} schema
   * @returns {NemosynePacketData[]}
   */
  normalizeData(rawData, schema) {
    const dataArray = Array.isArray(rawData) ? rawData : [rawData];
    
    return dataArray.map((item, index) => {
      // Auto-generate ID if not present
      // Check schema.idField first, then item.id, then auto-generate
      let id = item.id;
      if (!id && schema.idField && item[schema.idField] !== undefined) {
        id = String(item[schema.idField]);
      }
      id = id || `packet-${Date.now()}-${index}`;
      
      // Extract value from schema.valueField if provided
      let value = item.value;
      if (!value && schema.valueField && item[schema.valueField] !== undefined) {
        value = item[schema.valueField];
      }
      value = value || item;
      
      // Build packet with defaults
      return new NemosyneDataPacket({
        id,
        value,
        semantics: {
          type: schema.type || this.inferType(item),
          structure: schema.structure || this.inferStructure(item),
          dimensions: schema.dimensions || 3,
          scale: schema.scale || 'continuous',
          ...item.semantics
        },
        relations: {
          parent: item.parent,
          children: item.children,
          links: item.links || item.relations?.links,
          ...item.relations
        },
        context: {
          timestamp: item.timestamp || Date.now(),
          importance: item.importance || 0.5,
          confidence: item.confidence || 1.0,
          ...item.context
        }
      });
    });
  }

  /**
   * Create A-Frame entity from packet
   * @param {NemosynePacketData} packet
   * @param {string} topology
   * @param {VisualProperties} visualProps
   * @param {{x: number, y: number, z: number}} position
   * @param {AnimationConfig} [animation]
   * @returns {Entity}
   */
  createArtefact(packet, topology, visualProps, position, animation) {
    // Select component type based on topology
    const componentName = this.getComponentForTopology(topology);
    
    // Create base entity
    const entity = document.createElement('a-entity');
    
    // Set position
    entity.setAttribute('position', position);
    
    // Set geometry (from property mapper)
    entity.setAttribute('geometry', visualProps.geometry);
    
    // Set material
    entity.setAttribute('material', {
      color: visualProps.color,
      emissive: visualProps.emissive || visualProps.color,
      emissiveIntensity: visualProps.emissiveIntensity || 0.5,
      opacity: visualProps.opacity,
      metalness: visualProps.metalness || 0.8,
      roughness: visualProps.roughness || 0.2
    });
    
    // Set scale
    entity.setAttribute('scale', visualProps.scale);
    
    // Add data-native component
    entity.setAttribute(componentName, {
      packetId: packet.id,
      data: JSON.stringify(packet.toJSON())
    });
    
    // Add animation if determined
    if (animation) {
      entity.setAttribute('animation', this.formatAnimation(animation));
    }
    
    // Add interaction capabilities
    entity.classList.add('data-native-entity');
    entity.classList.add('clickable');
    
    // Store reference
    entity.nemosyneData = packet;
    
    return entity;
  }

  /**
   * Handle incoming gesture
   * @param {GestureEvent} gesture
   */
  handleGesture(gesture) {
    console.log('[DataNativeEngine] Gesture received:', gesture.type);
    
    switch(gesture.type) {
      case 'grab':
        this.onGrab(gesture);
        break;
      case 'pinch':
        this.onPinch(gesture);
        break;
      case 'swipe':
        this.onSwipe(gesture);
        break;
      case 'point':
        this.onPoint(gesture);
        break;
    }
    
    this.emit('gesture-handled', { gesture });
  }

  /**
   * Handle VR headset telemetry
   * @param {TelemetryData} telemetry
   */
  handleTelemetry(telemetry) {
    if (!this.telemetryEnabled) return;
    
    // Analyze gaze patterns
    if (telemetry.gaze) {
      this.telemetryAnalyzer.trackGaze(telemetry.gaze);
    }
    
    // Analyze head movement
    if (telemetry.head) {
      this.telemetryAnalyzer.trackHeadMovement(telemetry.head);
    }
    
    // Adapt visualization based on telemetry
    this.adaptToTelemetry(telemetry);
  }

  /**
   * Adapt visualization based on user behavior
   * @param {TelemetryData} telemetry
   */
  adaptToTelemetry(telemetry) {
    // Example: Reduce detail when user is moving quickly
    if (telemetry.head?.velocity > 50) {
      this.temporarilyReduceDetail();
    }
    
    // Example: Expand detail where user is looking
    if (telemetry.gaze?.fixation) {
      const entity = telemetry.gaze.fixation.entity;
      this.expandDetailForNearby(entity);
    }
  }

  // Gesture handlers
  /**
   * @param {GestureEvent} gesture
   */
  onGrab(gesture) {
    const { target, hand } = gesture;
    if (!target) return;
    
    // Start drag
    this.dragState = {
      target,
      hand,
      startPosition: { ...target.getAttribute('position') },
      startHand: { ...hand.position }
    };
    
    // Visual feedback
    this.updateVisualFeedback(target, 'grabbed');
  }

  /**
   * @param {GestureEvent} gesture
   */
  onPinch(gesture) {
    const { target, scale } = gesture;
    if (!target) return;
    
    // Scale the entity
    const currentScale = target.getAttribute('scale');
    target.setAttribute('scale', {
      x: currentScale.x * scale,
      y: currentScale.y * scale,
      z: currentScale.z * scale
    });
    
    // Update data
    const packet = this.dataPackets.get(target.nemosyneData.id);
    if (packet) {
      packet.set('visual.scale', scale);
    }
  }

  /**
   * @param {GestureEvent} gesture
   */
  onSwipe(gesture) {
    const { direction, target: _target } = gesture;
    
    // Filter or transform based on swipe
    if (direction === 'left') {
      this.shiftTemporalView('past');
    } else if (direction === 'right') {
      this.shiftTemporalView('future');
    }
  }

  /**
   * @param {GestureEvent} gesture
   */
  onPoint(gesture) {
    const { target } = gesture;
    if (!target) return;
    
    // Highlight and show details
    this.highlight(target.nemosyneData.id);
    
    // Suggest related data
    this.suggestRelatedData(target.nemosyneData);
  }

  // Utility methods
  /**
   * @param {string} id
   * @returns {NemosynePacketData|undefined}
   */
  getDataPacket(id) {
    return this.dataPackets.get(id);
  }

  getAllDataPackets() {
    return Array.from(this.dataPackets.values());
  }

  /**
   * @param {string} id
   * @returns {Entity|undefined}
   */
  getArtefact(id) {
    return this.artefacts.get(id);
  }

  // Selection API
  /**
   * @param {string} id
   * @param {{clear?: boolean}} [options={}]
   */
  select(id, options = {}) {
    if (options.clear !== false) {
      this.clearSelection();
    }
    
    const artefact = this.artefacts.get(id);
    if (artefact) {
      artefact.classList.add('selected');
      this.selection.add(id);
      this.emit('selection-changed', { selected: [id] });
    }
  }

  /**
   * @param {string} id
   */
  addToSelection(id) {
    const artefact = this.artefacts.get(id);
    if (artefact) {
      artefact.classList.add('selected');
      this.selection.add(id);
    }
  }

  /**
   * @param {string} id
   */
  removeFromSelection(id) {
    const artefact = this.artefacts.get(id);
    if (artefact) {
      artefact.classList.remove('selected');
      this.selection.delete(id);
    }
  }

  /**
   * @param {string} id
   */
  toggleSelection(id) {
    if (this.selection.has(id)) {
      this.removeFromSelection(id);
    } else {
      this.addToSelection(id);
    }
  }

  clearSelection() {
    this.artefacts.forEach(artefact => {
      artefact.classList.remove('selected');
    });
    this.selection.clear();
  }

  getSelectedPackets() {
    return Array.from(this.selection).map(id => this.dataPackets.get(id)).filter(Boolean);
  }

  selectAll() {
    this.artefacts.forEach((_, id) => {
      this.addToSelection(id);
    });
  }

  invertSelection() {
    this.artefacts.forEach((artefact, id) => {
      if (this.selection.has(id)) {
        this.removeFromSelection(id);
      } else {
        this.addToSelection(id);
      }
    });
  }

  /**
   * @param {string} startId
   * @param {string} endId
   */
  selectRange(startId, endId) {
    // Select all packets between start and end
    const allIds = Array.from(this.dataPackets.keys());
    const startIdx = allIds.indexOf(startId);
    const endIdx = allIds.indexOf(endId);
    
    if (startIdx === -1 || endIdx === -1) return;
    
    const min = Math.min(startIdx, endIdx);
    const max = Math.max(startIdx, endIdx);
    
    for (let i = min; i <= max; i++) {
      this.addToSelection(allIds[i]);
    }
  }

  // Filter and query
  /**
   * @param {function(NemosynePacketData): boolean} predicate
   * @returns {NemosynePacketData[]}
   */
  filter(predicate) {
    return this.getAllDataPackets().filter(predicate);
  }

  /**
   * @param {QueryConditions} conditions
   * @returns {NemosynePacketData[]}
   */
  query(conditions) {
    return this.getAllDataPackets().filter(packet => {
      return Object.entries(conditions).every(([key, value]) => {
        const packetValue = packet.get(key);
        
        if (typeof value === 'object' && value !== null) {
          // Handle operators like $gt, $lt, $in, $exists
          if (value.$gt !== undefined) return packetValue > value.$gt;
          if (value.$lt !== undefined) return packetValue < value.$lt;
          if (value.$gte !== undefined) return packetValue >= value.$gte;
          if (value.$lte !== undefined) return packetValue <= value.$lte;
          if (value.$in !== undefined) return value.$in.includes(packetValue);
          if (value.$exists !== undefined) return value.$exists ? packetValue !== undefined : packetValue === undefined;
        }
        
        return packetValue === value;
      });
    });
  }

  /**
   * @param {string} field
   * @param {'asc'|'desc'} [order='asc']
   * @returns {NemosynePacketData[]}
   */
  sortBy(field, order = 'asc') {
    const packets = this.getAllDataPackets();
    return packets.sort((a, b) => {
      const aVal = a.get(field);
      const bVal = b.get(field);
      
      if (order === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });
  }

  /**
   * @param {string} field
   * @returns {Map<unknown, NemosynePacketData[]>}
   */
  groupBy(field) {
    const groups = new Map();
    
    this.getAllDataPackets().forEach(packet => {
      const value = packet.get(field);
      const key = value || 'unknown';
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(packet);
    });
    
    return groups;
  }

  /**
   * @param {string} field
   * @returns {unknown[]}
   */
  getUniqueValues(field) {
    const values = new Set();
    this.getAllDataPackets().forEach(packet => {
      const value = packet.get(field);
      if (value !== undefined) values.add(value);
    });
    return Array.from(values);
  }

  /**
   * @param {string} field
   * @returns {{min: number, max: number, avg: number, sum: number, count: number}}
   */
  calculateStats(field) {
    const packets = this.getAllDataPackets();
    const values = packets.map(p => p.get(field)).filter(v => typeof v === 'number');
    
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    return { min, max, avg, sum, count: values.length };
  }

  updateData(id, updates) {
    const packet = this.dataPackets.get(id);
    if (!packet) return false;
    
    // Apply updates
    Object.entries(updates).forEach(([path, value]) => {
      packet.set(path, value);
    });
    
    // Update visualization
    const artefact = this.artefacts.get(id);
    if (artefact) {
      const props = this.propertyMapper.map(packet);
      this.updateArtefactVisuals(artefact, props);
    }
    
    this.emit('data-updated', { id, updates });
    return true;
  }

  removeData(id) {
    const packet = this.dataPackets.get(id);
    if (!packet) return false;
    
    // Remove from scene
    const artefact = this.artefacts.get(id);
    if (artefact && artefact.parentNode) {
      artefact.parentNode.removeChild(artefact);
    }
    
    // Remove from maps
    this.dataPackets.delete(id);
    this.artefacts.delete(id);
    
    this.emit('data-removed', { id });
    return true;
  }

  clear() {
    this.dataPackets.forEach((packet, id) => {
      this.removeData(id);
    });
    this.emit('data-cleared');
  }

  updateArtefactVisuals(artefact, props) {
    // Update visual properties
    if (props.color) {
      artefact.setAttribute('material', 'color', props.color);
    }
    if (props.scale) {
      artefact.setAttribute('scale', props.scale);
    }
  }

  // Visualization
  setColorScheme(scheme) {
    // Update property mapper color scheme
    this.propertyMapper.setColorScheme?.(scheme);
  }

  setScaleRange(min, max) {
    // Update scale range for visualization
    this.propertyMapper.setScaleRange?.(min, max);
  }

  highlight(id) {
    const artefact = this.artefacts.get(id);
    if (artefact) {
      artefact.classList.add('highlighted');
    }
  }

  unhighlight(id) {
    const artefact = this.artefacts.get(id);
    if (artefact) {
      artefact.classList.remove('highlighted');
    }
  }

  focus(id) {
    const artefact = this.artefacts.get(id);
    if (artefact) {
      const pos = artefact.getAttribute('position');
      // Center view on this position
      this.scene?.setAttribute?.('position', {
        x: -pos.x,
        y: -pos.y,
        z: -pos.z
      });
    }
  }

  zoomToFit() {
    // Calculate bounding box of all artefacts
    // and adjust camera to fit
    const packets = this.getAllDataPackets();
    if (packets.length === 0) return;
    
    // Default implementation
    console.log('[DataNativeEngine] Zooming to fit');
  }

  resetView() {
    // Reset camera/scene position
    this.scene?.setAttribute?.('position', { x: 0, y: 0, z: 0 });
    this.scene?.setAttribute?.('rotation', { x: 0, y: 0, z: 0 });
  }

  setLayout(type) {
    this.currentLayout = type;
    // Trigger re-layout
    const packets = this.getAllDataPackets();
    if (packets.length > 0) {
      const positions = this.layoutEngine.calculatePositions(packets, type);
      // Update positions
      packets.forEach(packet => {
        const artefact = this.artefacts.get(packet.id);
        if (artefact) {
          artefact.setAttribute('position', positions.get(packet.id));
        }
      });
    }
  }

  getAvailableLayouts() {
    return [
      'nemosyne-graph-force',
      'nemosyne-tree-hierarchical',
      'nemosyne-timeline-spiral',
      'nemosyne-timeline-linear',
      'nemosyne-scatter-semantic',
      'nemosyne-geo-globe',
      'nemosyne-grid-categorical'
    ];
  }

  // Event handling
  emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // Export/Import
  toJSON() {
    return {
      dataPackets: Array.from(this.dataPackets.entries()).map(([id, packet]) => ({
        id,
        data: packet.toJSON()
      }))
    };
  }

  fromJSON(json) {
    if (!json) return;
    
    let data;
    try {
      data = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
      console.warn('[DataNativeEngine] Failed to parse JSON:', e);
      return;
    }
    
    if (!data || !data.dataPackets) {
      console.warn('[DataNativeEngine] Invalid data format');
      return;
    }
    
    this.clear();
    
    data.dataPackets.forEach(({ id, data: packetData }) => {
      const packet = NemosyneDataPacket.fromJSON(packetData);
      this.dataPackets.set(id, packet);
    });
    
    this.emit('data-loaded', { count: this.dataPackets.size });
  }

  // Helper methods
  inferType(item) { return 'quantitative'; }
  inferStructure(item) { return 'point'; }
  getComponentForTopology(topology) { return 'nemosyne-data-crystal'; }
  formatAnimation(anim) { return anim; }
  updateVisualFeedback(entity, state) { }
  createAggregatePacket(entities) { return {}; }
  visualizeAggregate(packet, center) { }
  findNearestCluster(position) { return 'default'; }
  findEntitiesInVolume(volume) { return []; }
  calculateGestureVolume(hands) { return {}; }
  calculateStatistics() { return {}; }
  temporarilyReduceDetail() { }
  expandDetailForNearby(entity) { }
  suggestRelatedData(packet) {
    if (!packet || !packet.relations || !packet.relations.links) {
      return [];
    }
    
    const related = [];
    packet.relations.links.forEach(link => {
      const relatedPacket = this.dataPackets.get(link.to);
      if (relatedPacket) {
        related.push(relatedPacket);
      }
    });
    
    return related;
  }
  shiftTemporalView(direction) { }
  commitPendingTransformation() { }
  rollbackTransformation() { }
  highlightRelatedData(packet) { }

  // Performance and state
  getPerformanceMetrics() {
    return {
      packetCount: this.dataPackets.size,
      artefactCount: this.artefacts.size,
      timestamp: Date.now()
    };
  }

  getState() {
    return {
      dataPackets: Array.from(this.dataPackets.entries()),
      artefacts: Array.from(this.artefacts.keys()),
      selection: Array.from(this.artefacts.entries())
        .filter(([_, a]) => a.classList?.contains('selected'))
        .map(([id, _]) => id),
      layout: this.currentLayout || 'default'
    };
  }

  hasData() {
    return this.dataPackets.size > 0;
  }

  getDataCount() {
    return this.dataPackets.size;
  }

  // Export methods
  toCSV() {
    const headers = ['id', 'value'];
    const rows = this.getAllDataPackets().map(p => {
      return [p.id, JSON.stringify(p.value)];
    });
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export { DataNativeEngine, Animator, GestureDataController, TelemetryAnalyzer };

console.log('[DataNativeEngine] Module loaded');
