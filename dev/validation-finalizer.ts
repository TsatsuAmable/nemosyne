import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  adjudicateValidationEvidence,
  validateQuestBoundaryReport,
  validateQuestPerformanceReport,
  type ValidationAdjudicationCohort,
  type ValidationPrerequisiteState,
} from './validation-adjudication.ts';
import {
  validateValidationManifest,
  type ValidationManifest,
} from '../src/validation/validation-manifest.ts';
import {
  validateGuidedUxSubmission,
  type GuidedUxSubmission,
} from '../src/validation/guided-ux-validation.ts';

export const VALIDATION_CUSTODY_SCHEMA_VERSION = '1';
const MAX_EVIDENCE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_REPORT_LINES = 512;
const MAX_COHORT_SESSIONS = 256;
const QUEST_10M_NONQUALIFICATION_INVALIDATION =
  'quest-10m boundary probe is not final 10M device qualification';
const P1_U9_MISSING_PREREQUISITE_REASON =
  'P1-U9 prerequisite state is missing; explicit preflight attestation is required before adjudication';

const RAW_EVIDENCE_NAMES = [
  'manifest.json',
  'loadtest-results.jsonl',
  'ux-results.json',
  'comfort-observation.json',
  'prerequisites.json',
] as const;

export interface ArtifactHash {
  path: string;
  bytes: number;
  sha256: string;
}

export interface CustodyRecord {
  schemaVersion: typeof VALIDATION_CUSTODY_SCHEMA_VERSION;
  state: 'finalized';
  sessionId: string;
  sessionLabel: string;
  buildId: string;
  worktree: ValidationManifest['worktree'];
  runtimeClass: ValidationManifest['runtimeClass'];
  evidenceClass: ValidationManifest['evidenceClass'];
  deviceBuildFingerprint: string | null;
  finalizedAt: string;
  rawEvidenceDigest: string;
  rawEvidence: ArtifactHash[];
  derivedArtifacts: ArtifactHash[];
  bundleDigest: string;
}

export type ValidationFinalizationResult =
  | { status: 'pending'; reason: string }
  | { status: 'finalized'; bundleDigest: string; aggregateStatus: string }
  | { status: 'already-finalized'; bundleDigest: string; aggregateStatus: string | null }
  | { status: 'tamper-detected'; reason: string }
  | { status: 'failed'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (isRecord(value)) {
    const body = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',');
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sha256Bytes(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function atomicWrite(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, file);
}

function readJson(file: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readBoundedJsonLines(file: string): unknown[] {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_EVIDENCE_FILE_BYTES) return [];
    return fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-MAX_REPORT_LINES)
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return null;
        }
      })
      .filter((value) => value !== null);
  } catch {
    return [];
  }
}

