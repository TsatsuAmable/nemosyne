#!/usr/bin/env node
/**
 * QV2 local device declaration CLI.
 *
 * Thin operator surface for the investigator-declared device facts stored in the
 * ignored local file `logs/validation/device.json`:
 *
 *   node scripts/quest-device-declaration.mjs show
 *   node scripts/quest-device-declaration.mjs set --model "Meta Quest 3S" \
 *     --firmware "v72" --label "Lab unit A" --investigator "T.A."
 *
 * `set` merges: flags present in the command are applied, absent flags keep the
 * current value; an explicit empty value clears a field. Values are trimmed and
 * bounded. These fields are visibly investigator-declared and never inferred by
 * the runtime; they remain distinct from runtime-measured browser/XR/WebGL facts.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  VALIDATION_LOG_ROOT,
  readDeviceDeclaration,
  writeDeviceDeclaration,
  mergeDeviceDeclaration,
} from './quest-validation.mjs';

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
    'DEVICE DECLARATION (investigator-declared, local-only)',
    `File: ${path.join(root, VALIDATION_LOG_ROOT, 'device.json')}`,
    `  label:                  ${declaration.label ?? '(unset)'}`,
    `  declaredQuestModel:     ${declaration.declaredQuestModel ?? '(unset)'}`,
    `  declaredFirmwareVersion: ${declaration.declaredFirmwareVersion ?? '(unset)'}`,
    `  investigator:           ${declaration.investigator ?? '(unset)'}`,
    'These fields are declared by the investigator and are distinct from the',
    'runtime-measured browser/XR/WebGL facts captured by QuestTelemetry.',
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
  write = (text) => process.stdout.write(text)
) {
  const command = argv[2];
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
  write(`Unknown command '${command ?? '(none)'}'.\n${usage()}`);
  return 2;
}

function usage() {
  return [
    '',
    'Usage:',
    '  node scripts/quest-device-declaration.mjs show',
    '  node scripts/quest-device-declaration.mjs set [--model <model>] [--firmware <firmware>] [--label <label>] [--investigator <name>]',
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
