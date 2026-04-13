/**
 * ResearchTelemetry: Empirical Data Collection for Nemosyne Studies
 *
 * Purpose: Enable user studies by collecting interaction data while
 * maintaining privacy (no PII, session IDs hashed)
 *
 * Data Collected:
 * - Navigation patterns (path through 3D space)
 * - Gaze dwell time (what elements attract attention)
 * - Click/interaction frequency
 * - Task completion time
 * - Layout efficacy metrics
 *
 * Architecture:
 * Event Stream → Anonymization → Aggregation → Export
 *
 * Privacy:
 * - No PII captured
 * - Session IDs are hashed
 * - IP addresses not stored
 * - Data stays client-side by default
 */

class ResearchTelemetry {
  constructor(options = {}) {
    // Configuration
    this.enabled = options.enabled !== false;
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.exportFormat = options.exportFormat || 'json'; // 'json' | 'csv'
    this.autoExport = options.autoExport || false;
    this.exportInterval = options.exportInterval || 30000; // 30s

    // Data storage
    this.events = [];
    this.metrics = {
      navigationPath: [],
      gazeTargets: new Map(), // elementId -> { dwellTime, fixations }
      interactions: [],
      layoutSwitches: [],
      taskCompletions: []
    };

    // Throttling
    this.lastPositionLog = 0;
    this.positionThrottle = 100; // ms between position logs

    console.log('[ResearchTelemetry] Initialized');
    console.log(`[ResearchTelemetry] Session: ${this.sessionId}`);

    if (this.enabled) {
      this.startAutoExport();
    }
  }

