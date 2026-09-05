#!/usr/bin/env node
/**
 * Quest evidence status (read-only operator diagnostic).
 *
 * Answers "did my run's data land?" without hand-run directory listings:
 * scans `logs/validation/<session>/` for manifests, dispositions and result
 * artifacts, checks the generic `logs/loadtest-results.jsonl` sink, and
 * prints a verdict per session plus mismatch guidance.
 *
 * Never writes, never transmits, never mutates. Exit 0 always (diagnostic,
 * not a gate).
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const VALIDATION_LOG_ROOT = 'logs/validation';
export const GENERIC_SINK_FILE = 'logs/loadtest-results.jsonl';
export const SESSION_RESULTS_FILE = 'loadtest-results.jsonl';
export const MAX_SESSIONS_SHOWN = 5;

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function statOrNull(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function shortSha(sha) {
  return typeof sha === 'string' && sha.length >= 7 ? sha.slice(0, 7) : null;
}

function summarizeSession(dir) {
  const label = path.basename(dir);
  const manifest = safeReadJson(path.join(dir, 'manifest.json'));
  const disposition = safeReadJson(path.join(dir, 'disposition.json'));
  let files = [];
  try {
    files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const full = path.join(dir, entry.name);
        const stat = statOrNull(full);
        return {
          name: entry.name,
          mtimeMs: stat ? stat.mtimeMs : null,
          sizeBytes: stat ? stat.size : null,
        };
      })
      .sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0));
  } catch {
    files = [];
  }
  const results = files.find((file) => file.name === SESSION_RESULTS_FILE) ?? null;
  const gate = disposition?.gateDisposition ?? null;
  let verdict = 'NO-MANIFEST';
  if (manifest && results) verdict = 'DELIVERED-TO-DISK';
  else if (manifest) verdict = 'NO-RESULTS';
  return {
    label,
    manifest: manifest
      ? {
          buildId7: shortSha(manifest.buildId),
          validationMode: manifest.validationMode ?? null,
          gates: Array.isArray(manifest.gates) ? manifest.gates : [],
        }
      : null,
    disposition: gate
      ? { status: gate.status ?? null, reasons: Array.isArray(gate.reasons) ? gate.reasons : [] }
      : null,
    files,
    resultsFile: results,
    verdict,
  };
}

function summarizeGenericSink(root) {
  const file = path.join(root, GENERIC_SINK_FILE);
  const stat = statOrNull(file);
  if (!stat) return { exists: false };
  let lastProfile = null;
  let lastRecordedAt = null;
  try {
    const lines = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '');
    if (lines.length > 0) {
      const last = JSON.parse(lines[lines.length - 1]);
      lastProfile = typeof last?.profileName === 'string' ? last.profileName : null;
      lastRecordedAt =
        typeof last?.recordedAt === 'number' ? new Date(last.recordedAt).toISOString() : null;
    }
  } catch {
    lastProfile = null;
  }
  return {
    exists: true,
    mtimeMs: stat.mtimeMs,
    sizeBytes: stat.size,
    lastProfile,
    lastRecordedAt,
  };
}

/**
 * Scan evidence state under root (defaults to cwd). Pure read-only scan;
 * safe to run against a live dev session.
 */
export function summarizeEvidence(root = process.cwd()) {
  const validationRoot = path.join(root, VALIDATION_LOG_ROOT);
  let sessionDirs = [];
  try {
    sessionDirs = fs
      .readdirSync(validationRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(validationRoot, entry.name))
      .sort((a, b) => (statOrNull(b)?.mtimeMs ?? 0) - (statOrNull(a)?.mtimeMs ?? 0));
  } catch {
    sessionDirs = [];
  }
  const sessions = sessionDirs.slice(0, MAX_SESSIONS_SHOWN).map(summarizeSession);
  const generic = summarizeGenericSink(root);

  const guidance = [];
  const newestResultsMs = Math.max(
    0,
    ...sessions.map((session) => session.resultsFile?.mtimeMs ?? 0)
  );
  if (sessions.length === 0) {
    guidance.push('No validation sessions found. Launch one with npm run dev:quest:perf.');
  }
  if (generic.exists && generic.mtimeMs > newestResultsMs) {
    guidance.push(
      'The generic sink is newer than every session result file: the browser session likely ' +
        'did not match the server active session (HTTP 409 path). Reload the Quest page from ' +
        'the CURRENT launcher URL, then use panel Flush to re-deliver the retained summary.'
    );
  }
  const failed = sessions.filter((session) => session.disposition?.status === 'FAIL');
  for (const session of failed) {
    guidance.push(
      `Session ${session.label} disposition FAIL: ${(session.disposition.reasons ?? []).join('; ') || 'no reason recorded'}.`
    );
  }
  return { generatedAt: new Date().toISOString(), root, sessions, generic, guidance };
}

function iso(ms) {
  if (typeof ms !== 'number') return '(unknown time)';
  return new Date(ms).toISOString();
}

/** Human-readable report for terminal output. */
export function formatEvidenceReport(summary) {
  const lines = ['QUEST EVIDENCE STATUS', ''];
  if (summary.sessions.length === 0) {
    lines.push('No validation sessions found.');
  }
  for (const session of summary.sessions) {
    const manifest = session.manifest;
    lines.push(`Session ${session.label} [${session.verdict}]`);
    lines.push(
      `  manifest: ${
        manifest
          ? `${manifest.buildId7 ?? '?'} mode=${manifest.validationMode ?? '?'} gates=${(manifest.gates ?? []).join(',') || 'none'}`
          : 'absent'
      }`
    );
    lines.push(
      `  disposition: ${session.disposition ? `${session.disposition.status ?? 'pending'}${session.disposition.reasons.length > 0 ? ` (${session.disposition.reasons.join('; ')})` : ''}` : 'pending'}`
    );
    if (session.resultsFile) {
      lines.push(
        `  results: ${SESSION_RESULTS_FILE} ${session.resultsFile.sizeBytes} bytes, ${iso(session.resultsFile.mtimeMs)}`
      );
    } else {
      lines.push('  results: absent (nothing delivered for this session)');
    }
  }
  lines.push('');
  const generic = summary.generic;
  if (generic.exists) {
    lines.push(
      `Generic sink ${GENERIC_SINK_FILE}: ${generic.sizeBytes} bytes, ${iso(generic.mtimeMs)}` +
        (generic.lastProfile ? `, last profile=${generic.lastProfile}` : '')
    );
  } else {
    lines.push(`Generic sink ${GENERIC_SINK_FILE}: absent`);
  }
  if (summary.guidance.length > 0) {
    lines.push('', 'Guidance:');
    for (const line of summary.guidance) lines.push(`  - ${line}`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const summary = summarizeEvidence();
  process.stdout.write(formatEvidenceReport(summary));
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
