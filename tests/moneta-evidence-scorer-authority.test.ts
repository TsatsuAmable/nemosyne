import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// TEC2 falsifiers for the empirical sample-count cost adjustment. The
// TypeScript `EvidenceWeightedScorer` re-ranking implementation was deleted
// because it shadowed the Rust kernel's analytical authority with a divergent
// formula (a 20.0 scale and a `(weight || 1.0)` zero-sample inversion, versus
// the kernel's 30.0 scale and fail-closed zero-sample path). These checks fail
// if any TypeScript reimplementation — or a second stale Rust twin —
// reappears, and pin the honest sample-count terminology.

const root = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(path.resolve(root, relative), 'utf8');
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [absolute] : [];
  });
}

const SRC_ROOT = path.resolve(root, 'src');

function scanSrc(pattern: RegExp): string[] {
  const offenders: string[] = [];
  for (const file of walk(SRC_ROOT)) {
    if (pattern.test(fs.readFileSync(file, 'utf8'))) {
      offenders.push(path.relative(SRC_ROOT, file).replaceAll(path.sep, '/'));
    }
  }
  return offenders;
}

describe('Moneta empirical-evidence scorer authority', () => {
  it('has no TypeScript reimplementation of the sample-count cost adjustment', () => {
    // The deleted `EvidenceWeightedScorer` reimplemented the kernel formula
    // (`(compositeUtility - 0.5) * 30.0 * min(1, sampleCount / 10)`), a divergent
    // 20.0 variant, and a `(weight || 1.0)` zero-sample inversion that flipped
    // the fail-closed semantics. Any reappearance of these shapes in
    // TypeScript is shadow analytical authority: the kernel's
    // `draco_adjust_evidence` is the only cost-adjustment path.
    expect(fs.existsSync(path.resolve(root, 'src/moneta/evidence/EvidenceWeightedScorer.ts'))).toBe(
      false
    );
    expect(
      scanSrc(/sampleCount\s*\/\s*10(?:\.0)?\b/),
      'TypeScript must not recompute the sample-count saturation weight'
    ).toEqual([]);
    expect(
      scanSrc(/sampleCountWeight/),
      'sample-count weighting must live only in the Rust kernel'
    ).toEqual([]);
    expect(
      scanSrc(/\*\s*(?:30\.0|20\.0)\s*\*/),
      'TypeScript must not multiply a utility delta by the kernel cost-adjustment scales'
    ).toEqual([]);
    expect(
      scanSrc(/\b(?:reRankCandidates|adjustCandidateScore|scoreCandidateWithEvidence)\b/),
      'TypeScript must not own an evidence-adjusted candidate ranking path'
    ).toEqual([]);
  });

  it('keeps the bridge alias mapped to exactly one Rust authority', () => {
    // `adjustDracoEvidence` is retained as a compatibility alias, but it must
    // resolve to the same single function that binds the one WASM export
    // `draco_adjust_evidence`. The runtime identity assertion lives in
    // `tests/runtime-bridge-module-boundaries.test.ts`.
    const bridge = source('src/wasm/runtime/KernelContractBridge.ts');
    expect(bridge).toContain('export const adjustDracoEvidence = adjustMonetaEvidence;');
    const binding = bridge.match(
      /export function adjustMonetaEvidence\([\s\S]*?\{[\s\S]*?\n\}/
    )?.[0];
    expect(binding).toBeDefined();
    expect(binding).toContain('draco_adjust_evidence');
  });

  it('has exactly one compiled Rust implementation of the adjustment', () => {
    // `wasm/src/draco/` was an uncompiled stale twin of `wasm/src/moneta/`
    // (no `mod draco;` ever declared it; `pub use moneta as draco` in lib.rs
    // routes `draco::evidence` to the moneta module). It must not reappear as
    // a second source of truth a future reader could "fix" independently.
    expect(fs.existsSync(path.resolve(root, 'wasm/src/draco'))).toBe(false);
    const lib = source('wasm/src/lib.rs');
    expect(lib).toContain('pub use moneta as draco;');
    expect(lib).toContain('pub extern "C" fn draco_adjust_evidence(');
    expect(lib).toMatch(/draco::evidence::adjust_candidate_cost_with_evidence/);
  });

  it('never calls sample count a confidence', () => {
    // Terminology honesty: sample count is bounded empirical support, not
    // statistical confidence. The kernel local must keep its honest name, and
    // the retained TS empirical-input producer must not reintroduce
    // confidence-labeled weighting.
    const kernel = source('wasm/src/moneta/evidence.rs');
    expect(kernel).toContain('sample_count_weight');
    expect(kernel).not.toMatch(/confidence_weight|confidenceWeight/);
    for (const name of fs.readdirSync(path.resolve(root, 'src/moneta/evidence'))) {
      const file = source(`src/moneta/evidence/${name}`);
      expect(file, `${name} must not label sample-count weighting as confidence`).not.toMatch(
        /confidence_weight|confidenceWeight/
      );
    }
  });
});
