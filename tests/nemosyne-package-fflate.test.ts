import { describe, it, expect } from 'vitest';
import { Zip, ZipPassThrough } from 'fflate';
import {
  NemosynePackageManager,
  sanitizeEntryPath,
  type NemosynePackageManifest,
} from '../src/session/NemosynePackage.ts';

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

  const datasetBytes = new TextEncoder().encode(
    'sepal_length,sepal_width,species\n5.1,3.5,setosa\n4.9,3.0,setosa'
  );
  const commandLogBytes = new TextEncoder().encode(
    JSON.stringify([
      { op: 'load', version: 1 },
      { op: 'filter', threshold: 5.0 },
    ])
  );

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

  it('rejects path traversal attacks including deeply percent-encoded variations', () => {
    expect(() => sanitizeEntryPath('../evil.txt')).toThrow();
    expect(() => sanitizeEntryPath('foo/../../bar')).toThrow();
    expect(() => sanitizeEntryPath('%2e%2e%2fevil.txt')).toThrow();
    expect(() => sanitizeEntryPath('%2e%2e/test')).toThrow();
    expect(() => sanitizeEntryPath('%252e%252e%252fevil.txt')).toThrow();
    // Four decode layers: the previous three-pass implementation left these
    // path metacharacters encoded and therefore failed to detect traversal.
    expect(() => sanitizeEntryPath('%2525252e%2525252e%2525252fevil.txt')).toThrow();
    expect(() => sanitizeEntryPath('%2525252fetc%2525252fpasswd')).toThrow();
    expect(() => sanitizeEntryPath('C%2525253a%2525255cWindows')).toThrow();
    expect(() => sanitizeEntryPath('/etc/passwd')).toThrow();
    expect(() => sanitizeEntryPath('C:\\Windows\\System32')).toThrow();
    expect(() => sanitizeEntryPath('evil\0.txt')).toThrow();
  });

  it('canonicalizes deeply encoded safe path metacharacters consistently', () => {
    expect(sanitizeEntryPath('notes%2525252etxt')).toBe('notes.txt');
    expect(sanitizeEntryPath('folder%2525252fnotes.txt')).toBe('folder/notes.txt');
  });

  it('rejects an invalid archive missing manifest.json', () => {
    const invalidZip = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]); // empty zip
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

  it('enforces the single-entry budget while inflating compressed data', () => {
    const archiveBytes = NemosynePackageManager.pack({
      manifest: validManifest,
      datasetBytes: new Uint8Array(4096).fill(65),
      commandLogBytes,
    });

    expect(() => NemosynePackageManager.unpack(archiveBytes, { singleEntryBytes: 1024 })).toThrow(
      /data\/dataset\.raw.*4096 > 1024/
    );
  });

  it('enforces the archive entry-count budget during streaming extraction', () => {
    const archiveBytes = NemosynePackageManager.pack({
      manifest: validManifest,
      datasetBytes,
      commandLogBytes,
    });

    expect(() => NemosynePackageManager.unpack(archiveBytes, { entryCount: 2 })).toThrow(
      /too many files \(3 > 2\)/
    );
  });

  it('rejects duplicate normalized entry paths instead of accepting a shadowed payload', () => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((error, chunk) => {
      if (error) throw error;
      chunks.push(chunk);
    });
    for (const contents of ['first', 'shadow']) {
      const file = new ZipPassThrough('manifest.json');
      zip.add(file);
      file.push(new TextEncoder().encode(contents), true);
    }
    zip.end();

    const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const archiveBytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      archiveBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    expect(() => NemosynePackageManager.unpack(archiveBytes)).toThrow(
      /duplicate file entry "manifest\.json"/
    );
  });
});
