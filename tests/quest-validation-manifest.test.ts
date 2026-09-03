import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  MANIFEST_SCHEMA_VERSION,
  VALIDATION_MODE_TABLE,
  deriveValidationManifest,
  validateValidationManifest,
  type ValidationManifestInput,
} from '../src/validation/validation-manifest.ts';
import {
  FALLBACK_BUILD_ID,
  VALIDATION_LOG_ROOT,
  buildValidationContext,
  generateSessionId,
  generateSessionLabel,
  main,
  resolveGitHead,
  resolveWorktreeState,
  writeManifestFile,
  runGit,
  type GitResult,
  type GitFn,
} from '../scripts/quest-validation.mjs';

const FAKE_SHA = 'a8be01af10e36e595e52571c91613cc070035b51';
const FAKE_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{40}$/i;

function fakeGitOk(stdout: string): GitFn {
  return (): GitResult => ({ ok: true, stdout });
}

function fakeGitFail(error: Error = new Error('git unavailable')): GitFn {
  return (): GitResult => ({ ok: false, error });
}

/** Mimics real git dispatch: returns a per-command stdout for HEAD/porcelain. */
function fakeGitDispatch(stdoutByArgs: Record<string, string>): GitFn {
  return (args: string[]): GitResult => {
    const stdout = stdoutByArgs[args.join(' ')];
    return stdout === undefined ? { ok: true, stdout: '' } : { ok: true, stdout };
  };
}

function baseInput(overrides: Partial<ValidationManifestInput> = {}): ValidationManifestInput {
  return {
    sessionId: FAKE_UUID,
    sessionLabel: 'PERF04-a8be01a-20260829T104512',
    buildId: FAKE_SHA,
    worktree: 'clean',
    mode: 'quest-perf',
    createdAt: '2026-08-29T10:45:12.000Z',
    ...overrides,
  };
}

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true });
});

function tempRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-qv-b1-'));
  tempDirectories.push(directory);
  return directory;
}

describe('QV0 validation manifest schema', () => {
  it('is versioned to a single supported schema version', () => {
    expect(MANIFEST_SCHEMA_VERSION).toBe('1');
    const manifest = deriveValidationManifest(baseInput());
    expect(manifest.schemaVersion).toBe('1');
  });

  it('derives a manifest that passes its own schema validation', () => {
    const manifest = deriveValidationManifest(baseInput());
    const validation = validateValidationManifest(manifest);
    expect(validation.ok).toBe(true);
    if (validation.ok) expect(validation.manifest).toEqual(manifest);
  });

  it('fails closed on an unknown future schema version', () => {
    const manifest = deriveValidationManifest(baseInput());
    const foreign = { ...manifest, schemaVersion: '2' };
    const validation = validateValidationManifest(foreign);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.join('\n')).toMatch(/unsupported schemaVersion "2"/);
    }
  });

  it('fails closed when required fields are missing', () => {
    const missing: Record<string, unknown> = { ...deriveValidationManifest(baseInput()) };
    delete missing.buildId;
    delete missing.sessionId;
    const validation = validateValidationManifest(missing);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.join('\n')).toMatch(/sessionId must be a UUID/);
      expect(validation.errors.join('\n')).toMatch(/buildId must be a non-empty/);
    }
  });

  it('rejects the unversioned fallback build identity', () => {
    const manifest = deriveValidationManifest(baseInput());
    const fallback = { ...manifest, buildId: FALLBACK_BUILD_ID };
    expect(validateValidationManifest(fallback).ok).toBe(false);
    const fallbackLiteral = { ...manifest, buildId: 'unversioned-local-build' };
    const validation = validateValidationManifest(fallbackLiteral);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.join('\n')).toMatch(/fallback unversioned build identity/);
    }
  });

  it('rejects unknown evidence classes, runtime classes, modes, and worktree states', () => {
    const manifest = deriveValidationManifest(baseInput());
    const cases = [
      { evidenceClass: 'simulator-evidence' },
      { runtimeClass: 'production-vite' },
      { validationMode: 'quest-final' },
      { worktree: 'cleanish' },
    ];
    for (const patch of cases) {
      expect(validateValidationManifest({ ...manifest, ...patch }).ok).toBe(false);
    }
  });

  it('keeps evidence class and gate disposition as separate fields', () => {
    const manifest = deriveValidationManifest(baseInput());
    expect(manifest.evidenceClass).toBe('governed-physical-validation');
    expect(manifest.gateDisposition).toEqual({ status: null, reasons: [] });
    expect(Object.keys(manifest)).toContain('evidenceClass');
    expect(Object.keys(manifest)).toContain('gateDisposition');
  });

  it('rejects malformed disposition statuses and non-boolean promotionEligible', () => {
    const manifest = deriveValidationManifest(baseInput());
    expect(
      validateValidationManifest({
        ...manifest,
        gateDisposition: { status: 'APPROVED', reasons: [] },
      }).ok
    ).toBe(false);
    expect(validateValidationManifest({ ...manifest, promotionEligible: 'yes' }).ok).toBe(false);
  });

  it('rejects a self-contradictory promotionEligible/invalidations pair', () => {
    const dirty = deriveValidationManifest(baseInput({ worktree: 'dirty' }));
    expect(dirty.promotionEligible).toBe(false);
    expect(validateValidationManifest({ ...dirty, promotionEligible: true }).ok).toBe(false);
    const clean = deriveValidationManifest(baseInput());
    expect(clean.promotionEligible).toBe(true);
    expect(validateValidationManifest({ ...clean, promotionEligible: false }).ok).toBe(false);
  });
});

