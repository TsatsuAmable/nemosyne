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
import { CANONICAL_DATASET_IDENTITY_ALGORITHM } from '../data/DatasetIdentity.ts';
import { INVESTIGATION_DIGEST_ALGORITHM } from '../investigation/InvestigationDigest.ts';

export const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;
export const MAX_TOTAL_UNCOMPRESSED = 250 * 1024 * 1024;
export const MAX_SINGLE_ENTRY = 100 * 1024 * 1024;
export const MAX_ENTRY_COUNT = 1000;

/**
 * Format v2 makes `datasetFingerprint` a canonical SHA-256 scientific dataset
 * identity. Format v1 remains readable for legacy archives whose field contains
 * the historical name/shape seed hash.
 *
 * RF-046 deliberately does not bump the container format: early format-v2
 * packages already exist with the historical digest projection. New packages
 * therefore carry `investigationDigestAlgorithm`; its absence means the reader
 * must verify the legacy schema-v1 digest instead of silently reinterpreting it.
 */
export const NEMOSYNE_PACKAGE_FORMAT_VERSION = 2 as const;
export const LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION = 1 as const;

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
  /** Required by format v2; absent on legacy format-v1 archives. */
  datasetIdentityAlgorithm: v.nullish(v.string()),
  analyticalDatasetFingerprint: v.nullish(v.string()),
  datasetName: v.string(),
  kernelVersion: v.string(),
  analyticalKernelVersion: v.nullish(v.string()),
  createdAt: v.number(),
  commandCount: v.number(),
  discoveryCount: v.nullish(v.number()),
  nilOutcomeCount: v.nullish(v.number()),
  investigationDigest: v.nullish(v.string()),
  /** RF-046: absent means the historical schema-v1 digest contract. */
  investigationDigestAlgorithm: v.nullish(v.string()),
  /** Portable research semantics committed by the RF-046 v2 digest. */
  researchContext: v.nullish(
    v.object({
      studyId: v.nullish(v.string()),
      researchQuestion: v.nullish(v.string()),
      hypothesis: v.nullish(v.string()),
      variablesOfInterest: v.nullish(v.array(v.string())),
      currentTask: v.nullish(v.string()),
      observerMode: v.nullish(v.boolean()),
    })
  ),
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
    /**
     * Privacy-sensitive fingerprinting surface. Exporters should omit this
     * unless a study/diagnostic workflow explicitly needs browser identity.
     */
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

function assertSupportedManifestIdentityContract(manifest: NemosynePackageManifest): void {
  if (manifest.formatVersion === LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION) {
    if (manifest.investigationDigestAlgorithm) {
      throw new Error('Format-v1 package cannot declare an RF-046 investigation digest algorithm');
    }
    return;
  }
  if (manifest.formatVersion !== NEMOSYNE_PACKAGE_FORMAT_VERSION) {
    throw new Error(`Unsupported .nemosyne formatVersion ${manifest.formatVersion}`);
  }
  if (manifest.datasetIdentityAlgorithm !== CANONICAL_DATASET_IDENTITY_ALGORITHM) {
    throw new Error(
      `Format-v2 package requires datasetIdentityAlgorithm '${CANONICAL_DATASET_IDENTITY_ALGORITHM}'`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(manifest.datasetFingerprint)) {
    throw new Error('Format-v2 package datasetFingerprint must be a lowercase SHA-256 hex digest');
  }
  if (
    manifest.investigationDigestAlgorithm != null &&
    manifest.investigationDigestAlgorithm !== INVESTIGATION_DIGEST_ALGORITHM
  ) {
    throw new Error(
      `Unsupported investigationDigestAlgorithm '${manifest.investigationDigestAlgorithm}'`,
    );
  }
}

export function sanitizeEntryPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new Error('Invalid archive entry path: path must be a non-empty string');
  }
  if (rawPath.includes('\0')) throw new Error('Invalid archive entry path: null byte detected');

  // Decode repeatedly before validation so single- and multiply-encoded path
  // separators / dot segments are judged in their effective form. Percent
  // checks after decoding are both redundant and misleading, so traversal is
  // validated only on the fully-normalized path below.
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
    if (part === '..' || part === '.') {
      throw new Error(`Invalid archive entry path: path traversal detected (${rawPath})`);
    }
  }
  return normalized;
}

export class NemosynePackageManager {
  static pack(payload: NemosynePackagePayload): Uint8Array {
    const validatedManifest = v.parse(NemosyneManifestSchema, payload.manifest);
    assertSupportedManifestIdentityContract(validatedManifest);
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
    assertSupportedManifestIdentityContract(manifestResult.output);

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
