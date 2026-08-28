#!/usr/bin/env node

// P1-Q Q9 / RF-052 repository-governance drift check.
//
// Compares the intended branch-protection policy declared in
// governance/promotion-policy.json against the LIVE GitHub ruleset for the
// protected branch. Any drift between intended and actual enforcement is a
// governance-truth failure and is reported as an error so CI cannot silently
// let policy drift (RF-052 / RF-009 / RF-034).
//
// Requires `gh` authenticated with a token able to read repository rulesets
// (GITHUB_TOKEN has `metadata: read`, which suffices for ruleset reads).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const owner = process.env.GITHUB_REPOSITORY_OWNER || 'TsatsuAmable';
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'nemosyne';

function gh(args) {
  return JSON.parse(
    execFileSync('gh', ['api', ...args], {
      encoding: 'utf8',
      env: { ...process.env, GH_NO_UPDATE_NOTIFIER: '1' },
    })
  );
}

function fail(message) {
  console.error(`[governance] ${message}`);
  process.exitCode = 1;
}

const policy = JSON.parse(readFileSync('governance/promotion-policy.json', 'utf8'));
const intended = policy.intendedPolicy;

if (policy.schemaVersion !== 1) fail('promotion-policy.json schemaVersion must be 1');
if (policy.branch !== 'main') fail('governance policy must target the main branch');

const rulesets = gh([`repos/${owner}/${repo}/rulesets`]);
let target = null;
for (const ruleset of rulesets) {
  const detail = gh([`repos/${owner}/${repo}/rulesets/${ruleset.id}`]);
  const includes = detail.conditions?.ref_name?.include ?? [];
  if (detail.enforcement === 'active' && includes.includes(`refs/heads/${policy.branch}`)) {
    target = detail;
    break;
  }
}

if (!target) {
  fail(`no active ruleset covers refs/heads/${policy.branch}`);
}

// 1. Ruleset name truthfulness (RF-052).
if (target.name !== intended.rulesetName) {
  fail(`ruleset name drift: intended "${intended.rulesetName}", live "${target.name}"`);
}

// 2. Required status checks match intended.
const pullRequestRule = target.rules.find((rule) => rule.type === 'pull_request');
const checksRule = target.rules.find((rule) => rule.type === 'required_status_checks');
const liveChecks = (checksRule?.parameters?.required_status_checks ?? []).map(
  (check) => check.context
);
const liveCheckSet = new Set(liveChecks);
const intendedCheckSet = new Set(intended.requiredStatusChecks);
for (const check of intendedCheckSet) {
  if (!liveCheckSet.has(check)) fail(`required check "${check}" is not enforced live`);
}
for (const check of liveCheckSet) {
  if (!intendedCheckSet.has(check)) fail(`live required check "${check}" is not declared in intended policy`);
}

// 3. Review-thread resolution is enforced.
if (pullRequestRule?.parameters?.required_review_thread_resolution !== intended.requiredReviewThreadResolution) {
  fail(
    `review-thread resolution drift: intended ${intended.requiredReviewThreadResolution}, live ${pullRequestRule?.parameters?.required_review_thread_resolution}`
  );
}

// 4. Approving-review count matches the declared authority.
if (pullRequestRule?.parameters?.required_approving_review_count !== intended.requiredApprovingReviewCount) {
  fail(
    `approving-review-count drift: intended ${intended.requiredApprovingReviewCount}, live ${pullRequestRule?.parameters?.required_approving_review_count}`
  );
}

if (process.exitCode) {
  console.error('[governance] DRIFT DETECTED between intended and live protection policy.');
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ruleset: target.name,
      enforcement: target.enforcement,
      requiredChecks: liveChecks,
      reviewThreadResolution: pullRequestRule?.parameters?.required_review_thread_resolution,
      requiredApprovingReviewCount: pullRequestRule?.parameters?.required_approving_review_count,
      approvalAuthority: intended.approvalAuthority,
      drift: false,
    },
    null,
    2
  )
);