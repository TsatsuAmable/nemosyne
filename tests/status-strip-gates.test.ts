// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { StatusStripController, SEMANTIC_PALETTE } from '../src/vr/ui/StatusStripController.ts';
import { UXAcceptanceGateEvaluator } from '../src/vr/trace/UXAcceptanceGate.ts';

describe('Cockpit Status & UX Acceptance Gates (Sprints 24.8, 24.9)', () => {
  describe('Sprint 24.8 — Status Strip & Spotlight Context Model', () => {
    it('formats persistent status strip answering current analyst context', () => {
      const controller = new StatusStripController();

      controller.setDatasetContext('FINANCIAL_FRAUD', 'GRAPH', 18420);
      controller.setInteractionMode('INTERACT');
      controller.setFocusTarget('COMMUNITY_7');
      controller.recordAction('COMPARE_DISTRIBUTION', 'Filter anomaly subgraphs');

      const formatted = controller.formatStripText();
      expect(formatted).toBe('GRAPH / 18,420 items · MODE: INTERACT · FOCUS: COMMUNITY_7 · ACTION: COMPARE_DISTRIBUTION');
      expect(SEMANTIC_PALETTE.analysis).toBeDefined();
      expect(SEMANTIC_PALETTE.accent).toBeDefined();
    });

    it('tracks spotlight entity priority', () => {
      const controller = new StatusStripController();
      controller.setSpotlight('cluster-mesh-node-42');
      expect(controller.spotlightEntityId).toBe('cluster-mesh-node-42');
    });
  });

  describe('Sprint 24.9 — UX Acceptance Gates', () => {
    it('evaluates UX sessions against quality criteria targets', () => {
      const evaluator = new UXAcceptanceGateEvaluator();

      const healthyMetrics = {
        tFirstJointsValidMs: 2500, // < 10000 ms
        meanAimDriftDegPerSec: 4.2, // < 15 deg/s
        bothPinchSuppressionRatio: 0.02, // < 0.10
        targetAcquisitionFailureRate: 0.03, // < 0.05
      };

      const cleanReport = evaluator.evaluate(healthyMetrics);
      expect(cleanReport.passed).toBe(true);
      expect(cleanReport.violations.length).toBe(0);

      const regressedMetrics = {
        tFirstJointsValidMs: 14000, // VIOLATION
        meanAimDriftDegPerSec: 8.0,
        bothPinchSuppressionRatio: 0.25, // VIOLATION
        targetAcquisitionFailureRate: 0.08, // VIOLATION
      };

      const failingReport = evaluator.evaluate(regressedMetrics);
      expect(failingReport.passed).toBe(false);
      expect(failingReport.violations.length).toBe(3);
      expect(failingReport.violations.map((v) => v.ruleId)).toContain('UX-001');
      expect(failingReport.violations.map((v) => v.ruleId)).toContain('UX-003');
      expect(failingReport.violations.map((v) => v.ruleId)).toContain('UX-004');
    });
  });
});
