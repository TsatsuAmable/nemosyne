import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const depcruiseBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'depcruise.cmd' : 'depcruise',
);
const boundaryConfig = path.join(repoRoot, '.dependency-cruiser.boundaries.cjs');
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'nemosyne-architecture-boundary-'));

function runFixture() {
  return spawnSync(
    depcruiseBin,
    ['--config', path.join(fixtureRoot, 'dependency-cruiser.fixture.cjs'), '--output-type', 'err-long', 'src'],
    {
      cwd: fixtureRoot,
      encoding: 'utf8',
    },
  );
}

try {
  await mkdir(path.join(fixtureRoot, 'src', 'draco'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'safe'), { recursive: true });

  await writeFile(
    path.join(fixtureRoot, 'dependency-cruiser.fixture.cjs'),
    `const base = require(${JSON.stringify(boundaryConfig)});\n` +
      `module.exports = {\n` +
      `  forbidden: base.forbidden,\n` +
      `  options: {\n` +
      `    includeOnly: { path: '^src/' },\n` +
      `    doNotFollow: { path: 'node_modules' },\n` +
      `  },\n` +
      `};\n`,
  );
  await writeFile(path.join(fixtureRoot, 'src', 'draco', 'compat.js'), 'export const legacy = true;\n');
  await writeFile(path.join(fixtureRoot, 'src', 'safe', 'value.js'), 'export const value = 1;\n');
  await writeFile(
    path.join(fixtureRoot, 'src', 'consumer.js'),
    "import { legacy } from './draco/compat.js';\nexport const value = legacy;\n",
  );

  const invalid = runFixture();
  const invalidOutput = `${invalid.stdout ?? ''}\n${invalid.stderr ?? ''}`;
  if (invalid.status === 0 || !invalidOutput.includes('no-production-draco-imports')) {
    throw new Error(
      `Expected the deliberately invalid production -> Draco fixture to fail with no-production-draco-imports.\n${invalidOutput}`,
    );
  }

  await writeFile(
    path.join(fixtureRoot, 'src', 'consumer.js'),
    "import { value } from './safe/value.js';\nexport const consumerValue = value;\n",
  );

  const valid = runFixture();
  if (valid.status !== 0) {
    throw new Error(
      `Expected the repaired fixture to pass the boundary policy.\n${valid.stdout ?? ''}\n${valid.stderr ?? ''}`,
    );
  }

  console.log('Architecture boundary fixture proved fail-closed enforcement and clean recovery.');
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
