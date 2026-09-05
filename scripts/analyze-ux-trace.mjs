#!/usr/bin/env node
/**
 * Offline analyzer for UX traces recorded by UXTraceRecorder.
 *
 * Usage:
 *   node scripts/analyze-ux-trace.mjs [trace.jsonl|trace.json] [--timeline] [--session SID]
 *
 * Defaults to logs/ux-trace.jsonl. Accepts legacy dev JSONL, legacy production
 * export envelopes, v1 records-only integrity exports, and v2 whole-envelope
 * integrity exports. Malformed/truncated evidence is rejected rather than silently skipped.
 *
 * Output per session:
 *   - duration + record counts
 *   - trace completeness / integrity status
 *   - pinch outcome table (gating x what the ray actually hit)
 *   - selection hit/miss rates, misses while looking at a panel (aim errors)
 *   - head-gaze vs pointer-ray drift stats (median/p90) + target divergence
 *   - frustration windows: >=2 ineffective pinches within 3 s
 *   - system toggles / suppressions, wheel open/close counts, tour progress
 *   - --timeline prints a compact chronological event table
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseUXTraceText, UXTraceInputError } from './lib/ux-trace-input.mjs';

const args = process.argv.slice(2);
const timelineFlag = args.includes('--timeline');
const sessionFlagIdx = args.indexOf('--session');
const sessionFilter = sessionFlagIdx >= 0 ? args[sessionFlagIdx + 1] : null;
const fileArg = args.find((a) => !a.startsWith('--') && a !== sessionFilter);

const file = path.resolve(fileArg ?? path.join('logs', 'ux-trace.jsonl'));
if (!fs.existsSync(file)) {
  console.error(`Trace file not found: ${file}`);
  console.error('Run a dev-server session or export a local UX trace first.');
  process.exit(1);
}

let input;
try {
  input = parseUXTraceText(fs.readFileSync(file, 'utf-8'), { source: file });
} catch (error) {
  const message = error instanceof UXTraceInputError || error instanceof Error ? error.message : String(error);
  console.error(`Invalid UX trace evidence: ${message}`);
  process.exit(1);
}
const records = input.records;

const sessions = new Map();
for (const r of records) {
  if (!sessions.has(r.sid)) sessions.set(r.sid, []);
  sessions.get(r.sid).push(r);
}

if (sessions.size === 0) {
  console.error('No valid records found.');
  process.exit(1);
}

if (input.envelope) {
  const env = input.envelope;
  const schema = env.schemaVersion ?? 'legacy';
  const integrity =
    input.integrityScope === 'envelope'
      ? 'verified-envelope'
      : input.integrityScope === 'records'
        ? 'verified-records-only'
        : 'unverified';
  console.log(
    `Input: ${input.format} | schema=${schema} | integrity=${integrity} | records=${records.length}`
  );
}

const pct = (arr, p) => {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const fmtT = (t) => `${t.toFixed(1)}s`.padStart(8);

for (const [sid, recs] of sessions) {
  if (sessionFilter && sid !== sessionFilter) continue;
  recs.sort((a, b) => a.t - b.t || (a.seq ?? 0) - (b.seq ?? 0));
  const duration = recs.length > 1 ? recs[recs.length - 1].t - recs[0].t : 0;

  const byType = {};
  for (const r of recs) byType[r.type] = (byType[r.type] ?? 0) + 1;

  const pinches = recs.filter((r) => r.type === 'pinch' && r.phase === 'start');
  const selections = recs.filter((r) => r.type === 'selection');
  const contexts = recs.filter((r) => r.type === 'context');
  const systems = recs.filter((r) => r.type === 'system');
  const wheels = recs.filter((r) => r.type === 'wheel');
  const tours = recs.filter((r) => r.type === 'tour');
  const gestures = recs.filter((r) => r.type === 'gesture');
  const manifests = recs.filter((r) => r.type === 'session-manifest');
  const perfs = recs.filter((r) => r.type === 'perf');
  const frictions = recs.filter((r) => r.type === 'friction');
  const handsEvents = recs.filter((r) => r.type === 'hands');
  const lifecycles = recs.filter((r) => r.type === 'trace-lifecycle');
  const meta = recs.find((r) => r.type === 'meta');
  const latestManifest = manifests.length > 0 ? manifests[manifests.length - 1] : null;

  console.log('\n================================================================');
  console.log(`Session ${sid}  (${meta?.startedAt ?? latestManifest?.startedAt ?? 'unknown start'}, ${Math.round(duration)}s)`);
  if (latestManifest) {
    console.log(
      `Dataset: ${latestManifest.datasetName ?? 'none'} | Topology: ${latestManifest.topology ?? '-'} | Version: ${latestManifest.datasetVersion ?? '-'} | Caps: 0x${(latestManifest.wasmCapabilities ?? 0).toString(16)}`
    );
  }
  console.log('================================================================');
  console.log(
    `Records: ${recs.length} | ` +
      Object.entries(byType)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
  );

  // --- Trace completeness / chain of custody ------------------------------
  console.log('\n--- Trace completeness & integrity ---');
  const env = input.envelope?.sid === sid ? input.envelope : null;
  if (env?.schemaVersion === 2) {
    console.log(
      `  envelope: schema=v2 integrity=verified-envelope seq=${String(env.firstSeq)}..${String(env.lastSeq)} dropped=${env.droppedCount} traceOpen=${env.traceOpen}`
    );
    if (env.validationSession) {
      console.log(
        `  validation session: ${env.validationSession.label} / ${env.validationSession.id}`
      );
    }
    if (env.buildHash) console.log(`  build: ${env.buildHash}`);
  } else if (env?.schemaVersion === 1) {
    console.log(
      `  envelope: schema=v1 integrity=verified-records-only seq=${String(env.firstSeq)}..${String(env.lastSeq)} dropped=${env.droppedCount} traceOpen=${env.traceOpen}`
    );
    console.log('  ⚠ v1 envelope attribution/build/drop metadata is outside the record digest');
    if (env.validationSession) {
      console.log(
        `  validation session (unverified metadata): ${env.validationSession.label} / ${env.validationSession.id}`
      );
    }
    if (env.buildHash) console.log(`  build (unverified metadata): ${env.buildHash}`);
  } else if (env) {
    console.log('  envelope: legacy/unversioned (integrity cannot be verified)');
  } else {
    console.log('  input: legacy/dev record stream (no export-envelope digest)');
  }

  const lifecycleCounts = {};
  for (const event of lifecycles) {
    lifecycleCounts[event.event ?? 'unknown'] = (lifecycleCounts[event.event ?? 'unknown'] ?? 0) + 1;
  }
  if (lifecycles.length > 0) {
    console.log(
      `  lifecycle: ${Object.entries(lifecycleCounts)
        .map(([event, count]) => `${event}=${count}`)
        .join(' ')}`
    );
  } else {
    console.log('  lifecycle: absent (legacy evidence)');
  }
  const dropMarkers = lifecycles.filter((r) => r.event === 'buffer-drop');
  if (dropMarkers.length > 0) {
    const latestDrop = dropMarkers[dropMarkers.length - 1];
    console.log(`  ⚠ buffer truncation observed: cumulative dropped=${latestDrop.droppedCount ?? '?'}`);
  }

  // --- UX Phenomenon Scorecard (UX-001 through UX-012) -------------------
  console.log('\n--- UX Phenomenon Scorecard (UX-001 - UX-012) ---');
  // UX-001: Hand tracking cold-start
  const validJoints = handsEvents.find((h) => h.phase === 'joints-valid');
  if (validJoints && typeof validJoints.ttfrMs === 'number') {
    const coldStartSec = validJoints.ttfrMs / 1000;
    console.log(`  UX-001 Hand Cold-Start: ${coldStartSec.toFixed(1)}s ${coldStartSec > 10 ? '⚠️ [FLAGGED > 10s]' : '✅'}`);
  } else {
    console.log('  UX-001 Hand Cold-Start: nominal (no joint delay recorded)');
  }

  // UX-006: Frustrations & Friction
  if (frictions.length > 0) {
    const peakScore = Math.max(...frictions.map((f) => f.score ?? 0));
    console.log(`  UX-006 Frustration Bursts: ${frictions.length} events (Peak Score: ${peakScore.toFixed(2)}) ⚠️`);
  } else {
    console.log('  UX-006 Frustration Bursts: 0 events ✅');
  }

  // UX-007: Perf Budget
  const criticalPerfs = perfs.filter((p) => p.severity === 'critical');
  const warnPerfs = perfs.filter((p) => p.severity === 'warning');
  if (criticalPerfs.length > 0 || warnPerfs.length > 0) {
    console.log(`  UX-007 Perf Breaches: ${criticalPerfs.length} critical, ${warnPerfs.length} warnings ⚠️`);
  } else {
    console.log('  UX-007 Perf Breaches: 0 breaches (90 FPS nominal) ✅');
  }

  // --- Pinch outcomes -----------------------------------------------------
  console.log('\n--- Pinch starts by gating ---');
  const gatingCounts = {};
  for (const p of pinches) {
    const gaze = p.ctx?.gaze?.target ?? '-';
    const ptr = p.ctx?.ptr?.target ?? '-';
    const key = p.gating;
    gatingCounts[key] = (gatingCounts[key] ?? 0) + 1;
    if (timelineFlag) {
      console.log(
        `${fmtT(p.t)} PINCH ${String(p.hand).padEnd(6)} d=${String(p.d).padEnd(7)} gating=${p.gating.padEnd(17)} ptr=${String(ptr).padEnd(28)} gaze=${String(gaze).padEnd(28)} drift=${p.ctx?.ptr?.driftDeg ?? '-'}°`
      );
    }
  }
  for (const [g, n] of Object.entries(gatingCounts)) console.log(`  ${g.padEnd(20)} ${n}`);

  // --- Selection effectiveness --------------------------------------------
  console.log('\n--- Selection outcomes ---');
  const hitCounts = {};
  for (const s of selections) hitCounts[s.hit] = (hitCounts[s.hit] ?? 0) + 1;
  for (const [h, n] of Object.entries(hitCounts)) console.log(`  ${h.padEnd(15)} ${n}`);
  const misses = selections.filter((s) => s.hit === 'none' || s.hit === 'callback-only');
  const missesWhileLookingAtPanel = misses.filter((m) => {
    const g = m.ctx?.gaze;
    return g?.kind === 'panel' || g?.kind === 'hud';
  });
  console.log(
    `  Pinches with no world response: ${misses.length}` +
      (misses.length > 0
        ? ` (${missesWhileLookingAtPanel.length} of them while head-gaze was on a panel/hud => likely aim errors)`
        : '')
  );

  // --- Drift ---------------------------------------------------------------
  const drifts = contexts.map((c) => c.ctx?.ptr?.driftDeg).filter((d) => typeof d === 'number');
  if (drifts.length > 0) {
    const mean = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    console.log('\n--- Head-gaze vs pointer-ray drift ---');
    console.log(
      `  samples=${drifts.length} mean=${mean.toFixed(1)}° median=${pct(drifts, 50).toFixed(1)}° p90=${pct(drifts, 90).toFixed(1)}° max=${Math.max(...drifts).toFixed(1)}°`
    );
    const diverged = contexts.filter((c) => {
      const g = c.ctx?.gaze?.target;
      const p = c.ctx?.ptr?.target;
      return g && p && g !== p;
    }).length;
    const withTargets = contexts.filter((c) => c.ctx?.gaze?.target && c.ctx?.ptr?.target).length;
    if (withTargets > 0) {
      console.log(
        `  gaze/pointer target divergence: ${diverged}/${withTargets} samples (${((100 * diverged) / withTargets).toFixed(0)}%)`
      );
    }
  }

  // --- Frustration windows ---------------------------------------------------
  // >=2 selection misses (none/callback-only) or system-suppressed pinches within 3 s.
  const ineffective = [
    ...misses.map((m) => ({ t: m.t, why: `selection:${m.hit}` })),
    ...pinches
      .filter((p) => p.gating === 'system-suppressed')
      .map((p) => ({ t: p.t, why: 'pinch:system-suppressed' })),
  ].sort((a, b) => a.t - b.t);
  const windows = [];
  let win = [];
  for (const e of ineffective) {
    if (win.length === 0 || e.t - win[win.length - 1].t <= 3) win.push(e);
    else {
      if (win.length >= 2) windows.push(win);
      win = [e];
    }
  }
  if (win.length >= 2) windows.push(win);
  console.log('\n--- Frustration windows (>=2 ineffective inputs within 3 s) ---');
  if (windows.length === 0) console.log('  none');
  for (const w of windows) {
    console.log(`  ${fmtT(w[0].t)} -> ${fmtT(w[w.length - 1].t)}  ${w.map((e) => e.why).join(', ')}`);
  }

  // --- World-aware & Ergonomic Spatial Analysis -----------------------------
  console.log('\n--- World awareness & Gesture ergonomics ---');
  const zoneCounts = {};
  const reachCounts = {};
  const ergoScores = [];
  const troubleshootCounts = {};

  for (const c of contexts) {
    const world = c.ctx?.world;
    if (!world) continue;
    if (world.zone) zoneCounts[world.zone] = (zoneCounts[world.zone] ?? 0) + 1;
    if (world.ergonomics) {
      for (const p of Object.values(world.ergonomics)) {
        if (p?.reachZone) reachCounts[p.reachZone] = (reachCounts[p.reachZone] ?? 0) + 1;
        if (typeof p?.ergonomicScore === 'number') ergoScores.push(p.ergonomicScore);
        if (p?.troubleshootingFlag && p.troubleshootingFlag !== 'NONE') {
          troubleshootCounts[p.troubleshootingFlag] = (troubleshootCounts[p.troubleshootingFlag] ?? 0) + 1;
        }
      }
    }
  }

  const totalZoneSamples = Object.values(zoneCounts).reduce((a, b) => a + b, 0);
  if (totalZoneSamples > 0) {
    const zoneStr = Object.entries(zoneCounts)
      .map(([z, n]) => `${z} (${((100 * n) / totalZoneSamples).toFixed(0)}%)`)
      .join(', ');
    console.log(`  palace zones: ${zoneStr}`);
  }

  const totalReach = Object.values(reachCounts).reduce((a, b) => a + b, 0);
  if (totalReach > 0) {
    const reachStr = Object.entries(reachCounts)
      .map(([r, n]) => `${r} (${((100 * n) / totalReach).toFixed(0)}%)`)
      .join(', ');
    const avgScore = ergoScores.length > 0 ? (ergoScores.reduce((a, b) => a + b, 0) / ergoScores.length).toFixed(1) : '-';
    console.log(`  reach zones:  ${reachStr}`);
    console.log(`  ergonomic health score: mean=${avgScore}/100 (samples=${ergoScores.length})`);
  }

  if (Object.keys(troubleshootCounts).length > 0) {
    console.log('  gesture troubleshooting flags:');
    for (const [flag, n] of Object.entries(troubleshootCounts)) {
      console.log(`    ! ${flag.padEnd(30)} ${n}`);
    }
  } else {
    console.log('  gesture troubleshooting flags: none (all gestures within optimal envelope)');
  }

  // --- System / wheel / tour -------------------------------------------------
  console.log('\n--- Discoverability signals ---');
  const sysKinds = {};
  for (const s of systems) sysKinds[s.kind] = (sysKinds[s.kind] ?? 0) + 1;
  console.log(
    `  system toggles: ${sysKinds['both-pinch'] ?? 0} both-pinch, ${sysKinds.grips ?? 0} grips, ${sysKinds['both-pinch-suppressed'] ?? 0} suppressed`
  );
  const wheelOpens = wheels.filter((w) => w.state === 'open');
  const wheelClosed = wheels.filter((w) => w.state === 'closed');
  const firstPinch = pinches[0]?.t;
  const firstWheel = wheelOpens[0]?.t;
  console.log(
    `  wheel: ${wheelOpens.length} opens / ${wheelClosed.length} closes` +
      (firstPinch != null && firstWheel != null
        ? ` (first open ${Math.round(firstWheel - firstPinch)}s after first pinch)`
        : firstWheel == null && pinches.length > 0
          ? ' (NEVER opened despite pinching!)'
          : '')
  );
  if (tours.length > 0) {
    console.log(`  tour transitions: ${tours.length}`);
    for (const t of tours.slice(-3)) {
      console.log(`    ${fmtT(t.t)} -> step ${(t.step ?? 0) + 1}/${t.total ?? '?'} active=${t.active}`);
    }
  }
  if (gestures.length > 0) {
    const gk = {};
    for (const g of gestures) gk[g.name] = (gk[g.name] ?? 0) + 1;
    console.log(`  gestures: ${Object.entries(gk).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
}

if (!timelineFlag) console.log('\n(re-run with --timeline for a chronological pinch/selection table)');
