import { describe, it, expect } from 'vitest';
import { BenchmarkSession, CANONICAL_BENCHMARK_TASKS } from '../src/utils/BenchmarkSession.ts';

describe('Sprint 12.6: Benchmark Session & Evidence of Value Suite', () => {
  it('initializes canonical 5-task benchmark sequence', () => {
    expect(CANONICAL_BENCHMARK_TASKS.length).toBe(5);
    expect(CANONICAL_BENCHMARK_TASKS[0].name).toBe('Find Top Outlier');
    expect(CANONICAL_BENCHMARK_TASKS[4].name).toBe('Compare Two Encodings');
  });

  it('instruments task completion and captures timing/gesture/frustration metrics', () => {
    const session = new BenchmarkSession();

    session.recordGesture();
    session.recordGesture();
    session.recordOperation();
    session.updateFrustrationScore(0.25);

    const taskResult = session.completeTask(1, true);

    expect(taskResult.taskId).toBe(1);
    expect(taskResult.completed).toBe(true);
    expect(taskResult.gestureCount).toBe(2);
    expect(taskResult.operationCount).toBe(1);
    expect(taskResult.frustrationScore).toBe(0.25);
  });

  it('exports session results JSON with summary statistics', () => {
    const session = new BenchmarkSession();

    session.recordGesture();
    session.completeTask(1, true);
    session.completeTask(2, true);

    const exportData = session.exportResults();

    expect(exportData.sessionId).toContain('benchmark-');
    expect(exportData.tasksCompletedCount).toBe(2);
    expect(exportData.taskResults.length).toBe(2);
  });
});
