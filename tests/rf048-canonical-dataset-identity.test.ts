import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  CANONICAL_DATASET_IDENTITY_ALGORITHM,
  canonicalDatasetIdentityHex,
} from '../src/data/DatasetIdentity.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import {
  NemosynePackageManager,
  type NemosynePackageManifest,
} from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function makeDataset(values: number[] = [10, 20]): Dataset {
  return new Dataset(
    'same-name-and-shape',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    values.map((value) => ({ value })),
  );
}

describe('RF-048 canonical scientific dataset identity', () => {
  it('distinguishes datasets with the same name and shape but different scientific content', () => {
    const first = makeDataset([10, 20]);
    const second = makeDataset([11, 20]);

    expect(first.seedHash).toBe(second.seedHash);
    expect(first.fingerprint).toBe(canonicalDatasetIdentityHex(first.toJSON()));
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it('excludes durable row lineage metadata from scientific identity', () => {
    const dataset = makeDataset();
    const before = canonicalDatasetIdentityHex(dataset.toJSON());

    expect(dataset.adoptRowIds(['rust-row-a', 'rust-row-b'])).toBe(true);

    expect(canonicalDatasetIdentityHex(dataset.toJSON())).toBe(before);
    expect(dataset.fingerprint).toBe(before);
  });

  it('matches Rust row semantics by projecting declared columns, nulling missing values, and ignoring undeclared row keys', () => {
    const canonical = {
      name: 'projection-parity',
      columns: [
        { name: 'x', type: 'NUMERIC' as const },
        { name: 'y', type: 'NUMERIC' as const },
      ],
      rows: [{ x: 1, y: null }],
    };
    const irregular = {
      name: 'projection-parity',
      columns: canonical.columns,
      rows: [{ x: 1, ignoredPresentationValue: 999 }],
    };

    expect(canonicalDatasetIdentityHex(irregular)).toBe(
      canonicalDatasetIdentityHex(canonical),
    );
  });

  it('includes graph topology, edge attributes, and endpoint JSON type in scientific identity', () => {
    const numericEndpoints = makeDataset();
    numericEndpoints.edges = [
      { source: 0, target: 1, weight: 0.5, relation: { kind: 'supports', score: 2 } },
    ];
    const stringEndpoints = makeDataset();
    stringEndpoints.edges = [
      { source: '0', target: '1', weight: 0.5, relation: { kind: 'supports', score: 2 } },
    ];
    const changedAttribute = numericEndpoints.clone();
    changedAttribute.edges![0].relation = { kind: 'contradicts', score: 2 };

    const numeric = canonicalDatasetIdentityHex(numericEndpoints.toJSON());
    expect(canonicalDatasetIdentityHex(stringEndpoints.toJSON())).not.toBe(numeric);
    expect(canonicalDatasetIdentityHex(changedAttribute.toJSON())).not.toBe(numeric);
  });

  it('exports format-v2 packages with the canonical identity of the packaged original dataset', async () => {
    const dataset = makeDataset();
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
    atlas.loadDataset(dataset);
    const session = new NemosyneSession({ atlas });

    const payload = NemosynePackageManager.unpack(await session.exportPortablePackage());

    expect(payload.manifest.formatVersion).toBe(2);
    expect(payload.manifest.datasetIdentityAlgorithm).toBe(
      CANONICAL_DATASET_IDENTITY_ALGORITHM,
    );
    expect(payload.manifest.datasetFingerprint).toBe(
      canonicalDatasetIdentityHex(dataset.toJSON()),
    );
    expect(payload.manifest.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.manifest.datasetFingerprint).not.toBe(String(dataset.seedHash));
  });

  it('detects same-shape package data tampering under the format-v2 identity contract', async () => {
    const original = makeDataset([10, 20]);
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
    atlas.loadDataset(original);
    const session = new NemosyneSession({ atlas });
    const payload = NemosynePackageManager.unpack(await session.exportPortablePackage());

    payload.datasetBytes = strToU8(JSON.stringify(makeDataset([99, 20]).toJSON()));
    const tamperedArchive = NemosynePackageManager.pack(payload);
    const result = await new InvestigationReplayRunner(
      makeKernelMockBridge() as never,
    ).replayArchive(tamperedArchive);

    expect(result.success).toBe(false);
    expect(result.discrepancies.join('\n')).toMatch(/dataset fingerprint mismatch/i);
  });

  it('still verifies legacy format-v1 packages with their historical seed identity and digest input', async () => {
    const dataset = makeDataset();
    const bridge = makeKernelMockBridge() as never;
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset);
    const state = atlas.toState();
    const legacyDigest = await atlas.aggregate.computeDigest(
      atlas.kernelVersion() ?? 'unknown',
      { legacyImmutableDatasetSeedHash: true },
    );
    const manifest: NemosynePackageManifest = {
      formatVersion: 1,
      sessionId: atlas.sessionId,
      datasetFingerprint: String(dataset.seedHash),
      datasetIdentityAlgorithm: undefined,
      analyticalDatasetFingerprint: undefined,
      datasetName: dataset.name,
      kernelVersion: atlas.kernelVersion() ?? 'unknown',
      analyticalKernelVersion: undefined,
      createdAt: 1,
      commandCount: state.eventLedger.length,
      discoveryCount: 0,
      nilOutcomeCount: 0,
      investigationDigest: legacyDigest,
      representationModel: undefined,
      evidenceSummary: {
        observationsCount: 0,
        findingsCount: 0,
        annotationsCount: 0,
      },
      environment: {
        userAgent: undefined,
        platform: undefined,
        webxrSupported: undefined,
      },
    };
    const archive = NemosynePackageManager.pack({
      manifest,
      datasetBytes: strToU8(JSON.stringify(state.originalDataset)),
      commandLogBytes: strToU8(JSON.stringify(state.eventLedger)),
    });

    const result = await new InvestigationReplayRunner(
      makeKernelMockBridge() as never,
    ).replayArchive(archive);

    expect(result.success).toBe(true);
    expect(result.discrepancies).toEqual([]);
  });
});
