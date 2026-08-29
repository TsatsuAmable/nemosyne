import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coordinatorDirectory = resolve(process.cwd(), 'src/vr/coordinators');

const contracts = [
  {
    file: 'AnalysisStoryExporter.ts',
    name: 'AnalysisStoryHost',
    members: [
      '_logInteraction',
      '_originalDataset',
      '_transformedDataset',
      'analysisHistory',
      'currentEntry',
      'engine',
      'telemetryCollector',
      'uiManager',
    ],
  },
  {
    file: 'CollaborationCoordinator.ts',
    name: 'CollaborationHost',
    members: [
      '_buildWheelMenu',
      '_logInteraction',
      'annotationManager',
      'currentEntry',
      'engine',
      'scene',
      'telemetryCollector',
      'uiManager',
    ],
  },
  {
    file: 'GuidedTourController.ts',
    name: 'GuidedTourHost',
    members: [
      'dataOperationController',
      'datum',
      'dracoNode',
      'guidedTour',
      'inspector',
      'tdaGroup',
      'uiManager',
    ],
  },
  {
    file: 'LiveStreamCoordinator.ts',
    name: 'LiveStreamHost',
    members: ['currentEntry', 'dracoNode', 'loadDataset', 'uiManager'],
  },
  {
    file: 'WheelMenuBuilder.ts',
    name: 'WheelMenuHost',
    members: [
      '_cycleDataset',
      '_cycleThemePreset',
      '_joinCollaborationRoom',
      '_leaveCollaborationRoom',
      '_toggleDesktopPreview',
      '_toggleDracoDiagnostic',
      '_toggleDracoExplainer',
      '_toggleLoadTestPanel',
      '_toggleMiniOverview',
      '_togglePeerPresenceHUD',
      '_toggleSettingsPanel',
      '_toggleStatisticalLens',
      'applyDataOperation',
      'clearOperationPreview',
      'collaborationCoordinator',
      'connectLiveStream',
      'deleteSession',
      'disconnectLiveStream',
      'dispatchIntent',
      'engine',
      'exitVR',
      'exportAnalysisStory',
      'exportScreenshot',
      'isLiveConnected',
      'loadSession',
      'loadTemplate',
      'markMoment',
      'portalsEnabled',
      'previewDataOperation',
      'redoAnalysis',
      'resetDataOperation',
      'runLoadTest',
      'saveSession',
      'setPortalsEnabled',
      'startTour',
      'stopLoadTest',
      'uiManager',
      'undoAnalysis',
    ],
  },
  {
    file: 'WorldLandmarkController.ts',
    name: 'WorldLandmarkHost',
    members: [
      '_captureSession',
      '_logInteraction',
      '_setStatisticalLensVisible',
      '_statisticalLensEnabled',
      '_toggleVaultPanel',
      'applyDataOperation',
      'core',
      'datum',
      'engine',
      'iceVault',
      'portalA',
      'portalB',
      'resetDataOperation',
      'tooltipManager',
      'uiManager',
    ],
  },
  {
    file: 'WorldSessionController.ts',
    name: 'WorldSessionHost',
    members: [
      '_disposed',
      '_logInteraction',
      '_originalDataset',
      '_restoreDataset',
      '_transformedDataset',
      '_updateNarrativeStrip',
      'archiveStore',
      'atlas',
      'comfortSettingsController',
      'currentEntry',
      'dracoNode',
      'engine',
      'focusContext',
      'guidedTour',
      'loadDataset',
      'narrativeStrip',
      'reconstructRequirementsAndReArbitrate',
      'session',
      'sessionStore',
      'uiManager',
      'userModeController',
      'vrConsole',
    ],
  },
] as const;

