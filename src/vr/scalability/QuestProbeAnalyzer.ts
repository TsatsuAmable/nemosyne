/**
 * Quest B2 Real-Headset Probe Log Analyzer.
 *
 * Ingests and evaluates on-device load-test metrics (frame time p50/p95/p99,
 * dropped frame rate, JS heap, GPU bytes, hand tracking latency) against
 * Quest 3/3S spatial compute budgets.
 */

export interface QuestLoadTestEntry {
  timestamp: number;
  nodeCount: number;
  frameTimeP50Ms: number;
  frameTimeP95Ms: number;
  frameTimeP99Ms: number;
  droppedFrameRate: number;
  jsHeapUsedMb: number;
  gpuMemoryUsedMb?: number;
  handTrackingLatencyMs?: number;
}

export interface QuestPerformanceBudgetReport {
  isWithinBudget: boolean;
  maxFrameTimeP95Ms: number;
  maxDroppedRate: number;
  maxJsHeapMb: number;
  averageHandLatencyMs?: number;
  budgetViolations: string[];
}

export class QuestProbeAnalyzer {
  private readonly TARGET_MAX_P95_FRAME_TIME_MS = 13.8; // 72 FPS target budget = 13.88ms
  private readonly TARGET_MAX_DROPPED_RATE = 0.05; // 5% max dropped frames
  private readonly TARGET_MAX_JS_HEAP_MB = 250; // 250 MB JS Heap budget

  analyze(entries: QuestLoadTestEntry[]): QuestPerformanceBudgetReport {
    if (entries.length === 0) {
      return {
        isWithinBudget: true,
        maxFrameTimeP95Ms: 0,
        maxDroppedRate: 0,
        maxJsHeapMb: 0,
        budgetViolations: [],
      };
    }

    let maxP95 = 0;
    let maxDropped = 0;
    let maxHeap = 0;
    let totalHandLatency = 0;
    let handLatencyCount = 0;
    const violations: string[] = [];

    for (const entry of entries) {
      if (entry.frameTimeP95Ms > maxP95) maxP95 = entry.frameTimeP95Ms;
      if (entry.droppedFrameRate > maxDropped) maxDropped = entry.droppedFrameRate;
      if (entry.jsHeapUsedMb > maxHeap) maxHeap = entry.jsHeapUsedMb;

      if (typeof entry.handTrackingLatencyMs === 'number') {
        totalHandLatency += entry.handTrackingLatencyMs;
        handLatencyCount++;
      }
    }

    if (maxP95 > this.TARGET_MAX_P95_FRAME_TIME_MS) {
      violations.push(`P95 Frame time ${maxP95.toFixed(1)}ms exceeds budget of ${this.TARGET_MAX_P95_FRAME_TIME_MS}ms`);
    }

    if (maxDropped > this.TARGET_MAX_DROPPED_RATE) {
      violations.push(`Dropped frame rate ${(maxDropped * 100).toFixed(1)}% exceeds budget of ${(this.TARGET_MAX_DROPPED_RATE * 100)}%`);
    }

    if (maxHeap > this.TARGET_MAX_JS_HEAP_MB) {
      violations.push(`JS Heap ${maxHeap.toFixed(1)}MB exceeds budget of ${this.TARGET_MAX_JS_HEAP_MB}MB`);
    }

    return {
      isWithinBudget: violations.length === 0,
      maxFrameTimeP95Ms: maxP95,
      maxDroppedRate: maxDropped,
      maxJsHeapMb: maxHeap,
      averageHandLatencyMs: handLatencyCount > 0 ? totalHandLatency / handLatencyCount : undefined,
      budgetViolations: violations,
    };
  }
}
