import { describe, expect, it } from 'vitest';
import {
  ADB_CAPTURE_BASIS,
  QUEST_ADB_SERIAL_ENV,
  captureAdbQuestDevice,
  formatAdbQuestIdentity,
  parseAdbDevices,
  type AdbFn,
  type AdbResult,
} from '../scripts/quest-adb-device.mjs';

const SERIAL_A = '1WMHH123456789';
const SERIAL_B = '192.168.1.50:5555';

function fakeAdb(outputs: Record<string, string | Error>): AdbFn {
  return (args: string[]): AdbResult => {
    const key = args.join(' ');
    const value = outputs[key];
    if (value instanceof Error) return { ok: false, error: value };
    if (value === undefined) return { ok: false, error: new Error(`unexpected adb call: ${key}`) };
    return { ok: true, stdout: value };
  };
}

function questProperties(serial = SERIAL_A): Record<string, string> {
  return {
    [`-s ${serial} shell getprop ro.product.model`]: 'Meta Quest 3S\n',
    [`-s ${serial} shell getprop ro.build.version.incremental`]: '5123456789012345678\n',
    [`-s ${serial} shell getprop ro.build.fingerprint`]:
      'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys\n',
    [`-s ${serial} shell getprop ro.product.manufacturer`]: 'Meta\n',
    [`-s ${serial} shell getprop ro.build.display.id`]: 'SQ3A.220605.009.A1\n',
    [`-s ${serial} shell getprop ro.build.version.security_patch`]: '2026-08-01\n',
  };
}

describe('QV2a ADB device discovery', () => {
  it('parses authorised, unauthorised and network devices without trusting annotations', () => {
    const devices = parseAdbDevices(
      [
        'List of devices attached',
        `${SERIAL_A}\tdevice product:panther model:Quest_3S transport_id:1`,
        'ZX1G22\tunauthorized usb:1-2 transport_id:2',
        `${SERIAL_B}\tdevice product:panther model:Quest_3S transport_id:3`,
        '',
      ].join('\n')
    );
    expect(devices).toEqual([
      {
        serial: SERIAL_A,
        state: 'device',
        metadata: 'product:panther model:Quest_3S transport_id:1',
      },
      { serial: 'ZX1G22', state: 'unauthorized', metadata: 'usb:1-2 transport_id:2' },
      {
        serial: SERIAL_B,
        state: 'device',
        metadata: 'product:panther model:Quest_3S transport_id:3',
      },
    ]);
  });

  it('captures one authorised Quest and persists a hash rather than the raw ADB serial', () => {
    const adb = fakeAdb({
      'devices -l': `List of devices attached\n${SERIAL_A}\tdevice product:panther model:Quest_3S\n`,
      ...questProperties(),
    });
    const capture = captureAdbQuestDevice({ adb });
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;
    expect(capture.identity.captureBasis).toBe(ADB_CAPTURE_BASIS);
    expect(capture.identity.model).toBe('Meta Quest 3S');
    expect(capture.identity.buildIncremental).toBe('5123456789012345678');
    expect(capture.identity.buildFingerprint).toContain('oculus/panther');
    expect(capture.identity.securityPatch).toBe('2026-08-01');
    expect(capture.identity.deviceIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(capture.identity)).not.toContain(SERIAL_A);
  });

  it('fails closed when adb itself is unavailable', () => {
    const capture = captureAdbQuestDevice({
      adb: fakeAdb({ 'devices -l': new Error('spawn adb ENOENT') }),
    });
    expect(capture).toEqual({ ok: false, error: 'ADB is unavailable: spawn adb ENOENT' });
  });

  it('fails closed when no device is attached or the only device is unauthorised', () => {
    expect(
      captureAdbQuestDevice({ adb: fakeAdb({ 'devices -l': 'List of devices attached\n' }) })
    ).toEqual({ ok: false, error: 'no ADB device is attached' });

    const unauthorised = captureAdbQuestDevice({
      adb: fakeAdb({
        'devices -l': 'List of devices attached\nZX1G22\tunauthorized usb:1-2\n',
      }),
    });
    expect(unauthorised.ok).toBe(false);
    if (!unauthorised.ok) expect(unauthorised.error).toMatch(/no authorised ADB device/);
  });

  it('requires explicit selection when multiple authorised devices are attached', () => {
    const listing =
      `List of devices attached\n${SERIAL_A}\tdevice product:panther\n` +
      `${SERIAL_B}\tdevice product:panther\n`;
    const capture = captureAdbQuestDevice({ adb: fakeAdb({ 'devices -l': listing }) });
    expect(capture.ok).toBe(false);
    if (!capture.ok) {
      expect(capture.error).toContain(`set ${QUEST_ADB_SERIAL_ENV}`);
    }
  });

  it('uses the explicitly selected authorised device when multiple are attached', () => {
    const listing =
      `List of devices attached\n${SERIAL_A}\tdevice product:panther\n` +
      `${SERIAL_B}\tdevice product:panther\n`;
    const capture = captureAdbQuestDevice({
      selectedSerial: SERIAL_B,
      adb: fakeAdb({
        'devices -l': listing,
        ...questProperties(SERIAL_B),
      }),
    });
    expect(capture.ok).toBe(true);
    if (capture.ok) expect(capture.identity.model).toBe('Meta Quest 3S');
  });

  it('fails closed when a required system property is blank', () => {
    const capture = captureAdbQuestDevice({
      adb: fakeAdb({
        'devices -l': `List of devices attached\n${SERIAL_A}\tdevice\n`,
        ...questProperties(),
        [`-s ${SERIAL_A} shell getprop ro.build.version.incremental`]: '\n',
      }),
    });
    expect(capture.ok).toBe(false);
    if (!capture.ok) expect(capture.error).toMatch(/ro\.build\.version\.incremental/);
  });

  it('renders an operator-readable machine identity without exposing the raw serial', () => {
    const capture = captureAdbQuestDevice({
      adb: fakeAdb({
        'devices -l': `List of devices attached\n${SERIAL_A}\tdevice\n`,
        ...questProperties(),
      }),
    });
    const text = formatAdbQuestIdentity(capture);
    expect(text).toContain('ADB QUEST IDENTITY (machine-captured)');
    expect(text).toContain('Meta Quest 3S');
    expect(text).toContain('5123456789012345678');
    expect(text).not.toContain(SERIAL_A);
  });
});
