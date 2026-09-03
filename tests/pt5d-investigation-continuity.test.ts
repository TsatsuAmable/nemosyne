import { describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  InvestigationContinuityController,
  type ContinuitySessionController,
} from '../src/app/investigation/InvestigationContinuityController.ts';
import type { ReplayVerificationResult } from '../src/session/InvestigationReplayRunner.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { NemosyneSession, type NemosyneSessionJSON } from '../src/session/NemosyneSession.ts';
import type { ArchiveEntry } from '../src/session/VaultArchiveStore.ts';

function makeSnapshot(sessionId: string, theme: string): NemosyneSessionJSON {
  const dataset = Dataset.fromJSON({
    name: `dataset-${sessionId}`,
    topology: 'TABULAR',
    columns: [{ name: 'value', type: 'float', values: [1, 2, 3] }],
  });
  const atlas = new AtlasCore({ sessionId });
  atlas.loadDataset(dataset);
  const session = new NemosyneSession({ atlas, sessionId });
  session.setResearchContext({ currentTask: `task-${sessionId}` });
  session.setPresentation({
    camera: { position: [1, 2, 3], rotationY: 0.5 },
    settings: { reducedMotion: true },
    tour: { stepIndex: 3, finished: false },
    theme,
    panelPositions: [{ panel: 'investigation', x: 1 }],
    entry: { name: dataset.name, topology: 'TABULAR' },
    focus: { currentLevel: 'dataset', focusedStructureId: null },
  });
  return session.serialize();
}

function replaySuccess(bytes: Uint8Array): ReplayVerificationResult {
  const payload = NemosynePackageManager.unpack(bytes);
  return {
    success: true,
    sessionId: payload.manifest.sessionId,
    datasetName: payload.manifest.datasetName,
    datasetFingerprint: payload.manifest.datasetFingerprint,
    commandsReplayed: 0,
    eventsMatched: payload.manifest.commandCount,
    provenanceEventsVerified: 0,
    representationProvenanceVerified: false,
    discoveryProvenanceVerified: payload.manifest.discoveryCount ?? 0,
    nilProvenanceVerified: payload.manifest.nilOutcomeCount ?? 0,
    remediationEventsVerified: 0,
    refusalEventsVerified: 0,
    finalOutputHash: payload.manifest.datasetFingerprint,
    investigationDigest: payload.manifest.investigationDigest ?? '',
    evidenceCount: { observations: 0, findings: 0, annotations: 0 },
    discrepancies: [],
  };
}

function fixture(initial = makeSnapshot('session-a', 'theme-a')): {
  controller: InvestigationContinuityController;
  sessions: ContinuitySessionController;
  current(): NemosyneSessionJSON;
  setCurrent(snapshot: NemosyneSessionJSON): void;
  archives: ArchiveEntry[];
  restoreSnapshot: ReturnType<typeof vi.fn>;
  saveSessionChecked: ReturnType<typeof vi.fn>;
} {
  let current = structuredClone(initial);
  const archives: ArchiveEntry[] = [];
  const archiveSnapshots = new Map<string, NemosyneSessionJSON>();
  const saveSessionChecked = vi.fn(async () => true);
  const restoreSnapshot = vi.fn(async (snapshot: NemosyneSessionJSON) => {
    current = structuredClone(snapshot);
    return true;
  });
  const sessions: ContinuitySessionController = {
    snapshotCurrentSession: () => structuredClone(current) as unknown as Record<string, unknown>,
    saveSession: vi.fn(async () => {}),
    saveSessionChecked,
    hasSession: vi.fn(async () => true),
    restoreSnapshot,
    restoreAutoSave: vi.fn(async () => true),
    archiveStore: {
      freezeInvestigation: vi.fn(async (label, snapshot, metadata) => {
        const archiveId = `archive:${archives.length + 1}`;
        archiveSnapshots.set(archiveId, structuredClone(snapshot) as unknown as NemosyneSessionJSON);
        archives.push({ archiveId, label, frozenAt: 100 + archives.length, ...metadata });
        return archiveId;
      }),
      listArchives: vi.fn(async () => structuredClone(archives)),
      loadArchive: vi.fn(async (archiveId) => {
        const value = archiveSnapshots.get(archiveId);
        return value ? structuredClone(value) as unknown as Record<string, unknown> : null;
      }),
      deleteArchive: vi.fn(async (archiveId) => {
        archiveSnapshots.delete(archiveId);
        const index = archives.findIndex((entry) => entry.archiveId === archiveId);
        if (index >= 0) archives.splice(index, 1);
      }),
    },
  };
  return {
    controller: new InvestigationContinuityController({
      sessionController: sessions,
      verifyPortableInvestigation: async (bytes) => replaySuccess(bytes),
      environment: () => ({ platform: 'test', webxrSupported: true }),
    }),
    sessions,
    current: () => current,
    setCurrent: (snapshot) => { current = structuredClone(snapshot); },
    archives,
    restoreSnapshot,
    saveSessionChecked,
  };
}

