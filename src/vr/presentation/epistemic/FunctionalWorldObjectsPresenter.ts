import type { AtlasCore } from '../../../atlas/AtlasCore.ts';
import type { InvestigatorActionableOutcome } from '../../../moneta/representation/ActionableNil.ts';
import type { TechnoCoreDecisionState, TechnoCoreNode } from '../../artifacts/TechnoCoreNode.ts';
import type { IceVaultNode } from '../../artifacts/IceVaultNode.ts';
import type { FarcasterPortal } from '../../artifacts/FarcasterPortal.ts';
import type { WorldLandmarkController } from '../../coordinators/WorldLandmarkController.ts';
import type { RecommendationPanel } from '../../ui/RecommendationPanel.ts';
import type { VaultPanel } from '../../ui/VaultPanel.ts';
import type { PanelManager } from '../../ui/PanelManager.ts';
import type { TooltipManager } from '../../ui/TooltipManager.ts';
import type { Engine } from '../../Engine.ts';
import {
  MemoryPalaceWorldView,
  type MemoryPalaceProjectionSource,
} from './MemoryPalaceWorldView.ts';

interface AsyncLike {
  then?: unknown;
}

export interface FunctionalWorldObjectsHost {
  engine: Pick<
    Engine,
    'scene' | 'addUpdatable' | 'removeUpdatable' | 'addInteractable' | 'removeInteractable'
  >;
  atlas: AtlasCore;
  core: TechnoCoreNode;
  iceVault: IceVaultNode;
  portalA: FarcasterPortal;
  portalB: FarcasterPortal;
  landmarkController: WorldLandmarkController;
  panelManager: PanelManager;
  recommendationPanel: RecommendationPanel;
  vaultPanel: VaultPanel;
  tooltipManager: TooltipManager;
  getOutcome(): InvestigatorActionableOutcome | null;
  getPreviewDecision(): import('../../../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null;
}

/**
 * C1 presentation projection for persistent investigator world objects.
 *
 * This class owns no analytical state. It reads existing Moneta/Atlas/Vault
 * state and makes that state visible in the persistent landmarks. The Memory
 * Palace child view likewise projects explicit Atlas/InvestigationGraph state
 * and never activates the dormant authoring controller.
 */
export class FunctionalWorldObjectsPresenter {
  private readonly host: FunctionalWorldObjectsHost;
  readonly memoryPalace: MemoryPalaceWorldView;
  private elapsed = 0;
  private lastDecisionState: TechnoCoreDecisionState | null = null;
  private restoringArchive = false;
  private readonly originalVaultRestore?: (archiveId: string) => unknown;
  private readonly originalVaultFreeze?: () => unknown;
  private readonly originalVaultDelete?: (archiveId: string) => unknown;
  private disposed = false;

  constructor(host: FunctionalWorldObjectsHost) {
    this.host = host;
    this.originalVaultRestore = host.vaultPanel.onRestore as ((archiveId: string) => unknown) | undefined;
    this.originalVaultFreeze = host.vaultPanel.onFreeze as (() => unknown) | undefined;
    this.originalVaultDelete = host.vaultPanel.onDelete as ((archiveId: string) => unknown) | undefined;

    this.memoryPalace = new MemoryPalaceWorldView({
      scene: host.engine.scene,
      addInteractable: (object, handlers) => host.engine.addInteractable(object, handlers),
      removeInteractable: (object) => host.engine.removeInteractable(object),
      registerTooltipTarget: (object) => host.tooltipManager.registerTarget(object),
      unregisterTooltipTarget: (object) => {
        const index = host.tooltipManager.targets.indexOf(object);
        if (index >= 0) host.tooltipManager.targets.splice(index, 1);
      },
    });

    host.landmarkController.setRepresentationGuidanceOpener(() => this.openRepresentationGuidance());
    this.wrapVaultOperations();
    host.engine.addUpdatable(this);
    this.syncNow();
  }

  update(delta = 0): void {
    this.elapsed += delta;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    this.syncNow();
  }

  syncNow(): void {
    if (this.disposed) return;
    this.syncTechnoCore();
    this.syncVaultAndPortals();
    this.memoryPalace.sync(this.memorySource());
  }

  private syncTechnoCore(): void {
    const outcome = this.host.getOutcome();
    const activeDecision = this.host.atlas.activeRepresentationDecision;
    const state: TechnoCoreDecisionState =
      outcome?.state ?? activeDecision?.decisionStatus ?? 'PENDING';
    if (state !== this.lastDecisionState) {
      this.host.core.setDecisionState(state);
      this.lastDecisionState = state;
    }

    const preview = this.host.getPreviewDecision();
    const candidate =
      preview?.chosenCandidateId ??
      activeDecision?.chosenCandidateId ??
      activeDecision?.representationFamily ??
      'not yet decided';
    const mode = preview ? 'PREVIEW' : 'COMMITTED';
    this.host.core.group.userData.tooltipMeta = {
      title: `TechnoCore · ${state}`,
      body: `${mode}: ${String(candidate)}. Select to inspect why, alternatives, constraints, and remediation.`,
      priority: 3,
    };
    this.host.core.group.userData.representationState = {
      state,
      candidate,
      preview: Boolean(preview),
      decisionId: preview?.id ?? activeDecision?.id ?? null,
    };
  }

