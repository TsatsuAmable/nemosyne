#!/usr/bin/env node
/**
 * QV1 Quest validation launcher.
 *
 * Thin Node launcher that derives truthful attribution for a physical Quest
 * validation session and starts the existing Vite dev server:
 *
 *   1. resolves the exact Git HEAD SHA;
 *   2. determines clean/dirty/unknown worktree state via `git status --porcelain`;
 *   3. maps the selected mode to its governed gate/profile + evidence/runtime class;
 *   4. generates a session ID + human-readable session label;
 *   5. writes the versioned QV0 manifest to `logs/validation/<sessionLabel>/manifest.json`;
 *   6. builds the WASM dev kernel when the mode requires it;
 *   7. spawns `vite --host` with the build ID and validation metadata in env.
 *
 * Fail-closed behavior: if Git HEAD cannot be resolved, the launcher refuses
 * to start rather than emitting a manifest with a fallback build identity.
 *
 * The launcher never edits source, Git state, roadmap, or promotion state.
 * Evidence is written only under the git-ignored `logs/validation/` directory.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  MANIFEST_SCHEMA_VERSION,
  VALIDATION_MODE_TABLE,
  deriveValidationManifest,
  validateValidationManifest,
} from '../src/validation/validation-manifest.ts';

export const VALIDATION_LOG_ROOT = 'logs/validation';
export const FALLBACK_BUILD_ID = 'unversioned-local-build';

const GIT_SHA_RE = /^[0-9a-f]{40}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function runGit(args, { execFileSyncFn = execFileSync } = {}) {
  try {
    const stdout = execFileSyncFn('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout: String(stdout ?? '') };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Resolve the exact Git HEAD SHA. Fails closed: a missing, empty, or
 * non-40-hex result throws instead of returning a fallback identity.
 */
export function resolveGitHead(git = runGit) {
  const result = git(['rev-parse', 'HEAD']);
  if (!result.ok) {
    throw new Error(`failed to resolve git HEAD: ${result.error?.message ?? 'git unavailable'}`);
  }
  const sha = String(result.stdout).trim();
  if (!GIT_SHA_RE.test(sha)) {
    throw new Error(`git HEAD is not an exact 40-hex SHA: ${sha || '(empty)'}`);
  }
  return sha;
}

/**
 * Determine worktree state. `git status --porcelain` output is used
 * verbatim: any non-empty output means `dirty`; exec failure means `unknown`.
 * Untracked build/harness paths (e.g. symlinked node_modules) are reported
 * by porcelain as `??` and therefore conservatively classify as `dirty`.
 */
export function resolveWorktreeState(git = runGit) {
  const result = git(['status', '--porcelain']);
  if (!result.ok) return 'unknown';
  return String(result.stdout).trim() === '' ? 'clean' : 'dirty';
}

/** Session/run ID generation: a fresh UUID v4 per session. */
export function generateSessionId() {
  const id = randomUUID();
  if (!UUID_RE.test(id)) {
    throw new Error(`session ID generator produced an invalid UUID: ${id}`);
  }
  return id;
}

function timestampStamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

/**
 * Human-readable session label: `<gate-or-mode>-<sha7>-<yyyymmddThhmmss>`.
 * Also names the per-session evidence directory. Deterministic in UTC.
 */
export function generateSessionLabel(mode, buildId, now = () => new Date()) {
  const spec = VALIDATION_MODE_TABLE[mode];
  const prefix = (spec?.gates?.[0] ?? spec?.mode ?? String(mode)).replace(/[^A-Za-z0-9]/g, '');
  const sha7 = String(buildId).slice(0, 7);
  return `${prefix}-${sha7}-${timestampStamp(now())}`;
}

export const DEVICE_DECLARATION_FILE = 'device.json';
export const DEVICE_DECLARATION_FIELDS = [
  'label',
  'declaredQuestModel',
  'declaredFirmwareVersion',
  'investigator',
];

function declarationString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 128) : null;
}

/**
 * Read the optional local investigator-declared device facts (QV2). A
 * missing/invalid file yields nulls; the launcher never guesses firmware or
 * model. The fields are visibly investigator-declared and distinct from the
 * runtime-measured browser/XR/WebGL facts captured by `QuestTelemetry`.
 */
