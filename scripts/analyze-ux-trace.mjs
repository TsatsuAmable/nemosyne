#!/usr/bin/env node
/**
 * Offline analyzer for UX traces recorded by UXTraceRecorder.
 *
 * Usage:
 *   node scripts/analyze-ux-trace.mjs [trace.jsonl] [--timeline] [--session SID]
 *
 * Defaults to logs/ux-trace.jsonl. With multiple sessions in one file, each
 * session gets its own summary; --session restricts output to one.
 *
 * Output per session:
 *   - duration + record counts
 *   - pinch outcome table (gating x what the ray actually hit)
 *   - selection hit/miss rates, misses while looking at a panel (aim errors)
 *   - head-gaze vs pointer-ray drift stats (median/p90) + target divergence
 *   - frustration windows: >=2 ineffective pinches within 3 s
 *   - system toggles / suppressions, wheel open/close counts, tour progress
 *   - --timeline prints a compact chronological event table
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const timelineFlag = args.includes('--timeline');
const sessionFlagIdx = args.indexOf('--session');
const sessionFilter = sessionFlagIdx >= 0 ? args[sessionFlagIdx + 1] : null;
const fileArg = args.find((a) => !a.startsWith('--') && a !== sessionFilter);

const file = path.resolve(fileArg ?? path.join('logs', 'ux-trace.jsonl'));
if (!fs.existsSync(file)) {
  console.error(`Trace file not found: ${file}`);
  console.error('Run a dev-server session first (UXTraceRecorder POSTs to /__ux-trace).');
  process.exit(1);
}

const lines = fs.readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim());
const records = [];
for (const line of lines) {
  try {
    records.push(JSON.parse(line));
  } catch {
    // Skip malformed lines.
  }
}

const sessions = new Map();
for (const r of records) {
  if (!r?.sid || typeof r.t !== 'number') continue;
  if (!sessions.has(r.sid)) sessions.set(r.sid, []);
  sessions.get(r.sid).push(r);
}

if (sessions.size === 0) {
  console.error('No valid records found.');
  process.exit(1);
}

const pct = (arr, p) => {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const fmtT = (t) => `${t.toFixed(1)}s`.padStart(8);

for (const [sid, recs] of sessions) {
  if (sessionFilter && sid !== sessionFilter) continue;
  recs.sort((a, b) => a.t - b.t);
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
  const meta = recs.find((r) => r.type === 'meta');

  console.log('\n================================================================');
  console.log(`Session ${sid}  (${meta?.startedAt ?? 'unknown start'}, ${Math.round(duration)}s)`);
  console.log('================================================================');
  console.log(
    `Records: ${recs.length} | ` +
      Object.entries(byType)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
  );

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
