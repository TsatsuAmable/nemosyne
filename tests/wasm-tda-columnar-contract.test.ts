import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('S3: WASM TDA columnar authority contract', () => {
  it('ensures TDA exports in wasm/src/lib.rs do not call data::materialize_rows', () => {
    const libSource = source('../wasm/src/lib.rs');

    // Extract the TDA exports region
    const mapperIdx = libSource.indexOf('pub fn data_compute_mapper_graph');
    const bettiIdx = libSource.indexOf('pub fn data_compute_betti0_curve');
    const endIdx = libSource.indexOf('pub fn data_compute_radial_tree_3d', bettiIdx);

    expect(mapperIdx).toBeGreaterThan(0);
    expect(bettiIdx).toBeGreaterThan(mapperIdx);
    expect(endIdx).toBeGreaterThan(bettiIdx);

    const tdaExportsSlice = libSource.slice(mapperIdx, endIdx);
    expect(tdaExportsSlice).not.toContain('materialize_rows');
    expect(tdaExportsSlice).toContain('tda_space');
  });

  it('ensures topology.rs FeatureSpace columnar paths do not construct row HashMaps', () => {
    const topologySource = source('../wasm/src/data/topology.rs');

    // FeatureSpace implementation slice
    const spaceStart = topologySource.indexOf('impl FeatureSpace');
    const spaceEnd = topologySource.indexOf('pub fn compute_mapper_graph_space');

    expect(spaceStart).toBeGreaterThan(0);
    expect(spaceEnd).toBeGreaterThan(spaceStart);

    const spaceSlice = topologySource.slice(spaceStart, spaceEnd);
    expect(spaceSlice).not.toContain('HashMap<String, Value>');
    expect(spaceSlice).toContain('from_columnar');
  });

  it('requires the production TDA bridge to translate the kernel-inline resource refusal', () => {
    const budgetSource = source('../wasm/src/data/resource_budget.rs');
    const runtimeExports = source('../src/wasm/runtime/RuntimeExports.ts');
    const bridgeSource = source('../src/wasm/runtime/DatasetHandleBridge.ts');

    expect(budgetSource).toContain('pub fn data_tda_resource_preflight');
    expect(budgetSource).toContain('borrowed_feature_columns');
    expect(budgetSource).toContain('HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET');
    expect(budgetSource).toContain('mapper_bins');
    expect(budgetSource).toContain('betti_steps');
    expect(runtimeExports).toContain('data_tda_resource_preflight');

    // Enforcement is kernel-inline: tdaCall invokes the Rust export (which
    // refuses over-budget work in-band) and then translates the refusal
    // envelope to UnsupportedAtScaleError. It must NOT run a separate host-side
    // preflight, so direct/raw callers cannot bypass the envelope.
    const tdaCallStart = bridgeSource.indexOf('function tdaCall');
    const dryRunStart = bridgeSource.indexOf('export function tdaResourcePreflight', tdaCallStart);
    const loadCsvStart = bridgeSource.indexOf('export function loadCsv', tdaCallStart);
    expect(tdaCallStart).toBeGreaterThan(0);
    expect(dryRunStart).toBeGreaterThan(tdaCallStart);
    expect(loadCsvStart).toBeGreaterThan(dryRunStart);
    const tdaCallSlice = bridgeSource.slice(tdaCallStart, dryRunStart);
    expect(tdaCallSlice).not.toContain('readTdaPreflight');
    expect(tdaCallSlice).toContain('parseTdaRefusalEnvelope');
    expect(tdaCallSlice).toContain('UnsupportedAtScaleError');
    expect(tdaCallSlice.indexOf('wasm[exportName]')).toBeLessThan(
      tdaCallSlice.indexOf('parseTdaRefusalEnvelope')
    );
    // Durable refusal provenance: after detecting the in-band refusal, tdaCall
    // reads the kernel-authoritative refusal provenance from the side-channel
    // (the envelope itself is size-stable and carries no provenance) and
    // attaches it to the typed error.
    expect(tdaCallSlice).toContain('kernelProvenance');
    expect(tdaCallSlice.indexOf('parseTdaRefusalEnvelope')).toBeLessThan(
      tdaCallSlice.indexOf('kernelProvenance')
    );

    // The standalone preflight remains available as a dry-run query.
    const dryRunSlice = bridgeSource.slice(dryRunStart, loadCsvStart);
    expect(dryRunSlice).toContain('readTdaPreflight');
  });
});
