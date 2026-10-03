import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TelemetryCollector } from '../src/utils/Telemetry.ts';
import type { UXTraceRecorderOptions } from '../src/vr/trace/UXTraceRecorder.ts';
import {
  setupDevTraceRecorder,
  type DevTraceBindings,
  type UXTraceAppExportEnvelopeV2,
} from '../src/app/devTrace.ts';
import { TelemetryConsentManager } from '../src/study/TelemetryConsentManager.ts';
import { parseUXTraceText } from '../scripts/lib/ux-trace-input.mjs';

type Handler = (payload?: unknown) => void;

function createTraceHarness(options: { enabled?: boolean; alwaysEnabled?: boolean } = {}) {
  const handlers = new Map<string, Handler[]>();
  const eventBus = {
    on(topic: string, handler: Handler) {
      const list = handlers.get(topic) ?? [];
      list.push(handler);
      handlers.set(topic, list);
      return () => {
        const current = handlers.get(topic) ?? [];
        const index = current.indexOf(handler);
        if (index >= 0) current.splice(index, 1);
      };
    },
  };
  const getUIState = vi.fn(() => ({ panel: 'telemetry' }));
  const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
  const engine = {
    camera: new THREE.PerspectiveCamera(),
    addUpdatable: vi.fn(),
    removeUpdatable: vi.fn(),
    input: {
      hands: [],
      panels: [],
      interactables: [],
    },
  };

  const recorderOptions: UXTraceRecorderOptions = {
    engine,
    eventBus,
    getUIState,
    fetchImpl,
  };
  if (options.enabled !== undefined) {
    recorderOptions.enabled = options.enabled;
  }

  const bindings: DevTraceBindings = {
    recorderOptions,
    bind: vi.fn(),
  };

  const recorder = setupDevTraceRecorder(bindings, {
    allowNetworkFlush: false,
    alwaysEnabled: options.alwaysEnabled ?? false,
  });

  return {
    recorder,
    getUIState,
    fetchImpl,
    emit(topic: string, payload?: unknown) {
      for (const handler of [...(handlers.get(topic) ?? [])]) {
        handler(payload);
      }
    },
    exportEnvelope(): UXTraceAppExportEnvelopeV2 {
      return JSON.parse(recorder.exportJson()) as UXTraceAppExportEnvelopeV2;
    },
  };
}

