import type * as THREE from 'three';
import {
  parseApplicationAnalysisOperation,
  type ApplicationIntentDispatcher,
} from '../../app/intents/ApplicationIntent.ts';
import type {
  CoreNodeLike,
  DatumLike,
  PortalLike,
} from './types.ts';

export interface LandmarkTargets {
  core: CoreNodeLike;
  datum?: DatumLike;
  iceVault?: { group: import('three').Group };
  portalA?: PortalLike;
  portalB?: PortalLike;
}

export interface LandmarkRegistryPort {
  registerTooltipTarget(target: THREE.Object3D): void;
  registerInteractable(target: THREE.Object3D, onSelect: () => void): void;
}

export interface LandmarkApplicationPort {
  dispatchIntent: ApplicationIntentDispatcher;
  openVault(): void;
  setStatisticalLensVisible(visible: boolean): void;
  recordInteraction(action: string, details: Record<string, unknown>): void;
  captureSession(): void;
}

export interface LandmarkFeedbackPort {
  log(message: string): void;
  playCoreTone(mode: string): void;
  playHaptic(strength: number, durationMs: number): void;
}

export interface WorldLandmarkControllerOptions {
  targets: LandmarkTargets;
  registry: LandmarkRegistryPort;
  application: LandmarkApplicationPort;
  feedback: LandmarkFeedbackPort;
}

export class WorldLandmarkController {
  private readonly targets: LandmarkTargets;
  private readonly registry: LandmarkRegistryPort;
  private readonly application: LandmarkApplicationPort;
  private readonly feedback: LandmarkFeedbackPort;
  private representationGuidanceOpener: (() => void) | null = null;

  constructor({ targets, registry, application, feedback }: WorldLandmarkControllerOptions) {
    this.targets = targets;
    this.registry = registry;
    this.application = application;
    this.feedback = feedback;
  }

  /**
   * C1 composition hook. The production composition root installs the existing
   * governed representation-guidance surface here. Keeping this optional
   * preserves the historical lens-hub behavior for isolated/legacy harnesses
   * without making the landmark itself own UI construction.
   */
  setRepresentationGuidanceOpener(opener: (() => void) | null): void {
    this.representationGuidanceOpener = opener;
  }

  registerTooltipTargets(): void {
    const targets = this.targets;
    if (targets.core?.group) {
      targets.core.group.userData.tooltipMeta = {
        title: 'TechnoCore',
        body: 'Representation reasoning: select to inspect why, alternatives, constraints, and remediation',
      };
      this.registry.registerTooltipTarget(targets.core.group);
    }
    if (targets.datum?.mesh) {
      targets.datum.mesh.userData.tooltipMeta = {
        title: 'Datum Plane',
        body: 'Substrate of cyberspace',
      };
      this.registry.registerTooltipTarget(targets.datum.mesh);
    }
    if (targets.portalA?.group) {
      targets.portalA.group.userData.tooltipMeta = {
        title: 'Farcaster: Overview',
        body: 'Step through to return to the overview vantage',
      };
      this.registry.registerTooltipTarget(targets.portalA.group);
    }
    if (targets.portalB?.group) {
      targets.portalB.group.userData.tooltipMeta = {
        title: 'Farcaster: Saved Investigation',
        body: 'Step through to restore the latest frozen archive',
      };
      this.registry.registerTooltipTarget(targets.portalB.group);
    }
    if (targets.iceVault?.group) {
      targets.iceVault.group.userData.tooltipMeta = {
        title: 'Evidence Vault',
        body: 'Select to freeze, restore, or export investigation snapshots',
      };
      this.registry.registerTooltipTarget(targets.iceVault.group);
    }
  }

  registerLandmarkInteractions(): void {
    const targets = this.targets;
    if (targets.core?.group) {
      this.registry.registerInteractable(targets.core.group, () => this.onCoreSelect());
    }
    if (targets.iceVault?.group) {
      this.registry.registerInteractable(targets.iceVault.group, () => this.onVaultSelect());
    }
  }

  onVaultSelect(): void {
    this.application.openVault();
    this.application.recordInteraction('Evidence Vault select', {});
    this.feedback.playHaptic(0.4, 50);
  }

  onCoreSelect(): void {
    if (this.representationGuidanceOpener) {
      this.representationGuidanceOpener();
      const state = this.targets.core.group?.userData?.decisionState ?? 'PENDING';
      this.application.recordInteraction('TechnoCore representation guidance', { state });
      this.feedback.log(`TechnoCore: representation ${String(state).toLowerCase()}`);
      this.feedback.playCoreTone(String(state).toLowerCase());
      this.feedback.playHaptic(0.5, 60);
      this.application.captureSession();
      return;
    }

    // Compatibility fallback for isolated harnesses that do not install the C1
    // product projection. The production path always installs guidance.
    const mode = this.targets.core.nextLensMode();
    if (mode === 'statistical') {
      this.application.setStatisticalLensVisible(true);
      this.feedback.log('TechnoCore: statistical lens');
    } else if (mode === 'anomaly') {
      this.application.dispatchIntent({ type: 'analysis.apply', operation: 'anomaly' });
      this.feedback.log('TechnoCore: anomaly lens applied');
    } else {
      this.application.setStatisticalLensVisible(false);
      this.feedback.log('TechnoCore: lens off');
    }
    this.application.recordInteraction('TechnoCore lens', { result: mode });
    this.feedback.playCoreTone(mode);
    this.feedback.playHaptic(0.5, 60);
    this.application.captureSession();
  }

  applyPortalOperation(operation: string | null): void {
    if (!operation) return;
    if (operation === 'reset') {
      this.application.dispatchIntent({ type: 'analysis.reset' });
      return;
    }
    const parsed = parseApplicationAnalysisOperation(operation);
    if (parsed) this.application.dispatchIntent({ type: 'analysis.apply', operation: parsed });
  }
}