/**
 * TemporalScrubber: Time-Travel Animation for Data Evolution
 *
 * Enables:
 * - Scrubbing backward/forward through time
 * - Watching data structures grow/evolve
 * - Comparing states at different moments
 * - Animated transitions between epochs
 * - Uncertainty visualization (probability clouds)
 *
 * Use case: "Watch your MemPalace grow over months"
 */

class TemporalScrubber extends EventTarget {
  constructor(options = {}) {
    super();

    this.timeRange = {
      start: options.startTime || Date.now() - (365 * 24 * 60 * 60 * 1000), // Default: 1 year ago
      end: options.endTime || Date.now(),
      current: options.currentTime || Date.now()
    };

    this.state = {
      isPlaying: false,
      playbackSpeed: options.playbackSpeed || 1.0, // Days per second
      direction: 1, // 1 = forward, -1 = backward
      loop: options.loop !== false
    };

    this.dataHistory = new Map(); // timestamp -> data snapshot
    this.interpolatedState = null;

    // Animation frame ID
    this.animationFrame = null;

    console.log('[TemporalScrubber] Initialized for time range',
      new Date(this.timeRange.start), 'to', new Date(this.timeRange.end));
  }

  /**
   * Add a historical data snapshot
   */
  addSnapshot(timestamp, data) {
    this.dataHistory.set(timestamp, data);

    // Sort timestamps
    this.sortedTimes = Array.from(this.dataHistory.keys()).sort((a, b) => a - b);

    this.emit('snapshot-added', { timestamp, data });
  }

  /**
   * Load data from MemPalace with timestamps
   */
  async loadFromMemPalace(adapter, options = {}) {
    this.emit('loading-started', {});

    try {
      // Get all drawers with timestamps
      const response = await fetch(`${adapter.baseUrl}/api/drawers`);
      const data = await response.json();

      // Group by creation time windows
      const timeWindow = options.timeWindow || 24 * 60 * 60 * 1000; // 1 day buckets

      data.drawers.forEach(drawer => {
        const timestamp = drawer.data.timestamp || drawer.created_at;
        const bucketTime = Math.floor(timestamp / timeWindow) * timeWindow;

        if (!this.dataHistory.has(bucketTime)) {
          this.dataHistory.set(bucketTime, {
            nodes: [],
            timestamp: bucketTime,
            stats: { count: 0, byWing: {} }
          });
        }

        const snapshot = this.dataHistory.get(bucketTime);
        snapshot.nodes.push({
          id: drawer.data.drawerId,
          wingId: drawer.data.wingId,
          roomId: drawer.data.roomId,
          content: drawer.data.content,
          timestamp: timestamp,
          position: drawer.position
        });

        snapshot.stats.count++;
        snapshot.stats.byWing[drawer.data.wingId] =
          (snapshot.stats.byWing[drawer.data.wingId] || 0) + 1;
      });

      // Sort timestamps
      this.sortedTimes = Array.from(this.dataHistory.keys()).sort((a, b) => a - b);

      // Update time range
      if (this.sortedTimes.length > 0) {
        this.timeRange.start = this.sortedTimes[0];
        this.timeRange.end = this.sortedTimes[this.sortedTimes.length - 1];
        this.timeRange.current = this.timeRange.start;
      }

      this.emit('loading-complete', {
        snapshots: this.dataHistory.size,
        timeRange: this.timeRange
      });

      return true;

    } catch (error) {
      console.error('[TemporalScrubber] Failed to load:', error);
      this.emit('loading-error', { error });
      return false;
    }
  }

