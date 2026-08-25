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
});
