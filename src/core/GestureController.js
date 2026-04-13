/**
 * GestureController: Bridges hand tracking to data operations
 * Connects to the gestures branch formalism
 */

export class GestureDataController {
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

export default GestureDataController;