  /**
   * Generate anonymized session ID
   * Hash of timestamp + random to prevent tracking
   */
  generateSessionId() {
    const raw = `${Date.now()}-${Math.random()}-${navigator.userAgent}`;
    return this.hashString(raw).substring(0, 16);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Track camera/navigation movement
   * Records path through 3D space for analysis
   */
  trackNavigation(camera) {
    if (!this.enabled) return;

    const now = Date.now();
    if (now - this.lastPositionLog < this.positionThrottle) return;

    const position = camera.getAttribute('position');
    const rotation = camera.getAttribute('rotation');

    this.metrics.navigationPath.push({
      timestamp: now - this.startTime,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      velocity: this.calculateVelocity(position)
    });

    this.lastPositionLog = now;
  }

  calculateVelocity(currentPos) {
    const path = this.metrics.navigationPath;
    if (path.length < 2) return 0;

    const prev = path[path.length - 1];
    const dx = currentPos.x - prev.position.x;
    const dy = currentPos.y - prev.position.y;
    const dz = currentPos.z - prev.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dt = (Date.now() - this.startTime - prev.timestamp) / 1000;

    return dt > 0 ? dist / dt : 0;
  }

  /**
   * Log user interaction with an element
   */
  logInteraction(type, targetId, details = {}) {
    if (!this.enabled) return;

    this.metrics.interactions.push({
      timestamp: Date.now() - this.startTime,
      type, // 'click', 'hover', 'drag', 'select', etc.
      targetId,
      details,
      context: this.getInteractionContext()
    });

    this.emit('interaction', { type, targetId });
  }

  getInteractionContext() {
    const path = this.metrics.navigationPath;
    return {
      sessionDuration: Date.now() - this.startTime,
      totalNavPoints: path.length,
      currentRegion: this.getCurrentRegion(path[path.length - 1]?.position)
    };
  }

  getCurrentRegion(position) {
    if (!position) return 'unknown';
    // Simple region detection based on position
    // Can be extended with spatial partitioning
    const { x, y, z } = position;
    if (y > 5) return 'upper-space';
    if (y < -5) return 'lower-space';
    if (Math.abs(x) > 10) return 'far-lateral';
    return 'center';
  }

  /**
   * Track gaze/focus on specific elements
   */
  trackGaze(elementId, duration) {
    if (!this.enabled) return;

    const current = this.metrics.gazeTargets.get(elementId) || {
      dwellTime: 0,
      fixations: 0,
      firstSeen: Date.now() - this.startTime
    };

    current.dwellTime += duration;
    current.fixations++;
    current.lastSeen = Date.now() - this.startTime;

    this.metrics.gazeTargets.set(elementId, current);
  }

  /**
   * Log layout algorithm efficacy
   */
  logLayoutEvent(layoutType, dataSize, timeToRender) {
    if (!this.enabled) return;

    this.metrics.layoutSwitches.push({
      timestamp: Date.now() - this.startTime,
      layoutType,
      dataSize,
      timeToRender,
      performanceScore: this.calculateLayoutScore(timeToRender, dataSize)
    });
  }

  calculateLayoutScore(renderTime, dataSize) {
    // Lower score is better
    // Heuristic: 100ms per 100 items is acceptable
    const expected = dataSize;
    const ratio = renderTime / expected;
    return Math.min(ratio, 10); // Cap at 10
  }

  /**
   * Log task completion for study protocols
   */
  logTaskCompletion(taskId, success, timeToComplete, errors = []) {
    if (!this.enabled) return;

    this.metrics.taskCompletions.push({
      taskId,
      success,
      timeToComplete,
      errors,
      navigationPathLength: this.metrics.navigationPath.length,
      interactionsCount: this.metrics.interactions.length,
      timestamp: Date.now() - this.startTime
    });

    console.log(`[ResearchTelemetry] Task ${taskId}: ${success ? 'completed' : 'failed'} in ${timeToComplete}ms`);
  }

  /**
   * Export collected data
   */
  exportData(format = this.exportFormat) {
    if (!this.enabled) return null;

    const data = {
      sessionId: this.sessionId,
      exportTime: Date.now(),
      sessionDuration: Date.now() - this.startTime,
      summary: this.generateSummary(),
      metrics: this.serializeMetrics()
    };

    if (format === 'csv') {
      return this.toCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  generateSummary() {
    const interactions = this.metrics.interactions;
    const gazeTargets = Array.from(this.metrics.gazeTargets.entries());

    return {
      totalInteractions: interactions.length,
      uniqueElementsInteracted: new Set(interactions.map(i => i.targetId)).size,
      totalNavigationPoints: this.metrics.navigationPath.length,
      averageVelocity: this.calculateAverageVelocity(),
      mostViewedElements: gazeTargets
        .sort((a, b) => b[1].dwellTime - a[1].dwellTime)
        .slice(0, 5)
        .map(([id, data]) => ({ id, dwellTime: data.dwellTime })),
      taskSuccessRate: this.calculateTaskSuccessRate(),
      totalDistanceTraveled: this.calculateTotalDistance()
    };
  }

  calculateAverageVelocity() {
    const velocities = this.metrics.navigationPath
      .filter(p => p.velocity > 0)
      .map(p => p.velocity);
    return velocities.length > 0
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length
      : 0;
  }

  calculateTaskSuccessRate() {
    const tasks = this.metrics.taskCompletions;
    if (tasks.length === 0) return null;
    const successful = tasks.filter(t => t.success).length;
    return successful / tasks.length;
  }

  calculateTotalDistance() {
    const path = this.metrics.navigationPath;
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const p1 = path[i - 1].position;
      const p2 = path[i].position;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return total;
  }

  serializeMetrics() {
    return {
      navigationPath: this.metrics.navigationPath,
      interactions: this.metrics.interactions,
      gazeTargets: Array.from(this.metrics.gazeTargets.entries()).map(
        ([id, data]) => ({ elementId: id, ...data })
      ),
      layoutSwitches: this.metrics.layoutSwitches,
      taskCompletions: this.metrics.taskCompletions
    };
  }

  toCSV(data) {
    // Convert interactions to CSV
    const interactions = data.metrics.interactions;
    const headers = 'timestamp,type,targetId,sessionDuration,totalNavPoints\n';
    const rows = interactions.map(i =>
      `${i.timestamp},${i.type},${i.targetId},${i.context.sessionDuration},${i.context.totalNavPoints}`
    ).join('\n');

    return headers + rows;
  }

  /**
   * Auto-export at intervals (if enabled)
   */
  startAutoExport() {
    if (!this.autoExport) return;

    setInterval(() => {
      const data = this.exportData();
      if (data) {
        this.emit('telemetry-export', { data, timestamp: Date.now() });
      }
    }, this.exportInterval);
  }

  /**
   * Clear all collected data
   */
  clear() {
    this.metrics = {
      navigationPath: [],
      gazeTargets: new Map(),
      interactions: [],
      layoutSwitches: [],
      taskCompletions: []
    };
    this.events = [];
    this.startTime = Date.now();
    console.log('[ResearchTelemetry] Data cleared');
  }

  /**
   * Event emitter for integration
   */
  emit(eventName, data) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`nemosyne-telemetry-${eventName}`, {
        detail: data
      }));
    }
  }

  /**
   * Hook into A-Frame scene
   */
  attachToScene(scene) {
    if (!this.enabled) return this;

    // Hook into camera
    const camera = scene.querySelector('[camera]') || scene.camera;
    if (camera) {
      // Track position changes
      setInterval(() => {
        this.trackNavigation(camera);
      }, this.positionThrottle);
    }

    // Hook into click events
    scene.addEventListener('click', (e) => {
      const target = e.detail?.intersectedEl;
      if (target) {
        this.logInteraction('click', target.id || target.className, {
          position: e.detail.point,
          distance: e.detail.distance
        });
      }
    });

    console.log('[ResearchTelemetry] Attached to scene');
    return this;
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResearchTelemetry;
}

// Make available globally for browser
if (typeof window !== 'undefined') {
  window.ResearchTelemetry = ResearchTelemetry;
}

export { ResearchTelemetry };