export function readDeviceDeclaration(root = process.cwd()) {
  try {
    const raw = fs.readFileSync(
      path.join(root, VALIDATION_LOG_ROOT, DEVICE_DECLARATION_FILE),
      'utf8'
    );
    const parsed = JSON.parse(raw);
    return {
      label: declarationString(parsed?.label),
      declaredQuestModel: declarationString(parsed?.declaredQuestModel),
      declaredFirmwareVersion: declarationString(parsed?.declaredFirmwareVersion),
      investigator: declarationString(parsed?.investigator),
    };
  } catch {
    return {
      label: null,
      declaredQuestModel: null,
      declaredFirmwareVersion: null,
      investigator: null,
    };
  }
}

/**
 * Merge operator updates into a declaration. An absent update keeps the current
 * value; an explicit empty string clears the field. All values are trimmed and
 * bounded (fail closed on oversized/empty -> null).
 */
export function mergeDeviceDeclaration(current = {}, updates = {}) {
  const merged = {};
  for (const key of DEVICE_DECLARATION_FIELDS) {
    const raw = updates[key] !== undefined ? updates[key] : current[key];
    merged[key] = declarationString(raw);
  }
  return merged;
}

/** Persist the declaration under ignored local state (logs/validation/device.json). */
export function writeDeviceDeclaration(declaration, root = process.cwd()) {
  const dir = path.join(root, VALIDATION_LOG_ROOT);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, DEVICE_DECLARATION_FILE);
  fs.writeFileSync(file, `${JSON.stringify(declaration, null, 2)}\n`, 'utf8');
  return file;
}

/**
 * QV2 gate: a governed validation mode cannot be promotion-eligible without an
 * investigator-declared device identity. Missing model/firmware downgrade the
 * manifest (invalidation + promotionEligible:false) rather than being guessed.
 * Informational modes (`quest`, `quest-validate`) are unaffected.
 *
 * This intentionally lives in the launcher layer, not in the pure manifest
 * derivation, so the B1 `deriveValidationManifest` contract is unchanged.
 */
export function applyDeviceDeclarationGate(manifest) {
  const spec = VALIDATION_MODE_TABLE[manifest.validationMode];
  if (!spec || spec.evidenceClass !== 'governed-physical-validation') return manifest;
  const invalidations = [...manifest.invalidations];
  if (!manifest.declaredQuestModel) {
    invalidations.push(
      `no declaredQuestModel in ${VALIDATION_LOG_ROOT}/${DEVICE_DECLARATION_FILE}; physical device identity cannot be attributed`
    );
  }
  if (!manifest.declaredFirmwareVersion) {
    invalidations.push(
      `no declaredFirmwareVersion in ${VALIDATION_LOG_ROOT}/${DEVICE_DECLARATION_FILE}; firmware cannot be attributed`
    );
  }
  if (invalidations.length === manifest.invalidations.length) return manifest;
  return { ...manifest, invalidations, promotionEligible: invalidations.length === 0 };
}

/**
 * Build the full validation context: resolve Git truth, generate the session
 * identity, then derive the QV0 manifest. This is the real production path a
 * Quest developer hits through `npm run dev:quest:*`.
 */
export function buildValidationContext({
  mode,
  git = runGit,
  sessionId = generateSessionId(),
  now = () => new Date(),
  device = readDeviceDeclaration(),
}) {
  if (!(mode in VALIDATION_MODE_TABLE)) {
    throw new Error(
      `unknown validation mode '${mode}'; valid modes: ${Object.keys(VALIDATION_MODE_TABLE).join(', ')}`
    );
  }
  const buildId = resolveGitHead(git);
  const worktree = resolveWorktreeState(git);
  const sessionLabel = generateSessionLabel(mode, buildId, now);
  return applyDeviceDeclarationGate(
    deriveValidationManifest({
      sessionId,
      sessionLabel,
      buildId,
      worktree,
      mode,
      createdAt: now().toISOString(),
      ...device,
    })
  );
}

/**
 * Resolve the per-session evidence directory and refuse any path that escapes
 * the validation root (fail closed). Shared by the manifest and evidence writers.
 */
