import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src/moneta/representation');

function read(name: string): string {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

describe('Moneta scoring ownership', () => {
  it('keeps bootstrap fitness explicit and versioned', () => {
    const source = read('FitnessModel.ts');
    expect(source).toContain('BOOTSTRAP_FITNESS_MODEL_VERSION');
    expect(source).toContain('engineering priors, not empirical probabilities');
    expect(source).toContain('utilityScore');
  });

  it('keeps learned ranking downstream of bootstrap candidate generation and hard constraints', () => {
    const source = read('LearnedMonetaRuntime.ts');
    expect(source).toContain('Apply a pinned learned model only after bootstrap Moneta has generated');
    expect(source).toContain('enforced hard constraints');
    expect(source).toContain('rankWithPinnedLearnedFitnessModel');
    expect(source).not.toMatch(/from ['\"][^'\"]*data\/Dataset/);
  });

  it('does not silently fall back when learned provenance is invalid', () => {
    const source = read('LearnedMonetaRuntime.ts');
    expect(source).toContain('There is deliberately no fallback');
    expect(source).toContain('Pinned FitnessModel version mismatch');
    expect(source).toContain('missing requirements provenance');
  });
});
