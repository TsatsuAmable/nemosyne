/**
 * Performance budget enforcement for the Nemosyne WebXR runtime.
 *
 * Tracks frame time, draw calls, geometry primitives, and interactable counts
 * against configurable thresholds. Produces in-VR warnings and telemetry
 * events so Quest Browser profiling is visible while running.
 */

export const DEFAULT_BUDGETS = {
  frameMs: 16.67, // 60 fps
  droppedFramesPer10s: 5, // acceptable stutter
  drawCalls: 500,
  triangles: 200_000,
  points: 100_000,
  interactables: 500,
  updatables: 200,
  panels: 20,
  handTrackingMs: 4, // budget for hand-tracking processing per frame
};

export class PerformanceBudget {
  constructor(budgets = {}) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets };
    this._violations = [];
    this._frameDropWindow = [];
    this._lastWindowTime = 0;
    this._warned = new Set();
  }

  /** Update budget thresholds at runtime. */
  setBudgets(budgets) {
    this.budgets = { ...this.budgets, ...budgets };
  }

  /**
   * Evaluate a single frame and return a list of budget violations.
   * @param {object} snapshot
   * @param {number} snapshot.frameMs
   * @param {boolean} snapshot.dropped
   * @param {object} snapshot.rendererInfo from three.js renderer.info
   * @param {number} snapshot.interactableCount
   * @param {number} snapshot.updatableCount
   * @param {number} snapshot.panelCount
   * @param {number} snapshot.time elapsed engine time
   */
  check(snapshot) {
    const now = performance.now?.() ?? Date.now();
    const violations = [];

    if (snapshot.frameMs > this.budgets.frameMs) {
      violations.push({
        id: 'frameMs',
        severity: snapshot.frameMs > this.budgets.frameMs * 2 ? 'critical' : 'warning',
        message: `Frame ${snapshot.frameMs.toFixed(1)} ms exceeds ${this.budgets.frameMs.toFixed(1)} ms budget`,
        value: snapshot.frameMs,
        budget: this.budgets.frameMs,
      });
    }

    this._recordDrop(snapshot.dropped, now);
    const dropsInWindow = this._frameDropWindow.length;
    if (dropsInWindow > this.budgets.droppedFramesPer10s) {
      violations.push({
        id: 'droppedFramesPer10s',
        severity: 'warning',
        message: `${dropsInWindow} dropped frames in 10 s exceeds ${this.budgets.droppedFramesPer10s}`,
        value: dropsInWindow,
        budget: this.budgets.droppedFramesPer10s,
      });
    }

    const render = snapshot.rendererInfo?.render ?? {};
    if (render.calls > this.budgets.drawCalls) {
      violations.push({
        id: 'drawCalls',
        severity: render.calls > this.budgets.drawCalls * 2 ? 'critical' : 'warning',
        message: `${render.calls} draw calls exceed ${this.budgets.drawCalls} budget`,
        value: render.calls,
        budget: this.budgets.drawCalls,
      });
    }

    const triangles = render.triangles ?? 0;
    if (triangles > this.budgets.triangles) {
      violations.push({
        id: 'triangles',
        severity: 'warning',
        message: `${triangles.toLocaleString()} triangles exceed ${this.budgets.triangles.toLocaleString()} budget`,
        value: triangles,
        budget: this.budgets.triangles,
      });
    }

    const points = render.points ?? 0;
    if (points > this.budgets.points) {
      violations.push({
        id: 'points',
        severity: 'warning',
        message: `${points.toLocaleString()} points exceed ${this.budgets.points.toLocaleString()} budget`,
        value: points,
        budget: this.budgets.points,
      });
    }

    if (snapshot.interactableCount > this.budgets.interactables) {
      violations.push({
        id: 'interactables',
        severity: 'warning',
        message: `${snapshot.interactableCount} interactables exceed ${this.budgets.interactables} budget`,
        value: snapshot.interactableCount,
        budget: this.budgets.interactables,
      });
    }

    if (snapshot.updatableCount > this.budgets.updatables) {
      violations.push({
        id: 'updatables',
        severity: 'warning',
        message: `${snapshot.updatableCount} updatables exceed ${this.budgets.updatables} budget`,
        value: snapshot.updatableCount,
        budget: this.budgets.updatables,
      });
    }

    if (snapshot.panelCount > this.budgets.panels) {
      violations.push({
        id: 'panels',
        severity: 'warning',
        message: `${snapshot.panelCount} panels exceed ${this.budgets.panels} budget`,
        value: snapshot.panelCount,
        budget: this.budgets.panels,
      });
    }

    for (const v of violations) {
      const key = `${v.id}:${Math.floor(now / 5000)}`; // throttle identical warnings to 5 s
      if (!this._warned.has(key)) {
        this._warned.add(key);
        this._violations.push({ ...v, time: now });
      }
    }

    // Trim violation history.
    if (this._violations.length > 100) this._violations = this._violations.slice(-50);

    return violations;
  }

  _recordDrop(dropped, now) {
    if (!dropped) return;
    const windowStart = now - 10_000;
    this._frameDropWindow = this._frameDropWindow.filter((t) => t >= windowStart);
    this._frameDropWindow.push(now);
  }

  /** Return the most recent violations. */
  getViolations() {
    return this._violations.slice();
  }

  /** Return current budget values. */
  getBudgets() {
    return { ...this.budgets };
  }

  reset() {
    this._violations = [];
    this._frameDropWindow = [];
    this._warned.clear();
  }
}