  private openRepresentationGuidance(): void {
    this.host.recommendationPanel.markDirty();
    this.host.recommendationPanel.setActiveTab('guidance');
    this.host.panelManager.showPanel(this.host.recommendationPanel);
  }

  private syncVaultAndPortals(): void {
    const archiveCount = this.host.vaultPanel.archives.length;
    if (!this.restoringArchive) {
      this.host.iceVault.setArchiveState(archiveCount > 0 ? 'frozen' : 'empty');
    }
    this.host.iceVault.group.userData.archiveCount = archiveCount;
    this.host.iceVault.group.userData.tooltipMeta = {
      title: 'Evidence Vault',
      body: this.restoringArchive
        ? 'Restoring a frozen investigation snapshot'
        : archiveCount > 0
          ? `${archiveCount} frozen investigation snapshot${archiveCount === 1 ? '' : 's'} available. Select to inspect archive actions.`
          : 'No frozen snapshots yet. Select to freeze the current investigation.',
      priority: 2,
    };

    this.host.portalA.setPreviewInfo({
      label: 'Overview',
      description: 'Return to the overview vantage without analytical mutation.',
    });
    this.host.portalA.group.userData.portalAvailability = 'available';
    this.host.portalA.group.userData.tooltipMeta = {
      title: 'Farcaster: Overview',
      body: 'Destination: overview. Traversal changes viewpoint/context only.',
      priority: 2,
    };

    const savedAvailable = archiveCount > 0;
    this.host.portalB.setPreviewInfo({
      label: 'Latest frozen investigation',
      description: savedAvailable
        ? `${archiveCount} frozen snapshot${archiveCount === 1 ? '' : 's'} available; traversal restores the latest.`
        : 'No frozen investigation is available; traversal will refuse rather than invent a destination.',
    });
    this.host.portalB.group.userData.portalAvailability = savedAvailable ? 'available' : 'unavailable';
    this.host.portalB.group.userData.tooltipMeta = {
      title: 'Farcaster: Saved Investigation',
      body: savedAvailable
        ? `Destination: latest frozen investigation (${archiveCount} available).`
        : 'Destination unavailable: freeze an investigation first.',
      priority: 2,
    };
  }

  private wrapVaultOperations(): void {
    this.host.vaultPanel.onRestore = (archiveId: string) => {
      this.restoringArchive = true;
      this.host.iceVault.setArchiveState('restoring');
      this.syncVaultAndPortals();
      const result = this.originalVaultRestore?.(archiveId);
      this.afterPotentialAsync(result, () => {
        this.restoringArchive = false;
        this.syncNow();
      });
    };

    this.host.vaultPanel.onFreeze = () => {
      const result = this.originalVaultFreeze?.();
      this.afterPotentialAsync(result, () => this.syncNow());
    };

    this.host.vaultPanel.onDelete = (archiveId: string) => {
      const result = this.originalVaultDelete?.(archiveId);
      this.afterPotentialAsync(result, () => this.syncNow());
    };
  }

  private afterPotentialAsync(result: unknown, complete: () => void): void {
    const maybePromise = result as AsyncLike | null | undefined;
    if (maybePromise && typeof maybePromise.then === 'function') {
      Promise.resolve(result).finally(complete);
      return;
    }
    queueMicrotask(complete);
  }

  private memorySource(): MemoryPalaceProjectionSource {
    const aggregate = this.host.atlas.aggregate;
    return {
      sessionId: aggregate.sessionId,
      researchQuestion: aggregate.context.researchQuestion,
      hypothesis: aggregate.context.hypothesis,
      nodes: aggregate.graph.nodes,
      edges: aggregate.graph.edges,
      activeNodeId: aggregate.graph.activeNodeId,
      observations: this.host.atlas.observations,
      findings: this.host.atlas.findings,
    };
  }

  getDiagnosticSnapshot(): {
    technoCore: Record<string, unknown>;
    vault: { state: string; archiveCount: number };
    portals: { overview: unknown; saved: unknown };
    memoryPalace: ReturnType<MemoryPalaceWorldView['getSnapshot']>;
  } {
    return {
      technoCore: { ...this.host.core.group.userData.representationState },
      vault: {
        state: this.host.iceVault.archiveState,
        archiveCount: this.host.vaultPanel.archives.length,
      },
      portals: {
        overview: this.host.portalA.group.userData.portalAvailability,
        saved: this.host.portalB.group.userData.portalAvailability,
      },
      memoryPalace: this.memoryPalace.getSnapshot(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.host.engine.removeUpdatable(this);
    this.host.landmarkController.setRepresentationGuidanceOpener(null);
    this.host.vaultPanel.onRestore = this.originalVaultRestore as ((archiveId: string) => void) | undefined;
    this.host.vaultPanel.onFreeze = this.originalVaultFreeze as (() => void) | undefined;
    this.host.vaultPanel.onDelete = this.originalVaultDelete as ((archiveId: string) => void) | undefined;
    this.memoryPalace.dispose();
  }
}