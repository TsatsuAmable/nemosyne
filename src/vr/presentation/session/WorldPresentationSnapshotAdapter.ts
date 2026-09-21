import type { PresentationState } from '../../../session/NemosyneSession.ts';
import type { FocusContextController } from '../../interactions/FocusContextController.ts';
import type {
  ComfortSettingsControllerLike,
  DatasetLoadEntry,
  SettingsPanelLike,
  WorldEngineLike,
  WorkspaceSurfaceManagerLike,
} from '../../coordinators/types.ts';
import type { PresentationSnapshotPort } from './PresentationSnapshotPort.ts';
import { UI_TREATMENT_VERSION } from '../../ui/panelLayout.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCompatibleSetting(current: unknown, restored: unknown): boolean {
  if (typeof current !== typeof restored) return false;
  return typeof restored !== 'number' || Number.isFinite(restored);
}

export interface GuidedTourPresentationPort {
  capturePresentationState(): PresentationState['tour'];
  restorePresentationState(snapshot: PresentationState['tour']): void;
}

export interface WorldPresentationSnapshotDependencies {
  cameraGroup: WorldEngineLike['cameraGroup'];
  theme: NonNullable<WorldEngineLike['theme']>;
  settingsPanel: SettingsPanelLike;
  workspaceSurfaces: WorkspaceSurfaceManagerLike;
  guidedTour: GuidedTourPresentationPort;
  comfortSettingsController: ComfortSettingsControllerLike;
  focusContext: Pick<FocusContextController, 'exportState' | 'restoreState' | 'clearFocus'>;
  getCurrentEntry(): DatasetLoadEntry | null;
  getFallbackDatasetName(): string | null;
  hasRepresentation(): boolean;
}

/**
 * Captures and restores presentation-only session state. It deliberately has
 * no access to Atlas, NemosyneSession, World, dataset mutation, or Moneta
 * arbitration.
 */
export class WorldPresentationSnapshotAdapter implements PresentationSnapshotPort {
  constructor(private readonly dependencies: WorldPresentationSnapshotDependencies) {}

  capture(): PresentationState | null {
    const deps = this.dependencies;
    const entry = deps.getCurrentEntry();
    if (!entry?.dataset || !deps.hasRepresentation()) return null;

    return {
      camera: {
        position: deps.cameraGroup.position.toArray() as [number, number, number],
        rotationY: deps.cameraGroup.rotation.y,
      },
      settings: deps.settingsPanel.getAllSettings(),
      tour: deps.guidedTour.capturePresentationState(),
      theme: deps.theme.currentPreset,
      uiTreatmentVersion: UI_TREATMENT_VERSION,
      panelPositions: deps.workspaceSurfaces.capturePositions(),
      entry: {
        name:
          entry.name ??
          deps.getFallbackDatasetName() ??
          entry.label ??
          'dataset',
        topology: entry.topology,
        encodings: entry.encodings,
        maxDepth: entry.maxDepth,
      },
      focus: deps.focusContext.exportState(),
    };
  }

  async restore(snapshot: PresentationState): Promise<void> {
    const deps = this.dependencies;
    const camera = snapshot.camera;
    if (
      Array.isArray(camera?.position) &&
      camera.position.length === 3 &&
      camera.position.every((value) => typeof value === 'number' && Number.isFinite(value))
    ) {
      deps.cameraGroup.position.fromArray(camera.position);
    }
    if (typeof camera?.rotationY === 'number' && Number.isFinite(camera.rotationY)) {
      deps.cameraGroup.rotation.y = camera.rotationY;
    }

    const currentSettings = deps.settingsPanel.getAllSettings();
    if (isRecord(snapshot.settings)) {
      for (const [key, value] of Object.entries(snapshot.settings)) {
        if (!(key in currentSettings) || !isCompatibleSetting(currentSettings[key], value)) {
          continue;
        }
        deps.settingsPanel.setSetting?.(key, value);
      }
    }
    const settings = deps.settingsPanel.getAllSettings();
    deps.comfortSettingsController.apply(settings);
    if (
      typeof settings.defaultPanelDistance === 'number' &&
      Number.isFinite(settings.defaultPanelDistance)
    ) {
      deps.comfortSettingsController.applyPanelDistance(settings.defaultPanelDistance);
    }

    if (typeof snapshot.theme === 'string' && snapshot.theme.length > 0) {
      deps.theme.applyPreset?.(snapshot.theme);
    }
    if (snapshot.uiTreatmentVersion === UI_TREATMENT_VERSION && Array.isArray(snapshot.panelPositions)) {
      const panelPositions = snapshot.panelPositions.filter(
        (value): value is { id: string; title?: string; position?: number[]; visible?: boolean } => {
          if (!value || typeof value !== 'object') return false;
          const item = value as {
            id?: unknown;
            title?: unknown;
            position?: unknown;
            visible?: unknown;
          };
          return (
            typeof item.id === 'string' &&
            item.id.length > 0 &&
            Array.isArray(item.position) &&
            item.position.length === 3 &&
            item.position.every(
              (coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)
            ) &&
            typeof item.visible === 'boolean'
          );
        }
      );
      deps.workspaceSurfaces.restorePositions(panelPositions);
    } else {
      // A body-frame/layout revision invalidates old spatial coordinates.
      deps.workspaceSurfaces.recenterAll();
    }

    const tour = snapshot.tour;
    if (tour?.finished === true) {
      deps.guidedTour.restorePresentationState({ stepIndex: 0, finished: true });
    } else if (tour?.finished === false) {
      deps.guidedTour.restorePresentationState({
        stepIndex: Number.isInteger(tour.stepIndex) && tour.stepIndex >= 0 ? tour.stepIndex : 0,
        finished: false,
      });
    }

    if (!snapshot.focus) {
      // Focus is investigation-local presentation state. A snapshot that
      // predates this field must not inherit semantic focus from the session
      // being replaced.
      deps.focusContext.clearFocus();
      return;
    }

    try {
      deps.focusContext.restoreState(
        snapshot.focus as Parameters<FocusContextController['restoreState']>[0]
      );
    } catch {
      // Corrupt or stale semantic focus cannot abort the wider restore.
      deps.focusContext.clearFocus();
    }
  }
}