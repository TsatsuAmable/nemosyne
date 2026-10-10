// Phase-0 falsifier for the Draco alias retirement: the WASM ABI must expose
// only Moneta contract names. The retired `draco_solve` /
// `draco_evaluate_candidate` / `draco_adjust_evidence` aliases were
// compatibility shims over the same Moneta implementation; rebuilding the
// kernel (npm run wasm) must produce a pkg with the `moneta_*` exports and no
// `draco_*` symbol at all. Skipped in fresh clones without wasm/pkg, like
// wasm-runtime.test.ts.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CapabilityFlags } from '../src/wasm/capabilities.ts';

const pkgTypesPath = resolve(process.cwd(), 'wasm/pkg/nemosyne_wasm_bg.wasm.d.ts');

describe('Moneta WASM ABI surface', () => {
  it.skipIf(!existsSync(pkgTypesPath))(
    'exports the three Moneta solver contract names and no Draco alias',
    () => {
      const pkgTypes = readFileSync(pkgTypesPath, 'utf8');
      expect(pkgTypes).toContain('moneta_solve: (');
      expect(pkgTypes).toContain('moneta_evaluate_candidate: (');
      expect(pkgTypes).toContain('moneta_adjust_evidence: (');
      expect(pkgTypes).not.toMatch(/draco/i);
    }
  );

  it('keeps DRACO_RUST out of the capability-flag mirror', () => {
    expect(CapabilityFlags).not.toHaveProperty('DRACO_RUST');
    expect(CapabilityFlags.MONETA_RUST).toBe(1 << 3);
  });
});
