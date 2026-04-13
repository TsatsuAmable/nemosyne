/**
 * TelemetryEngine: Processes VR headset data for spatial context
 * 
 * Analyzes:
 * - Gaze patterns (fixation detection)
 * - Head movement velocity
 * - Spatial attention hotspots
 */

export class TelemetryAnalyzer {
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

export default TelemetryAnalyzer;
