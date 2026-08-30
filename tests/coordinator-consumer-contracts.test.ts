import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coordinatorDirectory = resolve(process.cwd(), 'src/vr/coordinators');

const contracts = [
  {
    file: 'AnalysisStoryExporter.ts',
    name: 'AnalysisStoryHost',
    members: ['_logInteraction', 'atlas', 'currentEntry', 'engine', 'telemetryCollector', 'uiManager'],
  },
  {
    file: 'CollaborationCoordinator.ts',
    name: 'CollaborationPresencePort',
    members: [
      'annotationManager',
      'camera',
      'cameraGroup',
      'getDatasetLabel',
      'scene',
    ],
  },
  {
    file: 'CollaborationCoordinator.ts',
    name: 'CollaborationPresentationPort',
    members: ['getSettings', 'log', 'recordInteraction', 'recordTelemetry', 'setStatus'],
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
    name: 'LiveDatasetSink',
    members: ['appendRows', 'loadDataset'],
  },
  {
    file: 'LiveStreamCoordinator.ts',
    name: 'LiveStreamStatusSink',
    members: ['publish'],
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
      'saveSession',
      'setPortalsEnabled',
      'startTour',
      'uiManager',
      'undoAnalysis',
    ],
  },
  {
    file: 'WorldLandmarkController.ts',
    name: 'LandmarkTargets',
    members: ['core', 'datum', 'iceVault', 'portalA', 'portalB'],
  },
  {
    file: 'WorldLandmarkController.ts',
    name: 'LandmarkRegistryPort',
    members: ['registerInteractable', 'registerTooltipTarget'],
  },
  {
    file: 'WorldLandmarkController.ts',
    name: 'LandmarkApplicationPort',
    members: [
      'captureSession',
      'dispatchIntent',
      'openVault',
      'recordInteraction',
      'setStatisticalLensVisible',
    ],
  },
  {
    file: 'WorldLandmarkController.ts',
    name: 'LandmarkFeedbackPort',
    members: ['log', 'playCoreTone', 'playHaptic'],
  },
] as const;

const ownedContracts = [
  {
    file: 'CollaborationCoordinator.ts',
    names: [
      'CollaborationCoordinatorOptions',
      'CollaborationPresencePort',
      'CollaborationPresentationPort',
      'CollaborationStatus',
      'NetworkEvent',
      'NetworkManagerLike',
    ],
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
    names: [
      'LiveConnectorLike',
      'LiveDatasetSink',
      'LiveStreamCoordinatorOptions',
      'LiveStreamOptions',
      'LiveStreamStatusSink',
    ],
  },
  {
    file: 'WorldLandmarkController.ts',
    names: [
      'LandmarkApplicationPort',
      'LandmarkFeedbackPort',
      'LandmarkRegistryPort',
      'LandmarkTargets',
      'WorldLandmarkControllerOptions',
    ],
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
    file: 'WorldSessionController.ts',
    names: ['WorldSessionControllerOptions'],
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

  it('keeps runtime import and bridge typing inside the analytical runtime owner', () => {
    const worldSource = readFileSync(resolve(process.cwd(), 'src/vr/World.ts'), 'utf8');
    const ownerSource = readFileSync(
      resolve(process.cwd(), 'src/vr/runtime/AnalyticalRuntimeOwner.ts'),
      'utf8'
    );
    expect(source('types.ts')).not.toMatch(/\bWasmRuntimeBridge\b/);
    expect(worldSource).not.toMatch(/import\('\.\.\/wasm\/RuntimeBridge\.ts'\)/);
    expect(worldSource).not.toMatch(/\bWorkerAnalyticalPort\b|\bnew Worker\b/);
    expect(ownerSource).toMatch(
      /type AnalyticalRuntimeBridge = typeof import\('\.\.\/\.\.\/wasm\/RuntimeBridge\.ts'\)/
    );
  });

  it('types every coordinator entry point against its own host', () => {
    expect(source('AnalysisStoryExporter.ts')).toMatch(
      /buildAnalysisStory\(world: AnalysisStoryHost\)/
    );
    expect(source('CollaborationCoordinator.ts')).toMatch(
      /constructor\(\{ presence, presentation \}: CollaborationCoordinatorOptions\)/
    );
    expect(source('GuidedTourController.ts')).toMatch(/constructor\(world: GuidedTourHost\)/);
    expect(source('LiveStreamCoordinator.ts')).toMatch(
      /constructor\(\{ dataset, status \}: LiveStreamCoordinatorOptions\)/
    );
    expect(source('WorldLandmarkController.ts')).toMatch(
      /constructor\(\{ targets, registry, application, feedback \}: WorldLandmarkControllerOptions\)/
    );
    for (const file of [
      'CollaborationCoordinator.ts',
      'LiveStreamCoordinator.ts',
      'WorldLandmarkController.ts',
    ]) {
      expect(source(file), file).not.toMatch(/\b(?:Collaboration|LiveStream|WorldLandmark)Host\b/);
      expect(source(file), file).not.toMatch(/\b(?:this\.)?_world\b|\bthis\.world\b/);
    }
    expect(source('WorldSessionController.ts')).toMatch(
      /constructor\(options: WorldSessionControllerOptions\)/
    );
    expect(source('WorldSessionController.ts')).not.toMatch(/\bWorldSessionHost\b/);
    expect(source('WorldSessionController.ts')).not.toMatch(
      /_transformedDataset|_restoreDataset|_updateNarrativeStrip/
    );
    expect(source('WheelMenuBuilder.ts')).toMatch(
      /buildWheelMenuCategories\(world: WheelMenuHost\)/
    );
    expect(source('WheelMenuBuilder.ts')).toMatch(
      /buildIntentWheelMenuCategories\(world: WheelMenuHost\)/
    );
  });
});