function hashFile(file: string, relativePath: string): ArtifactHash {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${relativePath} is not a regular file`);
  if (stat.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error(`${relativePath} exceeds the ${MAX_EVIDENCE_FILE_BYTES}-byte custody limit`);
  }
  const bytes = fs.readFileSync(file);
  return { path: relativePath, bytes: stat.size, sha256: sha256Bytes(bytes) };
}

function hashRawEvidence(evidenceDir: string): ArtifactHash[] {
  return RAW_EVIDENCE_NAMES.flatMap((name) => {
    const file = path.join(evidenceDir, name);
    return fs.existsSync(file) ? [hashFile(file, name)] : [];
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function rawDigest(artifacts: ArtifactHash[]): string {
  return sha256Bytes(canonicalJson(artifacts));
}

function readManifest(evidenceDir: string): ValidationManifest | null {
  const checked = validateValidationManifest(readJson(path.join(evidenceDir, 'manifest.json')));
  return checked.ok ? checked.manifest : null;
}

function sameBuildDevice(a: ValidationManifest, b: ValidationManifest): boolean {
  const af = a.deviceIdentity?.buildFingerprint ?? null;
  const bf = b.deviceIdentity?.buildFingerprint ?? null;
  return Boolean(
    af &&
      bf &&
      a.buildId === b.buildId &&
      af === bf &&
      a.deviceIdentity?.buildIncremental === b.deviceIdentity?.buildIncremental
  );
}

function cohortManifestEligible(manifest: ValidationManifest): boolean {
  if (manifest.validationMode === 'quest-perf') return manifest.invalidations.length === 0;
  if (manifest.validationMode === 'quest-10m') {
    return manifest.invalidations.every(
      (reason) => reason === QUEST_10M_NONQUALIFICATION_INVALIDATION
    );
  }
  return false;
}

function priorSessionCustodyMatches(
  evidenceDir: string,
  manifest: ValidationManifest
): boolean {
  const verified = verifyFinalizedCustody(evidenceDir);
  if (!verified.ok) return false;
  const expectedFingerprint = manifest.deviceIdentity?.buildFingerprint ?? null;
  return Boolean(
    verified.custody.sessionId === manifest.sessionId &&
      verified.custody.sessionLabel === manifest.sessionLabel &&
      verified.custody.buildId === manifest.buildId &&
      verified.custody.deviceBuildFingerprint === expectedFingerprint
  );
}

export function scanValidationCohort(
  validationLogRoot: string,
  activeManifest: ValidationManifest
): ValidationAdjudicationCohort {
  const cohort: ValidationAdjudicationCohort = {
    perfPassingRunCount: 0,
    perfCompletedRunCount: 0,
    boundaryCompletedRunCount: 0,
    boundaryAttemptCount: 0,
  };
  const seenSessionIds = new Set<string>();
  let entries: fs.Dirent[] = [];
  try {
    entries = fs
      .readdirSync(validationLogRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .slice(0, MAX_COHORT_SESSIONS);
  } catch {
    return cohort;
  }

  for (const entry of entries) {
    const evidenceDir = path.join(validationLogRoot, entry.name);
    const manifest = readManifest(evidenceDir);
    if (
      !manifest ||
      entry.name !== manifest.sessionLabel ||
      manifest.worktree !== 'clean' ||
      !sameBuildDevice(activeManifest, manifest) ||
      !cohortManifestEligible(manifest) ||
      seenSessionIds.has(manifest.sessionId)
    ) {
      continue;
    }

    const isActiveSession =
      manifest.sessionId === activeManifest.sessionId &&
      manifest.sessionLabel === activeManifest.sessionLabel;
    if (!isActiveSession && !priorSessionCustodyMatches(evidenceDir, manifest)) continue;
    seenSessionIds.add(manifest.sessionId);

    const reports = readBoundedJsonLines(path.join(evidenceDir, 'loadtest-results.jsonl'));
    if (manifest.validationMode === 'quest-perf') {
      const perfReports = reports.filter(
        (report) => isRecord(report) && report.profileName === 'quest-3s-qualification'
      );
      if (perfReports.length !== 1) continue;
      const checked = validateQuestPerformanceReport(perfReports[0], manifest);
      if (checked.ok && !checked.aborted) {
        cohort.perfCompletedRunCount += 1;
        if (checked.corePass) cohort.perfPassingRunCount += 1;
      }
      continue;
    }

    const boundaryReports = reports.filter(
      (report) => isRecord(report) && report.profileName === 'quest-3s-rust-boundary-10m'
    );
    if (boundaryReports.length !== 1) continue;
    const checked = validateQuestBoundaryReport(boundaryReports[0], manifest);
    if (checked.ok && checked.outcome) {
      cohort.boundaryAttemptCount += 1;
      if (checked.outcome === 'completed') cohort.boundaryCompletedRunCount += 1;
    }
  }
  return cohort;
}

function readGuidedUxSubmission(
  evidenceDir: string,
  manifest: ValidationManifest
): GuidedUxSubmission | null {
  const ux = readJson(path.join(evidenceDir, 'ux-results.json'));
  const comfort = readJson(path.join(evidenceDir, 'comfort-observation.json'));
  if (!isRecord(ux) || !isRecord(comfort)) return null;
  return {
    schemaVersion: ux.schemaVersion as GuidedUxSubmission['schemaVersion'],
    sessionId: String(ux.sessionId ?? ''),
    sessionLabel: String(ux.sessionLabel ?? ''),
    buildId: String(ux.buildId ?? ''),
    deviceBuildFingerprint:
      typeof ux.deviceBuildFingerprint === 'string' ? ux.deviceBuildFingerprint : null,
    evidenceKind: ux.evidenceKind as GuidedUxSubmission['evidenceKind'],
    results: Array.isArray(ux.results) ? (ux.results as GuidedUxSubmission['results']) : [],
    comfortObservation: {
      outcome: comfort.outcome as GuidedUxSubmission['comfortObservation']['outcome'],
      recordedAt: String(comfort.recordedAt ?? ''),
      note: null,
    },
    completedAt: String(ux.completedAt ?? manifest.timestamps.completedAt ?? ''),
  };
}

function readPrerequisites(
  evidenceDir: string,
  manifest: ValidationManifest
): Record<string, ValidationPrerequisiteState[]> | undefined {
  const raw = readJson(path.join(evidenceDir, 'prerequisites.json'));
  const result: Record<string, ValidationPrerequisiteState[]> = {};
  if (isRecord(raw)) {
    for (const [gate, value] of Object.entries(raw)) {
      if (!Array.isArray(value)) continue;
      const states = value.flatMap((item) => {
        if (!isRecord(item) || typeof item.satisfied !== 'boolean' || typeof item.reason !== 'string') {
          return [];
        }
        return [{ satisfied: item.satisfied, reason: item.reason.slice(0, 512) }];
      });
      if (states.length > 0) result[gate] = states;
    }
  }
  if (manifest.gates.includes('P1-U9') && !result['P1-U9']) {
    result['P1-U9'] = [{ satisfied: false, reason: P1_U9_MISSING_PREREQUISITE_REASON }];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function finalizationReady(manifest: ValidationManifest, evidenceDir: string): boolean {
  if (manifest.validationMode === 'quest-perf' || manifest.validationMode === 'quest-10m') {
    return readBoundedJsonLines(path.join(evidenceDir, 'loadtest-results.jsonl')).length > 0;
  }
  if (manifest.validationMode === 'quest-ux') {
    const submission = readGuidedUxSubmission(evidenceDir, manifest);
    if (!submission || validateGuidedUxSubmission(submission).length > 0) return false;
    return Boolean(
      submission.sessionId === manifest.sessionId &&
        submission.sessionLabel === manifest.sessionLabel &&
        submission.buildId === manifest.buildId &&
        submission.deviceBuildFingerprint === (manifest.deviceIdentity?.buildFingerprint ?? null)
    );
  }
  return false;
}

function custodyBundleCore(record: Omit<CustodyRecord, 'bundleDigest'>): unknown {
  return record;
}

function buildReport(
  manifest: ValidationManifest,
  custody: CustodyRecord,
  disposition: Record<string, unknown>
): string {
  const gates = Array.isArray(disposition.gates)
    ? (disposition.gates as Array<Record<string, unknown>>)
    : [];
  const gateLines =
    gates.length > 0
      ? gates
          .map(
            (item) =>
              `| ${String(item.gate ?? '?')} | ${String(item.status ?? '?')} | ${Array.isArray(item.reasons) ? item.reasons.join('; ') : ''} |`
          )
          .join('\n')
      : '| — | PARTIAL | No governed gate is adjudicable in this mode. |';
  return (
    `# Validation report — ${manifest.sessionLabel}\n\n` +
    `> Machine-generated projection of frozen QV evidence. Do not edit this file as an evidence source.\n\n` +
    `- **Session:** \`${manifest.sessionId}\`\n` +
    `- **Source build:** \`${manifest.buildId}\`\n` +
    `- **Worktree at launch:** \`${manifest.worktree}\`\n` +
    `- **Mode:** \`${manifest.validationMode}\`\n` +
    `- **Runtime:** \`${manifest.runtimeClass}\`\n` +
    `- **Evidence class:** \`${manifest.evidenceClass}\`\n` +
    `- **Device fingerprint:** \`${manifest.deviceIdentity?.buildFingerprint ?? 'unavailable'}\`\n` +
    `- **Finalized:** ${custody.finalizedAt}\n` +
    `- **Raw evidence digest:** \`${custody.rawEvidenceDigest}\`\n` +
    `- **Custody bundle digest:** \`${custody.bundleDigest}\`\n\n` +
    `## Gate dispositions\n\n` +
    `| Gate | Status | Reasons |\n| --- | --- | --- |\n${gateLines}\n\n` +
    `## Chain of custody\n\n` +
    `The raw evidence files were hashed before QV4 analysis. \`analysis.json\`, \`disposition.json\` and \`evidence-index.json\` are bound into the custody bundle. The Markdown report is a regenerable projection and is not itself an authority.\n`
  );
}

