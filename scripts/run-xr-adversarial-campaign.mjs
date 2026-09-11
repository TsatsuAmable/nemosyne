import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, process.argv[2] ?? 'test-results/xr-adversarial/latest.json');
mkdirSync(dirname(output), { recursive: true });
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) throw new Error(git.stderr || 'cannot resolve git SHA');
const buildHash = git.stdout.trim();
const vitest = resolve(root, 'node_modules/.bin/vitest');
const run = spawnSync(
  vitest,
  [
    'run',
    'tests/ui-system/xr-adversarial-campaign.test.ts',
    '--config',
    'vitest.ui.config.ts',
    '--reporter=verbose',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEMOSYNE_XR_CAMPAIGN_MODE: 'operational',
      NEMOSYNE_XR_CAMPAIGN_OUTPUT: output,
      NEMOSYNE_XR_CAMPAIGN_BUILD: buildHash,
    },
  }
);
if (run.status !== 0) process.exit(run.status ?? 1);
const report = JSON.parse(readFileSync(output, 'utf8'));
console.log('\nXR adversarial campaign');
console.log(`  build: ${report.buildHash}`);
console.log(
  `  runs: ${report.summary.runs}; pass=${report.summary.passed}; fail=${report.summary.failed}; incomplete=${report.summary.incomplete}`
);
console.log(`  injected fault events: ${report.summary.injectedFaultEvents}`);
console.log(`  proposed iterations: ${report.proposedIterations.length}`);
console.log(
  `  next: ${report.nextIteration ? `${report.nextIteration.priority} ${report.nextIteration.title}` : 'none'}`
);
console.log(`  evidence: ${output}`);
