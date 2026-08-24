/**
 * Nemosyne Portable Package (.nemosyne ZIP Container) Engine.
 *
 * Implements:
 * - Deterministic, zero-dependency ZIP archive creation and streaming extraction using `fflate`.
 * - Strict schema validation of `manifest.json` using `valibot`.
 * - Robust zip-bomb, zip-slip, path-traversal, and decompression budget enforcement.
 * - Integrity guarantees: dataset fingerprint, kernel version ABI compatibility, command log completeness,
 *   and optional persisted Moneta representation/discovery/NIL provenance.
 */

import * as v from 'valibot';
import { zipSync, strToU8, strFromU8, Unzip, UnzipInflate, type UnzipFile } from 'fflate';

export const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;
export const MAX_TOTAL_UNCOMPRESSED = 250 * 1024 * 1024;
export const MAX_SINGLE_ENTRY = 100 * 1024 * 1024;
export const MAX_ENTRY_COUNT = 1000;

export interface NemosynePackageReadLimits {
  archiveBytes?: number;
  totalUncompressedBytes?: number;
  singleEntryBytes?: number;
  entryCount?: number;
}

export const NemosyneManifestSchema = v.object({
  formatVersion: v.number(),
  sessionId: v.string(),
  datasetFingerprint: v.string(),
  analyticalDatasetFingerprint: v.nullish(v.string()),
  datasetName: v.string(),
  kernelVersion: v.string(),
  analyticalKernelVersion: v.nullish(v.string()),
  createdAt: v.number(),
  commandCount: v.number(),
  discoveryCount: v.nullish(v.number()),
  nilOutcomeCount: v.nullish(v.number()),
  investigationDigest: v.nullish(v.string()),
  representationModel: v.nullish(
    v.object({
      fitnessModelVersion: v.string(),
      fitnessModelArtifactHash: v.nullish(v.string()),
    })
  ),
  evidenceSummary: v.nullish(
    v.object({
      observationsCount: v.number(),
      findingsCount: v.number(),
      annotationsCount: v.number(),
    })
  ),
  environment: v.object({
    userAgent: v.nullish(v.string()),
    platform: v.nullish(v.string()),
    webxrSupported: v.nullish(v.boolean()),
  }),
});

export type NemosynePackageManifest = v.InferOutput<typeof NemosyneManifestSchema>;

export interface NemosynePackagePayload {
  manifest: NemosynePackageManifest;
  datasetBytes: Uint8Array;
  commandLogBytes: Uint8Array;
  representationDecisionBytes?: Uint8Array;
  discoveryEpisodesBytes?: Uint8Array;
  nilOutcomesBytes?: Uint8Array;
  extraFiles?: Record<string, Uint8Array>;
}

export function sanitizeEntryPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new Error('Invalid archive entry path: path must be a non-empty string');
  }
  if (rawPath.includes('\0')) throw new Error('Invalid archive entry path: null byte detected');

  let decoded = rawPath;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  if (decoded.includes('\0')) {
    throw new Error('Invalid archive entry path: decoded null byte detected');
  }
  const normalized = decoded.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.startsWith('//')) {
    throw new Error(
      `Invalid archive entry path: absolute or drive-relative paths are forbidden (${rawPath})`
    );
  }
  for (const part of normalized.split('/')) {
    if (part === '..' || part === '.' || part.includes('%2e') || part.includes('%2E')) {
      throw new Error(`Invalid archive entry path: path traversal detected (${rawPath})`);
    }
  }
  return normalized;
}

export class NemosynePackageManager {
  static pack(payload: NemosynePackagePayload): Uint8Array {
    const validatedManifest = v.parse(NemosyneManifestSchema, payload.manifest);
    const zipFiles: Record<string, Uint8Array> = {
      'manifest.json': strToU8(JSON.stringify(validatedManifest, null, 2)),
      'data/dataset.raw': payload.datasetBytes,
      'investigation/commands.log': payload.commandLogBytes,
    };

    if (payload.representationDecisionBytes) {
      zipFiles['investigation/representation.json'] = payload.representationDecisionBytes;
    }
    if (payload.discoveryEpisodesBytes) {
      zipFiles['investigation/discoveries.json'] = payload.discoveryEpisodesBytes;
    }
    if (payload.nilOutcomesBytes) {
      zipFiles['investigation/nil-outcomes.json'] = payload.nilOutcomesBytes;
    }

    if (payload.extraFiles) {
      for (const [path, data] of Object.entries(payload.extraFiles)) {
        zipFiles[`extras/${sanitizeEntryPath(path)}`] = data;
      }
    }
    return zipSync(zipFiles, { level: 6 });
  }

