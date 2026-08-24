import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'scripts/benchmark-columnar-capacity.mjs');
const workflowPath = resolve(process.cwd(), '.github/workflows/columnar-capacity.yml');

describe('Rust JS boundary benchmark contract', () => {
  it('defines the deterministic 10K through 10M tall envelope', () => {
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain('tall10k: { rows: 10_000');
    expect(source).toContain('tall100k: { rows: 100_000');
    expect(source).toContain('tall1m: { rows: 1_000_000');
    expect(source).toContain('tall10m: { rows: 10_000_000');
  });

  it('measures the current columnar and authoritative evidence boundaries separately', () => {
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain('hostAllocationAndCopyMs');
    expect(source).toContain('rustLoadMs');
    expect(source).toContain('typed_dataset_fingerprint');
    expect(source).toContain('data_compute_structure_profile');
    expect(source).toContain('compatibility_row_materialisation_count');
    expect(source).toContain('rustToJsEvidenceTransferBytes');
    expect(source).toContain('maximumVerifiedResidentRows');
    expect(source).toContain('fingerprintToRustLoadRatioAt10m');
    expect(source).toContain('retainedWasmBytesAfter10mDestroy');
    expect(source).toContain('EVIDENCE_PATH_AVAILABLE_AT_10M');
    expect(source).toContain('deviceQualifiedAt10m');
    expect(source).toContain('evidenceGenerationMsAt10m');
    expect(source).toContain('COLUMNAR_CAPACITY_ONLY');
    expect(source).toContain('INCOMPLETE_NO_10M_SCENARIO');
    expect(source).toContain('schemaVersion: 2');
  });

  it('publishes the provisioned envelope as a reproducible artifact', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('name: Rust JS Boundary Envelope');
    expect(workflow).toContain('npm run wasm:dev');
    expect(workflow).toContain('scripts/benchmark-columnar-capacity.mjs --json');
    expect(workflow).toContain('name: rust-js-boundary-envelope');
  });

  it('rejects an unknown scenario before loading WASM', () => {
    const run = spawnSync(process.execPath, [scriptPath, '--scenario=bogus'], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/unknown scenario bogus/);
    expect(run.stderr).not.toMatch(/run npm run wasm:dev first/);
  });
});
