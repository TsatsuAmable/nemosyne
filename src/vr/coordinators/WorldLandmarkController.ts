import type {
  CoreNodeLike,
  DatumLike,
  LogInteraction,
  PortalLike,
  TooltipManagerLike,
  WorldEngineLike,
  WorldUIManagerLike,
} from './types.ts';

export interface WorldLandmarkHost {
  core: CoreNodeLike;
  datum?: DatumLike;
  iceVault?: { group: import('three').Group };
  portalA?: PortalLike;
  portalB?: PortalLike;
  tooltipManager: TooltipManagerLike;
  engine: Pick<WorldEngineLike, 'addInteractable' | 'input'>;
  uiManager: Pick<WorldUIManagerLike, 'vrConsole'>;
  _statisticalLensEnabled?: boolean;
  _setStatisticalLensVisible(visible: boolean): void;
  applyDataOperation(operation: string): void;
  resetDataOperation(): void;
  _logInteraction: LogInteraction;
  _captureSession(): void;
  _toggleVaultPanel?(): void;
}

export class WorldLandmarkController {
  private _world: WorldLandmarkHost;

  constructor(world: WorldLandmarkHost) {
    this._world = world;
  }

  registerTooltipTargets(): void {
    const w = this._world;
    if (w.core?.group) {
      w.core.group.userData.tooltipMeta = {
        title: 'TechnoCore',
        body: 'Lens hub: pinch to cycle statistical/anomaly lens',
      };
      w.tooltipManager.registerTarget(w.core.group);
    }
    if (w.datum?.mesh) {
      w.datum.mesh.userData.tooltipMeta = {
        title: 'Datum Plane',
        body: 'Substrate of cyberspace',
      };
      w.tooltipManager.registerTarget(w.datum.mesh);
    }
    if (w.portalA?.group) {
      w.portalA.group.userData.tooltipMeta = {
        title: 'Farcaster: Overview',
        body: 'Step through to return to the overview vantage',
      };
      w.tooltipManager.registerTarget(w.portalA.group);
    }
    if (w.portalB?.group) {
      w.portalB.group.userData.tooltipMeta = {
        title: 'Farcaster: Saved Investigation',
        body: 'Step through to restore the latest frozen archive',
      };
      w.tooltipManager.registerTarget(w.portalB.group);
    }
    if (w.iceVault?.group) {
      w.iceVault.group.userData.tooltipMeta = {
        title: 'Evidence Vault',
        body: 'Select to freeze, restore, or export investigation snapshots',
      };
      w.tooltipManager.registerTarget(w.iceVault.group);
    }
  }

  registerLandmarkInteractions(): void {
    const w = this._world;
    if (w.core?.group) {
      w.engine.addInteractable(w.core.group, {
        onEnter: () => {},
        onLeave: () => {},
        onSelect: () => this.onCoreSelect(),
      });
    }
    if (w.iceVault?.group) {
      w.engine.addInteractable(w.iceVault.group, {
        onEnter: () => {},
        onLeave: () => {},
        onSelect: () => this.onVaultSelect(),
      });
    }
  }

  onVaultSelect(): void {
    this._world._toggleVaultPanel?.();
    this._world._logInteraction('Evidence Vault select', {});
    this._world.engine.input.feedback?.playHaptic?.(0.4, 50);
  }

  onCoreSelect(): void {
    const w = this._world;
    const mode = w.core.nextLensMode();
    if (mode === 'statistical') {
      w._statisticalLensEnabled = true;
      w._setStatisticalLensVisible(true);
      w.uiManager?.vrConsole?.log?.('log', ['TechnoCore: statistical lens']);
    } else if (mode === 'anomaly') {
      w.applyDataOperation('anomaly');
      w.uiManager?.vrConsole?.log?.('log', ['TechnoCore: anomaly lens applied']);
    } else {
      w._statisticalLensEnabled = false;
      w._setStatisticalLensVisible(false);
      w.uiManager?.vrConsole?.log?.('log', ['TechnoCore: lens off']);
    }
    w._logInteraction('TechnoCore lens', { result: mode });
    w.engine.input.feedback?.playCoreTone?.(mode);
    w.engine.input.feedback?.playHaptic?.(0.5, 60);
    w._captureSession();
  }

  applyPortalOperation(operation: string | null): void {
    if (!operation) return;
    if (operation === 'reset') {
      this._world.resetDataOperation();
    } else {
      this._world.applyDataOperation(operation);
    }
  }
}
