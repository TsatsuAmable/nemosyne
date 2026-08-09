/**
 * Adaptive WebXR Frame & Thermal Governor.
 *
 * Continuously monitors WebXR frame render time. Dynamically scales particle counts,
 * LOD culling distance, and shadow map resolution when frame time breaches 11.1ms
 * (90 FPS Meta Quest 3S performance target).
 */

export interface FrameGovernorMetrics {
  averageFrameTimeMs: number;
  lodScaleFactor: number; // 0.5 (low detail) to 1.0 (full detail)
  isGovernorActive: boolean;
  throttleCount: number;
}

export class AdaptiveFrameGovernor {
  targetFrameTimeMs: number;
  sampleWindowSize: number;
  private _frameTimes: number[] = [];
  private _lodScaleFactor = 1.0;
  private _throttleCount = 0;

  constructor(targetFrameTimeMs = 11.1, sampleWindowSize = 30) {
    this.targetFrameTimeMs = targetFrameTimeMs;
    this.sampleWindowSize = sampleWindowSize;
  }

  recordFrame(renderTimeMs: number): void {
    this._frameTimes.push(renderTimeMs);
    if (this._frameTimes.length > this.sampleWindowSize) {
      this._frameTimes.shift();
    }

    if (this._frameTimes.length >= 10) {
      const avgTime = this.getAverageFrameTime();
      if (avgTime > this.targetFrameTimeMs * 1.15) {
        // Frame time breaching 90 FPS target -> throttle LOD
        this._lodScaleFactor = Math.max(0.40, this._lodScaleFactor - 0.05);
        this._throttleCount++;
      } else if (avgTime < this.targetFrameTimeMs * 0.75 && this._lodScaleFactor < 1.0) {
        // Render time smooth -> recover LOD detail
        this._lodScaleFactor = Math.min(1.0, this._lodScaleFactor + 0.02);
      }
    }
  }

  getAverageFrameTime(): number {
    if (this._frameTimes.length === 0) return 0;
    const sum = this._frameTimes.reduce((acc, val) => acc + val, 0);
    return Number((sum / this._frameTimes.length).toFixed(2));
  }

  getMetrics(): FrameGovernorMetrics {
    return {
      averageFrameTimeMs: this.getAverageFrameTime(),
      lodScaleFactor: Number(this._lodScaleFactor.toFixed(2)),
      isGovernorActive: this._lodScaleFactor < 1.0,
      throttleCount: this._throttleCount,
    };
  }

  reset(): void {
    this._frameTimes = [];
    this._lodScaleFactor = 1.0;
    this._throttleCount = 0;
  }
}
