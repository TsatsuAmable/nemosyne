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

  it('requires the production TDA bridge to consult the Rust-owned resource envelope first', () => {
    const budgetSource = source('../wasm/src/data/resource_budget.rs');
    const runtimeExports = source('../src/wasm/runtime/RuntimeExports.ts');
    const bridgeSource = source('../src/wasm/runtime/DatasetHandleBridge.ts');

    expect(budgetSource).toContain('pub fn data_tda_resource_preflight');
    expect(budgetSource).toContain('borrowed_feature_columns');
    expect(budgetSource).toContain('HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET');
    expect(budgetSource).toContain('mapper_bins');
    expect(budgetSource).toContain('betti_steps');
    expect(runtimeExports).toContain('data_tda_resource_preflight');

    const tdaCallStart = bridgeSource.indexOf('function tdaCall');
    const loadCsvStart = bridgeSource.indexOf('export function loadCsv', tdaCallStart);
    expect(tdaCallStart).toBeGreaterThan(0);
    expect(loadCsvStart).toBeGreaterThan(tdaCallStart);
    const tdaCallSlice = bridgeSource.slice(tdaCallStart, loadCsvStart);
    expect(tdaCallSlice).toContain('readTdaPreflight');
    expect(tdaCallSlice).toContain('UnsupportedAtScaleError');
    expect(tdaCallSlice.indexOf('readTdaPreflight')).toBeLessThan(
      tdaCallSlice.indexOf('wasm[exportName]')
    );
  });
});
