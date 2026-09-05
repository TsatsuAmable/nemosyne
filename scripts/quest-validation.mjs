#!/usr/bin/env node
/**
 * Quest validation launcher (QV1-QV3 + QV2a ADB device attribution).
 *
 * Thin Node launcher that derives truthful attribution for a physical Quest
 * validation session and starts the existing Vite dev server:
 *
 *   1. resolves the exact Git HEAD SHA;
 *   2. determines clean/dirty/unknown worktree state via `git status --porcelain`;
 *   3. captures Quest model + exact OS/build identity from one authorised ADB device;
 *   4. maps the selected mode to its governed gate/profile + evidence/runtime class;
 *   5. generates a session ID + human-readable session label;
 *   6. writes the versioned manifest to `logs/validation/<sessionLabel>/manifest.json`;
 *   7. builds the WASM dev kernel when the mode requires it;
 *   8. spawns `vite --host` with source/session/device identity metadata in env.
 *
 * Fail-closed behavior:
 * - if Git HEAD cannot be resolved, launch is refused;
 * - governed physical evidence cannot be promotion-eligible without machine-captured
 *   ADB identity; manual model/firmware declarations are exploratory fallbacks only.
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
import {
  captureAdbQuestDevice,
  QUEST_ADB_SERIAL_ENV,
} from './quest-adb-device.mjs';

export const VALIDATION_LOG_ROOT = 'logs/validation';
export const FALLBACK_BUILD_ID = 'unversioned-local-build';

const GIT_SHA_RE = /^[0-9a-f]{40}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WASM_DIAGNOSTIC_PROBE_TIMEOUT_MS = 1000;
const WASM_DIAGNOSTIC_PROBE_MAX_TIMEOUT_MS = 5000;

/**
 * Resolve npm without depending on an executable shell shim.
 *
 * `npm run dev:quest` provides `npm_execpath`, so prefer launching that JS CLI
 * through the current Node executable. Direct Windows launcher usage falls back
 * to `cmd.exe /c npm`, which is the supported way to execute npm's `.cmd` shim.
 */
export function resolveNpmInvocation(env = process.env, platform = process.platform) {
  const npmExecPath =
    typeof env.npm_execpath === 'string' && env.npm_execpath.trim().length > 0
      ? env.npm_execpath.trim()
      : null;
  if (npmExecPath) {
    return { command: process.execPath, args: [npmExecPath] };
  }
  if (platform === 'win32') {
    const comspec =
      typeof env.ComSpec === 'string' && env.ComSpec.trim().length > 0
        ? env.ComSpec.trim()
        : typeof env.COMSPEC === 'string' && env.COMSPEC.trim().length > 0
          ? env.COMSPEC.trim()
          : 'cmd.exe';
    return { command: comspec, args: ['/d', '/s', '/c', 'npm'] };
  }
  return { command: 'npm', args: [] };
}

/**
 * Prefer Vite's JS entry point over `.cmd`/shell shims so the launcher behaves
 * the same on Windows, macOS and Linux. The shim fallback remains for unusual
 * installations where the package CLI path is unavailable.
 */
export function resolveViteInvocation(root = process.cwd(), platform = process.platform) {
  const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(viteCli)) {
    return { command: process.execPath, args: [viteCli] };
  }
  const bin = platform === 'win32' ? 'vite.cmd' : 'vite';
  const local = path.join(root, 'node_modules', '.bin', bin);
  return { command: fs.existsSync(local) ? local : 'vite', args: [] };
}

function runWasmDevBuild({
  root = process.cwd(),
  env = process.env,
  platform = process.platform,
  spawnSyncFn = spawnSync,
} = {}) {
  const invocation = resolveNpmInvocation(env, platform);
  return spawnSyncFn(invocation.command, [...invocation.args, 'run', 'wasm:dev'], {
    stdio: 'inherit',
    cwd: root,
    env,
  });
}

