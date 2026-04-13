/**
 * @typedef {import('../types/index.ts').GazeData} GazeData
 * @typedef {import('../types/index.ts').HeadData} HeadData
 * @typedef {import('../types/index.ts').FixationData} FixationData
 * @typedef {import('../types/index.ts').Entity} Entity
 * @typedef {import('../types/index.ts').Vector3} Vector3
 */

/**
 * TelemetryEngine: Processes VR headset data for context
 */
export class TelemetryAnalyzer {
  constructor() {
    /** @type {Array<{timestamp: number, point: Vector3, direction: Vector3}>} */
    this.gazeHistory = [];
    /** @type {Array<{timestamp: number, position: Vector3, velocity: number}>} */
    this.headHistory = [];
    this.fixationThreshold = 800; // ms
  }

  /**
   * @param {GazeData} gazeData
   */
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

  /**
   * @param {HeadData} headData
   */
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
  /**
   * @param {Vector3[]} points
   * @returns {Vector3}
   */
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

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @returns {number}
   */
  distance(a, b) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    );
  }

  /**
   * @returns {number}
   */
  calculateHeadSpeed() {
    // Calculate from recent head movements
    return 0; // Placeholder
  }

  /**
   * @param {Vector3} _point
   * @returns {Entity | null}
   */
  findEntityAt(_point) {
    // Raycast to find entity
    return null; // Placeholder
  }

  /**
   * @param {string} eventName
   * @param {FixationData | {speed: number}} detail
   */
  emit(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export default TelemetryAnalyzer;