  /**
   * Interpolate data state at specific time
   */
  getStateAtTime(timestamp) {
    if (!this.sortedTimes || this.sortedTimes.length === 0) {
      return null;
    }

    // Clamp to available range
    const clamped = Math.max(this.timeRange.start,
      Math.min(this.timeRange.end, timestamp));

    // Find surrounding snapshots
    let lowerIdx = -1;
    let upperIdx = -1;

    for (let i = 0; i < this.sortedTimes.length; i++) {
      if (this.sortedTimes[i] <= clamped) {
        lowerIdx = i;
      }
      if (this.sortedTimes[i] >= clamped && upperIdx === -1) {
        upperIdx = i;
        break;
      }
    }

    // Exact match
    if (this.sortedTimes[lowerIdx] === clamped) {
      return this.dataHistory.get(clamped);
    }

    // Need interpolation
    if (lowerIdx === -1) return this.dataHistory.get(this.sortedTimes[0]);
    if (upperIdx === -1) return this.dataHistory.get(this.sortedTimes[this.sortedTimes.length - 1]);
    if (lowerIdx === upperIdx) return this.dataHistory.get(this.sortedTimes[lowerIdx]);

    // Linear interpolation between snapshots
    const t1 = this.sortedTimes[lowerIdx];
    const t2 = this.sortedTimes[upperIdx];
    const fraction = (clamped - t1) / (t2 - t1);

    const state1 = this.dataHistory.get(t1);
    const state2 = this.dataHistory.get(t2);

    return this.interpolateStates(state1, state2, fraction);
  }

  interpolateStates(state1, state2, t) {
    // Interpolate node positions and properties
    const result = {
      timestamp: state1.timestamp + (state2.timestamp - state1.timestamp) * t,
      nodes: [],
      stats: {
        count: state1.stats.count + (state2.stats.count - state1.stats.count) * t,
        byWing: {}
      },
      isInterpolated: true
    };

    // Interpolate each node that exists in both states
    const nodeMap1 = new Map(state1.nodes.map(n => [n.id, n]));
    const nodeMap2 = new Map(state2.nodes.map(n => [n.id, n]));

    // Nodes appearing in state1
    state1.nodes.forEach(node => {
      const node2 = nodeMap2.get(node.id);
      if (node2) {
        // Node exists in both - interpolate
        result.nodes.push({
          ...node,
          position: {
            x: node.position.x + (node2.position.x - node.position.x) * t,
            y: node.position.y + (node2.position.y - node.position.y) * t,
            z: node.position.z + (node2.position.z - node.position.z) * t
          },
          opacity: 1
        });
      } else {
        // Node disappearing
        result.nodes.push({
          ...node,
          opacity: 1 - t
        });
      }
    });

    // New nodes appearing in state2
    state2.nodes.forEach(node => {
      if (!nodeMap1.has(node.id)) {
        result.nodes.push({
          ...node,
          opacity: t
        });
      }
    });

    return result;
  }

  /**
   * Start playback
   */
  play() {
    if (this.state.isPlaying) return;

    this.state.isPlaying = true;
    this.lastFrameTime = performance.now();

    this.emit('playback-started', { currentTime: this.timeRange.current });

    this.animate();
  }

  /**
   * Pause playback
   */
  pause() {
    this.state.isPlaying = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.emit('playback-paused', { currentTime: this.timeRange.current });
  }