function readDispositionStatus(evidenceDir: string): string | null {
  const disposition = readJson(path.join(evidenceDir, 'disposition.json'));
  if (!isRecord(disposition)) return null;
  const gateDisposition = isRecord(disposition.gateDisposition) ? disposition.gateDisposition : null;
  return gateDisposition && typeof gateDisposition.status === 'string' ? gateDisposition.status : null;
}

function writeLocalLedger(validationLogRoot: string): void {
  const rows: Array<{
    finalizedAt: string;
    label: string;
    buildId: string;
    status: string;
    bundle: string;
  }> = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs
      .readdirSync(validationLogRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
  } catch {
    return;
  }
  for (const entry of entries.slice(0, MAX_COHORT_SESSIONS)) {
    const evidenceDir = path.join(validationLogRoot, entry.name);
    if (!fs.existsSync(path.join(evidenceDir, 'custody.json'))) continue;
    const verified = verifyFinalizedCustody(evidenceDir);
    if (!verified.ok) {
      rows.push({
        finalizedAt: '',
        label: entry.name,
        buildId: 'UNVERIFIED',
        status: 'TAMPER-DETECTED',
        bundle: 'UNVERIFIED',
      });
      continue;
    }
    rows.push({
      finalizedAt: verified.custody.finalizedAt,
      label: entry.name,
      buildId: verified.custody.buildId,
      status: readDispositionStatus(evidenceDir) ?? 'UNKNOWN',
      bundle: verified.custody.bundleDigest,
    });
  }
  rows.sort((a, b) => a.finalizedAt.localeCompare(b.finalizedAt));
  const body = rows
    .map(
      (row) =>
        `| ${row.finalizedAt || 'UNVERIFIED'} | \`${row.label}\` | \`${row.buildId.slice(0, 12)}\` | ${row.status} | \`${row.bundle === 'UNVERIFIED' ? row.bundle : `${row.bundle.slice(0, 16)}…`}\` |`
    )
    .join('\n');
  atomicWrite(
    path.join(validationLogRoot, 'VALIDATION_LEDGER.md'),
    `# Local validation ledger\n\nMachine-generated from custody-verified finalized records. Tampered finalized sessions are surfaced explicitly and are never projected as valid evidence. This file is a projection, not a promotion authority.\n\n| Finalized | Session | Build | Status | Bundle |\n| --- | --- | --- | --- | --- |\n${body || '| — | — | — | — | — |'}\n`
  );
}

