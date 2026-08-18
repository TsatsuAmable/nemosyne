/**
 * UX Acceptance Quality Gates (Sprint 24.9).
 *
 * Enforces measurable engineering acceptance criteria across UX phenomena (UX-001..UX-012):
 * - UX-001: Hand tracking cold start (tFirstJointsValid < 10,000 ms)
 * - UX-002: Aim stability / drift (< 15 degrees / sec jitter)
 * - UX-003: Both-pinch suppression ratio (< 10% suppressed)
 * - UX-004: Target acquisition failure rate (< 5% failed pointer attempts)
 */

export interface UXSessionMetrics {
  tFirstJointsValidMs: number;
  meanAimDriftDegPerSec: number;
  bothPinchSuppressionRatio: number;
  targetAcquisitionFailureRate: number;
}

export interface GateRule {
  id: string;
  phenomenon: string;
  threshold: number;
  comparator: 'lt' | 'lte' | 'gt' | 'gte';
  extractValue: (metrics: UXSessionMetrics) => number;
}

export const UX_GATE_RULES: readonly GateRule[] = [
  {
    id: 'UX-001',
    phenomenon: 'Hand Tracking Cold Start',
    threshold: 10000,
    comparator: 'lt',
    extractValue: (m) => m.tFirstJointsValidMs,
  },
  {
    id: 'UX-002',
    phenomenon: 'Aim Drift / Jitter',
    threshold: 15,
    comparator: 'lt',
    extractValue: (m) => m.meanAimDriftDegPerSec,
  },
  {
    id: 'UX-003',
    phenomenon: 'Both-Pinch Gesture Suppression',
    threshold: 0.10,
    comparator: 'lt',
    extractValue: (m) => m.bothPinchSuppressionRatio,
  },
  {
    id: 'UX-004',
    phenomenon: 'Target Acquisition Failure Rate',
    threshold: 0.05,
    comparator: 'lt',
    extractValue: (m) => m.targetAcquisitionFailureRate,
  },
];

export interface GateViolation {
  ruleId: string;
  phenomenon: string;
  actual: number;
  threshold: number;
}

export interface GateEvaluationReport {
  passed: boolean;
  violations: GateViolation[];
  metrics: UXSessionMetrics;
  evaluatedAt: number;
}

export class UXAcceptanceGateEvaluator {
  evaluate(metrics: UXSessionMetrics): GateEvaluationReport {
    const violations: GateViolation[] = [];

    for (const rule of UX_GATE_RULES) {
      const actual = rule.extractValue(metrics);
      let passed = true;

      switch (rule.comparator) {
        case 'lt':
          passed = actual < rule.threshold;
          break;
        case 'lte':
          passed = actual <= rule.threshold;
          break;
        case 'gt':
          passed = actual > rule.threshold;
          break;
        case 'gte':
          passed = actual >= rule.threshold;
          break;
      }

      if (!passed) {
        violations.push({
          ruleId: rule.id,
          phenomenon: rule.phenomenon,
          actual,
          threshold: rule.threshold,
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      metrics,
      evaluatedAt: Date.now(),
    };
  }
}
