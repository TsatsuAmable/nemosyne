// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { UXFrustrationAnalyzer } from '../src/utils/UXFrustrationAnalyzer.ts';
import { TelemetryCollector } from '../src/utils/Telemetry.ts';

describe('On-Device UX Frustration & Dissatisfaction Analyzer Subsystem', () => {
  it('detects repeated rapid action clicking friction patterns', () => {
    const analyzer = new UXFrustrationAnalyzer();

    // User rapidly clicks menu toggle 4 times in 2 seconds due to dissatisfaction
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');

    const patterns = analyzer.analyzeFriction();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].type).toBe('REPEATED_ACTION');
    expect(patterns[0].count).toBe(4);
    expect(analyzer.getDissatisfactionScore()).toBeGreaterThan(0.2);
  });

  it('detects rapid window thrashing and abandonment (<1.2s)', () => {
    const analyzer = new UXFrustrationAnalyzer();

    analyzer.recordUserAction('panel:show', 'VR MENU');
    analyzer.recordUserAction('panel:hide', 'VR MENU');

    const patterns = analyzer.analyzeFriction();
    expect(patterns.some((p) => p.type === 'RAPID_ABANDONMENT')).toBe(true);
  });

  it('generates a condensed token-efficient report block (< 10 lines)', () => {
    const collector = new TelemetryCollector({ enabled: true });

    collector.recordMenuAction('toggle');
    collector.recordMenuAction('toggle');
    collector.recordMenuAction('toggle');
    collector.recordMiss('data-node');
    collector.recordError(new Error('WASM load error'));

    const report = collector.formatCompactUXReport();
    expect(report).toContain('COMPACT UX DISSATISFACTION REPORT');
    expect(report).toContain('Compact Trail:');
    expect(report).toContain('Suggested Remedies:');
    expect(report.split('\n').length).toBeLessThan(14);
  });
});
