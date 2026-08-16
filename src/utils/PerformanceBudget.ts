/**
 * Performance budget enforcement for the Nemosyne WebXR runtime.
 *
 * Tracks frame time, draw calls, geometry primitives, and interactable counts
 * against configurable thresholds. Produces in-VR warnings and telemetry
 * events so Quest Browser profiling is visible while running.
 */

import type { PerformanceBudgets, PerformanceViolation } from '../vr/coordinators/types.ts';

export const DEFAULT_BUDGETS: Required<PerformanceBudgets> = {
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
  budgets: Required<PerformanceBudgets>;
  private _violations: PerformanceViolation[];
  private _frameDropWindow: number[];
  private _lastWindowTime: number;
  private _warned: Set<string>;

  constructor(budgets: PerformanceBudgets = {}) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets };
    this._violations = [];
    this._frameDropWindow = [];
    this._lastWindowTime = 0;
    this._warned = new Set();
  }

  /** Update budget thresholds at runtime. */
  setBudgets(budgets: Partial<PerformanceBudgets>): void {
    this.budgets = { ...this.budgets, ...budgets };
  }

  /**
   * Evaluate a single frame and return a list of budget violations.
   */
  check(snapshot: Record<string, unknown>): PerformanceViolation[] {
    const now = performance.now?.() ?? Date.now();
    const violations: PerformanceViolation[] = [];

    const frameMs = typeof snapshot.frameMs === 'number' ? snapshot.frameMs : 0;
    const dropped = !!snapshot.dropped;
    const interactableCount = typeof snapshot.interactableCount === 'number' ? snapshot.interactableCount : 0;
    const updatableCount = typeof snapshot.updatableCount === 'number' ? snapshot.updatableCount : 0;
    const panelCount = typeof snapshot.panelCount === 'number' ? snapshot.panelCount : 0;

    const rendererInfo = snapshot.rendererInfo as { render?: { calls?: number; triangles?: number; points?: number } } | undefined;
    const render = rendererInfo?.render ?? {};
    const drawCalls = render.calls ?? 0;
    const triangles = render.triangles ?? 0;
    const points = render.points ?? 0;

    if (frameMs > this.budgets.frameMs) {
      violations.push({
        id: 'frameMs',
        severity: frameMs > this.budgets.frameMs * 2 ? 'critical' : 'warning',
        message: `Frame ${frameMs.toFixed(1)} ms exceeds ${this.budgets.frameMs.toFixed(1)} ms budget`,
        value: frameMs,
        budget: this.budgets.frameMs,
      });
    }

    this._recordDrop(dropped, now);
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

    if (drawCalls > this.budgets.drawCalls) {
      violations.push({
        id: 'drawCalls',
        severity: drawCalls > this.budgets.drawCalls * 2 ? 'critical' : 'warning',
        message: `${drawCalls} draw calls exceed ${this.budgets.drawCalls} budget`,
        value: drawCalls,
        budget: this.budgets.drawCalls,
      });
    }

    if (triangles > this.budgets.triangles) {
      violations.push({
        id: 'triangles',
        severity: 'warning',
        message: `${triangles.toLocaleString()} triangles exceed ${this.budgets.triangles.toLocaleString()} budget`,
        value: triangles,
        budget: this.budgets.triangles,
      });
    }

    if (points > this.budgets.points) {
      violations.push({
        id: 'points',
        severity: 'warning',
        message: `${points.toLocaleString()} points exceed ${this.budgets.points.toLocaleString()} budget`,
        value: points,
        budget: this.budgets.points,
      });
    }

    if (interactableCount > this.budgets.interactables) {
      violations.push({
        id: 'interactables',
        severity: 'warning',
        message: `${interactableCount} interactables exceed ${this.budgets.interactables} budget`,
        value: interactableCount,
        budget: this.budgets.interactables,
      });
    }

    if (updatableCount > this.budgets.updatables) {
      violations.push({
        id: 'updatables',
        severity: 'warning',
        message: `${updatableCount} updatables exceed ${this.budgets.updatables} budget`,
        value: updatableCount,
        budget: this.budgets.updatables,
      });
    }

    if (panelCount > this.budgets.panels) {
      violations.push({
        id: 'panels',
        severity: 'warning',
        message: `${panelCount} panels exceed ${this.budgets.panels} budget`,
        value: panelCount,
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

  _recordDrop(dropped: boolean, now: number): void {
    if (!dropped) return;
    const windowStart = now - 10_000;
    this._frameDropWindow = this._frameDropWindow.filter((t) => t >= windowStart);
    this._frameDropWindow.push(now);
  }

  /** Return the most recent violations. */
  getViolations(): PerformanceViolation[] {
    return this._violations.slice();
  }

  /** Return current budget values. */
  getBudgets(): Required<PerformanceBudgets> {
    return { ...this.budgets };
  }

  reset(): void {
    this._violations = [];
    this._frameDropWindow = [];
    this._warned.clear();
  }
}
