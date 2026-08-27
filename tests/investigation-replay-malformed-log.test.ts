import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('RF-047 replay parser boundary', () => {
  it('fails closed on a null semantic-v2 command-log entry instead of throwing', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), sessionId: 'rf047-null-log' });
    atlas.loadDataset(Dataset.fromJSON({
      name: 'RF047 malformed log',
      columns: [{ name: 'x', type: 'number' }],
      rows: [{ x: 1 }],
    }));

    const session = new NemosyneSession({ atlas, sessionId: atlas.sessionId });
    const payload = NemosynePackageManager.unpack(await session.exportPortablePackage());
    payload.commandLogBytes = strToU8(JSON.stringify([null]));
    payload.manifest.commandCount = 1;

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(payload);

    expect(replay.success).toBe(false);
    expect(replay.commandsReplayed).toBe(0);
    expect(replay.discrepancies).toContain(
      'Semantic-v2 command log entry #0 is missing a research-event kind',
    );
  });

  it('fails closed on a null legacy command-log entry instead of throwing', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), sessionId: 'rf047-null-legacy-log' });
    const dataset = Dataset.fromJSON({
      name: 'RF047 malformed legacy log',
      columns: [{ name: 'x', type: 'number' }],
      rows: [{ x: 1 }],
    });
    atlas.loadDataset(dataset);

    const payload = {
      manifest: {
        formatVersion: 1,
        sessionId: atlas.sessionId,
        datasetFingerprint: String(dataset.seedHash),
        datasetName: dataset.name,
        kernelVersion: atlas.kernelVersion() ?? 'unknown',
        createdAt: Date.now(),
        commandCount: 1,
        environment: {},
      },
      datasetBytes: strToU8(JSON.stringify(dataset.toJSON())),
      commandLogBytes: strToU8(JSON.stringify([null])),
    };

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(payload);

    expect(replay.success).toBe(false);
    expect(replay.commandsReplayed).toBe(0);
    expect(replay.discrepancies).toContain('Legacy command log entry #0 must be an object');
  });
});