/**
 * Best-effort WASM prerequisite diagnostics for the 7/14 governed sessions
 * that abort with `WASM dev build failed; session aborted before Vite start`.
 *
 * Pure collection: never throws, never edits source. Each external version probe
 * is strictly time-bounded so diagnostics can never indefinitely delay writing
 * the authoritative FAIL disposition. Promotion semantics are untouched.
 */
export function collectWasmBuildDiagnostics({
  root = process.cwd(),
  wasm = {},
  probeSyncFn = spawnSync,
  probeTimeoutMs = WASM_DIAGNOSTIC_PROBE_TIMEOUT_MS,
} = {}) {
  const boundedProbeTimeoutMs =
    Number.isFinite(probeTimeoutMs) && probeTimeoutMs > 0
      ? Math.min(probeTimeoutMs, WASM_DIAGNOSTIC_PROBE_MAX_TIMEOUT_MS)
      : WASM_DIAGNOSTIC_PROBE_TIMEOUT_MS;
  const probe = (command, args) => {
    try {
      const result = probeSyncFn(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: boundedProbeTimeoutMs,
      });
      if (result?.error || result?.status !== 0) return null;
      return String(result?.stdout ?? '').trim().slice(0, 512) || null;
    } catch {
      return null;
    }
  };
  const exists = (rel) => {
    try {
      return fs.existsSync(path.join(root, rel));
    } catch {
      return false;
    }
  };
  return {
    recordedAt: new Date().toISOString(),
    status: typeof wasm?.status === 'number' ? wasm.status : null,
    launchError:
      wasm?.error instanceof Error ? wasm.error.message : wasm?.error ? String(wasm.error) : null,
    node: typeof process !== 'undefined' ? process.version : null,
    platform: typeof process !== 'undefined' ? process.platform : null,
    wasmPackVersion: probe('wasm-pack', ['--version']),
    cargoVersion: probe('cargo', ['--version']),
    rustcVersion: probe('rustc', ['--version']),
    wasmJsPresent: exists(path.join('wasm', 'pkg', 'nemosyne_wasm.js')),
    wasmBgPresent: exists(path.join('wasm', 'pkg', 'nemosyne_wasm_bg.wasm')),
    hint: 'Run `npm run wasm:dev` manually for full output; see docs/GETTING_STARTED.md for the Rust/wasm-pack fallback.',
  };
}

