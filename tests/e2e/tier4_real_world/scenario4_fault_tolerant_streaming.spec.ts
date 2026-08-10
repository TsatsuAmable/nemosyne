import { describe, it, expect } from 'vitest';
import { ArrowBinaryParser } from '../../../src/data/ArrowBinaryParser.ts';
import { InstancedPointCloud } from '../../../src/vr/scalability/InstancedPointCloud.ts';
import { AdaptiveFrameGovernor } from '../../../src/vr/scalability/AdaptiveFrameGovernor.ts';

describe('Tier 4 — Scenario 4: Resilient Real-Time Binary Data Streaming & Fault Injection', () => {
  it('Executes live binary streaming workflow under fault injection: parses binary stream, handles corrupt payloads, updates point cloud, and maintains governor stability', () => {
    // Step 1: Valid binary Float32 stream creation (2 columns: attr_1, attr_2; 10 rows)
    const validBuffer = new ArrayBuffer(8 + 2 * 10 * 4);
    const view = new DataView(validBuffer);
    view.setUint32(0, 2, true); // numCols
    view.setUint32(4, 10, true); // rowCount

    const floatView = new Float32Array(validBuffer, 8, 20);
    for (let i = 0; i < 20; i++) floatView[i] = i * 1.0;

    const dataset = ArrowBinaryParser.parseBinaryFloatStream(validBuffer);
    expect(dataset.rowCount).toBe(10);
    expect(dataset.columnCount).toBe(2);

    // Step 2: Fault Injection — truncated binary payload
    const corruptBuffer = new ArrayBuffer(4); // < 8 bytes
    const corruptDataset = ArrowBinaryParser.parseBinaryFloatStream(corruptBuffer);
    expect(corruptDataset.rowCount).toBe(0); // Safely returns empty dataset without crashing

    // Step 3: Stream recovery — next valid payload updates InstancedPointCloud
    const cloud = new InstancedPointCloud(100);
    const items = dataset.rows.map((r, idx) => ({
      position: [r.attr_1 as number, r.attr_2 as number, 0] as [number, number, number],
      color: 0x00ffcc,
      scale: 1,
    }));
    cloud.setPoints(items);
    expect(cloud.mesh.count).toBe(10);

    // Step 4: AdaptiveFrameGovernor stability during stream disruption
    const governor = new AdaptiveFrameGovernor(11.11, 30);
    for (let i = 0; i < 20; i++) {
      governor.recordFrame(i % 5 === 0 ? 30.0 : 10.0); // Spikes during disruption
    }

    const metrics = governor.getMetrics();
    expect(metrics.averageFrameTimeMs).toBeGreaterThan(0);

    cloud.dispose();
  });
});
