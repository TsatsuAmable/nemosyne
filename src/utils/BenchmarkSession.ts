/**
 * Benchmark Session Manager for Nemosyne Spatial Analysis Tasks.
 *
 * Instruments and automates testing across 5 canonical analyst tasks:
 * 1. Find Top Outlier (Financial Scatter)
 * 2. Identify Dominant Cluster (Geospatial)
 * 3. Trace Causal Path (Process-Flow Hierarchy)
 * 4. Spot Temporal Anomaly (Time Series)
 * 5. Compare Two Encodings (Representation Carousel)
 *
 * Exports JSON performance metrics including time-to-correct-selection,
 * gesture count, operation count, and dissatisfaction score at completion.
 */

export interface CanonicalTask {
  id: number;
  name: string;
  datasetType: string;
  successCriterion: string;
}

export interface TaskPerformanceResult {
  taskId: number;
  taskName: string;
  completed: boolean;
  timeToCompleteMs: number;
  gestureCount: number;
  operationCount: number;
  frustrationScore: number;
}

export interface BenchmarkSessionExport {
  sessionId: string;
  timestamp: number;
  totalDurationMs: number;
  tasksCompletedCount: number;
  averageFrustrationScore: number;
  taskResults: TaskPerformanceResult[];
}

export const CANONICAL_BENCHMARK_TASKS: CanonicalTask[] = [
  { id: 1, name: 'Find Top Outlier', datasetType: 'Financial Scatter', successCriterion: 'Select outlier node via Holographic Inspector' },
  { id: 2, name: 'Identify Dominant Cluster', datasetType: 'Geospatial Outlets', successCriterion: 'Confirm primary cluster label' },
  { id: 3, name: 'Trace Causal Path', datasetType: 'Process-Flow Hierarchy', successCriterion: 'Activate root-to-leaf path' },
  { id: 4, name: 'Spot Temporal Anomaly', datasetType: 'Time Series Sensors', successCriterion: 'Inspect anomaly spike in time ribbon' },
  { id: 5, name: 'Compare Two Encodings', datasetType: 'Multi-dimensional', successCriterion: 'Evaluate candidates in Representation Carousel' },
];

export class BenchmarkSession {
  sessionId: string;
  startTime: number;
  currentTaskId = 1;
  private _gestureCount = 0;
  private _operationCount = 0;
  private _frustrationScore = 0.0;
  private _taskResults: TaskPerformanceResult[] = [];

  constructor() {
    this.sessionId = `benchmark-${Date.now().toString(36)}`;
    this.startTime = Date.now();
  }

  recordGesture(): void {
    this._gestureCount++;
  }

  recordOperation(): void {
    this._operationCount++;
  }

  updateFrustrationScore(score: number): void {
    this._frustrationScore = Math.max(this._frustrationScore, score);
  }

  completeTask(taskId: number, success = true): TaskPerformanceResult {
    const task = CANONICAL_BENCHMARK_TASKS.find((t) => t.id === taskId) ?? {
      id: taskId,
      name: `Custom Task ${taskId}`,
      datasetType: 'Generic',
      successCriterion: 'Passed',
    };

    const timeToCompleteMs = Date.now() - this.startTime;

    const result: TaskPerformanceResult = {
      taskId: task.id,
      taskName: task.name,
      completed: success,
      timeToCompleteMs,
      gestureCount: this._gestureCount,
      operationCount: this._operationCount,
      frustrationScore: Number(this._frustrationScore.toFixed(2)),
    };

    this._taskResults.push(result);
    this.currentTaskId = Math.min(CANONICAL_BENCHMARK_TASKS.length, taskId + 1);

    return result;
  }

  exportResults(): BenchmarkSessionExport {
    const completed = this._taskResults.filter((t) => t.completed);
    const avgFrustration =
      completed.length > 0
        ? completed.reduce((acc, t) => acc + t.frustrationScore, 0) / completed.length
        : 0;

    return {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      totalDurationMs: Date.now() - this.startTime,
      tasksCompletedCount: completed.length,
      averageFrustrationScore: Number(avgFrustration.toFixed(2)),
      taskResults: [...this._taskResults],
    };
  }
}
