#!/usr/bin/env node
/**
 * Record an explicit, reviewable prerequisite attestation for an open governed
 * validation session. This does not infer project governance state and cannot
 * mutate a finalized custody bundle.
 *
 * Usage:
 *   node scripts/quest-validation-prerequisite.mjs <session-label> <gate> <satisfied|blocked> <reason...>
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateValidationManifest } from '../src/validation/validation-manifest.ts';

const SESSION_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const GATE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_REASON_LENGTH = 512;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, file);
}

export function recordValidationPrerequisite({
  root = process.cwd(),
  sessionLabel,
  gate,
  satisfied,
  reason,
}) {
  if (!SESSION_LABEL_RE.test(sessionLabel)) throw new Error('session label is invalid');
  if (!GATE_RE.test(gate)) throw new Error('gate is invalid');
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error('a non-empty prerequisite reason is required');
  }
  const boundedReason = reason.trim().slice(0, MAX_REASON_LENGTH);
  const evidenceDir = path.join(root, 'logs', 'validation', sessionLabel);
  if (fs.existsSync(path.join(evidenceDir, 'custody.json'))) {
    throw new Error('validation session is finalized; prerequisite evidence is write-locked');
  }
  const manifestCheck = validateValidationManifest(readJson(path.join(evidenceDir, 'manifest.json')));
  if (!manifestCheck.ok || manifestCheck.manifest.sessionLabel !== sessionLabel) {
    throw new Error('validation manifest is missing, invalid, or bound to another session');
  }
  if (!manifestCheck.manifest.gates.includes(gate)) {
    throw new Error(`gate '${gate}' is not owned by validation session '${sessionLabel}'`);
  }

  const file = path.join(evidenceDir, 'prerequisites.json');
  const existing = readJson(file);
  const payload = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  payload[gate] = [{ satisfied: Boolean(satisfied), reason: boundedReason }];
  atomicWrite(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

function main(argv = process.argv) {
  const [, , sessionLabel, gate, state, ...reasonParts] = argv;
  if (!sessionLabel || !gate || !['satisfied', 'blocked'].includes(state) || reasonParts.length === 0) {
    process.stderr.write(
      'Usage: node scripts/quest-validation-prerequisite.mjs <session-label> <gate> <satisfied|blocked> <reason...>\n'
    );
    return 2;
  }
  try {
    const file = recordValidationPrerequisite({
      sessionLabel,
      gate,
      satisfied: state === 'satisfied',
      reason: reasonParts.join(' '),
    });
    process.stdout.write(`Recorded ${gate} prerequisite attestation in ${file}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(
      `[quest-validation-prerequisite] ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 1;
  }
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
