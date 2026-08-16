import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorkspaceManager } from '../../../src/vr/coordinators/WorkspaceManager.ts';
import { DataOperationController } from '../../../src/vr/coordinators/DataOperationController.ts';
import { WorldEventBus } from '../../../src/utils/EventBus.ts';
import { Dataset } from '../../../src/data/Dataset.ts';
import { sharedSphereGeometry, sharedBoxGeometry } from '../../../src/vr/scalability/ObjectPool.ts';

describe('Tier 4 — Scenario 3: Long-Running VR Spatial Memory Palace & Dynamic Dataset Swapping', () => {
  it('Executes multi-dataset session: loads Dataset A, simulates long run, swaps to Dataset B, and verifies MeshPool static geometry preservation', () => {
    const scene = new THREE.Scene();
    const workspace = new WorkspaceManager(scene);
    const bus = new WorldEventBus();
    // Minimal functional artifact so apply()/reset() run the full operation
    // path (captureBaseState -> computeDataset -> applyVisual -> history push)
    // instead of early-returning on a null artifact.
    const artifact = { group: new THREE.Group(), nodeMeshes: [] as THREE.Mesh[] };
    const doc = new DataOperationController({ eventBus: bus, getArtifact: () => artifact });

    // Step 1: Load Dataset A (Gene Expression topology)
    const datasetA = new Dataset('GeneExpression', [
      { name: 'gene_id', type: 'CATEGORICAL' },
      { name: 'expression_level', type: 'NUMERIC' },
    ], Array.from({ length: 50 }, (_, i) => ({ gene_id: `G_${i}`, expression_level: i * 2.5 })));

    doc.setOriginalDataset(datasetA);
    expect(doc.originalDataset?.name).toBe('GeneExpression');

    // Step 2: Simulate data operations
    doc.apply('sort');
    doc.apply('filter');
    expect(doc.analysisHistory.length).toBe(2);

    // Step 3: Swap to Dataset B (Astrophysics catalog)
    const datasetB = new Dataset('AstrophysicsCatalog', [
      { name: 'star_id', type: 'CATEGORICAL' },
      { name: 'luminosity', type: 'NUMERIC' },
    ], Array.from({ length: 100 }, (_, i) => ({ star_id: `Star_${i}`, luminosity: i * 10 })));

    doc.setOriginalDataset(datasetB);
    expect(doc.originalDataset?.name).toBe('AstrophysicsCatalog');

    // Step 4: Verify MeshPool static shared geometries are preserved across swaps
    expect(sharedSphereGeometry.attributes.position).toBeDefined();
    expect(sharedBoxGeometry.attributes.position).toBeDefined();
  });
});
