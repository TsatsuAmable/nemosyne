// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { HolographicInspector } from '../src/vr/artifacts/HolographicInspector.ts';
import { PanelBudgetController } from '../src/vr/ui-system/PanelBudgetController.ts';

function makeEngine() {
  const cameraGroup = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  cameraGroup.add(camera);
  const scene = new THREE.Scene();
  scene.add(cameraGroup);
  return {
    camera,
    cameraGroup,
    scene,
    input: { feedback: { playTone: vi.fn(), showHitMarker: vi.fn(), volume: 0.15 } },
  };
}

describe('HolographicInspector', () => {
  it('is hidden by default', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    expect(inspector.visible).toBe(false);
    expect(inspector.active).toBe(false);
  });

  it('showAtNode makes it visible and sets up text', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.position.set(1, 2, -3);
    node.userData.row = { id: 42, category: 'A', value: 99.5 };
    
    inspector.showAtNode(node, node.userData.row, null, 'NODE TITLE');

    expect(inspector.visible).toBe(true);
    expect(inspector.active).toBe(true);
    expect(inspector.title).toBe('NODE TITLE');
    expect(inspector.data).toEqual({ id: 42, category: 'A', value: 99.5 });
  });

  it('hide dismisses the inspector', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };
    
    inspector.showAtNode(node, node.userData.row, null, 'NODE');
    inspector.hide();
    
    expect(inspector.visible).toBe(false);
    expect(inspector.active).toBe(false);
  });

  it('setTab correctly renders tab content', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    inspector.data = { someValue: 123 };
    
    inspector.setTab('Values');
    expect(inspector._activeTab).toBe('Values');
    
    inspector.setTab('Evidence');
    expect(inspector._activeTab).toBe('Evidence');
    
    inspector.setTab('Provenance');
    expect(inspector._activeTab).toBe('Provenance');
  });

  it('faces the camera on update', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };

    inspector.showAtNode(node, node.userData.row, null, 'NODE');

    // Move camera to check if it looks at it
    engine.camera.position.set(0, 10, 10);
    engine.camera.updateMatrixWorld();

    inspector.update(0.016);

    // Verify it changed rotation
    expect(inspector.rotation.x).not.toBe(0);
  });

  it('registers with the workspace budget controller on show and untracks on hide', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const budget = new PanelBudgetController();
    inspector.budgetController = budget;
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };

    inspector.showAtNode(node, node.userData.row, null, 'NODE');

    expect(budget.isOpen(inspector)).toBe(true);
    expect(budget.getRole(inspector)).toBe('inspector');
    expect(budget.activeBudgetCount).toBe(1);

    inspector.hide();

    expect(budget.isOpen(inspector)).toBe(false);
    expect(budget.activeBudgetCount).toBe(0);
  });

  it('dismisses a previous inspector-replacement occupant through the budget controller', () => {
    const engine = makeEngine();
    const budget = new PanelBudgetController();
    const first = new HolographicInspector(engine);
    first.budgetController = budget;
    const second = new HolographicInspector(engine);
    second.budgetController = budget;
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };

    first.showAtNode(node, node.userData.row, null, 'NODE');
    // A second inspector opening in the same role replaces the first.
    second.showAtNode(node, node.userData.row, null, 'NODE');

    expect(budget.getRole(second)).toBe('inspector');
    expect(budget.isOpen(first)).toBe(false);
    expect(first.visible).toBe(false);
    expect(second.visible).toBe(true);
    expect(budget.activeBudgetCount).toBe(1);
  });

  it('renders ledger-derived session provenance (not a placeholder) when a provider is wired', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    inspector.provenanceProvider = {
      getProvenance: () => [
        { id: 'e1', operation: 'filter', datasetVersion: 3, timestamp: 1000 },
        { id: 'e2', operation: 'cluster', datasetVersion: 4, timestamp: 2000 },
      ],
      getEvidence: () => [],
    };

    inspector.setTab('Provenance');
    // header + 2 provenance rows
    expect(inspector._contentContainer.children.length).toBe(3);
  });

  it('renders ledger-derived session evidence when a provider is wired', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    inspector.provenanceProvider = {
      getProvenance: () => [],
      getEvidence: () => [
        { id: 'o1', kind: 'observation', title: 'Cluster skews left', timestamp: 1000 },
        { id: 'f1', kind: 'finding', title: 'Anomaly confirmed', timestamp: 2000 },
      ],
    };

    inspector.setTab('Evidence');
    // header + 2 evidence rows
    expect(inspector._contentContainer.children.length).toBe(3);
  });

  it('shows an "unavailable" notice for provenance/evidence when no provider is wired', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    expect(inspector.provenanceProvider).toBeNull();

    inspector.setTab('Provenance');
    // header + notice
    expect(inspector._contentContainer.children.length).toBe(2);

    inspector.setTab('Evidence');
    expect(inspector._contentContainer.children.length).toBe(2);
  });
});