describe('QV1 mode/gate/profile/evidence/runtime mapping', () => {
  it('maps quest-perf to PERF-04/PERF-05 and the quest-3s-qualification profile', () => {
    const manifest = deriveValidationManifest(baseInput({ mode: 'quest-perf' }));
    expect(manifest.gates).toEqual(['PERF-04', 'PERF-05']);
    expect(manifest.profile).toBe('quest-3s-qualification');
    expect(manifest.evidenceClass).toBe('governed-physical-validation');
    expect(manifest.runtimeClass).toBe('vite-dev');
  });

  it('maps quest to an exploratory physical-device trial', () => {
    const manifest = deriveValidationManifest(baseInput({ mode: 'quest' }));
    expect(manifest.gates).toEqual([]);
    expect(manifest.profile).toBeNull();
    expect(manifest.evidenceClass).toBe('physical-device-trial');
    expect(manifest.runtimeClass).toBe('vite-dev');
  });

  it('maps quest-ux to governed UX evidence', () => {
    const manifest = deriveValidationManifest(baseInput({ mode: 'quest-ux' }));
    expect(manifest.gates).toEqual(['UX-03', 'RF-049', 'RF-050', 'P1-U9']);
    expect(manifest.profile).toBe('ux-03-guided-tasks');
    expect(manifest.evidenceClass).toBe('governed-physical-validation');
    expect(manifest.runtimeClass).toBe('vite-dev');
  });

  it('maps quest-10m to governed boundary evidence that is never final qualification', () => {
    const manifest = deriveValidationManifest(baseInput({ mode: 'quest-10m' }));
    expect(manifest.gates).toEqual(['RF-029', 'RF-051']);
    expect(manifest.profile).toBe('quest-3s-rust-boundary-10m');
    expect(manifest.evidenceClass).toBe('governed-physical-validation');
    expect(manifest.invalidations).toContain(
      'quest-10m boundary probe is not final 10M device qualification'
    );
    expect(manifest.promotionEligible).toBe(false);
  });

  it('maps quest-validate to an orchestration entry, not a governed claim', () => {
    const manifest = deriveValidationManifest(baseInput({ mode: 'quest-validate' }));
    expect(manifest.evidenceClass).toBe('physical-device-trial');
    expect(manifest.promotionEligible).toBe(false);
  });

  it('assigns runtime class vite-dev to every dev validation mode', () => {
    for (const mode of Object.keys(VALIDATION_MODE_TABLE) as Array<
      keyof typeof VALIDATION_MODE_TABLE
    >) {
      const manifest = deriveValidationManifest(baseInput({ mode }));
      expect(manifest.runtimeClass).toBe('vite-dev');
    }
  });

  it('points profiles at the owned profile definitions in the codebase', () => {
    const loadTestDriver = readFileSync(
      resolve(process.cwd(), 'src/vr/scalability/LoadTestDriver.ts'),
      'utf8'
    );
    const boundaryProbe = readFileSync(
      resolve(process.cwd(), 'src/vr/scalability/QuestBoundaryProbe.ts'),
      'utf8'
    );
    expect(loadTestDriver).toContain("name: 'quest-3s-qualification'");
    expect(boundaryProbe).toContain("profileName: 'quest-3s-rust-boundary-10m'");
    expect(VALIDATION_MODE_TABLE['quest-perf'].profile).toBe('quest-3s-qualification');
    expect(VALIDATION_MODE_TABLE['quest-10m'].profile).toBe('quest-3s-rust-boundary-10m');
  });
});

