#!/usr/bin/env node
/**
 * QV2a machine-captured Quest device identity.
 *
 * A governed physical Quest run must not depend on an operator transcribing a
 * firmware label. This helper selects exactly one authorised ADB device (or an
 * explicitly selected serial), reads immutable-ish Android build properties,
 * and returns a bounded identity record for the validation manifest.
 *
 * The raw ADB serial is used only while talking to adb. It is not persisted.
 * The manifest receives a SHA-256 hash instead so validation evidence can
 * distinguish devices without retaining the host-visible serial identifier.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const QUEST_ADB_SERIAL_ENV = 'NEMOSYNE_QUEST_ADB_SERIAL';
export const ADB_CAPTURE_BASIS = 'adb-system-property';

const REQUIRED_PROPERTIES = {
  model: 'ro.product.model',
  buildIncremental: 'ro.build.version.incremental',
  buildFingerprint: 'ro.build.fingerprint',
};

const OPTIONAL_PROPERTIES = {
  manufacturer: 'ro.product.manufacturer',
  buildDisplayId: 'ro.build.display.id',
  securityPatch: 'ro.build.version.security_patch',
};

function boundedText(value, max = 1024) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text.slice(0, max) : null;
}

export function runAdb(args, { execFileSyncFn = execFileSync } = {}) {
  try {
    const stdout = execFileSyncFn('adb', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout: String(stdout ?? '') };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Parse `adb devices -l` without trusting model/product annotations as identity. */
export function parseAdbDevices(stdout) {
  return String(stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => {
      const [serial = '', state = '', ...metadata] = line.split(/\s+/);
      return {
        serial,
        state,
        metadata: metadata.join(' '),
      };
    })
    .filter((entry) => entry.serial.length > 0);
}

function hashSerial(serial) {
  return createHash('sha256').update(serial, 'utf8').digest('hex');
}

function readProperty(adb, serial, property) {
  const result = adb(['-s', serial, 'shell', 'getprop', property]);
  if (!result.ok) {
    return {
      ok: false,
      error: `failed to read ${property}: ${result.error?.message ?? 'adb command failed'}`,
    };
  }
  return { ok: true, value: boundedText(result.stdout) };
}

function selectDevice(devices, selectedSerial) {
  if (selectedSerial) {
    const selected = devices.find((device) => device.serial === selectedSerial);
    if (!selected) {
      return { ok: false, error: `selected ADB device '${selectedSerial}' is not attached` };
    }
    if (selected.state !== 'device') {
      return {
        ok: false,
        error: `selected ADB device '${selectedSerial}' is '${selected.state}', not authorised/ready`,
      };
    }
    return { ok: true, device: selected };
  }

  const authorised = devices.filter((device) => device.state === 'device');
  if (authorised.length === 1) return { ok: true, device: authorised[0] };
  if (authorised.length > 1) {
    return {
      ok: false,
      error:
        `${authorised.length} authorised ADB devices are attached; set ${QUEST_ADB_SERIAL_ENV} ` +
        'to select the Quest used for this validation run',
    };
  }
  if (devices.length > 0) {
    const states = devices.map((device) => `${device.serial}:${device.state}`).join(', ');
    return { ok: false, error: `no authorised ADB device is ready (${states})` };
  }
  return { ok: false, error: 'no ADB device is attached' };
}

/**
 * Capture a Quest identity from Android system properties.
 *
 * Required properties are fail-closed because they are the provenance facts
 * QV4 will rely on. Optional fields may be null. No marketing-version string is
 * guessed: buildIncremental + buildFingerprint are the exact machine-reported
 * OS/build identity.
 */
export function captureAdbQuestDevice({
  adb = runAdb,
  selectedSerial = process.env[QUEST_ADB_SERIAL_ENV] ?? null,
} = {}) {
  const listed = adb(['devices', '-l']);
  if (!listed.ok) {
    return {
      ok: false,
      error: `ADB is unavailable: ${listed.error?.message ?? 'failed to list devices'}`,
    };
  }

  const selection = selectDevice(parseAdbDevices(listed.stdout), boundedText(selectedSerial, 256));
  if (!selection.ok) return selection;
  const serial = selection.device.serial;

  const values = {};
  for (const [field, property] of Object.entries({ ...REQUIRED_PROPERTIES, ...OPTIONAL_PROPERTIES })) {
    const result = readProperty(adb, serial, property);
    if (!result.ok) return result;
    values[field] = result.value;
  }

  for (const field of Object.keys(REQUIRED_PROPERTIES)) {
    if (!values[field]) {
      return {
        ok: false,
        error: `ADB device did not report required property ${REQUIRED_PROPERTIES[field]}`,
      };
    }
  }

  return {
    ok: true,
    identity: {
      captureBasis: ADB_CAPTURE_BASIS,
      deviceIdHash: hashSerial(serial),
      model: values.model,
      manufacturer: values.manufacturer,
      buildIncremental: values.buildIncremental,
      buildDisplayId: values.buildDisplayId,
      buildFingerprint: values.buildFingerprint,
      securityPatch: values.securityPatch,
    },
  };
}

export function formatAdbQuestIdentity(capture) {
  if (!capture?.ok) return `ADB Quest identity unavailable: ${capture?.error ?? 'unknown error'}`;
  const identity = capture.identity;
  return [
    'ADB QUEST IDENTITY (machine-captured)',
    `  model:            ${identity.model}`,
    `  manufacturer:     ${identity.manufacturer ?? '(unreported)'}`,
    `  buildIncremental: ${identity.buildIncremental}`,
    `  buildDisplayId:   ${identity.buildDisplayId ?? '(unreported)'}`,
    `  buildFingerprint: ${identity.buildFingerprint}`,
    `  securityPatch:    ${identity.securityPatch ?? '(unreported)'}`,
    `  deviceIdHash:     ${identity.deviceIdHash}`,
  ].join('\n');
}

export function main(
  _argv = process.argv,
  env = process.env,
  write = (text) => process.stdout.write(text)
) {
  const capture = captureAdbQuestDevice({ selectedSerial: env[QUEST_ADB_SERIAL_ENV] ?? null });
  write(`${formatAdbQuestIdentity(capture)}\n`);
  return capture.ok ? 0 : 2;
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
