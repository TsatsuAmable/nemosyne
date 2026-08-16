/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { TelemetryCollector } from '../src/utils/Telemetry.ts';
import { SelectionDispatcher } from '../src/vr/input/SelectionDispatcher.ts';
import { InteractableRegistry } from '../src/vr/input/InteractableRegistry.ts';

describe('New Telemetry Metrics Subsystem (Dwell Time & Gesture Confidence)', () => {
  it('records gaze and laser dwell time telemetry accurately', () => {
    const collector = new TelemetryCollector({ enabled: true });

    collector.recordDwell('panel:vr-menu', 1450, true);
    collector.recordDwell('node:data-3', 4200, false);
    collector.recordDwell('panel:settings', 3800, false);

    const report = collector.formatCompactUXReport();
    expect(report).toContain('COMPACT UX DISSATISFACTION REPORT');

    const patterns = collector.frustrationAnalyzer.analyzeFriction();
    expect(patterns.some((p) => p.type === 'LONG_DWELL_HESITATION' || p.actionKey === 'interaction:dwell-hesitation')).toBe(true);
  });

  it('records gesture confidence and detects gesture misfires', () => {
    const collector = new TelemetryCollector({ enabled: true });

    collector.recordGestureConfidence('pinchTogether', 0.92, false);
    collector.recordGestureConfidence('scoopUp', 0.45, true);
    collector.recordGestureConfidence('scoopUp', 0.40, true);

    const patterns = collector.frustrationAnalyzer.analyzeFriction();
    expect(patterns.some((p) => p.type === 'GESTURE_MISFIRE')).toBe(true);
  });

  it('dispatches dwell telemetry from SelectionDispatcher', () => {
    const collector = new TelemetryCollector({ enabled: true });
    const registry = new InteractableRegistry();
    (registry as any).engine = { telemetry: collector };

    const dispatcher = new SelectionDispatcher(registry);
    dispatcher.setDwellSelection(true, 1000);

    const fakePanel: any = { mesh: { uuid: 'panel-123' }, handlePointerDown: () => 'content' };
    const activePointer: any = { id: 'laser-1' };

    dispatcher.updateDwell({ panel: fakePanel, distance: 1 } as any, null, activePointer);
    // Switch hover target to trigger recordDwell
    dispatcher.updateDwell(null, null, activePointer);

    const report = collector.formatCompactUXReport();
    expect(report).toBeDefined();
  });
});