function readCustody(evidenceDir: string): CustodyRecord | null {
  const raw = readJson(path.join(evidenceDir, 'custody.json'));
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== VALIDATION_CUSTODY_SCHEMA_VERSION ||
    raw.state !== 'finalized'
  ) {
    return null;
  }
  return raw as unknown as CustodyRecord;
}

export function isValidationSessionFinalized(evidenceDir: string): boolean {
  return readCustody(evidenceDir) !== null;
}

export function verifyFinalizedCustody(
  evidenceDir: string
): { ok: true; custody: CustodyRecord } | { ok: false; reason: string } {
  const custody = readCustody(evidenceDir);
  if (!custody) return { ok: false, reason: 'custody.json is missing or invalid' };
  try {
    const rawEvidence = hashRawEvidence(evidenceDir);
    const currentRawDigest = rawDigest(rawEvidence);
    if (currentRawDigest !== custody.rawEvidenceDigest) {
      return { ok: false, reason: 'raw evidence digest changed after finalization' };
    }
    if (canonicalJson(rawEvidence) !== canonicalJson(custody.rawEvidence)) {
      return { ok: false, reason: 'raw evidence inventory changed after finalization' };
    }
    const derivedArtifacts = ['analysis.json', 'disposition.json', 'evidence-index.json']
      .map((name) => hashFile(path.join(evidenceDir, name), name))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (canonicalJson(derivedArtifacts) !== canonicalJson(custody.derivedArtifacts)) {
      return { ok: false, reason: 'derived adjudication artifacts changed after finalization' };
    }
    const withoutDigest: Omit<CustodyRecord, 'bundleDigest'> = {
      schemaVersion: custody.schemaVersion,
      state: custody.state,
      sessionId: custody.sessionId,
      sessionLabel: custody.sessionLabel,
      buildId: custody.buildId,
      worktree: custody.worktree,
      runtimeClass: custody.runtimeClass,
      evidenceClass: custody.evidenceClass,
      deviceBuildFingerprint: custody.deviceBuildFingerprint,
      finalizedAt: custody.finalizedAt,
      rawEvidenceDigest: custody.rawEvidenceDigest,
      rawEvidence: custody.rawEvidence,
      derivedArtifacts: custody.derivedArtifacts,
    };
    const bundleDigest = sha256Bytes(canonicalJson(custodyBundleCore(withoutDigest)));
    if (bundleDigest !== custody.bundleDigest) {
      return { ok: false, reason: 'custody bundle digest is invalid' };
    }
    return { ok: true, custody };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'custody verification failed',
    };
  }
}

