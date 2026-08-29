import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateValidationManifest,
  deriveValidationManifest,
  type ValidationMode,
} from '../src/validation/validation-manifest.ts';
import { captureQuestRuntimeEnvironment } from '../src/vr/scalability/QuestTelemetry.ts';
import {
  DEVICE_DECLARATION_FILE,
  VALIDATION_LOG_ROOT,
  applyDeviceDeclarationGate,
  buildValidationContext,
  mergeDeviceDeclaration,
  readDeviceDeclaration,
  writeDeviceDeclaration,
  type DeviceDeclaration,
  type GitResult,
  type GitFn,
} from '../scripts/quest-validation.mjs';
import {
  main as cliMain,
  printDeviceDeclaration,
  parseSetArgs,
} from '../scripts/quest-device-declaration.mjs';

const FAKE_SHA = 'a8be01af10e36e595e52571c91613cc070035b51';
const FAKE_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function fakeGitDispatch(stdoutByArgs: Record<string, string>): GitFn {
  return (args: string[]): GitResult => {
    const stdout = stdoutByArgs[args.join(' ')];
    return stdout === undefined ? { ok: true, stdout: '' } : { ok: true, stdout };
  };
}

function contextArgs(
  overrides: { mode?: ValidationMode; device?: Partial<DeviceDeclaration> } = {}
) {
  return {
    mode: overrides.mode ?? 'quest-perf',
    git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
    sessionId: FAKE_UUID,
    now: () => new Date('2026-08-29T10:45:12.000Z'),
    device: overrides.device,
  };
}

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true });
});

function tempRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-qv-b2-device-'));
  tempDirectories.push(directory);
  return directory;
}

describe('QV2 device declaration store', () => {
  it('writes a declaration and reads it back with all four fields', () => {
    const root = tempRoot();
    const declaration = {
      label: 'Lab unit A',
      declaredQuestModel: 'Meta Quest 3S',
      declaredFirmwareVersion: 'v72',
      investigator: 'T.A.',
    };
    const file = writeDeviceDeclaration(declaration, root);
    expect(file).toBe(join(root, VALIDATION_LOG_ROOT, DEVICE_DECLARATION_FILE));
    expect(readDeviceDeclaration(root)).toEqual(declaration);
    const onDisk = JSON.parse(readFileSync(file, 'utf8'));
    expect(onDisk).toEqual(declaration);
  });

  it('returns nulls for a missing declaration file (never guesses)', () => {
    const root = tempRoot();
    expect(readDeviceDeclaration(root)).toEqual({
      label: null,
      declaredQuestModel: null,
      declaredFirmwareVersion: null,
      investigator: null,
    });
  });

  it('tolerates a malformed declaration file and partial fields', () => {
    const root = tempRoot();
    const file = join(root, VALIDATION_LOG_ROOT, DEVICE_DECLARATION_FILE);
    mkdirSync(join(root, VALIDATION_LOG_ROOT), { recursive: true });
    writeFileSync(file, '{ not json', 'utf8');
    expect(readDeviceDeclaration(root)).toEqual({
      label: null,
      declaredQuestModel: null,
      declaredFirmwareVersion: null,
      investigator: null,
    });
    writeFileSync(file, JSON.stringify({ declaredQuestModel: 'Meta Quest 3S' }), 'utf8');
    expect(readDeviceDeclaration(root).declaredQuestModel).toBe('Meta Quest 3S');
    expect(readDeviceDeclaration(root).label).toBeNull();
  });

  it('merges updates, keeps unspecified fields, and clears on explicit empty value', () => {
    const current = {
      label: 'Lab unit A',
      declaredQuestModel: 'Meta Quest 3S',
      declaredFirmwareVersion: 'v72',
      investigator: 'T.A.',
    };
    const merged = mergeDeviceDeclaration(current, { declaredFirmwareVersion: 'v74' });
    expect(merged).toEqual({ ...current, declaredFirmwareVersion: 'v74' });
    const cleared = mergeDeviceDeclaration(merged, { label: '' });
    expect(cleared.label).toBeNull();
    expect(cleared.declaredQuestModel).toBe('Meta Quest 3S');
  });
});

