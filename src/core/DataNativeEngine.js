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
 */

import { TopologyDetector, TopologyScorer } from './TopologyDetector.js';
import { PropertyMapper } from './PropertyMapper.js';
import { LayoutEngine } from './LayoutEngine.js';
import { NemosyneDataPacket } from './NemosyneDataPacket.js';

class DataNativeEngine extends EventTarget {
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
    this.dataPackets = new Map(); // id -> NemosyneDataPacket
    this.artefacts = new Map();   // id -> Entity
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
   * @param {Array|Object} rawData - Raw data to visualize
   * @param {Object} schema - Optional schema hints
   * @returns {Array} Created artefacts
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

  onSwipe(gesture) {
    const { direction, target } = gesture;
    
    // Filter or transform based on swipe
    if (direction === 'left') {
      this.shiftTemporalView('past');
    } else if (direction === 'right') {
      this.shiftTemporalView('future');
    }
  }

  onPoint(gesture) {
    const { target } = gesture;
    if (!target) return;
    
    // Highlight and show details
    this.highlight(target.nemosyneData.id);
    
    // Suggest related data
    this.suggestRelatedData(target.nemosyneData);
  }

  // Utility methods
  getDataPacket(id) {
    return this.dataPackets.get(id);
  }

  getAllDataPackets() {
    return Array.from(this.dataPackets.values());
  }

  getArtefact(id) {
    return this.artefacts.get(id);
  }

  // Selection API
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

  addToSelection(id) {
    const artefact = this.artefacts.get(id);
    if (artefact) {
      artefact.classList.add('selected');
      this.selection.add(id);
    }
  }

  removeFromSelection(id) {
    const artefact = this.artefacts.get(id);
    if (artefact) {
      artefact.classList.remove('selected');
      this.selection.delete(id);
    }
  }

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
  filter(predicate) {
    return this.getAllDataPackets().filter(predicate);
  }

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

  getUniqueValues(field) {
    const values = new Set();
    this.getAllDataPackets().forEach(packet => {
      const value = packet.get(field);
      if (value !== undefined) values.add(value);
    });
    return Array.from(values);
  }

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


/**
 * Animator: Handles animation logic for data artefacts
 */
class Animator {
  constructor(options = {}) {
    this.defaultDuration = options.duration || 1000;
    this.easing = options.easing || 'easeInOutQuad';
  }

  /**
   * Determine animation for a data packet
   */
  determineAnimation(packet) {
    // Simple heuristic: animate appearance
    const baseDuration = 500;
    const stagger = Math.random() * 200;
    
    return {
      property: 'scale',
      from: '0 0 0',
      to: '1 1 1',
      dur: baseDuration + stagger,
      easing: this.easing
    };
  }

  /**
   * Format animation for A-Frame
   */
  formatAnimation(animation) {
    return `${animation.property}: ${animation.from}; ${animation.property}: ${animation.to}; dur: ${animation.dur}; easing: ${animation.easing}`;
  }

  /**
   * Create entrance animation
   */
  entranceAnimation(duration = 1000) {
    return {
      property: 'scale',
      from: '0 0 0',
      to: '1 1 1',
      dur: duration,
      easing: 'easeOutElastic'
    };
  }

  /**
   * Create exit animation
   */
  exitAnimation(duration = 500) {
    return {
      property: 'scale',
      from: '1 1 1',
      to: '0 0 0',
      dur: duration,
      easing: 'easeInQuad'
    };
  }

  /**
   * Create highlight animation
   */
  highlightAnimation(duration = 300) {
    return {
      property: 'scale',
      from: '1 1 1',
      to: '1.2 1.2 1.2',
      dur: duration,
      easing: 'easeInOutQuad',
      dir: 'alternate'
    };
  }

  /**
   * Create focus animation
   */
  focusAnimation(targetPosition, duration = 500) {
    return {
      property: 'position',
      to: targetPosition,
      dur: duration,
      easing: 'easeInOutQuad'
    };
  }
}


/**
 * GestureController: Bridges hand tracking to data operations
 * Connects to the gestures branch formalism
 */
class GestureDataController {
  constructor(engine) {
    this.engine = engine;
    this.interactionZones = new Map();
    this.activeGestures = new Map();
  }