describe('QV1 promotion eligibility', () => {
  it('a clean worktree with governed evidence is promotion-eligible', () => {
    const manifest = deriveValidationManifest(baseInput({ worktree: 'clean' }));
    expect(manifest.promotionEligible).toBe(true);
    expect(manifest.invalidations).toEqual([]);
  });

  it('a dirty worktree is promotion-ineligible with an invalidation reason', () => {
    const manifest = deriveValidationManifest(baseInput({ worktree: 'dirty' }));
    expect(manifest.worktree).toBe('dirty');
    expect(manifest.promotionEligible).toBe(false);
    expect(manifest.invalidations).toContain(
      "worktree state is 'dirty'; exact-source reproducibility cannot be claimed"
    );
  });

  it('an unknown worktree is promotion-ineligible', () => {
    const manifest = deriveValidationManifest(baseInput({ worktree: 'unknown' }));
    expect(manifest.promotionEligible).toBe(false);
  });

  it('a physical-device trial is promotion-ineligible even with a clean tree', () => {
    const manifest = deriveValidationManifest(baseInput({ mode: 'quest', worktree: 'clean' }));
    expect(manifest.worktree).toBe('clean');
    expect(manifest.promotionEligible).toBe(false);
  });
});

describe('QV1 launcher derivation', () => {
  it('resolves the exact Git HEAD SHA through a fake git exec', () => {
    expect(resolveGitHead(fakeGitOk(FAKE_SHA))).toBe(FAKE_SHA);
  });

  it('fails closed (throws, no fallback) when git HEAD cannot be resolved', () => {
    expect(() => resolveGitHead(fakeGitFail())).toThrow(/failed to resolve git HEAD/);
  });

  it('fails closed when git returns a non-40-hex identity', () => {
    expect(() => resolveGitHead(fakeGitOk('short-sha'))).toThrow(/not an exact 40-hex SHA/);
    expect(() => resolveGitHead(fakeGitOk(''))).toThrow(/not an exact 40-hex SHA/);
  });

  it('detects clean, dirty, and unknown worktree states', () => {
    expect(resolveWorktreeState(fakeGitOk(''))).toBe('clean');
    expect(resolveWorktreeState(fakeGitOk(' M src/foo.ts\n'))).toBe('dirty');
    expect(resolveWorktreeState(fakeGitFail())).toBe('unknown');
  });

  it('generates session IDs in UUID format', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = generateSessionId();
      expect(id).toMatch(UUID_RE);
      expect(generateSessionId()).not.toBe(generateSessionId());
    }
  });

  it('builds a human-readable session label', () => {
    const label = generateSessionLabel(
      'quest-perf',
      FAKE_SHA,
      () => new Date('2026-08-29T10:45:12.000Z')
    );
    expect(label).toBe('PERF04-a8be01a-20260829T104512');
  });

  it('derives a full valid context through the launcher with fake git', () => {
    const manifest = buildValidationContext({
      mode: 'quest-perf',
      git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
      sessionId: FAKE_UUID,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
      device: { declaredQuestModel: 'META_QUEST_3S', declaredFirmwareVersion: 'v72' },
    });
    expect(manifest.buildId).toBe(FAKE_SHA);
    expect(manifest.sessionId).toMatch(UUID_RE);
    expect(manifest.sessionLabel).toBe('PERF04-a8be01a-20260829T104512');
    expect(manifest.worktree).toBe('clean');
    expect(manifest.declaredQuestModel).toBe('META_QUEST_3S');
    expect(manifest.declaredFirmwareVersion).toBe('v72');
    expect(validateValidationManifest(manifest).ok).toBe(true);
  });

  it('a dirty worktree through the launcher still emits a valid, promotion-ineligible manifest', () => {
    const manifest = buildValidationContext({
      mode: 'quest-perf',
      git: fakeGitDispatch({
        'rev-parse HEAD': FAKE_SHA,
        'status --porcelain': ' M src/validation/validation-manifest.ts\n',
      }),
      sessionId: FAKE_UUID,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
    });
    const validation = validateValidationManifest(manifest);
    expect(validation.ok).toBe(true);
    expect(manifest.worktree).toBe('dirty');
    expect(manifest.promotionEligible).toBe(false);
    expect(manifest.invalidations.length).toBeGreaterThan(0);
  });

  it('resolves the real repo HEAD and emits a valid manifest end-to-end', () => {
    const head = resolveGitHead(runGit);
    expect(head).toMatch(SHA_RE);
    const manifest = buildValidationContext({
      mode: 'quest-perf',
      git: runGit,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
    });
    expect(manifest.buildId).toBe(head);
    const validation = validateValidationManifest(manifest);
    expect(validation.ok).toBe(true);
    expect(manifest.runtimeClass).toBe('vite-dev');
    expect(manifest.evidenceClass).toBe('governed-physical-validation');
  });
});

