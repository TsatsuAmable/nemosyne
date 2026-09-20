#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { finalizeUxr4Cohort } from '../dev/uxr4-cohort-finalizer.ts';
import { UXR4_QUALIFICATION_PROFILES } from '../src/validation/uxr4-verification-envelope.ts';

const [profile, ...sessionLabels] = process.argv.slice(2);
if (!UXR4_QUALIFICATION_PROFILES.includes(profile) || sessionLabels.length === 0) {
  console.error('Usage: node scripts/finalize-uxr4-cohort.mjs <functional-5m|resource-trend-30m|sustained-60m|scale-staircase> <session-label>...');
  process.exit(2);
}
const artifact = finalizeUxr4Cohort({ validationLogRoot: path.resolve('logs/validation'), profile, sessionLabels });
const dir = path.resolve('logs/validation/uxr4-cohorts');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, profile + '-' + Date.now() + '.json');
fs.writeFileSync(file, JSON.stringify(artifact, null, 2) + '\n');
console.log(file);
console.log('UXR4 aggregate: ' + artifact.adjudication.aggregateStatus);
