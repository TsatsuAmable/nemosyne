import type { InvestigationStatusProjection, StatusStripState } from '../vr/ui/StatusStripController.ts';

export interface C2ProductEvidenceSnapshot {
  schemaVersion: 1;
  status: StatusStripState;
  lines: string[];
  statusPanelParent: string | null;
  statusPanelVisible: boolean;
}

export interface C2ProductEvidenceHook {
  schemaVersion: 1;
  snapshot(): C2ProductEvidenceSnapshot;
  focusFirstStructure(): C2ProductEvidenceSnapshot & { structureId: string };
  previewOperation(operation?: string): C2ProductEvidenceSnapshot;
  clearPreview(): C2ProductEvidenceSnapshot;
  applyOperation(operation?: string): Promise<C2ProductEvidenceSnapshot>;
  undo(): C2ProductEvidenceSnapshot;
  markObservation(note?: string): C2ProductEvidenceSnapshot & { observationId: string };
  freezeInvestigation(): Promise<C2ProductEvidenceSnapshot>;
}

interface C2ProductEvidenceWorldPort {
  analystAnchor: { name: string };
  engine: {
    input: {
      registry: {
        interactables: Array<{
          semantic?: { structureId?: string; kind?: string };
        }>;
      };
      onFocusChange?: ((state: { currentLevel: string; focusedStructureId: string | null }) => void) | null;
    };
  };
  focusContext: {
    focusStructure(structureId: string): void;
    exportState(): { currentLevel: string; focusedStructureId: string | null };
  };
  dataOperationController: {
    preview(operation: string): void;
    clearPreview(): void;
    applyAsync(operation: string): Promise<void>;
  };
  uiManager: {
    statusStrip: {
      state: StatusStripState;
      formatInvestigationLines(): string[];
    };
    statusStripPanel: {
      mesh: { parent: { name?: string } | null; visible: boolean };
    };
    vaultPanel: {
      archives: readonly unknown[];
      onFreeze?: (() => unknown) | null;
    };
  };
  landmarkController: { onVaultSelect(): void };
  undoAnalysis(): void;
  markMoment(note?: string): { id: string };
}

interface C2ProductEvidencePresenterPort {
  syncNow(): InvestigationStatusProjection | null;
}

declare global {
  interface Window {
    __NEMOSYNE_C2_EVIDENCE__?: C2ProductEvidenceHook;
  }
}

function copyState(state: StatusStripState): StatusStripState {
  return {
    ...state,
    evidence: { ...state.evidence },
    recovery: { ...state.recovery },
    origin: { ...state.origin },
  };
}

function snapshot(
  world: C2ProductEvidenceWorldPort,
  presenter: C2ProductEvidencePresenterPort,
): C2ProductEvidenceSnapshot {
  presenter.syncNow();
  return {
    schemaVersion: 1,
    status: copyState(world.uiManager.statusStrip.state),
    lines: world.uiManager.statusStrip.formatInvestigationLines(),
    statusPanelParent: world.uiManager.statusStripPanel.mesh.parent?.name ?? null,
    statusPanelVisible: world.uiManager.statusStripPanel.mesh.visible,
  };
}

async function waitForArchive(
  world: C2ProductEvidenceWorldPort,
  presenter: C2ProductEvidencePresenterPort,
  minimum: number,
): Promise<void> {
  const deadline = performance.now() + 8_000;
  while (performance.now() < deadline) {
    presenter.syncNow();
    if (world.uiManager.vaultPanel.archives.length >= minimum) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`C2 archive evidence timed out waiting for ${minimum} archive(s).`);
}

/** Diagnostics-gated real-product actions for C2 browser evidence. */
export function installC2ProductEvidenceHook(
  world: C2ProductEvidenceWorldPort,
  presenter: C2ProductEvidencePresenterPort,
): () => void {
  const hook: C2ProductEvidenceHook = {
    schemaVersion: 1,
    snapshot: () => snapshot(world, presenter),
    focusFirstStructure: () => {
      const target = world.engine.input.registry.interactables.find(
        (entry) => entry.semantic?.structureId && entry.semantic.kind !== 'observation',
      );
      const structureId = target?.semantic?.structureId;
      if (!structureId) {
        throw new Error('C2 evidence requires a real rendered semantic structure target.');
      }
      world.focusContext.focusStructure(structureId);
      world.engine.input.onFocusChange?.(world.focusContext.exportState());
      return { ...snapshot(world, presenter), structureId };
    },
    previewOperation: (operation = 'sort') => {
      world.dataOperationController.preview(operation);
      return snapshot(world, presenter);
    },
    clearPreview: () => {
      world.dataOperationController.clearPreview();
      return snapshot(world, presenter);
    },
    applyOperation: async (operation = 'sort') => {
      await world.dataOperationController.applyAsync(operation);
      return snapshot(world, presenter);
    },
    undo: () => {
      world.undoAnalysis();
      return snapshot(world, presenter);
    },
    markObservation: (note = 'C2 evidence observation') => {
      const observation = world.markMoment(note);
      return { ...snapshot(world, presenter), observationId: observation.id };
    },
    freezeInvestigation: async () => {
      const before = world.uiManager.vaultPanel.archives.length;
      world.landmarkController.onVaultSelect();
      world.uiManager.vaultPanel.onFreeze?.();
      await waitForArchive(world, presenter, before + 1);
      return snapshot(world, presenter);
    },
  };

  window.__NEMOSYNE_C2_EVIDENCE__ = hook;
  return () => {
    if (window.__NEMOSYNE_C2_EVIDENCE__ === hook) {
      delete window.__NEMOSYNE_C2_EVIDENCE__;
    }
  };
}