describe('RF-040 Telemetry & Trace Lifecycle Assurance', () => {
  const TEST_SALT = 'telemetry-assurance-salt-2026';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Default-off fail-closed posture across authorities', () => {
    it('TelemetryCollector defaults to disabled and discards all observations', () => {
      const collector = new TelemetryCollector();
      expect(collector.enabled).toBe(false);

      // Attempt recording across every producer path
      collector.recordFrame(25);
      collector.recordDataset('Atlas-Hostile', 'GRAPH');
      collector.recordOperation('kmeans');
      collector.recordPanelAction('Inspector', 'drag');
      collector.recordMenuAction('reset-camera');
      collector.recordGesture('pinch');
      collector.recordDwell('btn-42', 500, true);
      collector.recordGestureConfidence('pinch', 0.95, false);
      collector.recordMiss('sphere-node');
      collector.recordError(new Error('unconsented failure'), false);
      collector.recordError('unconsented warning', true);

      const report = collector.getReport();
      expect(report.enabled).toBe(false);
      expect(report.frames.count).toBe(0);
      expect(report.frames.dropped).toBe(0);
      expect(report.session.datasetName).toBe('-');
      expect(report.session.datasetTopology).toBe('-');
      expect(Object.keys(report.operations)).toHaveLength(0);
      expect(Object.keys(report.gestures)).toHaveLength(0);
      expect(report.errors.count).toBe(0);
      expect(report.errors.warnings).toBe(0);
      expect(report.errors.last).toBeNull();
      expect(collector.getCompactUXDigest().compactTrail).toBe('');
      expect(collector.getCompactUXDigest().dissatisfactionScore).toBe(0);
      expect(collector.getCompactUXDigest().detectedPatterns).toHaveLength(0);
      expect(collector.formatCompactUXReport()).toContain('None (Smooth UX)');
    });

    it('UXTraceRecorder defaults to disabled and drops event-bus context without recording', () => {
      const { recorder, emit, exportEnvelope, getUIState } = createTraceHarness({ enabled: false });
      expect(recorder.enabled).toBe(false);

      emit('gesture:recognized', { name: 'fist', ctx: { confidence: 0.8 } });
      emit('interaction', { action: 'select', target: 'node-99' });

      expect(getUIState).not.toHaveBeenCalled();
      const envelope = exportEnvelope();
      expect(envelope.recordCount).toBe(0);
      expect(envelope.records).toHaveLength(0);
      expect(envelope.traceOpen).toBe(false);
    });

    it('TelemetryConsentManager fails closed without salt and refuses unconsented queries', async () => {
      expect(() => new TelemetryConsentManager('')).toThrow(/non-empty per-deployment salt/);
      expect(() => new TelemetryConsentManager(null as unknown as string)).toThrow(
        /non-empty per-deployment salt/
      );

      const manager = new TelemetryConsentManager(TEST_SALT);
      expect(await manager.isPermitted('investigator-1', 'telemetry')).toBe(false);
      expect(await manager.isPermitted('investigator-1', 'biometric')).toBe(false);
      expect(manager.activeConsentCount).toBe(0);
    });
  });

  describe('2. Explicit opt-in and scoped capture', () => {
    it('TelemetryCollector admits observations once consented via localStorage or API', () => {
      const collector = new TelemetryCollector();
      collector.saveConsent(true);
      expect(collector.enabled).toBe(true);

      const stored = localStorage.getItem('nemosyne-telemetry-consent');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual({ enabled: true });

      collector.recordFrame(16);
      collector.recordFrame(33); // dropped (> 16.67ms)
      collector.recordDataset('Moneta-Topology', 'EMBEDDING');
      collector.recordOperation('project-umap');
      collector.recordGesture('palmOpen');
      collector.recordError(new Error('consented issue'), false);

      const report = collector.getReport();
      expect(report.enabled).toBe(true);
      expect(report.frames.count).toBe(2);
      expect(report.frames.dropped).toBe(1);
      expect(report.session.datasetName).toBe('Moneta-Topology');
      expect(report.session.datasetTopology).toBe('EMBEDDING');
      expect(report.operations['project-umap']).toBe(1);
      expect(report.gestures['palmOpen']).toBe(1);
      expect(report.errors.count).toBe(1);
      expect(report.errors.last?.message).toBe('consented issue');
    });

    it('UXTraceRecorder records lifecycle and events when consented', () => {
      const { recorder, emit, exportEnvelope } = createTraceHarness({ enabled: false });
      recorder.setEnabled(true);
      expect(recorder.enabled).toBe(true);

      emit('gesture:recognized', { name: 'point', ctx: { confidence: 0.99 } });
      emit('interaction', { action: 'hover', target: 'panel-settings' });

      const envelope = exportEnvelope();
      expect(envelope.recordCount).toBeGreaterThan(0);
      expect(envelope.records.some((r) => r.type === 'trace-lifecycle' && r.event === 'consent-enabled')).toBe(true);
      expect(envelope.records.some((r) => r.type === 'gesture')).toBe(true);
      expect(envelope.records.some((r) => r.type === 'interaction')).toBe(true);
    });

    it('TelemetryConsentManager enforces scopes without retaining raw identifiers', async () => {
      const manager = new TelemetryConsentManager(TEST_SALT);
      const rawId = 'researcher_42@lab.internal';

      const record = await manager.grantConsent(rawId, ['telemetry']);
      expect(record.status).toBe('granted');
      expect(record.scopes).toEqual(['telemetry']);
      expect(record.pseudonymToken).toMatch(/^subj_[0-9a-f]{64}$/);

      // Verify raw identifier is nowhere in the record or its serialized JSON
      expect(record).not.toHaveProperty('rawSubjectId');
      expect(record).not.toHaveProperty('subjectId');
      expect(JSON.stringify(record)).not.toContain(rawId);

      // Scoped permissions check
      expect(await manager.isPermitted(rawId, 'telemetry')).toBe(true);
      expect(await manager.isPermitted(rawId, 'biometric')).toBe(false);
      expect(await manager.isPermitted(rawId, 'interaction_replay')).toBe(false);
    });
  });

  describe('3. Revocation immediate halt across all live producers', () => {
    it('TelemetryCollector immediately ceases recording on saveConsent(false) or setEnabled(false)', () => {
      const collector = new TelemetryCollector();
      collector.saveConsent(true);
      collector.recordOperation('op-pre-revoke');
      collector.recordFrame(12);

      const preReport = collector.getReport();
      expect(preReport.operations['op-pre-revoke']).toBe(1);
      expect(preReport.frames.count).toBe(1);

      // Revoke consent
      collector.saveConsent(false);
      expect(collector.enabled).toBe(false);
      expect(JSON.parse(localStorage.getItem('nemosyne-telemetry-consent')!)).toEqual({ enabled: false });

      // Attempt post-revocation recording
      collector.recordOperation('op-post-revoke');
      collector.recordFrame(16);
      collector.recordGesture('swipe');
      collector.recordError(new Error('post-revoke err'));

      const postReport = collector.getReport();
      expect(postReport.operations['op-post-revoke']).toBeUndefined();
      expect(postReport.operations['op-pre-revoke']).toBe(1);
      expect(postReport.frames.count).toBe(1);
      expect(postReport.gestures['swipe']).toBeUndefined();
      expect(postReport.errors.count).toBe(0);
    });

    it('UXTraceRecorder emits lifecycle boundary and halts recording on setEnabled(false)', () => {
      const { recorder, emit, exportEnvelope } = createTraceHarness({ enabled: true });
      emit('gesture:recognized', { name: 'tap' });

      const midEnvelope = exportEnvelope();
      const countBeforeRevocation = midEnvelope.recordCount;

      recorder.setEnabled(false);
      expect(recorder.enabled).toBe(false);

      emit('gesture:recognized', { name: 'tap-after-revocation' });
      emit('interaction', { action: 'click-after-revocation' });

      const finalEnvelope = exportEnvelope();
      // Should only contain the previous records plus consent-disabled and trace-end lifecycle markers
      expect(finalEnvelope.recordCount).toBe(countBeforeRevocation + 2);
      expect(finalEnvelope.records.slice(-2)).toEqual([
        expect.objectContaining({ type: 'trace-lifecycle', event: 'consent-disabled' }),
        expect.objectContaining({ type: 'trace-lifecycle', event: 'trace-end' }),
      ]);
      expect(
        finalEnvelope.records.some((r) => (r as Record<string, unknown>).name === 'tap-after-revocation')
      ).toBe(false);
    });

    it('TelemetryConsentManager revokes permissions immediately', async () => {
      const manager = new TelemetryConsentManager(TEST_SALT);
      const subject = 'participant-77';
      await manager.grantConsent(subject, ['telemetry', 'biometric']);
      expect(await manager.isPermitted(subject, 'telemetry')).toBe(true);

      await manager.revokeConsent(subject);
      expect(await manager.isPermitted(subject, 'telemetry')).toBe(false);
      expect(await manager.isPermitted(subject, 'biometric')).toBe(false);
    });
  });

  describe('4. Complete client-side erasure across stores and buffers', () => {
    it('TelemetryCollector.erase() purges all metrics, frustration trails, and stored consent', () => {
      const collector = new TelemetryCollector();
      collector.saveConsent(true);
      collector.recordDataset('SensitiveDataset', 'FINANCIAL');
      collector.recordOperation('high-risk-query');
      collector.recordFrame(50);
      collector.recordGesture('secretSign');
      collector.recordError(new Error('internal fault'));

      // Verify populated prior to erasure
      expect(collector.getReport().session.datasetName).toBe('SensitiveDataset');
      expect(collector.getReport().frames.count).toBe(1);
      expect(localStorage.getItem('nemosyne-telemetry-consent')).not.toBeNull();

      // Execute complete erasure
      collector.erase();

      expect(collector.enabled).toBe(false);
      expect(localStorage.getItem('nemosyne-telemetry-consent')).toBeNull();

      const wipedReport = collector.getReport();
      expect(wipedReport.enabled).toBe(false);
      expect(wipedReport.session.datasetName).toBe('-');
      expect(wipedReport.session.datasetTopology).toBe('-');
      expect(wipedReport.frames.count).toBe(0);
      expect(wipedReport.frames.dropped).toBe(0);
      expect(wipedReport.frames.averageMs).toBe(0);
      expect(wipedReport.frames.histogram).toEqual({
        under16: 0,
        under33: 0,
        under50: 0,
        under100: 0,
        over100: 0,
      });
      expect(wipedReport.operations).toEqual({});
      expect(wipedReport.gestures).toEqual({});
      expect(wipedReport.errors.count).toBe(0);
      expect(wipedReport.errors.warnings).toBe(0);
      expect(wipedReport.errors.last).toBeNull();
      expect(collector.getCompactUXDigest().compactTrail).toBe('');
      expect(collector.getCompactUXDigest().dissatisfactionScore).toBe(0);
      expect(collector.getCompactUXDigest().detectedPatterns).toHaveLength(0);
      expect(collector.formatCompactUXReport()).toContain('None (Smooth UX)');

      // Subsequent loadConsent fails closed
      const freshCollector = new TelemetryCollector();
      expect(freshCollector.loadConsent()).toBe(false);
      expect(freshCollector.enabled).toBe(false);
    });

    it('UXTraceRecorder.erase() completely purges buffer, counters, and export envelope', () => {
      const { recorder, emit, exportEnvelope } = createTraceHarness({ enabled: true });
      emit('gesture:recognized', { name: 'wave' });
      emit('interaction', { action: 'move', target: 'window-1' });

      expect(exportEnvelope().recordCount).toBeGreaterThan(0);

      recorder.erase();

      expect(recorder.enabled).toBe(false);
      const erased = exportEnvelope();
      expect(erased.recordCount).toBe(0);
      expect(erased.droppedCount).toBe(0);
      expect(erased.firstSeq).toBeNull();
      expect(erased.lastSeq).toBeNull();
      expect(erased.traceOpen).toBe(false);
      expect(erased.records).toEqual([]);

      const parsed = parseUXTraceText(recorder.exportJson(), { source: 'erased-trace.json' });
      expect(parsed.records).toHaveLength(0);
      expect(parsed.integrityVerified).toBe(true);
      expect(parsed.format).toBe('envelope-v2');
    });

    it('TelemetryConsentManager.deleteConsentRecord() purges participant mapping', async () => {
      const manager = new TelemetryConsentManager(TEST_SALT);
      const subject = 'user-to-scrub';
      await manager.grantConsent(subject);
      expect(manager.activeConsentCount).toBe(1);

      // deleteConsentRecord and executeRightToErasure both permanently wipe the entry
      const deleted = await manager.deleteConsentRecord(subject);
      expect(deleted).toBe(true);
      expect(manager.activeConsentCount).toBe(0);
      expect(await manager.isPermitted(subject)).toBe(false);

      // Subsequent deletion of absent record returns false
      expect(await manager.deleteConsentRecord(subject)).toBe(false);
      expect(await manager.executeRightToErasure(subject)).toBe(false);
    });
  });
});