describe('QV2 governed-mode missing-declaration gate', () => {
  it('downgrades a governed mode with a missing declaration to promotion-ineligible with invalidations', () => {
    const manifest = buildValidationContext(contextArgs());
    const validation = validateValidationManifest(manifest);
    expect(validation.ok).toBe(true);
    expect(manifest.declaredQuestModel).toBeNull();
    expect(manifest.declaredFirmwareVersion).toBeNull();
    expect(manifest.promotionEligible).toBe(false);
    expect(manifest.invalidations.some((reason) => reason.includes('declaredQuestModel'))).toBe(
      true
    );
    expect(
      manifest.invalidations.some((reason) => reason.includes('declaredFirmwareVersion'))
    ).toBe(true);
  });

  it('keeps a governed mode eligible when the declaration is complete', () => {
    const manifest = buildValidationContext(
      contextArgs({
        device: { declaredQuestModel: 'Meta Quest 3S', declaredFirmwareVersion: 'v72' },
      })
    );
    expect(manifest.promotionEligible).toBe(true);
    expect(manifest.invalidations).toEqual([]);
    expect(validateValidationManifest(manifest).ok).toBe(true);
  });

  it('lets the informational quest mode proceed without a declaration invalidation', () => {
    const manifest = buildValidationContext(contextArgs({ mode: 'quest' }));
    expect(validateValidationManifest(manifest).ok).toBe(true);
    expect(manifest.evidenceClass).toBe('physical-device-trial');
    expect(manifest.invalidations.some((reason) => reason.includes('declaredQuestModel'))).toBe(
      false
    );
    expect(
      manifest.invalidations.some((reason) => reason.includes('declaredFirmwareVersion'))
    ).toBe(false);
  });

  it('does not mutate the pure manifest derivation contract', () => {
    const derived = deriveValidationManifest({
      sessionId: FAKE_UUID,
      sessionLabel: 'PERF04-a8be01a-20260829T104512',
      buildId: FAKE_SHA,
      worktree: 'clean',
      mode: 'quest-perf',
    });
    expect(derived.promotionEligible).toBe(true);
    expect(applyDeviceDeclarationGate(derived).promotionEligible).toBe(false);
    expect(derived.promotionEligible).toBe(true);
  });

  it('keeps runtime-measured and investigator-declared facts distinct', () => {
    const root = tempRoot();
    const declaration = {
      label: 'Lab unit A',
      declaredQuestModel: 'Meta Quest 3S',
      declaredFirmwareVersion: 'v72',
      investigator: 'T.A.',
    };
    writeDeviceDeclaration(declaration, root);
    const read = readDeviceDeclaration(root);
    expect(read).toEqual(declaration);

    const gl = {
      VENDOR: 1,
      RENDERER: 2,
      VERSION: 3,
      getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 4, UNMASKED_RENDERER_WEBGL: 5 }),
      getParameter: (key: number) => ({ 3: 'WebGL 2', 4: 'Qualcomm', 5: 'Adreno' })[key],
    };
    const session = {
      visibilityState: 'visible',
      environmentBlendMode: 'opaque',
      interactionMode: 'world-space',
      frameRate: 72,
      supportedFrameRates: new Float32Array([72, 90]),
      renderState: { baseLayer: { framebufferWidth: 1832, framebufferHeight: 1920 } },
    };
    const runtime = captureQuestRuntimeEnvironment(
      { renderer: { xr: { getSession: () => session }, getContext: () => gl } },
      'META_QUEST_3S'
    );

    expect(runtime.identityBasis).toBe('investigator-declared');
    expect(typeof runtime.userAgent).toBe('string');
    expect(runtime.userAgent).not.toBe(declaration.declaredQuestModel);
    expect(runtime.webgl.renderer).toBe('Adreno');
    expect(runtime.xr.nominalFrameRateHz).toBe(72);

    const manifest = buildValidationContext(contextArgs({ device: read, mode: 'quest-perf' }));
    expect(manifest.declaredQuestModel).toBe(declaration.declaredQuestModel);
    expect(manifest.declaredFirmwareVersion).toBe(declaration.declaredFirmwareVersion);
    expect(runtime.declaredFirmwareVersion).not.toBe(declaration.declaredFirmwareVersion);
  });
});

describe('QV2 device declaration CLI', () => {
  it('parses set flags into declaration fields', () => {
    const parsed = parseSetArgs([
      'node',
      'quest-device-declaration.mjs',
      'set',
      '--model',
      'Meta Quest 3S',
      '--firmware',
      'v72',
      '--label',
      'Lab unit A',
      '--investigator',
      'T.A.',
    ]);
    expect(parsed).toEqual({
      updates: {
        declaredQuestModel: 'Meta Quest 3S',
        declaredFirmwareVersion: 'v72',
        label: 'Lab unit A',
        investigator: 'T.A.',
      },
    });
  });

  it('rejects unknown flags', () => {
    const parsed = parseSetArgs(['node', 'script', 'set', '--bogus', 'x']);
    expect('error' in parsed && parsed.error).toMatch(/unknown flag/);
  });

  it('set writes the declaration and show prints it back', () => {
    const root = tempRoot();
    const written: string[] = [];
    const write = (text: string) => written.push(text);

    const code = cliMain(
      [
        'node',
        'quest-device-declaration.mjs',
        'set',
        '--model',
        'Meta Quest 3S',
        '--firmware',
        'v72',
        '--label',
        'Lab unit A',
        '--investigator',
        'T.A.',
      ],
      root,
      write
    );
    expect(code).toBe(0);
    expect(readDeviceDeclaration(root).declaredQuestModel).toBe('Meta Quest 3S');

    const shown: string[] = [];
    const showCode = cliMain(
      ['node', 'quest-device-declaration.mjs', 'show'],
      root,
      (text: string) => shown.push(text)
    );
    expect(showCode).toBe(0);
    const output = shown.join('');
    expect(output).toContain('Meta Quest 3S');
    expect(output).toContain('v72');
    expect(output).toContain('Lab unit A');
    expect(output).toContain('T.A.');
  });

  it('unknown command exits non-zero', () => {
    const root = tempRoot();
    const written: string[] = [];
    expect(
      cliMain(['node', 'quest-device-declaration.mjs', 'bogus'], root, (t) => written.push(t))
    ).toBe(2);
    expect(written.join('')).toMatch(/Unknown command/);
  });

  it('print marks unset fields without inventing values', () => {
    const lines: string[] = [];
    printDeviceDeclaration(
      { label: null, declaredQuestModel: null, declaredFirmwareVersion: null, investigator: null },
      tempRoot(),
      (text: string) => lines.push(text)
    );
    expect(lines.join('')).toContain('(unset)');
  });
});
