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
  process.platform === 'win32' ? 'depcruise.cmd' : 'depcruise'
);
const boundaryConfig = path.join(repoRoot, '.dependency-cruiser.boundaries.cjs');
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'nemosyne-architecture-boundary-'));

function runFixture() {
  return spawnSync(
    process.execPath,
    [
      depcruiseBin,
      '--config',
      path.join(fixtureRoot, 'dependency-cruiser.fixture.cjs'),
      '--output-type',
      'err-long',
      'src',
    ],
    {
      cwd: fixtureRoot,
      encoding: 'utf8',
    }
  );
}

function outputOf(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function expectRejected(result, ruleName, description) {
  const output = outputOf(result);
  if (result.status === 0 || !output.includes(ruleName)) {
    throw new Error(`Expected ${description} to fail with ${ruleName}.\n${output}`);
  }
}

function expectAccepted(result, description) {
  if (result.status !== 0) {
    throw new Error(`Expected ${description} to pass the boundary policy.\n${outputOf(result)}`);
  }
}

try {
  await mkdir(path.join(fixtureRoot, 'src', 'draco'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'safe'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'vr'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'feature'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'app'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'governance'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'security'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'src', 'ui'), { recursive: true });

  await writeFile(
    path.join(fixtureRoot, 'dependency-cruiser.fixture.cjs'),
    `const base = require(${JSON.stringify(boundaryConfig)});\n` +
      `module.exports = {\n` +
      `  forbidden: base.forbidden,\n` +
      `  options: {\n` +
      `    includeOnly: { path: '^src/' },\n` +
      `    doNotFollow: { path: 'node_modules' },\n` +
      `  },\n` +
      `};\n`
  );
  await writeFile(
    path.join(fixtureRoot, 'src', 'draco', 'compat.js'),
    'export const legacy = true;\n'
  );
  await writeFile(path.join(fixtureRoot, 'src', 'safe', 'value.js'), 'export const value = 1;\n');
  await writeFile(path.join(fixtureRoot, 'src', 'vr', 'World.js'), 'export class World {}\n');

  const consumerPath = path.join(fixtureRoot, 'src', 'feature', 'consumer.js');
  await writeFile(
    consumerPath,
    "import { legacy } from '../draco/compat.js';\nexport const value = legacy;\n"
  );
  expectRejected(
    runFixture(),
    'no-production-draco-imports',
    'the deliberately invalid production -> Draco fixture'
  );

  await writeFile(
    consumerPath,
    "import { World } from '../vr/World.js';\nexport const createFeature = () => new World();\n"
  );
  expectRejected(
    runFixture(),
    'world-is-composition-root',
    'the deliberately invalid feature -> World fixture'
  );

  const governancePath = path.join(fixtureRoot, 'src', 'governance', 'boundary.js');
  await writeFile(path.join(fixtureRoot, 'src', 'ui', 'panel.js'), 'export const panel = true;\n');
  await writeFile(
    governancePath,
    "import { panel } from '../ui/panel.js';\nexport const governed = panel;\n"
  );
  expectRejected(
    runFixture(),
    'governed-event-boundary-is-product-independent',
    'the deliberately invalid governance -> UI fixture'
  );

  await writeFile(
    consumerPath,
    "import { value } from '../safe/value.js';\nexport const consumerValue = value;\n"
  );
  await writeFile(
    path.join(fixtureRoot, 'src', 'app', 'bootstrap.js'),
    "import { World } from '../vr/World.js';\nexport const bootstrap = () => new World();\n"
  );
  await writeFile(
    path.join(fixtureRoot, 'src', 'security', 'CryptoHash.js'),
    'export const sha256Hex = value => value;\n'
  );
  await writeFile(
    governancePath,
    "import { sha256Hex } from '../security/CryptoHash.js';\nexport const governed = sha256Hex('value');\n"
  );
  expectAccepted(
    runFixture(),
    'the repaired feature dependency plus approved bootstrap -> World composition edge'
  );

  console.log(
    'Architecture boundary fixture proved fail-closed Draco, World, and governed-event dependency enforcement.'
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
