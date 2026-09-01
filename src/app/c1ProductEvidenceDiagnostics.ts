import * as THREE from 'three';

export interface C1ProductEvidenceSnapshot {
  schemaVersion: 1;
  technoCore: Record<string, unknown>;
  vault: { state: string; archiveCount: number };
  portals: { overview: unknown; saved: unknown };
  memoryPalace: {
    visible: boolean;
    objectCount: number;
    relationshipCount: number;
    selectedId: string | null;
    objectIds: string[];
  };
  lensEnabled: boolean;
  analysisResultCount: number;
  recommendationPanelVisible: boolean;
}

export interface C1ProductEvidenceHook {
  schemaVersion: 1;
  snapshot(): C1ProductEvidenceSnapshot;
  selectTechnoCore(): C1ProductEvidenceSnapshot;
  markObservation(note?: string): { observationId: string; snapshot: C1ProductEvidenceSnapshot };
  freezeInvestigation(): Promise<C1ProductEvidenceSnapshot>;
  focus(target: 'technocore' | 'vault' | 'saved-portal' | 'memory-palace'): void;
}

/**
 * Diagnostics need only this read/action surface. Keeping it structural avoids
 * a reverse dependency on the World composition root (RF-062).
 */
export interface C1ProductEvidenceWorldPort {
  engine: { camera: THREE.Camera };
  uiManager: {
    recommendationPanel: { mesh?: THREE.Object3D | null };
    vaultPanel: {
      archives: readonly unknown[];
      onFreeze?: (() => unknown) | null;
    };
  };
  landmarkController: {
    onCoreSelect(): void;
    onVaultSelect(): void;
  };
  core: { group: THREE.Object3D };
  iceVault: { group: THREE.Object3D };
  portalB: { group: THREE.Object3D };
  _statisticalLensEnabled: boolean;
  atlas: { results: readonly unknown[] };
  markMoment(note?: string): { id: string };
}

export interface C1ProductEvidencePresenterPort {
  memoryPalace: { group: THREE.Object3D };
  syncNow(): void;
  getDiagnosticSnapshot(): {
    technoCore: Record<string, unknown>;
    vault: { state: string; archiveCount: number };
    portals: { overview: unknown; saved: unknown };
    memoryPalace: C1ProductEvidenceSnapshot['memoryPalace'];
  };
}

declare global {
  interface Window {
    __NEMOSYNE_C1_EVIDENCE__?: C1ProductEvidenceHook;
  }
}

function panelVisible(world: C1ProductEvidenceWorldPort): boolean {
  return Boolean(world.uiManager.recommendationPanel.mesh?.visible);
}

function snapshot(
  world: C1ProductEvidenceWorldPort,
  presenter: C1ProductEvidencePresenterPort,
): C1ProductEvidenceSnapshot {
  const projected = presenter.getDiagnosticSnapshot();
  return {
    schemaVersion: 1,
    ...projected,
    lensEnabled: world._statisticalLensEnabled,
    analysisResultCount: world.atlas.results.length,
    recommendationPanelVisible: panelVisible(world),
  };
}

function focusCamera(world: C1ProductEvidenceWorldPort, object: THREE.Object3D): void {
  const target = new THREE.Vector3();
  object.getWorldPosition(target);
  world.engine.camera.position.set(target.x, target.y + 0.35, target.z + 3.1);
  world.engine.camera.lookAt(target);
  world.engine.camera.updateMatrixWorld(true);
}

async function waitForArchiveCount(
  world: C1ProductEvidenceWorldPort,
  presenter: C1ProductEvidencePresenterPort,
  minimum: number,
): Promise<void> {
  const deadline = performance.now() + 8_000;
  while (performance.now() < deadline) {
    presenter.syncNow();
    if (world.uiManager.vaultPanel.archives.length >= minimum) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`C1 archive evidence timed out waiting for ${minimum} archive(s).`);
}

/**
 * Diagnostics-gated producer for P1-UV C1 browser evidence. It invokes the
 * real product interaction/action surfaces and only reads presentation state;
 * it does not manufacture Moneta, Atlas, archive, or epistemic records.
 */
export function installC1ProductEvidenceHook(
  world: C1ProductEvidenceWorldPort,
  presenter: C1ProductEvidencePresenterPort,
): () => void {
  const hook: C1ProductEvidenceHook = {
    schemaVersion: 1,
    snapshot: () => snapshot(world, presenter),
    selectTechnoCore: () => {
      world.landmarkController.onCoreSelect();
      presenter.syncNow();
      return snapshot(world, presenter);
    },
    markObservation: (note = 'C1 visible epistemic observation') => {
      const observation = world.markMoment(note);
      presenter.syncNow();
      return { observationId: observation.id, snapshot: snapshot(world, presenter) };
    },
    freezeInvestigation: async () => {
      const before = world.uiManager.vaultPanel.archives.length;
      world.landmarkController.onVaultSelect();
      world.uiManager.vaultPanel.onFreeze?.();
      await waitForArchiveCount(world, presenter, before + 1);
      return snapshot(world, presenter);
    },
    focus: (target) => {
      const object = target === 'technocore'
        ? world.core.group
        : target === 'vault'
          ? world.iceVault.group
          : target === 'saved-portal'
            ? world.portalB.group
            : presenter.memoryPalace.group;
      focusCamera(world, object);
    },
  };

  window.__NEMOSYNE_C1_EVIDENCE__ = hook;
  return () => {
    if (window.__NEMOSYNE_C1_EVIDENCE__ === hook) {
      delete window.__NEMOSYNE_C1_EVIDENCE__;
    }
  };
}