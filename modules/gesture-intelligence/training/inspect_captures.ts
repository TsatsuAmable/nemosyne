/**
 * Inspect captured JSONL corpora: list files, per-label counts, and a basic
 * schema check (each line has left/right arrays + a known label). Use before
 * `npm run merge-corpus` to confirm what will enter the retraining mix.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GESTURE_CLASSES } from '../src/contracts.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '_output');

function parseArgs(argv: readonly string[]): string {
  let dir = join(OUT, 'captured');
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--captured-dir') dir = argv[++i] ?? dir;
    else if (a.startsWith('--captured-dir=')) dir = a.slice('--captured-dir='.length);
  }
  return dir;
}

function main(): void {
  const dir = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.info(`no captured dir at ${dir}`);
    return;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  if (files.length === 0) {
    console.info(`no .jsonl captures in ${dir}`);
    return;
  }
  let total = 0;
  let malformed = 0;
  const labels: Record<string, number> = {};
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    let count = 0;
    for (const line of text.split('\n')) {
      if (line.trim().length === 0) continue;
      try {
        const row = JSON.parse(line) as { left: unknown[]; right: unknown[]; label: string };
        if (!Array.isArray(row.left) || !Array.isArray(row.right)) malformed += 1;
        if (!GESTURE_CLASSES.includes(row.label as never)) malformed += 1;
        labels[row.label] = (labels[row.label] ?? 0) + 1;
        count += 1;
        total += 1;
      } catch {
        malformed += 1;
      }
    }
    console.info(`${f}: ${count} instances`);
  }
  console.info(`total=${total} malformed=${malformed}`);
  console.info(`labels: ${JSON.stringify(labels)}`);
}

const invokedAsScript =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('inspect_captures.ts');
if (invokedAsScript) main();