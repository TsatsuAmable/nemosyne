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
      const id = item.id || `packet-${Date.now()}-${index}`;
      
      // Build packet with defaults
      return new NemosyneDataPacket({
        id,
        value: item.value || item,
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
    
    // Store reference to packet for reverse lookup
    entity.nemosyneData = packet;
    entity.topology = topology;
    
    return entity;
  }

  /**
   * Handle gesture events from GestureController
   */
  handleGesture(event) {
    const { gesture, hand, target, intersection } = event;
    
    switch (gesture) {
      case 'point-and-pinch':
        // Selection + potential manipulation start
        if (target) {
          this.selectDataEntity(target, hand);
        }
        break;
        
      case 'grab-move':
        // Spatial data manipulation
        if (target) {
          this.spatialDataUpdate(target, hand);
        }
        break;
        
      case 'two-hand-expand':
        // Scale/aggregate data
        this.dataAggregation(event.center, hand);
        break;
        
      case 'swipe-left':
        // Navigate temporal data
        this.temporalNavigation('backward');
        break;
        
      case 'swipe-right':
        // Navigate temporal data
        this.temporalNavigation('forward');
        break;
        
      case 'circle-draw':
        // Filter/select region
        this.spatialFilter(event.boundingBox);
        break;
        
      case 'thumbs-up':
        // Confirm transformation
        this.commitPendingTransformation();
        break;
        
      case 'thumbs-down':
        // Cancel transformation
        this.rollbackTransformation();
        break;
    }
    
    this.emit('gesture-handled', { gesture, target, action: event.action });
  }

  /**
   * Handle VR headset telemetry for gaze/attention analysis
   */
  handleTelemetry(event) {
    const { type, data } = event;
    
    switch (type) {
      case 'gaze-fixation':
        // User is looking at something intently
        this.handleGazeFixation(data);
        break;
        
      case 'head-velocity':
        // Fast head movement - disorientation or scanning
        if (data.speed > 100) {
          this.temporarilyReduceDetail();
        }
        break;
        
      case 'proximity':
        // User moved close to a cluster
        this.expandDetailForNearby(data.entity);
        break;
        
      case 'dwell-time':
        // User has been in same area for a while
        this.suggestRelatedData(data.entity);
        break;
    }
  }

  /**
   * Spatial data manipulation via hand movement
   * Updates data values based on spatial gesture
   */
  spatialDataUpdate(entity, hand) {
    const packet = entity.nemosyneData;
    if (!packet) return;
    
    // Calculate delta from original position
    const originalPos = this.layoutEngine.getOriginalPosition(packet.id);
    const currentPos = hand.position;
    
    const delta = {
      x: currentPos.x - originalPos.x,
      y: currentPos.y - originalPos.y,
      z: currentPos.z - originalPos.z
    };
    
    // Map spatial delta to data transformation
    switch (packet.semantics.type) {
      case 'quantitative':
        // Moving along Y axis modifies value
        const valueDelta = delta.y * 1000; // Scale factor
        packet.transform({ 
          value: packet.value + valueDelta,
          transformType: 'manual-spatial'
        });
        break;
        
      case 'categorical':
        // Moving to different cluster suggests reclassification
        const nearestCluster = this.findNearestCluster(currentPos);
        if (nearestCluster !== packet.semantics.category) {
          packet.transform({
            category: nearestCluster,
            transformType: 'reclassification'
          });
        }
        break;
        
      case 'temporal':
        // Moving along timeline
        const timeDelta = delta.x * 1000 * 60 * 60; // hours to ms
        packet.transform({
          timestamp: packet.context.timestamp + timeDelta,
          transformType: 'timeshift'
        });
        break;
    }
    
    // Visual feedback
    this.updateVisualFeedback(entity, 'transforming');
    
    // Emit
    this.emit('data-transformed', { packet, delta, hand });
  }

  /**
   * Aggregate data via two-hand gesture
   */
  dataAggregation(center, hands) {
    // Find all entities within the gesture volume
    const volume = this.calculateGestureVolume(hands);
    const containedEntities = this.findEntitiesInVolume(volume);
    
    if (containedEntities.length > 1) {
      // Create aggregate packet
      const aggregatePacket = this.createAggregatePacket(containedEntities);
      
      // Visualize as cluster
      this.visualizeAggregate(aggregatePacket, center);
      
      this.emit('data-aggregated', { 
        sources: containedEntities.map(e => e.nemosyneData.id),
        aggregate: aggregatePacket 
      });
    }
  }

  /**
   * Navigate temporal data via swipe gesture
   */
  temporalNavigation(direction) {
    const temporalPackets = Array.from(this.dataPackets.values())
      .filter(p => p.semantics.type === 'temporal')
      .sort((a, b) => a.context.timestamp - b.context.timestamp);
    
    if (direction === 'forward') {
      // Shift view to later data
      this.shiftTemporalView(1);
    } else {
      // Shift view to earlier data
      this.shiftTemporalView(-1);
    }
    
    // Animate transition
    this.scene.emit('temporal-shift', { direction });
  }

  /**
   * Filter data based on spatial region
   */
  spatialFilter(boundingBox) {
    const contained = this.findEntitiesInVolume(boundingBox);
    const excluded = Array.from(this.artefacts.values())
      .filter(a => !contained.includes(a));
    
    // Dim excluded entities
    excluded.forEach(entity => {
      entity.setAttribute('animation', {
        property: 'material.opacity',
        to: 0.1,
        dur: 300
      });
    });
    
    // Highlight contained
    contained.forEach(entity => {
      entity.setAttribute('animation', {
        property: 'material.emissiveIntensity',
        to: 1.5,
        dur: 300
      });
    });
    
    this.emit('spatial-filter-applied', { 
      contained: contained.length,
      excluded: excluded.length 
    });
  }

  /**
   * Handle gaze fixation - show details
   */
  handleGazeFixation(data) {
    const entity = data.entity;
    const packet = entity?.nemosyneData;
    
    if (packet) {
      // Show contextual info
      this.showDataDetails(entity, packet);
      
      // Highlight connections
      this.highlightRelatedData(packet);
    }
  }

  /**
   * Show detailed data view on gaze
   */
  showDataDetails(entity, packet) {
    // Create floating label with data info
    const label = document.createElement('a-entity');
    label.setAttribute('position', {
      x: entity.getAttribute('position').x,
      y: entity.getAttribute('position').y + 0.5,
      z: entity.getAttribute('position').z
    });
    label.setAttribute('text', {
      value: `${packet.id}: ${JSON.stringify(packet.value).slice(0, 50)}`,
      align: 'center',
      color: '#00d4aa',
      width: 2
    });
    label.setAttribute('billboard', true);
    
    this.scene.appendChild(label);
    
    // Auto-remove after 3 seconds
    setTimeout(() => label.remove(), 3000);
  }

  /**
   * Public API: Update data from external source
   */
  updateData(packetId, newValue) {
    const packet = this.dataPackets.get(packetId);
    const entity = this.artefacts.get(packetId);
    
    if (packet && entity) {
      // Update packet
      packet.updateValue(newValue);
      
      // Re-map properties
      const newProps = this.propertyMapper.map(packet);
      
      // Animate transition
      entity.setAttribute('animation', {
        property: 'material.color',
        to: newProps.color,
        dur: 500,
        easing: 'easeInOutQuad'
      });
      
      entity.setAttribute('animation__scale', {
        property: 'scale',
        to: `${newProps.scale.x} ${newProps.scale.y} ${newProps.scale.z}`,
        dur: 500,
        easing: 'easeOutElastic'
      });
      
      this.emit('data-updated', { packetId, newValue });
    }
  }

  /**
   * Public API: Get current data state
   */
  getDataState() {
    return {
      packets: Array.from(this.dataPackets.values()),
      topology: this.topologyDetector.lastDetected,
      statistics: this.calculateStatistics()
    };
  }

  /**
   * Utility: Emit events
   */
  emit(eventName, detail) {
    const event = new CustomEvent(eventName, { detail });
    this.dispatchEvent(event);
    console.log(`[DataNativeEngine] Event: ${eventName}`, detail);
  }

  // Helper methods (placeholders)
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
  suggestRelatedData(entity) { }
  shiftTemporalView(direction) { }
  commitPendingTransformation() { }
  rollbackTransformation() { }
  highlightRelatedData(packet) { }
}


/**
 * GestureController: Bridges hand tracking to data operations
 * Connects to the gesures branch formalism
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

export { DataNativeEngine };

console.log('[DataNativeEngine] Module loaded');