describe('PT5D investigation continuity', () => {
  it('exports a resumable package and reopens the exact investigation while retaining recipient device settings', async () => {
    const source = makeSnapshot('session-source', 'neon-source');
    source.presentation.settings = { reducedMotion: true, productAnalytics: true };
    const target = makeSnapshot('session-other', 'neon-other');
    target.presentation.settings = { reducedMotion: false, productAnalytics: false };
    const f = fixture(source);

    const bytes = await f.controller.exportCurrent();
    const unpacked = NemosynePackageManager.unpack(bytes);
    const embedded = unpacked.extraFiles?.['continuity/session-v2.json'];
    expect(embedded).toBeInstanceOf(Uint8Array);
    expect((JSON.parse(strFromU8(embedded!)) as NemosyneSessionJSON).presentation).toMatchObject({
      theme: 'neon-source',
      settings: { reducedMotion: true, productAnalytics: true },
    });

    f.setCurrent(target);
    const opened = await f.controller.openPortable(bytes);

    expect(opened.reopened).toBe(true);
    expect(opened.resumable).toBe(true);
    expect(f.current().sessionId).toBe('session-source');
    expect(f.current().presentation).toMatchObject({
      theme: 'neon-source',
      camera: { position: [1, 2, 3], rotationY: 0.5 },
      settings: { reducedMotion: false, productAnalytics: false },
    });
    expect(f.restoreSnapshot).toHaveBeenCalledTimes(1);
  });

  it('refuses a tampered embedded session snapshot even when the package replay verifier reports success', async () => {
    const source = makeSnapshot('session-source', 'theme-source');
    const current = makeSnapshot('session-current', 'theme-current');
    const f = fixture(source);
    const bytes = await f.controller.exportCurrent();
    const payload = NemosynePackageManager.unpack(bytes);
    const embedded = payload.extraFiles?.['continuity/session-v2.json'];
    expect(embedded).toBeTruthy();
    const tampered = JSON.parse(strFromU8(embedded!)) as NemosyneSessionJSON;
    tampered.researchContext = { ...tampered.researchContext, currentTask: 'silently changed' };
    payload.extraFiles = {
      ...(payload.extraFiles ?? {}),
      'continuity/session-v2.json': strToU8(JSON.stringify(tampered)),
    };
    const tamperedBytes = NemosynePackageManager.pack(payload);
    f.setCurrent(current);

    await expect(f.controller.openPortable(tamperedBytes)).rejects.toThrow(/research context|digest/i);
    expect(f.current().sessionId).toBe('session-current');
    expect(f.restoreSnapshot).not.toHaveBeenCalled();
  });

  it('keeps older verification-only packages readable without falsely claiming they were reopened', async () => {
    const source = makeSnapshot('legacy-session', 'legacy-theme');
    const current = makeSnapshot('current-session', 'current-theme');
    const f = fixture(source);
    const legacyBytes = await NemosyneSession.exportPortableSnapshot(source, { platform: 'legacy-test' });
    f.setCurrent(current);

    const result = await f.controller.openPortable(legacyBytes);

    expect(result.verification.success).toBe(true);
    expect(result.resumable).toBe(false);
    expect(result.reopened).toBe(false);
    expect(result.message).toMatch(/older package|does not contain resumable/i);
    expect(f.current().sessionId).toBe('current-session');
    expect(f.restoreSnapshot).not.toHaveBeenCalled();
  });

  it('rolls back to the previous live investigation when checkpoint restore fails after mutation begins', async () => {
    const previous = makeSnapshot('previous-session', 'previous-theme');
    const checkpoint = makeSnapshot('checkpoint-session', 'checkpoint-theme');
    const f = fixture(checkpoint);
    await f.controller.createCheckpoint('Before risky change');
    f.setCurrent(previous);

    f.restoreSnapshot.mockImplementationOnce(async (snapshot: NemosyneSessionJSON) => {
      f.setCurrent(snapshot);
      return false;
    }).mockImplementationOnce(async (snapshot: NemosyneSessionJSON) => {
      f.setCurrent(snapshot);
      return true;
    });

    await expect(f.controller.restoreLatestCheckpoint()).rejects.toThrow(/could not be restored/i);
    expect(f.restoreSnapshot).toHaveBeenCalledTimes(2);
    expect(f.current().sessionId).toBe('previous-session');
    expect(f.current().presentation.theme).toBe('previous-theme');
  });

  it('uses checked local save and creates checkpoints from a fresh presentation snapshot', async () => {
    const source = makeSnapshot('checkpoint-source', 'fresh-presentation');
    const f = fixture(source);

    await f.controller.saveNow();
    const checkpoint = await f.controller.createCheckpoint('Research milestone');

    expect(f.saveSessionChecked).toHaveBeenCalledWith('manual');
    expect(checkpoint.label).toBe('Research milestone');
    expect(checkpoint.datasetName).toBe('dataset-checkpoint-source');
    expect(checkpoint.investigationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(checkpoint.eventCount).toBe(source.eventLedger.length);
  });

  it('restores, exports and deletes the selected immutable checkpoint rather than substituting live state', async () => {
    const first = makeSnapshot('checkpoint-first', 'theme-first');
    const second = makeSnapshot('checkpoint-second', 'theme-second');
    const live = makeSnapshot('live-after-checkpoints', 'theme-live');
    const f = fixture(first);
    const firstEntry = await f.controller.createCheckpoint('First checkpoint');
    f.setCurrent(second);
    const secondEntry = await f.controller.createCheckpoint('Second checkpoint');
    f.setCurrent(live);

    await f.controller.restoreCheckpoint(firstEntry.archiveId);
    expect(f.current().sessionId).toBe('checkpoint-first');

    f.setCurrent(live);
    const secondBytes = await f.controller.exportCheckpoint(secondEntry.archiveId);
    const secondPayload = NemosynePackageManager.unpack(secondBytes);
    const secondEmbedded = secondPayload.extraFiles?.['continuity/session-v2.json'];
    expect(secondEmbedded).toBeTruthy();
    expect((JSON.parse(strFromU8(secondEmbedded!)) as NemosyneSessionJSON).sessionId).toBe('checkpoint-second');
    expect(f.current().sessionId).toBe('live-after-checkpoints');

    await f.controller.deleteCheckpoint(firstEntry.archiveId);
    expect((await f.controller.summary()).checkpointCount).toBe(1);
    await expect(f.controller.restoreCheckpoint(firstEntry.archiveId)).rejects.toThrow(/no longer listed/i);
  });
});