  /**
   * Animation loop
   */
  animate() {
    if (!this.state.isPlaying) return;

    const now = performance.now();
    const deltaReal = (now - this.lastFrameTime) / 1000; // seconds
    this.lastFrameTime = now;

    // Advance time based on playback speed
    const deltaTime = deltaReal * this.state.playbackSpeed * 24 * 60 * 60 * 1000; // ms per second

    this.timeRange.current += deltaTime * this.state.direction;

    // Check bounds
    if (this.timeRange.current >= this.timeRange.end) {
      if (this.state.loop) {
        this.timeRange.current = this.timeRange.start;
        this.emit('playback-looped');
      } else {
        this.timeRange.current = this.timeRange.end;
        this.pause();
        this.emit('playback-ended');
        return;
      }
    }

    if (this.timeRange.current <= this.timeRange.start && this.state.direction < 0) {
      this.timeRange.current = this.timeRange.start;
      this.pause();
      return;
    }

    // Calculate state
    const state = this.getStateAtTime(this.timeRange.current);

    if (state) {
      this.emit('time-update', {
        currentTime: this.timeRange.current,
        state: state,
        progress: (this.timeRange.current - this.timeRange.start) / (this.timeRange.end - this.timeRange.start)
      });
    }

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  /**
   * Scrub to specific time
   */
  scrubTo(timestamp) {
    this.timeRange.current = Math.max(this.timeRange.start,
      Math.min(this.timeRange.end, timestamp));

    const state = this.getStateAtTime(this.timeRange.current);

    this.emit('scrub-update', {
      currentTime: this.timeRange.current,
      state: state,
      progress: (this.timeRange.current - this.timeRange.start) / (this.timeRange.end - this.timeRange.start)
    });

    return state;
  }

  /**
   * Set playback speed
   */
  setSpeed(speed) {
    this.state.playbackSpeed = speed;
    this.emit('speed-changed', { speed });
  }

  /**
   * Set direction
   */
  setDirection(direction) {
    this.state.direction = direction;
    this.emit('direction-changed', { direction });
  }

  /**
   * Jump to specific events
   */
  jumpToNextEvent() {
    const current = this.timeRange.current;
    const next = this.sortedTimes.find(t => t > current);

    if (next) {
      this.scrubTo(next);
    }
    return next;
  }

  jumpToPreviousEvent() {
    const current = this.timeRange.current;
    const prev = [...this.sortedTimes].reverse().find(t => t < current);

    if (prev) {
      this.scrubTo(prev);
    }
    return prev;
  }

  /**
   * Generate uncertainty field (probability cloud)
   * For predictions or uncertain data
   */
  generateUncertaintyField(centerTime, uncertaintyWindow) {
    const states = [];

    // Sample multiple possible futures/pasts
    const samples = 10;
    for (let i = 0; i < samples; i++) {
      const offset = (Math.random() - 0.5) * 2 * uncertaintyWindow;
      const t = centerTime + offset;
      const state = this.getStateAtTime(t);
      if (state) {
        states.push({
          time: t,
          state: state,
          probability: 1 - Math.abs(offset) / uncertaintyWindow
        });
      }
    }

    return states;
  }

  /**
   * Compare two time periods
   */
  compareTimePeriods(time1, time2) {
    const state1 = this.getStateAtTime(time1);
    const state2 = this.getStateAtTime(time2);

    if (!state1 || !state2) return null;

    // Calculate differences
    const added = state2.nodes.filter(n2 => !state1.nodes.find(n1 => n1.id === n2.id));
    const removed = state1.nodes.filter(n1 => !state2.nodes.find(n2 => n2.id === n1.id));
    const changed = [];

    state2.nodes.forEach(n2 => {
      const n1 = state1.nodes.find(n => n.id === n2.id);
      if (n1) {
        const dist = Math.sqrt(
          Math.pow(n2.position.x - n1.position.x, 2) +
          Math.pow(n2.position.y - n1.position.y, 2) +
          Math.pow(n2.position.z - n1.position.z, 2)
        );
        if (dist > 0.1) {
          changed.push({ node: n2, fromPosition: n1.position, distance: dist });
        }
      }
    });

    return {
      added: added,
      removed: removed,
      changed: changed,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length
    };
  }

  /**
   * Get statistics about the time range
   */
  getStats() {
    return {
      snapshots: this.dataHistory.size,
      timeSpan: this.timeRange.end - this.timeRange.start,
      startTime: new Date(this.timeRange.start),
      endTime: new Date(this.timeRange.end),
      currentTime: new Date(this.timeRange.current),
      isPlaying: this.state.isPlaying,
      playbackSpeed: this.state.playbackSpeed
    };
  }

  emit(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    this.dispatchEvent(event);
  }
}

export { TemporalScrubber };

console.log('[TemporalScrubber] Module loaded');