describe('QV1 evidence directory isolation', () => {
  it('writes the manifest under logs/validation and round-trips through schema validation', () => {
    const root = tempRoot();
    const manifest = buildValidationContext({
      mode: 'quest-perf',
      git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
      sessionId: FAKE_UUID,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
    });
    const file = writeManifestFile(manifest, root);
    expect(file.startsWith(join(root, VALIDATION_LOG_ROOT))).toBe(true);
    const written = JSON.parse(readFileSync(file, 'utf8'));
    expect(validateValidationManifest(written).ok).toBe(true);
  });

  it('refuses an evidence directory that escapes the validation root', () => {
    const root = tempRoot();
    expect(() => writeManifestFile({ evidenceDir: '../escape' }, root)).toThrow(
      /escapes validation root/
    );
    expect(() => writeManifestFile({ evidenceDir: '/absolute/escape' }, root)).toThrow(
      /escapes validation root|outside/
    );
    expect(() => writeManifestFile({ evidenceDir: 'tmp/other' }, root)).toThrow(
      /outside logs\/validation/
    );
  });
});

describe('QV1 npm script surface', () => {
  it('keeps ordinary dev scripts loopback-only and requires explicit LAN opt-in', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts.dev).toBe('vite');
    expect(pkg.scripts['dev:wasm']).toBe('npm run wasm:dev && vite');
    expect(pkg.scripts['dev:lan']).toBe('vite --host 0.0.0.0');
    expect(pkg.scripts['dev:wasm:lan']).toBe('npm run wasm:dev && vite --host 0.0.0.0');
  });

  it('exposes the validation run modes', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['dev:quest']).toBe('node scripts/quest-validation.mjs quest');
    expect(pkg.scripts['dev:quest:perf']).toBe('node scripts/quest-validation.mjs quest-perf');
    expect(pkg.scripts['dev:quest:ux']).toBe('node scripts/quest-validation.mjs quest-ux');
    expect(pkg.scripts['dev:quest:10m']).toBe('node scripts/quest-validation.mjs quest-10m');
    expect(pkg.scripts['dev:quest:validate']).toBe(
      'node scripts/quest-validation.mjs quest-validate'
    );
  });

  it('rejects an unknown mode without spawning Vite or writing evidence', () => {
    const root = tempRoot();
    const result = main(['node', 'quest-validation.mjs', 'bogus'], {}, root);
    expect(result).toBe(2);
    expect(readdirSync(root)).toHaveLength(0);
  });
});