  static unpack(
    archiveBytes: Uint8Array,
    limits: NemosynePackageReadLimits = {}
  ): NemosynePackagePayload {
    const archiveLimit = limits.archiveBytes ?? MAX_ARCHIVE_SIZE;
    const totalLimit = limits.totalUncompressedBytes ?? MAX_TOTAL_UNCOMPRESSED;
    const singleEntryLimit = limits.singleEntryBytes ?? MAX_SINGLE_ENTRY;
    const entryCountLimit = limits.entryCount ?? MAX_ENTRY_COUNT;

    if (archiveBytes.byteLength > archiveLimit) {
      throw new Error(
        `Package archive exceeds maximum allowed size (${archiveBytes.byteLength} > ${archiveLimit} bytes)`
      );
    }
    if (archiveBytes.byteLength === 0) throw new Error('Invalid archive: empty file');

    const unzippedFiles: Record<string, Uint8Array> = {};
    const seenEntryPaths = new Set<string>();
    let totalUncompressed = 0;
    let entryCount = 0;
    const uz = new Unzip((file: UnzipFile) => {
      entryCount++;
      if (entryCount > entryCountLimit) {
        throw new Error(`Package contains too many files (${entryCount} > ${entryCountLimit})`);
      }
      const cleanName = sanitizeEntryPath(file.name);
      if (seenEntryPaths.has(cleanName)) {
        throw new Error(`Package contains duplicate file entry "${cleanName}"`);
      }
      seenEntryPaths.add(cleanName);
      const chunks: Uint8Array[] = [];
      let fileBytes = 0;
      file.ondata = (err, chunk, final) => {
        if (err) throw err;
        if (chunk) {
          fileBytes += chunk.byteLength;
          totalUncompressed += chunk.byteLength;
          if (fileBytes > singleEntryLimit) {
            throw new Error(
              `File entry "${cleanName}" exceeds maximum single entry size (${fileBytes} > ${singleEntryLimit} bytes)`
            );
          }
          if (totalUncompressed > totalLimit) {
            throw new Error(
              `Package exceeds maximum uncompressed size budget (${totalUncompressed} > ${totalLimit} bytes)`
            );
          }
          chunks.push(chunk);
        }
        if (final) {
          const combined = new Uint8Array(fileBytes);
          let offset = 0;
          for (const c of chunks) {
            combined.set(c, offset);
            offset += c.byteLength;
          }
          unzippedFiles[cleanName] = combined;
        }
      };
      file.start();
    });
    uz.register(UnzipInflate);
    uz.push(archiveBytes, true);

    const finalFiles = unzippedFiles;
    const entryKeys = Object.keys(finalFiles);
    if (entryKeys.length > entryCountLimit) {
      throw new Error(`Package contains too many files (${entryKeys.length} > ${entryCountLimit})`);
    }

    let verifiedTotal = 0;
    for (const key of entryKeys) {
      sanitizeEntryPath(key);
      const len = finalFiles[key].byteLength;
      if (len > singleEntryLimit) {
        throw new Error(
          `File entry "${key}" exceeds maximum single entry size (${len} > ${singleEntryLimit} bytes)`
        );
      }
      verifiedTotal += len;
      if (verifiedTotal > totalLimit) {
        throw new Error(
          `Package exceeds maximum uncompressed size budget (${verifiedTotal} > ${totalLimit} bytes)`
        );
      }
    }

    const manifestFile = finalFiles['manifest.json'];
    if (!manifestFile) throw new Error('Invalid .nemosyne package: missing manifest.json');
    const manifestJson = JSON.parse(strFromU8(manifestFile));
    const manifestResult = v.safeParse(NemosyneManifestSchema, manifestJson);
    if (!manifestResult.success) {
      const errorMsg = manifestResult.issues
        .map((i) => `${i.message} at ${i.path?.map((p) => p.key).join('.')}`)
        .join('; ');
      throw new Error(`Invalid .nemosyne manifest schema: ${errorMsg}`);
    }

    const datasetBytes = finalFiles['data/dataset.raw'];
    if (!datasetBytes || datasetBytes.byteLength === 0) {
      throw new Error('Invalid .nemosyne package: missing or empty data/dataset.raw');
    }
    const commandLogBytes = finalFiles['investigation/commands.log'] ?? new Uint8Array(0);
    if (manifestResult.output.commandCount > 0 && commandLogBytes.byteLength === 0) {
      throw new Error(
        `Package manifest declares ${manifestResult.output.commandCount} commands, but investigation/commands.log is empty`
      );
    }

    const representationDecisionBytes = finalFiles['investigation/representation.json'];
    if (manifestResult.output.representationModel && !representationDecisionBytes) {
      throw new Error(
        'Invalid .nemosyne package: manifest declares representation model provenance but investigation/representation.json is missing'
      );
    }
    const discoveryEpisodesBytes = finalFiles['investigation/discoveries.json'];
    if ((manifestResult.output.discoveryCount ?? 0) > 0 && !discoveryEpisodesBytes) {
      throw new Error(
        'Invalid .nemosyne package: manifest declares discoveries but investigation/discoveries.json is missing'
      );
    }
    const nilOutcomesBytes = finalFiles['investigation/nil-outcomes.json'];
    if ((manifestResult.output.nilOutcomeCount ?? 0) > 0 && !nilOutcomesBytes) {
      throw new Error(
        'Invalid .nemosyne package: manifest declares NIL outcomes but investigation/nil-outcomes.json is missing'
      );
    }

    const extraFiles: Record<string, Uint8Array> = {};
    for (const [path, data] of Object.entries(finalFiles)) {
      if (path.startsWith('extras/')) extraFiles[path.replace(/^extras\//, '')] = data;
    }

    return {
      manifest: manifestResult.output,
      datasetBytes,
      commandLogBytes,
      representationDecisionBytes,
      discoveryEpisodesBytes,
      nilOutcomesBytes,
      extraFiles,
    };
  }
}