export function resolveEvidenceDir(manifest, root = process.cwd()) {
  const rootResolved = path.resolve(root);
  const evidenceDir = path.resolve(root, manifest.evidenceDir);
  if (evidenceDir !== rootResolved && !evidenceDir.startsWith(rootResolved + path.sep)) {
    throw new Error(`evidence directory escapes validation root: ${manifest.evidenceDir}`);
  }
  if (!evidenceDir.startsWith(path.resolve(rootResolved, VALIDATION_LOG_ROOT) + path.sep)) {
    throw new Error(
      `evidence directory is outside ${VALIDATION_LOG_ROOT}: ${manifest.evidenceDir}`
    );
  }
  return evidenceDir;
}

/**
 * Write the manifest JSON under the session evidence directory. Refuses any
 * evidence directory that escapes the validation root (fail closed).
 */
export function writeManifestFile(manifest, root = process.cwd()) {
  const evidenceDir = resolveEvidenceDir(manifest, root);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, 'manifest.json');
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return file;
}

/**
 * Launch-time gate disposition. A governed run whose attribution is broken at
 * launch (dirty/unknown worktree, missing device declaration) is classified
 * INVALID_RUN with the attribution reasons. Mode-intrinsic invalidations (e.g.
 * the 10M boundary probe being non-qualification) are recorded in the manifest
 * but do not make the run's own-gate evidence invalid; those dispositions stay
 * pending (null) for QV4 adjudication. Failures are evidence, never discarded.
 */
export function deriveLaunchDisposition(manifest) {
  const spec = VALIDATION_MODE_TABLE[manifest.validationMode];
  if (!spec || spec.evidenceClass !== 'governed-physical-validation') {
    return { status: null, reasons: [] };
  }
  const attributionBlockers = manifest.invalidations.filter((reason) => {
    if (reason.startsWith("worktree state is '")) return true;
    if (reason.includes('declaredQuestModel')) return true;
    if (reason.includes('declaredFirmwareVersion')) return true;
    return false;
  });
  if (attributionBlockers.length > 0) {
    return { status: 'INVALID_RUN', reasons: attributionBlockers };
  }
  return { status: null, reasons: [] };
}

/**
 * Write the per-session gate disposition. The payload is a view of the manifest's
 * own gate state (session identity, invalidations, promotionEligible) plus the
 * current status/reasons — no thresholds or analysis are recomputed here.
 */
export function writeDispositionFile(manifest, disposition, root = process.cwd()) {
  const evidenceDir = resolveEvidenceDir(manifest, root);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, 'disposition.json');
  const payload = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    sessionId: manifest.sessionId,
    sessionLabel: manifest.sessionLabel,
    buildId: manifest.buildId,
    validationMode: manifest.validationMode,
    gates: [...(manifest.gates ?? [])],
    evidenceClass: manifest.evidenceClass,
    gateDisposition: {
      status: disposition.status ?? null,
      reasons: disposition.reasons ?? [],
    },
    invalidations: [...(manifest.invalidations ?? [])],
    promotionEligible: manifest.promotionEligible,
    recordedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return file;
}

/** QV3 analysis placeholder: explicit pending, never a fabricated result. */
export function writeAnalysisPlaceholder(manifest, root = process.cwd()) {
  const evidenceDir = resolveEvidenceDir(manifest, root);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, 'analysis.json');
  const payload = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    status: 'pending',
    note: 'QV4 analysis/adjudication has not run; placeholder written at launch.',
    recordedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return file;
}

/** QV3 UX placeholders for quest-ux sessions (bounded, not-run, never backfilled). */
export function writeUxPlaceholders(manifest, root = process.cwd()) {
  const evidenceDir = resolveEvidenceDir(manifest, root);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const written = [];
  for (const name of ['ux-results.json', 'comfort-observation.json']) {
    const file = path.join(evidenceDir, name);
    const payload = {
      status: 'not-run',
      note: 'QV5 guided UX runner not yet implemented; placeholder written at launch.',
    };
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    written.push(file);
  }
  return written;
}

/** Write the full set of QV3 per-session evidence files at launch. */
export function writeEvidencePlaceholders(manifest, root = process.cwd()) {
  const written = [writeAnalysisPlaceholder(manifest, root)];
  written.push(writeDispositionFile(manifest, deriveLaunchDisposition(manifest), root));
  if (manifest.validationMode === 'quest-ux') {
    written.push(...writeUxPlaceholders(manifest, root));
  }
  return written;
}

