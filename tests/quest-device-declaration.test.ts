import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateValidationManifest,
  deriveValidationManifest,
  type QuestDeviceIdentity,
  type ValidationMode,
} from '../src/validation/validation-manifest.ts';
import { captureQuestRuntimeEnvironment } from '../src/vr/scalability/QuestTelemetry.ts';
import {
  DEVICE_DECLARATION_FILE,
  VALIDATION_LOG_ROOT,
  applyDeviceIdentityGate,
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

function quest3sIdentity(overrides: Partial<QuestDeviceIdentity> = {}): QuestDeviceIdentity {
  return {
    captureBasis: 'adb-system-property',
    deviceIdHash: 'a'.repeat(64),
    model: 'Meta Quest 3S',
    manufacturer: 'Meta',
    buildIncremental: '5123456789012345678',
    buildDisplayId: 'SQ3A.220605.009.A1',
    buildFingerprint: 'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys',
    securityPatch: '2026-08-01',
    ...overrides,
  };
}

function contextArgs(
  overrides: {
    mode?: ValidationMode;
    device?: Partial<DeviceDeclaration>;
    capture?: { ok: true; identity: QuestDeviceIdentity } | { ok: false; error: string };
  } = {}
) {
  return {
    mode: overrides.mode ?? 'quest-perf',
    git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
    sessionId: FAKE_UUID,
    now: () => new Date('2026-08-29T10:45:12.000Z'),
    device: overrides.device,
    deviceCapture: overrides.capture ?? { ok: true as const, identity: quest3sIdentity() },
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

describe('QV2 legacy/manual device declaration store', () => {
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
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(declaration);
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

describe('QV2a governed ADB identity gate', () => {
  it('rejects a governed run when ADB identity is unavailable even if manual values are complete', () => {
    const manifest = buildValidationContext(
      contextArgs({
        device: { declaredQuestModel: 'Meta Quest 3S', declaredFirmwareVersion: 'v99' },
        capture: { ok: false, error: 'no ADB device is attached' },
      })
    );
    expect(validateValidationManifest(manifest).ok).toBe(true);
    expect(manifest.deviceIdentity).toBeNull();
    expect(manifest.declaredFirmwareVersion).toBe('v99');
    expect(manifest.promotionEligible).toBe(false);
    expect(manifest.invalidations.join('\n')).toMatch(/machine-captured Quest model\/build identity/);
  });

  it('keeps a governed Quest 3S run eligible with machine capture and no manual model/firmware', () => {
    const manifest = buildValidationContext(contextArgs({ device: {} }));
    expect(manifest.deviceIdentity).toEqual(quest3sIdentity());
    expect(manifest.declaredQuestModel).toBeNull();
    expect(manifest.declaredFirmwareVersion).toBeNull();
    expect(manifest.promotionEligible).toBe(true);
    expect(manifest.invalidations).toEqual([]);
    expect(validateValidationManifest(manifest).ok).toBe(true);
  });

  it('rejects a non-Quest ADB device for governed evidence', () => {
    const manifest = buildValidationContext(
      contextArgs({
        capture: {
          ok: true,
          identity: quest3sIdentity({ model: 'Pixel 10', manufacturer: 'Google' }),
        },
      })
    );
    expect(manifest.promotionEligible).toBe(false);
    expect(manifest.invalidations.join('\n')).toMatch(/not recognisable as a Meta Quest/);
  });

  it('records the machine model verbatim without guessing profile compatibility from its spelling', () => {
    const manifest = buildValidationContext(
      contextArgs({
        capture: { ok: true, identity: quest3sIdentity({ model: 'Meta Quest 3' }) },
      })
    );
    expect(manifest.deviceIdentity?.model).toBe('Meta Quest 3');
    expect(manifest.promotionEligible).toBe(true);
    expect(manifest.invalidations).toEqual([]);
  });

  it('lets informational quest mode proceed without machine identity attribution', () => {
    const manifest = buildValidationContext(
      contextArgs({ mode: 'quest', capture: { ok: false, error: 'adb unavailable' } })
    );
    expect(validateValidationManifest(manifest).ok).toBe(true);
    expect(manifest.evidenceClass).toBe('physical-device-trial');
    expect(manifest.invalidations.some((reason) => reason.startsWith('device identity:'))).toBe(false);
  });

  it('keeps pure QV0 derivation separate from the launch-time QV2a gate', () => {
    const derived = deriveValidationManifest({
      sessionId: FAKE_UUID,
      sessionLabel: 'PERF04-a8be01a-20260829T104512',
      buildId: FAKE_SHA,
      worktree: 'clean',
      mode: 'quest-perf',
    });
    expect(derived.promotionEligible).toBe(true);
    expect(applyDeviceIdentityGate(derived).promotionEligible).toBe(false);
    expect(derived.promotionEligible).toBe(true);
  });

  it('keeps machine-captured and manual/runtime facts structurally distinct', () => {
    const declaration = {
      label: 'Lab unit A',
      declaredQuestModel: 'manually typed model',
      declaredFirmwareVersion: 'manually typed firmware',
      investigator: 'T.A.',
    };
    const manifest = buildValidationContext(contextArgs({ device: declaration }));
    expect(manifest.deviceIdentity?.model).toBe('Meta Quest 3S');
    expect(manifest.deviceIdentity?.buildIncremental).toBe('5123456789012345678');
    expect(manifest.declaredQuestModel).toBe('manually typed model');
    expect(manifest.declaredFirmwareVersion).toBe('manually typed firmware');

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
    expect(runtime.webgl.renderer).toBe('Adreno');
    expect(runtime.xr.nominalFrameRateHz).toBe(72);
  });
});

describe('QV2 device metadata CLI', () => {
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

  it('set writes the declaration and show prints it back as legacy/local metadata', () => {
    const root = tempRoot();
    const written: string[] = [];
    const write = (text: string) => written.push(text);
    expect(
      cliMain(
        [
          'node',
          'quest-device-declaration.mjs',
          'set',
          '--label',
          'Lab unit A',
          '--investigator',
          'T.A.',
        ],
        root,
        write
      )
    ).toBe(0);
    expect(readDeviceDeclaration(root).label).toBe('Lab unit A');

    const shown: string[] = [];
    expect(
      cliMain(['node', 'quest-device-declaration.mjs', 'show'], root, (text) => shown.push(text))
    ).toBe(0);
    const output = shown.join('');
    expect(output).toContain('Lab unit A');
    expect(output).toContain('T.A.');
    expect(output).toContain('captures model/build automatically via ADB');
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
