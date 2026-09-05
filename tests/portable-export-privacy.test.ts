import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function makeSession(): NemosyneSession {
  const dataset = new Dataset(
    'privacy-export',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 1 }],
  );
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
  atlas.loadDataset(dataset);
  return new NemosyneSession({ atlas });
}

describe('portable investigation environment privacy', () => {
  it('omits user-agent and platform identity from ordinary product exports', async () => {
    const session = makeSession();
    const archive = await session.exportPortablePackage({
      userAgent: 'Highly identifying browser build',
      platform: 'Rare hardware platform',
      webxrSupported: true,
    });

    const payload = NemosynePackageManager.unpack(archive);
    expect(payload.manifest.environment).toEqual({
      userAgent: null,
      platform: null,
      webxrSupported: true,
    });
  });

  it('allows browser identity only behind an explicit study/diagnostic opt-in', async () => {
    const session = makeSession();
    const archive = await session.exportPortablePackage({
      userAgent: 'Study browser identity',
      platform: 'Study platform identity',
      webxrSupported: true,
      includePrivacySensitiveBrowserIdentity: true,
    });

    const payload = NemosynePackageManager.unpack(archive);
    expect(payload.manifest.environment).toEqual({
      userAgent: 'Study browser identity',
      platform: 'Study platform identity',
      webxrSupported: true,
    });
    expect('includePrivacySensitiveBrowserIdentity' in payload.manifest.environment).toBe(false);
  });
});
