/**
 * Legacy bootstrap retrain orchestrator.
 *
 * This reproduces the original gesture-intelligence demo asset only. PT8
 * product updates use the governed PT6 snapshot -> PT7 manifest/receipt ->
 * PT8 qualification -> signed PT7 deployment path. This script retains the
 * historical scalar quality bar solely for bootstrap reproducibility and is
 * deliberately fail-closed unless an operator explicitly opts into legacy
 * asset overwrite.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '_output');
const ASSETS = join(HERE, '..', 'assets');
const LEGACY_OVERRIDE = 'NEMOSYNE_ALLOW_LEGACY_GESTURE_ASSET_OVERWRITE';
const VENV_PYTHON =
  process.platform === 'win32'
    ? join(HERE, '.venv', 'Scripts', 'python.exe')
    : join(HERE, '.venv', 'bin', 'python');

interface ParsedArgs {
  noSynthetic: boolean;
  capturedDir: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let noSynthetic = false;
  let capturedDir = join(OUT, 'captured');
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--no-synthetic') noSynthetic = true;
    else if (argument === '--captured-dir') capturedDir = argv[++i] ?? capturedDir;
    else if (argument.startsWith('--captured-dir=')) capturedDir = argument.slice('--captured-dir='.length);
  }
  return { noSynthetic, capturedDir };
}

function run(command: string, args: readonly string[]): void {
  console.info(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`command failed (exit ${result.status}): ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

function venvRun(script: string): void {
  if (!existsSync(VENV_PYTHON)) {
    console.error(`venv python not found at ${VENV_PYTHON}; create it first`);
    process.exit(1);
  }
  run(VENV_PYTHON, [join(HERE, script)]);
}

function verifyHistoricalBar(): void {
  const metricsPath = join(OUT, 'metrics.json');
  if (!existsSync(metricsPath)) {
    console.error('metrics.json missing after legacy train');
    process.exit(2);
  }
  const metrics = JSON.parse(readFileSync(metricsPath, 'utf8')) as {
    held_out_accuracy: number;
    macro_f1: number;
  };
  const ok = metrics.held_out_accuracy >= 0.9 && metrics.macro_f1 >= 0.85;
  console.info(
    `historical bootstrap bar only: accuracy=${metrics.held_out_accuracy.toFixed(4)} ` +
      `macroF1=${metrics.macro_f1.toFixed(4)} -> ${ok ? 'PASS' : 'FAIL'}`
  );
  if (!ok) process.exit(2);
}

function verifyAssets(): void {
  const onnxPath = join(ASSETS, 'gesture_classifier.onnx');
  const cardPath = join(ASSETS, 'model_card.json');
  if (!existsSync(onnxPath) || !existsSync(cardPath)) {
    console.error('legacy bootstrap assets missing after export');
    process.exit(2);
  }
  const card = JSON.parse(readFileSync(cardPath, 'utf8')) as { sha256: string; version: string };
  console.info(`legacy bootstrap asset: ${onnxPath}`);
  console.info(`  modelVersion=${card.version} sha256=${card.sha256}`);
}

function main(): void {
  if (process.env[LEGACY_OVERRIDE] !== '1') {
    console.error(
      `REFUSED: npm run retrain is a legacy bootstrap path that can overwrite live demo assets. ` +
      `Use the PT8 governed training/update loop. Set ${LEGACY_OVERRIDE}=1 only for explicit historical bootstrap reproduction.`
    );
    process.exit(3);
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.noSynthetic) run('npx', ['tsx', join(HERE, 'generate_dataset.ts')]);
  run('npx', ['tsx', join(HERE, 'merge_corpus.ts'), '--captured-dir', args.capturedDir]);
  run('npx', ['tsx', join(HERE, 'extract_features.ts')]);
  venvRun('train.py');
  verifyHistoricalBar();
  venvRun('export_onnx.py');
  verifyAssets();
  console.info('legacy bootstrap reproduction complete; this is not PT8 promotion evidence');
}

void main();
