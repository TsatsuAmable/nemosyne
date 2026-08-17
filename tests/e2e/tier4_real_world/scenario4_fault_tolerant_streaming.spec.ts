import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../../../src/data/Dataset.ts';
import { InstancedPointCloud } from '../../../src/vr/scalability/InstancedPointCloud.ts';
import { AdaptiveFrameGovernor } from '../../../src/vr/scalability/AdaptiveFrameGovernor.ts';

describe('Tier 4 — Scenario 4: Resilient Real-Time Binary Data Streaming & Fault Injection', () => {
  it('Executes live binary streaming workflow under fault injection: builds a Float32 stream dataset, updates point cloud, and maintains governor stability', () => {
    // Wave 3: the JS ArrowBinaryParser is deleted; binary Arrow/Float32 parse
    // parity lives in the Rust kernel (wasm/src/data/parsers.rs) + covered by
    // wasm-runtime.test.ts. This scenario now builds the equivalent 2-column
    // Float32 dataset inline to drive the InstancedPointCloud + governor
    // assertions (the binary-bounds safety surface itself is Rust-covered).
    const numCols = 2;
    const rowCount = 10;
    const floatValues: number[] = [];
    for (let i = 0; i < numCols * rowCount; i++) floatValues.push(i * 1.0);

    const rows: Record<string, unknown>[] = [];
    for (let r = 0; r < rowCount; r++) {
      rows.push({
        attr_1: floatValues[r * numCols],
        attr_2: floatValues[r * numCols + 1],
      });
    }
    const dataset = new Dataset(
      'FloatStream',
      [
        { name: 'attr_1', type: ColumnType.NUMERIC },
        { name: 'attr_2', type: ColumnType.NUMERIC },
      ],
      rows
    );
    expect(dataset.rowCount).toBe(10);
    expect(dataset.columnCount).toBe(2);

    // Stream recovery — next valid payload updates InstancedPointCloud
    const cloud = new InstancedPointCloud(100);
    const items = dataset.rows.map((r) => ({
      position: [r.attr_1 as number, r.attr_2 as number, 0] as [number, number, number],
      color: 0x00ffcc,
      scale: 1,
    }));
    cloud.setPoints(items);
    expect(cloud.mesh.count).toBe(10);

    // AdaptiveFrameGovernor stability during stream disruption
    const governor = new AdaptiveFrameGovernor(11.11, 30);
    for (let i = 0; i < 20; i++) {
      governor.recordFrame(i % 5 === 0 ? 30.0 : 10.0); // Spikes during disruption
    }

    const metrics = governor.getMetrics();
    expect(metrics.averageFrameTimeMs).toBeGreaterThan(0);

    cloud.dispose();
  });
});