  initializeInteractionZones(entities) {
    // Create invisible interaction zones around data entities
    entities.forEach(entity => {
      const zone = document.createElement('a-sphere');
      zone.setAttribute('radius', 0.3);
      zone.setAttribute('visible', false);
      zone.setAttribute('class', 'data-interaction-zone');
      zone.dataset.targetId = entity.nemosyneData?.id;
      
      entity.parentNode.appendChild(zone);
      this.interactionZones.set(entity.nemosyneData?.id, zone);
    });
    
    // Listen for hand tracking events
    this.setupHandTracking();
  }

  setupHandTracking() {
    // Integration with gestures branch
    document.addEventListener('hand-tracking-update', (e) => {
      this.processHandUpdate(e.detail);
    });
    
    document.addEventListener('gesture-recognized', (e) => {
      this.processGesture(e.detail);
    });
  }

  processHandUpdate(handData) {
    // Check for hover over data entities
    this.interactionZones.forEach((zone, id) => {
      const distance = this.calculateHandZoneDistance(handData, zone);
      
      if (distance < 0.2) {
        // Hand is near this data point
        zone.emit('hand-near', { hand: handData, targetId: id });
      }
    });
  }

  processGesture(gestureData) {
    // Forward to engine with context
    const target = this.getTargetForGesture(gestureData);
    
    this.engine.handleGesture({
      ...gestureData,
      target: target?.entity,
      packet: target?.packet
    });
  }

  calculateHandZoneDistance(hand, zone) {
    const handPos = hand.position;
    const zonePos = zone.getAttribute('position');
    return Math.sqrt(
      Math.pow(handPos.x - zonePos.x, 2) +
      Math.pow(handPos.y - zonePos.y, 2) +
      Math.pow(handPos.z - zonePos.z, 2)
    );
  }

  getTargetForGesture(gestureData) {
    // Find what the user is gesturing at
    const ray = gestureData.ray || gestureData.hand?.pointingVector;
    // Return intersected entity
    return { entity: null, packet: null }; // Placeholder
  }
}


/**
 * TelemetryAnalyzer: Processes VR headset data for context
 */
class TelemetryAnalyzer {
  constructor() {
    this.gazeHistory = [];
    this.headHistory = [];
    this.fixationThreshold = 800; // ms
  }

  trackGaze(gazeData) {
    const now = Date.now();
    
    this.gazeHistory.push({
      timestamp: now,
      point: gazeData.point,
      direction: gazeData.direction
    });
    
    // Keep last 2 seconds
    this.gazeHistory = this.gazeHistory.filter(
      g => now - g.timestamp < 2000
    );
    
    // Detect fixation
    this.detectFixation();
  }

  detectFixation() {
    if (this.gazeHistory.length < 10) return;
    
    const recent = this.gazeHistory.slice(-10);
    const duration = recent[recent.length - 1].timestamp - recent[0].timestamp;
    
    // Calculate dispersion
    const points = recent.map(g => g.point);
    const centroid = this.calculateCentroid(points);
    const maxDist = Math.max(...points.map(p => this.distance(p, centroid)));
    
    // If low dispersion and long duration = fixation
    if (maxDist < 0.05 && duration > this.fixationThreshold) {
      this.emit('fixation-detected', {
        point: centroid,
        duration,
        entity: this.findEntityAt(centroid)
      });
    }
  }

  trackHeadMovement(headData) {
    this.headHistory.push({
      timestamp: Date.now(),
      position: headData.position,
      velocity: headData.velocity
    });
    
    // Calculate speed
    if (this.headHistory.length > 1) {
      const speed = this.calculateHeadSpeed();
      
      if (speed > 100) {
        this.emit('rapid-movement', { speed });
      }
    }
  }

  // Helpers
  calculateCentroid(points) {
    const sum = points.reduce((acc, p) => ({
      x: acc.x + p.x,
      y: acc.y + p.y,
      z: acc.z + p.z
    }), { x: 0, y: 0, z: 0 });
    
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length
    };
  }

  distance(a, b) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    );
  }

  calculateHeadSpeed() {
    // Calculate from recent head movements
    return 0; // Placeholder
  }

  findEntityAt(point) {
    // Raycast to find entity
    return null; // Placeholder
  }

  emit(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export { DataNativeEngine, Animator, GestureDataController, TelemetryAnalyzer };

console.log('[DataNativeEngine] Module loaded');