/** Persist diagnostics next to manifest/disposition; best-effort, never throws. */
export function writeWasmBuildLog(manifest, diagnostics, root = process.cwd()) {
  try {
    const evidenceDir = resolveEvidenceDir(manifest, root);
    fs.mkdirSync(evidenceDir, { recursive: true });
    const file = path.join(evidenceDir, 'build.log');
    fs.writeFileSync(file, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
    return file;
  } catch {
    return null;
  }
}

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

/** Resolve the exact Git HEAD SHA. Missing/invalid identity fails closed. */
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

/** `git status --porcelain`: any output is dirty; exec failure is unknown. */
export function resolveWorktreeState(git = runGit) {
  const result = git(['status', '--porcelain']);
  if (!result.ok) return 'unknown';
  return String(result.stdout).trim() === '' ? 'clean' : 'dirty';
}

export function generateSessionId() {
  const id = randomUUID();
  if (!UUID_RE.test(id)) throw new Error(`session ID generator produced an invalid UUID: ${id}`);
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

/** Human-readable `<gate-or-mode>-<sha7>-<yyyymmddThhmmss>` session label. */
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
 * Read legacy/manual local declaration facts.
 *
 * Model/firmware remain for backwards-compatible exploratory runs, but governed
 * physical evidence now requires `deviceIdentity.captureBasis=adb-system-property`.
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

export function mergeDeviceDeclaration(current = {}, updates = {}) {
  const merged = {};
  for (const key of DEVICE_DECLARATION_FIELDS) {
    const raw = updates[key] !== undefined ? updates[key] : current[key];
    merged[key] = declarationString(raw);
  }
  return merged;
}

export function writeDeviceDeclaration(declaration, root = process.cwd()) {
  const dir = path.join(root, VALIDATION_LOG_ROOT);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, DEVICE_DECLARATION_FILE);
  fs.writeFileSync(file, `${JSON.stringify(declaration, null, 2)}\n`, 'utf8');
  return file;
}

function isRecognisableQuest(identity) {
  const joined = `${identity?.manufacturer ?? ''} ${identity?.model ?? ''}`;
  return /quest|oculus|meta/i.test(joined);
}

/**
 * QV2a governed identity gate.
 *
 * Manual declarations no longer satisfy promotion-grade physical attribution.
 * One authorised ADB device must supply an exact build identity. Profile/device
 * compatibility is adjudicated downstream against governed evidence rather than
 * inferred from a brittle Android model-string heuristic at capture time.
 */
export function applyDeviceIdentityGate(manifest) {
  const spec = VALIDATION_MODE_TABLE[manifest.validationMode];
  if (!spec || spec.evidenceClass !== 'governed-physical-validation') return manifest;

  const invalidations = [...manifest.invalidations];
  const identity = manifest.deviceIdentity;
  if (!identity) {
    invalidations.push(
      `device identity: ${manifest.deviceIdentityError ?? 'ADB identity capture unavailable'}; ` +
        'governed physical validation requires machine-captured Quest model/build identity'
    );
  } else {
    if (!isRecognisableQuest(identity)) {
      invalidations.push(
        `device identity: ADB reported '${identity.manufacturer ?? 'unknown'} ${identity.model}', ` +
          'which is not recognisable as a Meta Quest device'
      );
    }
  }

  if (invalidations.length === manifest.invalidations.length) return manifest;
  return { ...manifest, invalidations, promotionEligible: invalidations.length === 0 };
}

/** Backward-compatible export name; semantics are now the stronger machine identity gate. */
export const applyDeviceDeclarationGate = applyDeviceIdentityGate;

/**
 * Build the full validation context. Device capture is injected so unit tests do
 * not invoke host ADB; `main()` supplies the real capture on the production path.
 */
export function buildValidationContext({
  mode,
  git = runGit,
  sessionId = generateSessionId(),
  now = () => new Date(),
  device = readDeviceDeclaration(),
  deviceCapture = { ok: false, error: 'ADB identity capture was not supplied' },
}) {
  if (!(mode in VALIDATION_MODE_TABLE)) {
    throw new Error(
      `unknown validation mode '${mode}'; valid modes: ${Object.keys(VALIDATION_MODE_TABLE).join(', ')}`
    );
  }
  const buildId = resolveGitHead(git);
  const worktree = resolveWorktreeState(git);
  const sessionLabel = generateSessionLabel(mode, buildId, now);
  const identity = deviceCapture.ok ? deviceCapture.identity : null;
  const identityError = deviceCapture.ok ? null : deviceCapture.error;
  return applyDeviceIdentityGate(
    deriveValidationManifest({
      sessionId,
      sessionLabel,
      buildId,
      worktree,
      mode,
      createdAt: now().toISOString(),
      deviceIdentity: identity,
      deviceIdentityError: identityError,
      ...device,
    })
  );
}

/** Resolve per-session directory and refuse path traversal/escape. */
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

export function writeManifestFile(manifest, root = process.cwd()) {
  const evidenceDir = resolveEvidenceDir(manifest, root);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, 'manifest.json');
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return file;
}

/**
 * Launch-time disposition: attribution failures are INVALID_RUN. Mode-intrinsic
 * non-qualification reasons such as QUEST 10M remain pending for QV4.
 */
export function deriveLaunchDisposition(manifest) {
  const spec = VALIDATION_MODE_TABLE[manifest.validationMode];
  if (!spec || spec.evidenceClass !== 'governed-physical-validation') {
    return { status: null, reasons: [] };
  }
  const attributionBlockers = manifest.invalidations.filter((reason) => {
    if (reason.startsWith("worktree state is '")) return true;
    if (reason.startsWith('device identity:')) return true;
    return false;
  });
  if (attributionBlockers.length > 0) {
    return { status: 'INVALID_RUN', reasons: attributionBlockers };
  }
  return { status: null, reasons: [] };
}

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
    deviceIdentity: manifest.deviceIdentity,
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

