import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(path.resolve(root, relative), 'utf8');
}

describe('Moneta migration authority exit guards', () => {
  it('has no independent legacy ConstraintArbiter implementation', () => {
    expect(fs.existsSync(path.resolve(root, 'src/moneta/ConstraintArbiter.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(root, 'src/draco/ConstraintArbiter.ts'))).toBe(false);
    expect(source('src/moneta/index.ts')).not.toMatch(/ConstraintArbiter/);
  });

  it('keeps canonical representation ranking on the versioned FitnessModel path', () => {
    const engine = source('src/moneta/representation/MonetaHypothesisEngine.ts');
    expect(engine).toMatch(/BootstrapFitnessModel/);
    expect(engine).toMatch(/scoreCandidateWithModel/);
    expect(engine).not.toMatch(/class\s+ConstraintArbiter/);
  });

  it('documents legacy SpatialStrategy confidence as utility compatibility only', () => {
    const strategy = source('src/moneta/SpatialStrategy.ts');
    expect(strategy).toMatch(/@deprecated Compatibility alias for score/);
    expect(strategy).toMatch(/not a calibrated probability/);
  });
});
