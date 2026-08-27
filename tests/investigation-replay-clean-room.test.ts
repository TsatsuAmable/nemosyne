import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import type { AnalysisSpec, VRCommand } from '../src/atlas/types.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

const DATASET = Dataset.fromJSON({
  name: 'RF047',
  columns: [{ name: 'x', type: 'number' }],
  rows: [{ x: 1 }, { x: 2 }, { x: 3 }],
});

function makeAtlas(sessionId: string): AtlasCore {
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), sessionId });
  atlas.loadDataset(DATASET.clone());
  return atlas;
}

function filterSpec(atlas: AtlasCore, min: number): AnalysisSpec {
  return {
    datasetFingerprint: atlas.datasetFingerprint ?? '',
    datasetVersion: atlas.datasetVersion,
    operation: { op: 'filter', column: 'x', min },
    algorithmVersion: atlas.kernelVersion() ?? 'unknown',
    label: `filter-x-${min}`,
  };
}

async function exportAndReplay(atlas: AtlasCore): Promise<Awaited<ReturnType<InvestigationReplayRunner['replayArchive']>>> {
  const session = new NemosyneSession({ atlas, sessionId: atlas.sessionId });
  const archive = await session.exportPortablePackage({ userAgent: 'rf047-clean-room-test' });
  const runner = new InvestigationReplayRunner(makeKernelMockBridge());
  return runner.replayArchive(archive);
}

describe('RF-047 clean-room portable replay contract', () => {
  it('does not let non-durable previews perturb durable analysis result identity', async () => {
    const atlas = makeAtlas('rf047-preview');

    atlas.previewAnalysis(filterSpec(atlas, 1));
    const committed = atlas.applyAnalysis(filterSpec(atlas, 2));

    expect(committed.resultId.endsWith(':1')).toBe(true);

    const replay = await exportAndReplay(atlas);
    expect(replay.success, replay.discrepancies.join('\n')).toBe(true);
    expect(replay.investigationDigest).not.toBe('');
  });

  it('restores non-mutating intervention events without executing them as analyses', async () => {
    const atlas = makeAtlas('rf047-intervention');
    atlas.recordIntervention('Investigator rejected the apparent cluster as a projection artefact.');

    const replay = await exportAndReplay(atlas);

    expect(replay.success, replay.discrepancies.join('\n')).toBe(true);
    expect(replay.commandsReplayed).toBe(0);
    expect(replay.eventsMatched).toBe(atlas.ledger.length);
  });

  it('preserves durable event-level attribution instead of regenerating a lossy event', async () => {
    const atlas = makeAtlas('rf047-attribution');
    const command: VRCommand = {
      action: 'inspect-cluster',
      targetIds: ['cluster:1'],
      embodiment: 'focus-highlight',
    };
    const fingerprint = atlas.datasetFingerprint ?? '';

    atlas.evidenceLedger.appendEvent(
      {
        timestamp: 1_787_826_400_000,
        kind: 'embodiment',
        actor: 'investigator:alice',
        role: 'owner',
        deviation: 'manual semantic focus',
        command: { op: 'embodiment' },
        embodimentCommand: command,
        datasetVersion: atlas.datasetVersion,
        datasetFingerprint: fingerprint,
        stateHash: fingerprint,
      },
      atlas.sessionId,
    );

    const replay = await exportAndReplay(atlas);

    expect(replay.success, replay.discrepancies.join('\n')).toBe(true);
    expect(replay.eventsMatched).toBe(atlas.ledger.length);
  });

  it('reconstructs remediation and refusal records as non-mutating durable provenance', async () => {
    const atlas = makeAtlas('rf047-non-mutating');
    const fingerprint = atlas.datasetFingerprint ?? '';

    atlas.aggregate.recordRemediation({
      remediationId: 'remediation:1',
      kind: 'adjust-hardware-limit',
      constraintCode: 'hardware-element-budget',
      category: 'hardware',
      scientificPermissibility: 'permissible',
      deviceFeasibility: 'unverified',
      datasetFingerprint: fingerprint,
      oldRequirementsHash: 'requirements:old',
      newRequirementsHash: 'requirements:new',
      resultingDecisionId: 'decision:2',
      timestamp: 1_787_826_400_100,
    });

    atlas.evidenceLedger.recordRefusal(
      {
        operation: 'persistence',
        parameters: { maxDimension: 3 },
        inputFingerprint: fingerprint,
        provenance: {
          kernel: 'nemosyne-wasm',
          kernelVersion: atlas.kernelVersion() ?? 'unknown',
          operation: 'persistence',
          parameters: { maxDimension: 3 },
          inputFingerprint: fingerprint,
          outputFingerprint: '',
          timestamp: 1_787_826_400_200,
          outcome: 'refused',
        },
        preflight: {
          operation: 'persistence',
          allowed: false,
          estimatedWork: 10_000,
          limit: 1_000,
          reason: 'rf047 test refusal',
        },
        timestamp: 1_787_826_400_200,
        datasetFingerprint: fingerprint,
        datasetVersion: atlas.datasetVersion,
      },
      atlas.sessionId,
      atlas.datasetVersion,
      fingerprint,
    );

    const replay = await exportAndReplay(atlas);

    expect(replay.success, replay.discrepancies.join('\n')).toBe(true);
    expect(replay.commandsReplayed).toBe(0);
    expect(replay.eventsMatched).toBe(atlas.ledger.length);
  });
});
