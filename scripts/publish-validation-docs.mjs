#!/usr/bin/env node
/**
 * Publish custody-verified local validation evidence into deterministic tracked
 * project documentation. This is intentionally explicit and post-campaign:
 * live Quest runs stay under git-ignored logs/ so one completed run cannot dirty
 * the worktree and invalidate the next governed run.
 *
 * The publisher never changes docs/ROADMAP.md, GitHub state, or promotion state.
 * It projects already-adjudicated evidence only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { verifyFinalizedCustody } from '../dev/validation-finalizer.ts';
import { validateValidationManifest } from '../src/validation/validation-manifest.ts';

const root = process.cwd();
const validationLogRoot = path.join(root, 'logs', 'validation');
const outputRoot = path.join(root, 'docs', 'validation', 'generated');
const sessionOutputRoot = path.join(outputRoot, 'sessions');
const SESSION_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function loadProjection(entryName) {
  if (!SESSION_LABEL_RE.test(entryName)) return null;
  const evidenceDir = path.join(validationLogRoot, entryName);
  const verified = verifyFinalizedCustody(evidenceDir);
  if (!verified.ok) return null;
  const custody = verified.custody;
  if (custody.sessionLabel !== entryName) return null;

  const manifestCheck = validateValidationManifest(readJson(path.join(evidenceDir, 'manifest.json')));
  if (!manifestCheck.ok) return null;
  const manifest = manifestCheck.manifest;
  if (
    manifest.sessionId !== custody.sessionId ||
    manifest.buildId !== custody.buildId ||
    manifest.sessionLabel !== custody.sessionLabel
  ) {
    return null;
  }

  const disposition = readJson(path.join(evidenceDir, 'disposition.json'));
  if (!disposition || typeof disposition !== 'object' || Array.isArray(disposition)) return null;
  const gateDisposition = disposition.gateDisposition;
  const status =
    gateDisposition &&
    typeof gateDisposition === 'object' &&
    !Array.isArray(gateDisposition) &&
    typeof gateDisposition.status === 'string'
      ? gateDisposition.status
      : 'UNKNOWN';
  const gates = Array.isArray(disposition.gates)
    ? disposition.gates.filter((gate) => gate && typeof gate === 'object' && !Array.isArray(gate))
    : [];

  return { manifest, custody, status, gates };
}

function renderSession(projection) {
  const { manifest, custody, status, gates } = projection;
  const gateRows =
    gates.length > 0
      ? gates
          .map((gate) => {
            const reasons = Array.isArray(gate.reasons) ? gate.reasons.join('; ') : '';
            return `| ${escapeCell(gate.gate)} | ${escapeCell(gate.status)} | ${escapeCell(reasons)} |`;
          })
          .join('\n')
      : '| — | PARTIAL | No governed gate was adjudicable. |';

  return (
    `# Validation evidence — ${manifest.sessionLabel}\n\n` +
    `> Generated only from a custody-verified local validation bundle. This document is a projection of evidence, not a promotion authority.\n\n` +
    `- **Disposition:** ${status}\n` +
    `- **Session:** \`${manifest.sessionId}\`\n` +
    `- **Source build:** \`${manifest.buildId}\`\n` +
    `- **Worktree at launch:** \`${manifest.worktree}\`\n` +
    `- **Mode:** \`${manifest.validationMode}\`\n` +
    `- **Runtime:** \`${manifest.runtimeClass}\`\n` +
    `- **Evidence class:** \`${manifest.evidenceClass}\`\n` +
    `- **Device build fingerprint:** \`${manifest.deviceIdentity?.buildFingerprint ?? 'unavailable'}\`\n` +
    `- **Finalized:** ${custody.finalizedAt}\n` +
    `- **Raw evidence digest:** \`${custody.rawEvidenceDigest}\`\n` +
    `- **Custody bundle digest:** \`${custody.bundleDigest}\`\n\n` +
    `## Gate dispositions\n\n` +
    `| Gate | Status | Reasons |\n| --- | --- | --- |\n${gateRows}\n\n` +
    `## Authority boundary\n\n` +
    `The source of truth remains the frozen bundle under the local validation evidence store. This generated file does not change \`docs/ROADMAP.md\`, promotion state, or any gate by itself. Re-publishing after evidence tampering is refused by custody verification.\n`
  );
}

function main() {
  let entries = [];
  try {
    entries = fs.readdirSync(validationLogRoot, { withFileTypes: true });
  } catch {
    console.error('No local validation evidence directory exists at logs/validation/.');
    process.exitCode = 1;
    return;
  }

  const projections = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadProjection(entry.name))
    .filter(Boolean)
    .sort((a, b) => a.custody.finalizedAt.localeCompare(b.custody.finalizedAt));

  if (projections.length === 0) {
    console.error('No custody-verified finalized validation sessions are available to publish.');
    process.exitCode = 1;
    return;
  }

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(sessionOutputRoot, { recursive: true });

  const ledger = projections.map(({ manifest, custody, status, gates }) => ({
    sessionId: manifest.sessionId,
    sessionLabel: manifest.sessionLabel,
    buildId: manifest.buildId,
    validationMode: manifest.validationMode,
    runtimeClass: manifest.runtimeClass,
    evidenceClass: manifest.evidenceClass,
    finalizedAt: custody.finalizedAt,
    rawEvidenceDigest: custody.rawEvidenceDigest,
    bundleDigest: custody.bundleDigest,
    status,
    gates: gates.map((gate) => ({
      gate: typeof gate.gate === 'string' ? gate.gate : null,
      status: typeof gate.status === 'string' ? gate.status : null,
      reasons: Array.isArray(gate.reasons)
        ? gate.reasons.filter((reason) => typeof reason === 'string')
        : [],
    })),
  }));

  for (const projection of projections) {
    fs.writeFileSync(
      path.join(sessionOutputRoot, `${projection.manifest.sessionLabel}.md`),
      renderSession(projection),
      'utf8'
    );
  }

  const rows = ledger
    .map(
      (row) =>
        `| ${row.finalizedAt} | [\`${row.sessionLabel}\`](sessions/${row.sessionLabel}.md) | \`${row.buildId.slice(0, 12)}\` | ${row.validationMode} | ${row.status} | \`${row.bundleDigest.slice(0, 16)}…\` |`
    )
    .join('\n');
  fs.writeFileSync(
    path.join(outputRoot, 'INDEX.md'),
    `# Published validation ledger\n\nGenerated by \`node scripts/publish-validation-docs.mjs\` from custody-verified local bundles. It is evidence documentation, not promotion authority.\n\n| Finalized | Session | Build | Mode | Status | Bundle |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(outputRoot, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  console.log(
    `Published ${ledger.length} custody-verified validation session(s) to docs/validation/generated/.`
  );
}

main();
