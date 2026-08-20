import { describe, it, expect } from 'vitest';
import { NemosynePackageManager, sanitizeEntryPath, type NemosynePackageManifest } from '../src/session/NemosynePackage.ts';

describe('Nemosyne Portable Package Engine (fflate + valibot)', () => {
  const validManifest: NemosynePackageManifest = {
    formatVersion: 1,
    sessionId: 'session-pkg-01',
    datasetFingerprint: 'fp-abcdef123456',
    datasetName: 'iris_flowers',
    kernelVersion: '0.2.0',
    createdAt: 1724000000,
    commandCount: 5,
    environment: {
      platform: 'MacIntel',
      webxrSupported: true,
    },
  };

  const datasetBytes = new TextEncoder().encode('sepal_length,sepal_width,species\n5.1,3.5,setosa\n4.9,3.0,setosa');
  const commandLogBytes = new TextEncoder().encode(JSON.stringify([{ op: 'load', version: 1 }, { op: 'filter', threshold: 5.0 }]));

  it('packs and unpacks a .nemosyne archive with full fidelity', () => {
    const archiveBytes = NemosynePackageManager.pack({
      manifest: validManifest,
      datasetBytes,
      commandLogBytes,
      extraFiles: {
        'notes.txt': new TextEncoder().encode('Special investigation notes'),
      },
    });

    expect(archiveBytes).toBeInstanceOf(Uint8Array);
    expect(archiveBytes.length).toBeGreaterThan(50);

    const unpacked = NemosynePackageManager.unpack(archiveBytes);

    expect(unpacked.manifest.sessionId).toBe('session-pkg-01');
    expect(unpacked.manifest.datasetFingerprint).toBe('fp-abcdef123456');
    expect(unpacked.manifest.commandCount).toBe(5);

    const unpackedDatasetText = new TextDecoder().decode(unpacked.datasetBytes);
    expect(unpackedDatasetText).toContain('sepal_length,sepal_width,species');

    const unpackedLogText = new TextDecoder().decode(unpacked.commandLogBytes);
    expect(unpackedLogText).toContain('threshold');

    expect(unpacked.extraFiles).toBeDefined();
    const unpackedNotes = new TextDecoder().decode(unpacked.extraFiles!['notes.txt']);
    expect(unpackedNotes).toBe('Special investigation notes');
  });

  it('rejects path traversal attacks including percent-encoded variations', () => {
    expect(() => sanitizeEntryPath('../evil.txt')).toThrow();
    expect(() => sanitizeEntryPath('foo/../../bar')).toThrow();
    expect(() => sanitizeEntryPath('%2e%2e%2fevil.txt')).toThrow();
    expect(() => sanitizeEntryPath('%2e%2e/test')).toThrow();
    expect(() => sanitizeEntryPath('/etc/passwd')).toThrow();
    expect(() => sanitizeEntryPath('C:\\Windows\\System32')).toThrow();
    expect(() => sanitizeEntryPath('evil\0.txt')).toThrow();
  });

  it('rejects an invalid archive missing manifest.json', () => {
    const invalidZip = new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // empty zip
    expect(() => NemosynePackageManager.unpack(invalidZip)).toThrow();
  });

  it('rejects an archive with a schema-invalid manifest using valibot', () => {
    const invalidManifest = {
      ...validManifest,
      formatVersion: 'NOT_A_NUMBER' as unknown as number,
    };

    expect(() =>
      NemosynePackageManager.pack({
        manifest: invalidManifest,
        datasetBytes,
        commandLogBytes,
      })
    ).toThrow();
  });
});