export function getValidationFinalizationStatus(evidenceDir: string): {
  state: 'open' | 'finalized' | 'tamper-detected';
  bundleDigest: string | null;
  gateDisposition: string | null;
  reason: string | null;
} {
  if (!fs.existsSync(path.join(evidenceDir, 'custody.json'))) {
    return {
      state: 'open',
      bundleDigest: null,
      gateDisposition: readDispositionStatus(evidenceDir),
      reason: null,
    };
  }
  const verified = verifyFinalizedCustody(evidenceDir);
  if (!verified.ok) {
    return {
      state: 'tamper-detected',
      bundleDigest: null,
      gateDisposition: readDispositionStatus(evidenceDir),
      reason: verified.reason,
    };
  }
  return {
    state: 'finalized',
    bundleDigest: verified.custody.bundleDigest,
    gateDisposition: readDispositionStatus(evidenceDir),
    reason: null,
  };
}

export function finalizeValidationSession(options: {
  validationLogRoot: string;
  sessionLabel: string;
  now?: () => Date;
}): ValidationFinalizationResult {
  const evidenceDir = path.join(options.validationLogRoot, options.sessionLabel);
  const existing = readCustody(evidenceDir);
  if (existing) {
    const verified = verifyFinalizedCustody(evidenceDir);
    if (!verified.ok) return { status: 'tamper-detected', reason: verified.reason };
    return {
      status: 'already-finalized',
      bundleDigest: existing.bundleDigest,
      aggregateStatus: readDispositionStatus(evidenceDir),
    };
  }

  const manifest = readManifest(evidenceDir);
  if (!manifest || manifest.sessionLabel !== options.sessionLabel) {
    return {
      status: 'failed',
      reason: 'validation manifest is missing, malformed or bound to another session',
    };
  }
  if (!finalizationReady(manifest, evidenceDir)) {
    return { status: 'pending', reason: 'required terminal evidence has not been captured yet' };
  }

  try {
    const rawEvidence = hashRawEvidence(evidenceDir);
    const rawEvidenceDigest = rawDigest(rawEvidence);
    const cohort = scanValidationCohort(options.validationLogRoot, manifest);
    const loadTestReports = readBoundedJsonLines(path.join(evidenceDir, 'loadtest-results.jsonl'));
    const guidedUxSubmission = readGuidedUxSubmission(evidenceDir, manifest);
    const prerequisites = readPrerequisites(evidenceDir, manifest);
    const adjudication = adjudicateValidationEvidence({
      manifest,
      loadTestReports,
      guidedUxSubmission,
      cohort,
      prerequisites,
    });
    const { schemaVersion: adjudicationSchemaVersion, ...adjudicationResult } = adjudication;
    const finalizedAt = (options.now ?? (() => new Date()))().toISOString();
    const evidenceIndex = {
      schemaVersion: VALIDATION_CUSTODY_SCHEMA_VERSION,
      sessionId: manifest.sessionId,
      sessionLabel: manifest.sessionLabel,
      rawEvidenceDigest,
      artifacts: rawEvidence,
    };
    const analysis = {
      schemaVersion: VALIDATION_CUSTODY_SCHEMA_VERSION,
      adjudicationSchemaVersion,
      status: 'complete',
      recordedAt: finalizedAt,
      rawEvidenceDigest,
      ...adjudicationResult,
    };
    const disposition = {
      schemaVersion: VALIDATION_CUSTODY_SCHEMA_VERSION,
      recordedAt: finalizedAt,
      sessionId: manifest.sessionId,
      sessionLabel: manifest.sessionLabel,
      buildId: manifest.buildId,
      evidenceClass: manifest.evidenceClass,
      rawEvidenceDigest,
      gateDisposition: {
        status: adjudication.aggregateStatus,
        reasons: adjudication.aggregateReasons,
      },
      gates: adjudication.gateResults,
    };

    atomicWrite(
      path.join(evidenceDir, 'evidence-index.json'),
      `${JSON.stringify(evidenceIndex, null, 2)}\n`
    );
    atomicWrite(
      path.join(evidenceDir, 'analysis.json'),
      `${JSON.stringify(analysis, null, 2)}\n`
    );
    atomicWrite(
      path.join(evidenceDir, 'disposition.json'),
      `${JSON.stringify(disposition, null, 2)}\n`
    );

    const derivedArtifacts = ['analysis.json', 'disposition.json', 'evidence-index.json']
      .map((name) => hashFile(path.join(evidenceDir, name), name))
      .sort((a, b) => a.path.localeCompare(b.path));
    const withoutDigest: Omit<CustodyRecord, 'bundleDigest'> = {
      schemaVersion: VALIDATION_CUSTODY_SCHEMA_VERSION,
      state: 'finalized',
      sessionId: manifest.sessionId,
      sessionLabel: manifest.sessionLabel,
      buildId: manifest.buildId,
      worktree: manifest.worktree,
      runtimeClass: manifest.runtimeClass,
      evidenceClass: manifest.evidenceClass,
      deviceBuildFingerprint: manifest.deviceIdentity?.buildFingerprint ?? null,
      finalizedAt,
      rawEvidenceDigest,
      rawEvidence,
      derivedArtifacts,
    };
    const custody: CustodyRecord = {
      ...withoutDigest,
      bundleDigest: sha256Bytes(canonicalJson(custodyBundleCore(withoutDigest))),
    };
    atomicWrite(path.join(evidenceDir, 'custody.json'), `${JSON.stringify(custody, null, 2)}\n`);
    atomicWrite(path.join(evidenceDir, 'report.md'), buildReport(manifest, custody, disposition));
    writeLocalLedger(options.validationLogRoot);
    return {
      status: 'finalized',
      bundleDigest: custody.bundleDigest,
      aggregateStatus: adjudication.aggregateStatus,
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'validation finalization failed',
    };
  }
}
