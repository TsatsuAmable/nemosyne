/**
 * CMS-2 — "false flat-buffer surface retirement" (exit-criterion falsifiers).
 *
 * The retired module was not the standard it was named after: it hand-rolled a
 * bespoke little-endian row buffer. This file pins the retirement exit state:
 * no test file or production source references the retired surface in any form,
 * the serializers directory contains only the two truthful canonical
 * serializers plus their barrel, the barrel exports exactly the two canonical
 * serializer pairs, and the governance capability registry no longer carries a
 * development-only entry for the retired surface.
 *
 * The search needle is assembled from parts so this audit file does not contain
 * the string it forbids.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as serializerBarrel from '../src/data/serializers/index.ts';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_ROOT = join(REPO_ROOT, 'src');
const TESTS_ROOT = join(REPO_ROOT, 'tests');

// Case-insensitive needle assembled at runtime (see header comment).
const NEEDLE = ['flat', 'buffer'].join('').toLowerCase();

function listFiles(dir: string, extensions: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listFiles(full, extensions, acc);
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

describe('CMS-2 retired serializer surface', () => {
  it('no test file references the retired surface — filename, import, identifier, or string', () => {
    const offenders: string[] = [];
    for (const file of listFiles(TESTS_ROOT, ['.ts', '.tsx', '.js', '.mjs'])) {
      if (file.toLowerCase().includes(NEEDLE)) offenders.push(file);
      if (readFileSync(file, 'utf8').toLowerCase().includes(NEEDLE)) offenders.push(file + ' (content)');
    }
    expect(offenders).toEqual([]);
  });

  it('no src/ file references the retired surface — filename or string, sweep excluding nothing', () => {
    const offenders: string[] = [];
    for (const file of listFiles(SRC_ROOT, ['.ts', '.tsx', '.js', '.json'])) {
      if (file.toLowerCase().includes(NEEDLE)) offenders.push(file);
      if (readFileSync(file, 'utf8').toLowerCase().includes(NEEDLE)) offenders.push(file + ' (content)');
    }
    expect(offenders).toEqual([]);
  });

  it('governance/production-capabilities.json carries no capability entry for the retired surface', () => {
    const registry = join(REPO_ROOT, 'governance', 'production-capabilities.json');
    expect(readFileSync(registry, 'utf8').toLowerCase().includes(NEEDLE)).toBe(false);
  });

  it('src/data/serializers/ contains only the two canonical serializers and their barrel', () => {
    const files = readdirSync(join(SRC_ROOT, 'data', 'serializers'))
      .filter((entry) => entry.endsWith('.ts'))
      .sort();
    expect(files).toEqual(['ArrowSerializer.ts', 'MessagePackSerializer.ts', 'index.ts']);
  });

  it('the serializer barrel exports exactly the two canonical serializer pairs', () => {
    expect(Object.keys(serializerBarrel).sort()).toEqual([
      'arrowIPCToDataset',
      'datasetToArrowIPC',
      'datasetToMessagePack',
      'messagePackToDataset',
    ]);
  });
});