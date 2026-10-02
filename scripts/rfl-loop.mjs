#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const maxIterations = Number(opt('--max-iterations', process.env.RFL_MAX_ITERATIONS ?? '20'));
const maxMinutes = Number(opt('--max-minutes', process.env.RFL_MAX_MINUTES ?? '180'));
const model = opt('--model', process.env.RFL_MODEL ?? '');
const session = opt('--session', process.env.RFL_SESSION ?? '');
const opencode = opt('--opencode', process.env.RFL_OPENCODE ?? 'opencode');
const contract = readFileSync(new URL('../governance/rfl/iteration-contract.md', import.meta.url), 'utf8');
const started = Date.now();
let consecutiveBlocked = 0;

function run(command, argv, options = {}) {
  return spawnSync(command, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function enforceMutationBoundary() {
  const status = run('git', ['status', '--porcelain']);
  if (status.status !== 0) throw new Error(status.stderr || 'git status failed');
  const forbidden = status.stdout.split('\n').filter(Boolean).filter(line => {
    const path = line.slice(3);
    return path.startsWith('src/') || path.startsWith('wasm/') || path === 'docs/ROADMAP.md' ||
      path.startsWith('governance/production-') || path === 'governance/review-findings.json';
  });
  if (forbidden.length) throw new Error('RFL circuit breaker: forbidden mutation detected:\n' + forbidden.join('\n'));
}

if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000) throw new Error('--max-iterations must be 1..1000');
if (!Number.isFinite(maxMinutes) || maxMinutes <= 0 || maxMinutes > 1440) throw new Error('--max-minutes must be >0 and <=1440');
if (!existsSync(new URL('../governance/rfl/findings.jsonl', import.meta.url))) throw new Error('RFL ledger missing');

for (let iteration = 1; iteration <= maxIterations; iteration++) {
  if ((Date.now() - started) / 60000 >= maxMinutes) {
    console.log('RFL controller: runtime budget reached');
    break;
  }
  enforceMutationBoundary();
  const prompt = contract + '\n\nController iteration: ' + iteration + '/' + maxIterations + '. Work from the current RFL worktree. Re-read fresh repository state before choosing the target.';
  const ocArgs = ['run'];
  if (session) ocArgs.push('--session', session, '--fork');
  if (model) ocArgs.push('--model', model);
  ocArgs.push(prompt);
  const result = run(opencode, ocArgs, { maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  enforceMutationBoundary();

  const marker = (result.stdout ?? '').split('\n').reverse().find(line => line.startsWith('RFL_RESULT '));
  if (result.status !== 0 || !marker) {
    consecutiveBlocked++;
    console.error('RFL controller: iteration ' + iteration + ' produced no valid result');
  } else {
    let record;
    try { record = JSON.parse(marker.slice('RFL_RESULT '.length)); } catch { record = null; }
    if (!record || !['PASS','FINDING','STOP_NO_NOVEL_TARGET','BLOCKED'].includes(record.outcome)) {
      consecutiveBlocked++;
      console.error('RFL controller: invalid result at iteration ' + iteration);
    } else if (record.outcome === 'STOP_NO_NOVEL_TARGET') {
      console.log('RFL controller: no novel non-colliding target; stopping');
      break;
    } else if (record.outcome === 'BLOCKED') {
      consecutiveBlocked++;
    } else {
      consecutiveBlocked = 0;
    }
  }
  if (consecutiveBlocked >= 3) {
    console.error('RFL controller: circuit breaker after 3 blocked/invalid iterations');
    process.exitCode = 2;
    break;
  }
}
