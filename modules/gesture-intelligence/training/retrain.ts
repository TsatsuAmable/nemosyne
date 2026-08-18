/**
 * One-shot retrain orchestrator — the deploy half of the capture→train→deploy loop.
 *
 * Steps: (optional) regenerate synthetic raw data → merge captured corpora →
 * extract 56-dim features → spawn the venv `python train.py` (bar: held-out
 * accuracy >= 0.90 AND macro-F1 >= 0.85) → spawn `export_onnx.py` → verify the
 * metrics and model card → the exporter writes `assets/gesture_classifier.onnx`
 * + `assets/model_card.json` directly; the engine/bridge verify sha256 +
 * modelVersion on the next init, so deploy requires no code changes.
 *
 * Venv python is resolved per-OS: `training/.venv/Scripts/python.exe` on
 * Windows, `training/.venv/bin/python` elsewhere.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '_output');
const ASSETS = join(HERE, '..', 'assets');
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
    const a = argv[i];
    if (a === '--no-synthetic') noSynthetic = true;
    else if (a === '--captured-dir') capturedDir = argv[++i] ?? capturedDir;
    else if (a.startsWith('--captured-dir=')) capturedDir = a.slice('--captured-dir='.length);
  }
  return { noSynthetic, capturedDir };
}

function run(cmd: string, args: readonly string[]): void {
  console.info(`$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`command failed (exit ${result.status}): ${cmd} ${args.join(' ')}`);
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

function verifyBar(): void {
  const metricsPath = join(OUT, 'metrics.json');
  if (!existsSync(metricsPath)) {
    console.error('metrics.json missing after train');
    process.exit(2);
  }
  const metrics = JSON.parse(readFileSync(metricsPath, 'utf8')) as {
    held_out_accuracy: number;
    macro_f1: number;
  };
  const ok = metrics.held_out_accuracy >= 0.9 && metrics.macro_f1 >= 0.85;
  console.info(
    `quality bar: accuracy=${metrics.held_out_accuracy.toFixed(4)} ` +
      `macroF1=${metrics.macro_f1.toFixed(4)} -> ${ok ? 'PASS' : 'FAIL'}`
  );
  if (!ok) process.exit(2);
}

function verifyAssets(): void {
  const onnxPath = join(ASSETS, 'gesture_classifier.onnx');
  const cardPath = join(ASSETS, 'model_card.json');
  if (!existsSync(onnxPath) || !existsSync(cardPath)) {
    console.error('assets missing after export');
    process.exit(2);
  }
  const card = JSON.parse(readFileSync(cardPath, 'utf8')) as { sha256: string; version: string };
  console.info(`deployed assets: ${onnxPath}`);
  console.info(`  modelVersion=${card.version} sha256=${card.sha256}`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.noSynthetic) run('npx', ['tsx', join(HERE, 'generate_dataset.ts')]);
  run('npx', ['tsx', join(HERE, 'merge_corpus.ts'), '--captured-dir', args.capturedDir]);
  run('npx', ['tsx', join(HERE, 'extract_features.ts')]);
  venvRun('train.py');
  venvRun('export_onnx.py');
  verifyBar();
  verifyAssets();
  console.info('retrain complete; assets updated — engine verifies sha256 + version on next init');
}

void main();