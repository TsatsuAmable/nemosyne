#!/usr/bin/env node

// P1-Q Q9 exact-head promotion evidence controller.
//
// Verifies, for a candidate PR at an exact expected head SHA, the promotion
// evidence that a governed merge requires:
//   1. exact-head: PR head SHA equals the expected SHA (any head movement
//      revokes and requires re-verification);
//   2. required checks are green on that exact SHA;
//   3. no unresolved CHANGES_REQUESTED review is open on the exact head;
//   4. the promotion-evidence marker / adversarial disposition is present in
//      the PR body or as a label.
//
// The controller can optionally wait for required checks that are missing or
// still running. Completed non-success checks fail immediately. A non-required
// audit may also accept an already-merged PR, but it still verifies the exact
// head, required checks, review disposition and promotion marker. The required
// approval gate never uses that merged-PR allowance.
//
// This controller NEVER manufactures an approval. It reports promotion
// evidence for the exact head only, and its verdict is explicitly not an
// approval. The approval authority remains the repository's approval-gate
// workflow / review policy (see governance/promotion-policy.json and RF-052).

import { execFileSync } from 'node:child_process';

const owner = process.env.GITHUB_REPOSITORY_OWNER || 'TsatsuAmable';
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'nemosyne';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function numericArg(name, fallback) {
  const raw = argValue(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`${name} must be a non-negative number`);
  }
  return parsed;
}

function gh(args, options = {}) {
  const raw = execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    env: { ...process.env, GH_NO_UPDATE_NOTIFIER: '1' },
    ...options,
  });
  const trimmed = raw.trim();
  if (!trimmed) return options.paginated ? [] : null;
  if (options.paginated) {
    return trimmed.split('\n').map((line) => JSON.parse(line));
  }
  return JSON.parse(trimmed);
}

function fail(message) {
  console.error(`[Q9 controller] ${message}`);
  process.exit(1);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const prNumber = argValue('--pr');
const expectedSha = argValue('--sha');
const requiredChecks = (argValue('--required-checks') ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const waitSeconds = numericArg('--wait-seconds', 0);
const pollSeconds = Math.max(1, numericArg('--poll-seconds', 5));
const allowMerged = process.argv.includes('--allow-merged');

if (!prNumber) fail('missing --pr <number>');
if (!expectedSha || !/^[0-9a-f]{40}$/.test(expectedSha)) {
  fail('missing --sha <exact 40-char head SHA>');
}

function readPull() {
  return gh([
    `repos/${owner}/${repo}/pulls/${prNumber}`,
    '--jq',
    '{head:{sha:.head.sha}, state, merged, merged_at, body, labels:[.labels[].name]}',
  ]);
}

function verifyPullState() {
  const pull = readPull();
  console.log(
    `[Q9 controller] PR #${prNumber} head=${pull.head.sha} expected=${expectedSha} state=${pull.state} merged=${pull.merged}`
  );

  // Exact-head: any head movement revokes promotion evidence.
  if (pull.head.sha !== expectedSha) {
    fail(
      `HEAD MOVEMENT DETECTED: PR head ${pull.head.sha} does not match expected promotion head ${expectedSha}. Promotion evidence revoked; re-verify on the exact new head.`
    );
  }

  if (pull.state !== 'open' && !(allowMerged && pull.merged === true)) {
    fail(`PR is not open (state=${pull.state}); no promotion evidence applies.`);
  }
  if (pull.state !== 'open') {
    console.log(
      `[Q9 controller] PR #${prNumber} already merged at ${pull.merged_at}; continuing as a non-required post-merge audit of the exact head.`
    );
  }
  return pull;
}

function readRequiredChecks() {
  const checkRuns = gh(
    [
      `repos/${owner}/${repo}/commits/${expectedSha}/check-runs`,
      '--paginate',
      '--jq',
      '.check_runs[] | {id, name, status, conclusion}',
    ],
    { paginated: true }
  );

  // GitHub returns newer check runs first. Preserve the first result for a
  // duplicate name so a rerun attempt supersedes an older failed attempt.
  const byName = new Map();
  for (const run of checkRuns) {
    if (!byName.has(run.name)) byName.set(run.name, run);
  }
  return byName;
}

// 1 + 2. Remain exact-head/open while boundedly waiting for required checks.
const deadline = Date.now() + waitSeconds * 1000;
let pull = verifyPullState();
while (true) {
  const byName = readRequiredChecks();
  const pending = [];
  const failed = [];

  for (const required of requiredChecks) {
    const run = byName.get(required);
    if (!run) {
      pending.push(`${required}: missing on ${expectedSha}`);
      continue;
    }
    if (run.status !== 'completed') {
      pending.push(`${required}: ${run.status}/${run.conclusion}`);
      continue;
    }
    if (run.conclusion !== 'success') {
      failed.push(`${required}: ${run.status}/${run.conclusion}`);
    }
  }

  if (failed.length > 0) {
    fail(`Required checks failed on exact head ${expectedSha}: ${failed.join('; ')}`);
  }
  if (pending.length === 0) break;
  if (Date.now() >= deadline) {
    fail(`Required checks not green on exact head ${expectedSha}: ${pending.join('; ')}`);
  }

  console.log(
    `[Q9 controller] Waiting for required checks on ${expectedSha}: ${pending.join('; ')}`
  );
  await sleep(pollSeconds * 1000);
  pull = verifyPullState();
}

// Refresh after the wait so body/labels/state are evaluated on the same exact
// head immediately before the remaining promotion checks.
pull = verifyPullState();

// 3. No unresolved CHANGES_REQUESTED review on the exact head.
const reviews = gh(
  [
    `repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    '--paginate',
    '--jq',
    '.[] | {state, submitted_at, commit_id, user:.user.login}',
  ],
  { paginated: true }
);
const openRequests = reviews.filter(
  (review) => review.state === 'CHANGES_REQUESTED' && review.commit_id === expectedSha
);
if (openRequests.length > 0) {
  const latest = openRequests[openRequests.length - 1];
  fail(`Unresolved CHANGES_REQUESTED review on exact head ${expectedSha} by ${latest.user} at ${latest.submitted_at}.`);
}

// 4. Promotion-evidence marker / adversarial disposition present.
// The disposition is the requirement, not a specific heading level: accept the
// post-implementation adversarial review section (any heading level), the
// adversarial-contract section with a high-risk/low-risk disposition, or a
// promotion-evidence/adversarial label.
const body = pull.body ?? '';
const hasPostReviewSection = /^#{1,6}\s*post-implementation adversarial review/im.test(body);
const hasContractSection = /^#{1,6}\s*adversarial implementation contract/im.test(body);
const hasDisposition =
  hasContractSection &&
  (/High-risk change/i.test(body) || /Low-risk exemption/i.test(body));
const hasAdversarialLabel = (pull.labels ?? []).some(
  (label) => /promotion-evidence|adversarial/i.test(label)
);
if (!hasPostReviewSection && !hasAdversarialLabel && !hasDisposition) {
  fail(`Promotion-evidence marker and adversarial disposition missing on PR #${prNumber}.`);
}

console.log(
  JSON.stringify(
    {
      pr: Number(prNumber),
      exactHead: expectedSha,
      verified: true,
      prState: pull.state,
      merged: pull.merged === true,
      requiredChecksGreen: requiredChecks,
      reviewThreadState: openRequests.length === 0 ? 'clean' : 'blocked',
      markerPresent: hasPostReviewSection || hasAdversarialLabel || hasDisposition,
      note: 'Promotion evidence only; this verdict is not an approval.',
    },
    null,
    2
  )
);