export function writeEvidencePlaceholders(manifest, root = process.cwd()) {
  const written = [writeAnalysisPlaceholder(manifest, root)];
  written.push(writeDispositionFile(manifest, deriveLaunchDisposition(manifest), root));
  if (manifest.validationMode === 'quest-ux') written.push(...writeUxPlaceholders(manifest, root));
  return written;
}

export function printSessionSummary(manifest) {
  const identity = manifest.deviceIdentity;
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
    `Device identity: ${identity ? 'ADB MACHINE-CAPTURED' : 'UNAVAILABLE'}`,
    `Quest model: ${identity?.model ?? '(not captured)'}`,
    `Firmware/build: ${identity?.buildIncremental ?? '(not captured)'}`,
    `Build fingerprint: ${identity?.buildFingerprint ?? '(not captured)'}`,
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

export function main(argv = process.argv, env = process.env, root = process.cwd()) {
  const mode = argv[2];
  if (!(mode in VALIDATION_MODE_TABLE)) {
    process.stderr.write(
      `Unknown validation mode '${mode ?? '(none)'}'. Valid modes: ${Object.keys(VALIDATION_MODE_TABLE).join(', ')}\n`
    );
    return 2;
  }
  const spec = VALIDATION_MODE_TABLE[mode];

  const deviceCapture = captureAdbQuestDevice({
    selectedSerial: env[QUEST_ADB_SERIAL_ENV] ?? null,
  });

  let manifest;
  try {
    manifest = buildValidationContext({
      mode,
      git: runGit,
      now: () => new Date(),
      device: readDeviceDeclaration(root),
      deviceCapture,
    });
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
    const wasm = runWasmDevBuild({ root, env });
    if (wasm.error || wasm.status !== 0) {
      const reason = wasm.error
        ? `failed to launch npm for WASM dev build: ${wasm.error instanceof Error ? wasm.error.message : String(wasm.error)}`
        : `WASM dev build exited with status ${wasm.status ?? 'unknown'}`;
      process.stderr.write(`[quest-validation] ${reason}; aborting session\n`);
      try {
        const diagnostics = collectWasmBuildDiagnostics({ root, wasm });
        const buildLog = writeWasmBuildLog(validated.manifest, diagnostics, root);
        if (buildLog) {
          process.stderr.write(`[quest-validation] WASM diagnostics recorded to ${buildLog}\n`);
        }
      } catch (error) {
        process.stderr.write(
          `[quest-validation] failed to record WASM diagnostics: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
      try {
        const disposition = writeDispositionFile(
          validated.manifest,
          { status: 'FAIL', reasons: [`${reason}; session aborted before Vite start`] },
          root
        );
        process.stderr.write(`[quest-validation] aborted disposition recorded to ${disposition}\n`);
      } catch (error) {
        process.stderr.write(
          `[quest-validation] failed to record aborted disposition: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
      return typeof wasm.status === 'number' ? wasm.status : 1;
    }
  }

  const identity = validated.manifest.deviceIdentity;
  const vite = resolveViteInvocation(root);
  const child = spawn(vite.command, [...vite.args, '--host'], {
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
      VITE_NEMOSYNE_QUEST_IDENTITY_BASIS: identity?.captureBasis ?? '',
      VITE_NEMOSYNE_QUEST_MODEL: identity?.model ?? '',
      VITE_NEMOSYNE_QUEST_BUILD_INCREMENTAL: identity?.buildIncremental ?? '',
      VITE_NEMOSYNE_QUEST_BUILD_DISPLAY_ID: identity?.buildDisplayId ?? '',
      VITE_NEMOSYNE_QUEST_BUILD_FINGERPRINT: identity?.buildFingerprint ?? '',
      VITE_NEMOSYNE_QUEST_SECURITY_PATCH: identity?.securityPatch ?? '',
    },
  });
  child.on('error', (error) => {
    process.stderr.write(`[quest-validation] failed to launch Vite: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    if (typeof code === 'number') process.exitCode = code;
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
