// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { UXHypothesisTriageEngine } from '../src/vr/trace/UXHypothesisTriage.ts';
import { QuestProbeAnalyzer } from '../src/vr/scalability/QuestProbeAnalyzer.ts';
import { ShareableSessionURL } from '../src/session/ShareableSessionURL.ts';

describe('UX Triage, Quest Probe Analyzer & Shareable Session URLs', () => {
  describe('UX Hypothesis Triage Engine', () => {
    it('produces dual hypotheses and observational checks instead of dogmatic frustration score', () => {
      const triage = new UXHypothesisTriageEngine();

      const hyp = triage.triageSignal('LONG_DWELL_HESITATION', { confidence: 0.8 });

      expect(hyp.signalType).toBe('LONG_DWELL_HESITATION');
      expect(hyp.primaryHypothesis).toContain('confused');
      expect(hyp.alternativeHypothesis).toContain('inspecting data');
      expect(hyp.recommendedObservationalCheck).toContain('retrospective interview');
      expect(triage.getAllHypotheses().length).toBe(1);
    });
  });

  describe('Quest Probe Analyzer', () => {
    it('evaluates on-device frame time, dropped rate, and heap against budget', () => {
      const analyzer = new QuestProbeAnalyzer();

      // Passing scenario
      const passingReport = analyzer.analyze([
        {
          timestamp: 1000,
          nodeCount: 8000,
          frameTimeP50Ms: 11.1,
          frameTimeP95Ms: 12.8,
          frameTimeP99Ms: 13.5,
          droppedFrameRate: 0.01,
          jsHeapUsedMb: 140,
          handTrackingLatencyMs: 18,
        },
      ]);

      expect(passingReport.isWithinBudget).toBe(true);
      expect(passingReport.budgetViolations.length).toBe(0);
      expect(passingReport.averageHandLatencyMs).toBe(18);

      // Failing scenario (exceeds budget)
      const failingReport = analyzer.analyze([
        {
          timestamp: 2000,
          nodeCount: 65000,
          frameTimeP50Ms: 15.0,
          frameTimeP95Ms: 18.2, // Exceeds 13.8ms
          frameTimeP99Ms: 22.0,
          droppedFrameRate: 0.08, // Exceeds 5%
          jsHeapUsedMb: 280, // Exceeds 250MB
        },
      ]);

      expect(failingReport.isWithinBudget).toBe(false);
      expect(failingReport.budgetViolations.length).toBe(3);
    });
  });

  describe('Shareable Session URL', () => {
    it('encodes and decodes self-contained analytical session states', () => {
      const payload = {
        datasetId: 'DATASET_COVID_GRAPH',
        topology: 'GRAPH',
        selectedEntityId: 'NODE_ALPHA_9',
        activeLayout: 'force_directed',
        interactionMode: 'INTERACT',
        focusTarget: 'CLUSTER_3',
        timestamp: 1723980000000,
        authToken: 'AUTH_SECRET_XYZ',
      };

      const encodedUrl = ShareableSessionURL.encode(payload, 'https://nemosyne.ai/app');
      expect(encodedUrl).toContain('session_state=');

      const decoded = ShareableSessionURL.decode(encodedUrl);
      expect(decoded).not.toBeNull();
      expect(decoded?.datasetId).toBe('DATASET_COVID_GRAPH');
      expect(decoded?.topology).toBe('GRAPH');
      expect(decoded?.selectedEntityId).toBe('NODE_ALPHA_9');
      expect(decoded?.activeLayout).toBe('force_directed');
      expect(decoded?.interactionMode).toBe('INTERACT');
      expect(decoded?.authToken).toBe('AUTH_SECRET_XYZ');
    });

    it('returns null on invalid URL or tampered payload', () => {
      expect(ShareableSessionURL.decode('https://nemosyne.ai/app')).toBeNull();
      expect(ShareableSessionURL.decode('https://nemosyne.ai/app?session_state=INVALID_BASE64!')).toBeNull();
    });
  });
});
