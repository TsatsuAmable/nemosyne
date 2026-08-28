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

const prNumber = argValue('--pr');
const expectedSha = argValue('--sha');
const requiredChecks = (argValue('--required-checks') ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

if (!prNumber) fail('missing --pr <number>');
if (!expectedSha || !/^[0-9a-f]{40}$/.test(expectedSha)) {
  fail('missing --sha <exact 40-char head SHA>');
}

const pull = gh([
  `repos/${owner}/${repo}/pulls/${prNumber}`,
  '--jq',
  '{head:{sha:.head.sha}, state, labels:[.labels[].name]}',
]);

console.log(`[Q9 controller] PR #${prNumber} head=${pull.head.sha} expected=${expectedSha}`);

// 1. Exact-head: any head movement revokes promotion evidence.
if (pull.head.sha !== expectedSha) {
  fail(
    `HEAD MOVEMENT DETECTED: PR head ${pull.head.sha} does not match expected promotion head ${expectedSha}. Promotion evidence revoked; re-verify on the exact new head.`
  );
}
if (pull.state !== 'open') {
  fail(`PR is not open (state=${pull.state}); no promotion evidence applies.`);
}

// 2. Required checks green on the exact expected head.
const checkRuns = gh(
  [
    `repos/${owner}/${repo}/commits/${expectedSha}/check-runs`,
    '--paginate',
    '--jq',
    '.check_runs[] | {name, status, conclusion}',
  ],
  { paginated: true }
);
const byName = new Map();
for (const run of checkRuns) {
  byName.set(run.name, run);
}

const failed = [];
for (const required of requiredChecks) {
  const run = byName.get(required);
  if (!run) {
    failed.push(`${required}: missing on ${expectedSha}`);
    continue;
  }
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    failed.push(`${required}: ${run.status}/${run.conclusion}`);
  }
}
if (failed.length > 0) {
  fail(`Required checks not green on exact head ${expectedSha}: ${failed.join('; ')}`);
}

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
const marker = '## Post-implementation adversarial review';
const body = pull.body ?? '';
const hasMarker = body.includes(marker);
const hasAdversarialLabel = (pull.labels ?? []).some(
  (label) => /promotion-evidence|adversarial/i.test(label)
);
const hasDisposition =
  body.includes('## Adversarial implementation contract') &&
  (/High-risk change/i.test(body) || /Low-risk exemption/i.test(body));
if (!hasMarker && !hasAdversarialLabel && !hasDisposition) {
  fail(`Promotion-evidence marker and adversarial disposition missing on PR #${prNumber}.`);
}

console.log(
  JSON.stringify(
    {
      pr: Number(prNumber),
      exactHead: expectedSha,
      verified: true,
      requiredChecksGreen: requiredChecks,
      reviewThreadState: openRequests.length === 0 ? 'clean' : 'blocked',
      markerPresent: hasMarker || hasAdversarialLabel || hasDisposition,
      note: 'Promotion evidence only; this verdict is not an approval.',
    },
    null,
    2
  )
);