// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Dataset } from '../../../src/data/Dataset.ts';
import { ConstraintEngine } from '../../../src/moneta/ConstraintEngine.ts';
import { VRTopologyTranslator } from '../../../src/moneta/VRTopologyTranslator.ts';
import { AtlasCore } from '../../../src/atlas/AtlasCore.ts';
import { DataOperationController } from '../../../src/vr/coordinators/DataOperationController.ts';
import { WorldEventBus, WorldTopics } from '../../../src/utils/EventBus.ts';
import { IntentCompiler } from '../../../src/atlas/intent/IntentCompiler.ts';
import { StructureExplainer } from '../../../src/atlas/intent/StructureExplainer.ts';
import { NemosyneSession } from '../../../src/session/NemosyneSession.ts';
import { HandWheelMenu } from '../../../src/vr/ui/HandWheelMenu.ts';
import { MovablePanel } from '../../../src/vr/ui/MovablePanel.ts';
import { makeFactProvider } from '../../helpers/dracoFactsHelper.ts';
import { makeKernelMockBridge } from '../../helpers/kernelMock.ts';

describe('Tier 4 — Scenario 5: Complete End-to-End Analyst Journey across Three-Layer Architecture', () => {
  it('executes full journey: dataset ingestion -> Draco solve -> VR synthesis -> gesture analysis -> Atlas provenance -> session restore', async () => {
    // -------------------------------------------------------------------------
    // Phase 1: Ingest Multi-Dimensional Raw Dataset via Analytical Kernel
    // -------------------------------------------------------------------------
    const csvData = [
      'transaction_id,amount,risk_score,timestamp,merchant_category',
      ...Array.from({ length: 40 }, (_, i) =>
        `tx_${i},${(10 + i * 4.5).toFixed(2)},${(i % 7 === 0 ? 0.95 : 0.25).toFixed(2)},2026-08-18T00:${String(i).padStart(2, '0')}:00Z,retail`
      ),
    ].join('\n');

    const kernel = makeKernelMockBridge();
    const parsedJson = kernel.parseDatasetBytes(new TextEncoder().encode(csvData), 'csv');
    expect(parsedJson).toBeTruthy();

    const dataset = Dataset.fromJSON(parsedJson!);
    dataset.name = 'RealTimeTransactions';
    expect(dataset.rowCount).toBe(40);
    expect(dataset.numericColumns.length).toBeGreaterThanOrEqual(2);

    // -------------------------------------------------------------------------
    // Phase 2: Draco Constraint Solving & 3D Spatial Artefact Synthesis
    // -------------------------------------------------------------------------
    const factProvider = makeFactProvider();
    const engine = new ConstraintEngine({ factProvider });
    const solverResult = engine.solve({ dataset });

    expect(solverResult.spec).toBeDefined();
    expect(solverResult.spec.layout).toBeDefined();

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, { dataset });
    expect(artifact.nodeMeshes.length).toBe(40);
    expect(artifact.group).toBeInstanceOf(THREE.Group);

    // -------------------------------------------------------------------------
    // Phase 3: Spatial UI Composition (HUD & HandWheelMenu)
    // -------------------------------------------------------------------------
    const bus = new WorldEventBus();
    const scene = new THREE.Scene();
    scene.add(artifact.group);

    const cameraGroup = new THREE.Group();
    scene.add(cameraGroup);
    const mockHand = { group: new THREE.Group(), handedness: 'left' } as any;
    const mockEngine = { scene, cameraGroup, input: { feedback: null } } as any;

    const wheelMenu = new HandWheelMenu(mockEngine, mockHand);
    expect(wheelMenu).toBeDefined();

    const telemetryPanel = new MovablePanel(cameraGroup, {
      title: 'Metrics HUD',
      width: 400,
      height: 300,
    });
    scene.add(telemetryPanel.mesh);
    expect(telemetryPanel.mesh).toBeInstanceOf(THREE.Mesh);

    // -------------------------------------------------------------------------
    // Phase 4: Analytical Authority & Dual-Hand Gesture Transformations
    // -------------------------------------------------------------------------
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.loadDataset(dataset);

    const doc = new DataOperationController({
      eventBus: bus,
      getArtifact: () => artifact,
      atlas,
    });
    doc.setOriginalDataset(dataset);

    const opSpy = vi.fn();
    bus.on(WorldTopics.OPERATION_APPLIED, opSpy);

    // Apply Filter Operation
    doc.apply('filter');
    expect(opSpy).toHaveBeenCalledTimes(1);
    expect(doc.analysisHistory.length).toBe(1);

    // Apply Anomaly Detection Operation
    doc.apply('anomaly');
    expect(opSpy).toHaveBeenCalledTimes(2);
    expect(doc.analysisHistory.length).toBe(2);

    // Verify Atlas provenance ledger updated deterministically
    const atlasState = atlas.toState();
    expect(atlasState.analysisResults.length).toBe(2);
    expect(atlasState.eventLedger.length).toBeGreaterThanOrEqual(2);
    expect(atlasState.datasetFingerprint).toBeTruthy();
    expect(atlasState.datasetVersion).toBeGreaterThan(1);

    // -------------------------------------------------------------------------
    // Phase 5: Intent Compilation & Natural Explanation
    // -------------------------------------------------------------------------
    const compiler = new IntentCompiler();
    const compiled = compiler.compile('filter where risk_score > 0.8', dataset.toJSON());
    expect(compiled.kind).toBe('filter');
    expect(compiled.confidence).toBeGreaterThan(0.5);

    const explainer = new StructureExplainer();
    const explanation = explainer.explainAnalysisResult(atlasState.analysisResults[0]);
    expect(explanation.title).toBeTruthy();
    expect(explanation.summary).toBeTruthy();
    expect(explanation.keyFindings.length).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // Phase 6: Deterministic Session Serialization & Standalone Restore
    // -------------------------------------------------------------------------
    const session = new NemosyneSession({ atlas });
    session.setPresentation({ theme: 'darkVoid' });
    const sessionJson = session.serialize();

    expect(sessionJson).toBeTruthy();
    expect(sessionJson.schemaVersion).toBe(2);
    expect(sessionJson.datasetFingerprint).toBe(atlasState.datasetFingerprint);
    expect(sessionJson.presentation.theme).toBe('darkVoid');

    // Hydrate fresh AtlasCore & verify complete analytical fidelity
    const freshAtlas = new AtlasCore({ kernel: kernel as any });
    const restoredSession = NemosyneSession.deserialize(sessionJson, freshAtlas);
    expect(restoredSession.presentation.theme).toBe('darkVoid');

    const restoredState = freshAtlas.toState();
    expect(restoredState.datasetFingerprint).toBe(atlasState.datasetFingerprint);
    expect(restoredState.datasetVersion).toBe(atlasState.datasetVersion);
    expect(restoredState.analysisResults.length).toBe(2);
    expect(restoredState.eventLedger.length).toBe(atlasState.eventLedger.length);

    // Cleanup resources
    telemetryPanel.dispose();
    wheelMenu.dispose();
  });
});
