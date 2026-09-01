#!/usr/bin/env node
/**
 * QV2 local device metadata CLI.
 *
 * Machine facts now come from ADB. The local declaration remains for a friendly
 * label/investigator and for legacy exploratory model/firmware fallback only.
 * Governed physical validation does not accept manual model/firmware as a
 * substitute for ADB identity.
 *
 *   node scripts/quest-device-declaration.mjs probe
 *   node scripts/quest-device-declaration.mjs show
 *   node scripts/quest-device-declaration.mjs set --label "Lab unit A" --investigator "T.A."
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  VALIDATION_LOG_ROOT,
  readDeviceDeclaration,
  writeDeviceDeclaration,
  mergeDeviceDeclaration,
} from './quest-validation.mjs';
import {
  captureAdbQuestDevice,
  formatAdbQuestIdentity,
  QUEST_ADB_SERIAL_ENV,
} from './quest-adb-device.mjs';

const FLAG_TO_FIELD = {
  '--model': 'declaredQuestModel',
  '--firmware': 'declaredFirmwareVersion',
  '--label': 'label',
  '--investigator': 'investigator',
};

export function printDeviceDeclaration(
  declaration,
  root = process.cwd(),
  write = (text) => process.stdout.write(text)
) {
  const lines = [
    '',
    'DEVICE DECLARATION (local-only metadata / legacy fallback)',
    `File: ${path.join(root, VALIDATION_LOG_ROOT, 'device.json')}`,
    `  label:                   ${declaration.label ?? '(unset)'}`,
    `  declaredQuestModel:      ${declaration.declaredQuestModel ?? '(unset)'}`,
    `  declaredFirmwareVersion: ${declaration.declaredFirmwareVersion ?? '(unset)'}`,
    `  investigator:            ${declaration.investigator ?? '(unset)'}`,
    'Governed Quest validation captures model/build automatically via ADB.',
    'Manual model/firmware values cannot make a governed run promotion-eligible.',
    '',
  ];
  write(lines.join('\n'));
}

export function parseSetArgs(argv) {
  const updates = {};
  for (let i = 3; i < argv.length; i += 1) {
    const flag = argv[i];
    const field = FLAG_TO_FIELD[flag];
    if (!field) return { error: `unknown flag '${flag}'` };
    const value = argv[i + 1];
    if (value === undefined) return { error: `flag '${flag}' requires a value` };
    updates[field] = value;
    i += 1;
  }
  return { updates };
}

export function main(
  argv = process.argv,
  root = process.cwd(),
  write = (text) => process.stdout.write(text),
  env = process.env
) {
  const command = argv[2];
  if (command === 'probe') {
    const capture = captureAdbQuestDevice({ selectedSerial: env[QUEST_ADB_SERIAL_ENV] ?? null });
    write(`${formatAdbQuestIdentity(capture)}\n`);
    return capture.ok ? 0 : 2;
  }
  if (command === 'show') {
    printDeviceDeclaration(readDeviceDeclaration(root), root, write);
    return 0;
  }
  if (command === 'set') {
    const parsed = parseSetArgs(argv);
    if (parsed.error) {
      write(`Error: ${parsed.error}\n${usage()}`);
      return 2;
    }
    const merged = mergeDeviceDeclaration(readDeviceDeclaration(root), parsed.updates);
    const file = writeDeviceDeclaration(merged, root);
    write(`Device declaration written to ${file}\n`);
    printDeviceDeclaration(merged, root, write);
    return 0;
  }
  write(`Unknown command '${command ?? '(none)'}.\n${usage()}`);
  return 2;
}

function usage() {
  return [
    '',
    'Usage:',
    '  node scripts/quest-device-declaration.mjs probe',
    '  node scripts/quest-device-declaration.mjs show',
    '  node scripts/quest-device-declaration.mjs set [--label <label>] [--investigator <name>]',
    '  legacy fallback only: [--model <model>] [--firmware <firmware>]',
    `  multiple ADB devices: set ${QUEST_ADB_SERIAL_ENV}=<serial> before probe/launch`,
    '',
  ].join('\n');
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
