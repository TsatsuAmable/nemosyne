// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TelemetryCollector } from '../src/utils/Telemetry.ts';

describe('TelemetryCollector', () => {
  let telemetry: TelemetryCollector;

  beforeEach(() => {
    telemetry = new TelemetryCollector();
    localStorage.clear();
  });

  afterEach(() => {
    telemetry.setEnabled(false);
    localStorage.clear();
  });

  it('defaults to disabled', () => {
    expect(telemetry.enabled).toBe(false);
  });

  it('records nothing when disabled', () => {
    telemetry.recordFrame(20);
    telemetry.recordOperation('filter');
    telemetry.recordGesture('pinchTogether');
    telemetry.recordDataset('Sales', 'TABULAR');

    const report = telemetry.getReport();
    expect(report.frames.count).toBe(0);
    expect(report.operations.filter).toBeUndefined();
    expect(report.gestures.pinchTogether).toBeUndefined();
    expect(report.session.datasetName).toBe('-');
  });

  it('records frame timing and dropped frames when enabled', () => {
    telemetry.setEnabled(true);

    telemetry.recordFrame(10); // 10 ms
    telemetry.recordFrame(20); // 20 ms
    telemetry.recordFrame(40); // 40 ms

    const report = telemetry.getReport();
    expect(report.frames.count).toBe(3);
    expect(report.frames.dropped).toBe(2); // 20 and 40 ms miss 16.67 budget
    expect(report.frames.averageMs).toBeCloseTo(70 / 3, 1);
    expect(report.frames.histogram.under16).toBe(1);
    expect(report.frames.histogram.under33).toBe(1);
    expect(report.frames.histogram.under50).toBe(1);
  });

  it('records operations, gestures, and dataset', () => {
    telemetry.setEnabled(true);

    telemetry.recordDataset('Supply Chain', 'HIERARCHY');
    telemetry.recordOperation('filter');
    telemetry.recordOperation('filter');
    telemetry.recordOperation('sort');
    telemetry.recordGesture('pinchTogether');
    telemetry.recordGesture('pinchApart');
    telemetry.recordGesture('pinchTogether');

    const report = telemetry.getReport();
    expect(report.session.datasetName).toBe('Supply Chain');
    expect(report.session.datasetTopology).toBe('HIERARCHY');
    expect(report.operations).toEqual({ filter: 2, sort: 1 });
    expect(report.gestures).toEqual({ pinchTogether: 2, pinchApart: 1 });
  });

  it('records errors and warnings separately', () => {
    telemetry.setEnabled(true);

    telemetry.recordError(new Error('boom'));
    telemetry.recordError('warn message', true);
    telemetry.recordError(new Error('second boom'));

    const report = telemetry.getReport();
    expect(report.errors.count).toBe(2);
    expect(report.errors.warnings).toBe(1);
    expect(report.errors.last!.message).toBe('second boom');
    expect(report.errors.last!.isWarning).toBe(false);
  });

  it('resets counters but keeps consent', () => {
    telemetry.setEnabled(true);
    telemetry.recordOperation('filter');
    telemetry.recordError(new Error('oops'));

    telemetry.reset();

    const report = telemetry.getReport();
    expect(report.operations).toEqual({});
    expect(report.errors.count).toBe(0);
    expect(telemetry.enabled).toBe(true);
  });

  it('loads and saves consent via localStorage', () => {
    telemetry.saveConsent(true);

    const next = new TelemetryCollector();
    next.loadConsent();
    expect(next.enabled).toBe(true);

    next.saveConsent(false);
    const disabled = new TelemetryCollector();
    disabled.loadConsent();
    expect(disabled.enabled).toBe(false);
  });

  it('captures global errors and unhandled rejections when enabled', () => {
    telemetry.setEnabled(true);

    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('global err'), message: 'global err' })
    );
    const dummyPromise = Promise.reject(new Error('rejected'));
    dummyPromise.catch(() => {}); // suppress Node unhandled rejection
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: dummyPromise,
        reason: new Error('rejected'),
      })
    );

    const report = telemetry.getReport();
    expect(report.errors.count).toBeGreaterThanOrEqual(2);
    expect(report.errors.unhandledRejections).toBeGreaterThanOrEqual(1);
  });
});
