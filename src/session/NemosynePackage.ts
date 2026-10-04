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
import { parsePersistedEvidenceReceiptsV1 } from '../data/evidence/PersistedEvidenceReceipts.ts';
import { sha256Hex } from '../security/CryptoHash.ts';
import { GOVERNED_INVESTIGATION_DIGEST_ALGORITHM, INVESTIGATION_DIGEST_ALGORITHM } from '../investigation/InvestigationDigest.ts';

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
export const GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION = 3 as const;
export const FORMA_PACKAGE_FORMAT_VERSION = 4 as const;
export const EVIDENCE_RECEIPTS_ENTRY = 'investigation/evidence-receipts.json' as const;
export const FORMA_INVESTIGATION_ENTRY = 'investigation/forma.json' as const;
export const LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION = 1 as const;

export interface FormaStaticCaptureCapturedV1 {
  readonly status: 'CAPTURED';
  readonly planId: string;
  readonly variantTier: string;
  readonly admittedPlan?: unknown;
  readonly compiledVariants?: unknown;
  readonly timestamp: string;
  readonly isConjectural: boolean;
  readonly uncertaintyDisclosure?: string;
}

export interface FormaStaticCaptureNoneV1 {
  readonly status: 'NONE';
  readonly reason: string;
}

export type FormaStaticCaptureV1 = FormaStaticCaptureCapturedV1 | FormaStaticCaptureNoneV1;

export interface FormaInvestigationPayloadV1 {
  readonly schemaVersion: 1;
  readonly contextRef: string;
  readonly conjecturalProposalRefs: readonly string[];
  readonly epistemicBindingsRef: readonly string[];
  readonly generationRecordRef?: string;
  readonly staticCapture: FormaStaticCaptureV1;
}

export interface HistoricalInspectionCapability {
  readonly kind: 'HISTORICAL_INSPECTION';
  readonly captureId: string;
  readonly runtimeInstanceId: string;
  readonly inspectionEpoch: number;
  readonly isConjectural: boolean;
  readonly canAuthorizeActiveUse: false;
}

export function createHistoricalInspectionCapability(
  captureId: string,
  isConjectural: boolean = false
): HistoricalInspectionCapability {
  const instanceId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `hist-rt-${Date.now().toString(36)}`;
  return {
    kind: 'HISTORICAL_INSPECTION',
    captureId,
    runtimeInstanceId: instanceId,
    inspectionEpoch: 1,
    isConjectural,
    canAuthorizeActiveUse: false,
  };
}

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
  evidenceReceiptDigest: v.nullish(v.string()),
  formaDigest: v.nullish(v.string()),
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
  evidenceReceiptBytes?: Uint8Array;
  formaInvestigationBytes?: Uint8Array;
  extraFiles?: Record<string, Uint8Array>;
}

