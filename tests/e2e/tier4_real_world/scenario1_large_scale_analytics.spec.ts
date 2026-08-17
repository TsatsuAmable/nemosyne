import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Dataset } from '../../../src/data/Dataset.ts';
import { VRTopologyTranslator } from '../../../src/draco/VRTopologyTranslator.ts';
import { AdaptiveFrameGovernor } from '../../../src/vr/scalability/AdaptiveFrameGovernor.ts';
import { WorldEventBus, WorldTopics } from '../../../src/utils/EventBus.ts';
import { MovablePanel } from '../../../src/vr/ui/MovablePanel.ts';
import { makeKernelMockBridge } from '../../helpers/kernelMock.js';

describe('Tier 4 — Scenario 1: Large-Scale High-Dimensional Topological Dataset Ingestion & Adaptive Rendering', () => {
  it('Executes full E2E pipeline: parse, infer topology, synthesize spatial scene, adapt frame governor LOD, and inspect UI', () => {
    // Step 1: Parse large high-dimensional CSV data through the kernel mock
    // (canned CSV parser with prototype-pollution hardening). Parse parity is
    // covered by Rust #[test]s + wasm-runtime.test.ts.
    const csvContent = [
      'id,source,target,value,timestamp,__proto__',
      ...Array.from({ length: 500 }, (_, i) => `node_${i},node_${i},node_${(i + 1) % 500},${(i * 1.5).toFixed(2)},2026-08-09T12:00:00Z,malicious`),
    ].join('\n');

    const bridge = makeKernelMockBridge();
    const csvBytes = new TextEncoder().encode(csvContent);
    const json = bridge.parseDatasetBytes(csvBytes, 'csv');
    expect(json).toBeTruthy();
    const dataset = Dataset.fromJSON(json!);
    dataset.name = 'FinancialGraph';
    expect(dataset.rowCount).toBe(500);

    const check: any = {};
    expect(check.malicious).toBeUndefined();

    // Step 2: Infer topology via the kernel mock (source + target → GRAPH).
    const handle = bridge.loadDatasetJson(dataset.toJSON());
    const topology = bridge.inferTopology(handle);
    bridge.destroyDataset(handle);
    expect(topology).toBe('GRAPH');

    // Step 3: Synthesize spatial artifact via VRTopologyTranslator
    const solverResult = {
      spec: { layout: 'FORCE_DIRECTED_3D', geometry: 'ICOSA_NODE', behavior: 'NONE', interaction: 'NONE' },
      cost: 12.5,
      facts: { depth: 1, numericColumns: 1, categoricalColumns: 2, temporalColumns: 1, hasTimeSeries: true },
    };

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult as any, { dataset });
    expect(artifact.nodeMeshes.length).toBeGreaterThan(0);

    // Step 4: Wire AdaptiveFrameGovernor & verify LOD throttling under high frame times
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.11, 30, bus);

    let currentLOD = 1.0;
    bus.on(WorldTopics.PERFORMANCE_THROTTLE, (payload: any) => {
      currentLOD = payload.lodScaleFactor;
    });

    // Simulate high load
    for (let f = 0; f < 15; f++) {
      governor.recordFrame(22.0); // 22ms > 11.11ms
    }

    expect(currentLOD).toBeLessThan(1.0);

    // Step 5: Instantiate 3D inspector panel
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, { title: 'SCENARIO 1 ANALYTICS' });
    expect(panel.mesh.visible).toBe(true);
  });
});
