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
        title: 'Farcaster: Deep Net',
        body: 'Step through to apply anomaly lens and warp to the deep-net zone',
      };
      w.tooltipManager.registerTarget(w.portalA.group);
    }
    if (w.portalB?.group) {
      w.portalB.group.userData.tooltipMeta = {
        title: 'Farcaster: Local Matrix',
        body: 'Step through to reset transforms and return to the local matrix',
      };
      w.tooltipManager.registerTarget(w.portalB.group);
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