function assertSupportedManifestIdentityContract(manifest: NemosynePackageManifest): void {
  if (manifest.formatVersion === LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION) {
    if (manifest.investigationDigestAlgorithm) {
      throw new Error('Format-v1 package cannot declare an RF-046 investigation digest algorithm');
    }
    return;
  }
  const isV3 = manifest.formatVersion === GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION;
  const isV4 = manifest.formatVersion === FORMA_PACKAGE_FORMAT_VERSION;
  const governed = isV3 || isV4;
  if (!governed && manifest.formatVersion !== NEMOSYNE_PACKAGE_FORMAT_VERSION) {
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
  if (governed) {
    for (const field of ['analyticalDatasetFingerprint', 'investigationDigest', 'evidenceReceiptDigest'] as const) {
      if (typeof manifest[field] !== 'string' || !/^[0-9a-f]{64}$/.test(manifest[field])) {
        throw new Error(`Format-${isV4 ? 'v4' : 'v3'} package requires ${field} as a lowercase SHA-256 digest`);
      }
    }
    if (!manifest.analyticalKernelVersion || !manifest.kernelVersion) {
      throw new Error(`Format-${isV4 ? 'v4' : 'v3'} package requires explicit kernel identities`);
    }
    if (manifest.investigationDigestAlgorithm !== GOVERNED_INVESTIGATION_DIGEST_ALGORITHM) {
      throw new Error(`Format-${isV4 ? 'v4' : 'v3'} package requires its investigation digest algorithm`);
    }
    if (isV4) {
      if (typeof manifest.formaDigest !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.formaDigest)) {
        throw new Error('Format-v4 package requires formaDigest as a lowercase SHA-256 digest');
      }
    }
    return;
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

/** Legacy readers historically ignored unknown metadata; only V3/V4 own their extra digest fields. */
function manifestInput(value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    const formatVersion = (value as Record<string, unknown>).formatVersion;
    if (formatVersion !== GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION && formatVersion !== FORMA_PACKAGE_FORMAT_VERSION) {
      const { evidenceReceiptDigest: _ignored, formaDigest: _ignoredForma, ...legacy } = value as Record<string, unknown>;
      return legacy;
    }
  }
  return value;
}

/** Checks transport integrity and declared identity only, never reconstructed identity. */
function assertEvidenceContract(manifest: NemosynePackageManifest, bytes?: Uint8Array): void {
  if (manifest.formatVersion !== GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION &&
      manifest.formatVersion !== FORMA_PACKAGE_FORMAT_VERSION) {
    return;
  }
  if (!bytes) throw new Error(`Format-v${manifest.formatVersion} package is missing evidence receipts`);
  if (sha256Hex(bytes) !== manifest.evidenceReceiptDigest) {
    throw new Error('Evidence receipt entry digest mismatch');
  }
  const envelope = parsePersistedEvidenceReceiptsV1(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  if (envelope.bundle.datasetFingerprint !== manifest.analyticalDatasetFingerprint ||
      envelope.bundle.kernelVersion !== manifest.analyticalKernelVersion) {
    throw new Error('Evidence receipt bundle identity does not match analytical manifest identity');
  }
}

function assertFormaContract(manifest: NemosynePackageManifest, bytes?: Uint8Array): void {
  if (manifest.formatVersion !== FORMA_PACKAGE_FORMAT_VERSION) {
    return;
  }
  if (!bytes) throw new Error('Format-v4 package is missing forma investigation data');
  if (sha256Hex(bytes) !== manifest.formaDigest) {
    throw new Error('Forma investigation entry digest mismatch');
  }
}

function decodeNestedPathMetacharacters(value: string): string {
  return value.replace(/%(?:25)*(00|2e|2f|3a|5c)/gi, (_match, code: string) => {
    switch (code.toLowerCase()) {
      case '00': return '\0';
      case '2e': return '.';
      case '2f': return '/';
      case '3a': return ':';
      case '5c': return '\\';
      default: return _match;
    }
  });
}

export function sanitizeEntryPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new Error('Invalid archive entry path: path must be a non-empty string');
  }
  if (rawPath.includes('\0')) throw new Error('Invalid archive entry path: null byte detected');

  // Decode ordinary percent-encoding repeatedly for canonical duplicate-path
  // detection. The bounded decode loop is supplemented by a path-security
  // projection below that collapses arbitrarily nested encodings of path
  // metacharacters, so additional %25 wrapping cannot hide traversal syntax.
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

  const pathCanonical = decodeNestedPathMetacharacters(decoded);
  if (pathCanonical.includes('\0')) {
    throw new Error('Invalid archive entry path: decoded null byte detected');
  }
  const normalized = pathCanonical.replace(/\\/g, '/');
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
    const validatedManifest = v.parse(NemosyneManifestSchema, manifestInput(payload.manifest));
    assertSupportedManifestIdentityContract(validatedManifest);
    const evidenceSource = (validatedManifest.formatVersion === GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION ||
      validatedManifest.formatVersion === FORMA_PACKAGE_FORMAT_VERSION)
      ? payload.evidenceReceiptBytes : undefined;
    // Caller-owned buffers/getters must not change the bytes after validation.
    const evidenceReceiptBytes = evidenceSource === undefined ? undefined : new Uint8Array(evidenceSource);
    assertEvidenceContract(validatedManifest, evidenceReceiptBytes);

    const formaSource = validatedManifest.formatVersion === FORMA_PACKAGE_FORMAT_VERSION
      ? payload.formaInvestigationBytes : undefined;
    const formaInvestigationBytes = formaSource === undefined ? undefined : new Uint8Array(formaSource);
    assertFormaContract(validatedManifest, formaInvestigationBytes);

    const zipFiles: Record<string, Uint8Array> = {
      'manifest.json': strToU8(JSON.stringify(validatedManifest, null, 2)),
      'data/dataset.raw': payload.datasetBytes,
      'investigation/commands.log': payload.commandLogBytes,
    };

    if (evidenceReceiptBytes) zipFiles[EVIDENCE_RECEIPTS_ENTRY] = evidenceReceiptBytes;
    if (formaInvestigationBytes) zipFiles[FORMA_INVESTIGATION_ENTRY] = formaInvestigationBytes;

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
    const manifestResult = v.safeParse(NemosyneManifestSchema, manifestInput(manifestJson));
    if (!manifestResult.success) {
      const errorMsg = manifestResult.issues
        .map((i) => `${i.message} at ${i.path?.map((p) => p.key).join('.')}`)
        .join('; ');
      throw new Error(`Invalid .nemosyne manifest schema: ${errorMsg}`);
    }
    assertSupportedManifestIdentityContract(manifestResult.output);

    const evidenceReceiptBytes = (manifestResult.output.formatVersion === GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION ||
      manifestResult.output.formatVersion === FORMA_PACKAGE_FORMAT_VERSION)
      ? finalFiles[EVIDENCE_RECEIPTS_ENTRY] : undefined;
    assertEvidenceContract(manifestResult.output, evidenceReceiptBytes);

    const formaInvestigationBytes = manifestResult.output.formatVersion === FORMA_PACKAGE_FORMAT_VERSION
      ? finalFiles[FORMA_INVESTIGATION_ENTRY] : undefined;
    assertFormaContract(manifestResult.output, formaInvestigationBytes);

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
      evidenceReceiptBytes,
      formaInvestigationBytes,
      datasetBytes,
      commandLogBytes,
      representationDecisionBytes,
      discoveryEpisodesBytes,
      nilOutcomesBytes,
      extraFiles,
    };
  }
}