const ownedContracts = [
  {
    file: 'CollaborationCoordinator.ts',
    names: ['CollaborationHost', 'NetworkEvent', 'NetworkManagerLike'],
  },
  {
    file: 'ComfortSettingsController.ts',
    names: ['ComfortSettings'],
  },
  {
    file: 'DataOperationController.ts',
    names: ['DataOperationControllerOptions'],
  },
  {
    file: 'LiveStreamCoordinator.ts',
    names: ['LiveConnectorLike', 'LiveStreamHost', 'LiveStreamOptions', 'LiveTopologyNode'],
  },
  {
    file: 'UserModeController.ts',
    names: ['UserModeControllerOptions'],
  },
  {
    file: 'WorldInputCoordinator.ts',
    names: ['InputCallbacks', 'WorldInputOptions'],
  },
  {
    file: 'WorldSceneComposer.ts',
    names: ['WorldSceneComposerCallbacks'],
  },
  {
    file: 'WorldUIManager.ts',
    names: ['WorldUIManagerCallbacks'],
  },
] as const;

function source(file: string): string {
  return readFileSync(resolve(coordinatorDirectory, file), 'utf8');
}

function interfaceMembers(fileSource: string, name: string): string[] {
  const body = fileSource.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  expect(body, name).toBeDefined();
  return [...(body ?? '').matchAll(/^\s{2}([A-Za-z_$][\w$]*)\??(?:\(|:)/gm)]
    .map((match) => match[1])
    .sort();
}

describe('coordinator consumer contracts', () => {
  it('removes the shared World god-object facade', () => {
    expect(source('types.ts')).not.toMatch(/\bWorldLike\b/);
    for (const { file } of contracts) {
      expect(source(file), file).not.toMatch(/\bWorldLike\b/);
      expect(source(file), file).not.toMatch(/from ['"].*\/World\.ts['"]/);
    }
  });

  it('co-locates and freezes each consumer-owned host surface', () => {
    for (const contract of contracts) {
      expect(interfaceMembers(source(contract.file), contract.name), contract.file).toEqual(
        [...contract.members].sort()
      );
    }
  });

  it('keeps coordinator-specific options and collaborator ports with their consumer', () => {
    const sharedTypes = source('types.ts');
    for (const { file, names } of ownedContracts) {
      const consumerSource = source(file);
      for (const name of names) {
        expect(consumerSource, `${file}:${name}`).toMatch(
          new RegExp(`export interface ${name} \\{`)
        );
        expect(sharedTypes, name).not.toMatch(new RegExp(`export interface ${name} \\{`));
      }
    }
  });

  it('derives the World runtime dependency from the authoritative bridge module', () => {
    const worldSource = readFileSync(resolve(process.cwd(), 'src/vr/World.ts'), 'utf8');
    expect(source('types.ts')).not.toMatch(/\bWasmRuntimeBridge\b/);
    expect(worldSource).toMatch(
      /type WorldRuntimeBridge = typeof import\('\.\.\/wasm\/RuntimeBridge\.ts'\)/
    );
  });

  it('types every coordinator entry point against its own host', () => {
    expect(source('AnalysisStoryExporter.ts')).toMatch(
      /buildAnalysisStory\(world: AnalysisStoryHost\)/
    );
    expect(source('CollaborationCoordinator.ts')).toMatch(
      /constructor\(\{ world \}: \{ world: CollaborationHost \}\)/
    );
    expect(source('GuidedTourController.ts')).toMatch(/constructor\(world: GuidedTourHost\)/);
    expect(source('LiveStreamCoordinator.ts')).toMatch(
      /constructor\(\{ world \}: \{ world: LiveStreamHost \}\)/
    );
    expect(source('WorldLandmarkController.ts')).toMatch(/constructor\(world: WorldLandmarkHost\)/);
    expect(source('WorldSessionController.ts')).toMatch(/constructor\(world: WorldSessionHost\)/);
    expect(source('WheelMenuBuilder.ts')).toMatch(
      /buildWheelMenuCategories\(world: WheelMenuHost\)/
    );
    expect(source('WheelMenuBuilder.ts')).toMatch(
      /buildIntentWheelMenuCategories\(world: WheelMenuHost\)/
    );
  });
});