export function printSessionSummary(manifest) {
  const lines = [
    '',
    'VALIDATION SESSION',
    `Build: ${manifest.buildId.slice(0, 7)} (${manifest.buildId})`,
    `Working tree: ${manifest.worktree.toUpperCase()}`,
    `Validation mode: ${manifest.validationMode}`,
    `Gate: ${manifest.gates.join(', ') || 'none'}`,
    `Profile: ${manifest.profile ?? 'none'}`,
    `Evidence class: ${manifest.evidenceClass}`,
    `Runtime class: ${manifest.runtimeClass}`,
    `Promotion eligibility: ${manifest.promotionEligible ? 'YES' : 'NO'}`,
    `Session ID: ${manifest.sessionId}`,
    `Evidence directory: ${manifest.evidenceDir}`,
  ];
  if (manifest.invalidations.length > 0) {
    lines.push('Invalidations:');
    for (const reason of manifest.invalidations) lines.push(`  - ${reason}`);
  }
  lines.push('Quest-accessible URL: https://<lan-ip>:5173 (see Vite output)');
  lines.push('');
  process.stdout.write(`${lines.join('\n')}\n`);
}

function resolveViteCommand(root = process.cwd()) {
  const bin = process.platform === 'win32' ? 'vite.cmd' : 'vite';
  const local = path.join(root, 'node_modules', '.bin', bin);
  return fs.existsSync(local) ? local : 'vite';
}

/**
 * Launch a validation session. Exits non-zero (fail closed) rather than
 * writing a manifest when Git attribution cannot be resolved or the derived
 * manifest fails schema validation.
 */
export function main(argv = process.argv, env = process.env, root = process.cwd()) {
  const mode = argv[2];
  if (!(mode in VALIDATION_MODE_TABLE)) {
    process.stderr.write(
      `Unknown validation mode '${mode ?? '(none)'}'. Valid modes: ${Object.keys(VALIDATION_MODE_TABLE).join(', ')}\n`
    );
    return 2;
  }
  const spec = VALIDATION_MODE_TABLE[mode];

  let manifest;
  try {
    manifest = buildValidationContext({ mode, git: runGit, now: () => new Date() });
  } catch (error) {
    process.stderr.write(
      `[quest-validation] cannot attribute this run: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 2;
  }

  const validated = validateValidationManifest(manifest);
  if (!validated.ok) {
    process.stderr.write('[quest-validation] generated manifest failed schema validation:\n');
    for (const err of validated.errors) process.stderr.write(`  - ${err}\n`);
    return 2;
  }

  const manifestPath = writeManifestFile(validated.manifest, root);
  const evidenceFiles = writeEvidencePlaceholders(validated.manifest, root);
  printSessionSummary(validated.manifest);
  process.stderr.write(`[quest-validation] manifest written to ${manifestPath}\n`);
  for (const file of evidenceFiles) {
    process.stderr.write(`[quest-validation] evidence file written to ${file}\n`);
  }

  if (spec.wasmRequired) {
    const wasm = spawnSync('npm', ['run', 'wasm:dev'], { stdio: 'inherit', cwd: root });
    if (wasm.status !== 0) {
      process.stderr.write('[quest-validation] WASM dev build failed; aborting session\n');
      try {
        const disposition = writeDispositionFile(
          validated.manifest,
          { status: 'FAIL', reasons: ['WASM dev build failed; session aborted before Vite start'] },
          root
        );
        process.stderr.write(`[quest-validation] aborted disposition recorded to ${disposition}\n`);
      } catch (error) {
        process.stderr.write(
          `[quest-validation] failed to record aborted disposition: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
      return wasm.status ?? 1;
    }
  }

  const child = spawn(resolveViteCommand(root), ['--host'], {
    stdio: 'inherit',
    cwd: root,
    env: {
      ...env,
      VITE_NEMOSYNE_BUILD_ID: validated.manifest.buildId,
      VITE_NEMOSYNE_VALIDATION_MODE: validated.manifest.validationMode,
      VITE_NEMOSYNE_VALIDATION_SESSION_ID: validated.manifest.sessionId,
      VITE_NEMOSYNE_VALIDATION_SESSION_LABEL: validated.manifest.sessionLabel,
      VITE_NEMOSYNE_VALIDATION_EVIDENCE_DIR: validated.manifest.evidenceDir,
      VITE_NEMOSYNE_WORKTREE: validated.manifest.worktree,
    },
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 0;
  });
  return undefined;
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const code = main();
  if (typeof code === 'number') process.exitCode = code;
}
