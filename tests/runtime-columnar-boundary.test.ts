import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const boundarySource = readFileSync('src/wasm/ColumnarBoundary.ts', 'utf8');
const barrelSource = readFileSync('src/wasm/index.ts', 'utf8');

describe('runtime columnar host boundary', () => {
  it('routes metadata through canonical columnar exports', () => {
    expect(boundarySource).toContain("call('canonical_dataset_row_count', handle)");
    expect(boundarySource).toContain("call('canonical_dataset_column_count', handle)");
    expect(boundarySource).not.toContain("call('dataset_row_count', handle)");
    expect(boundarySource).not.toContain("call('dataset_column_count', handle)");
  });

  it('makes JSON export an explicit compatibility crossing', () => {
    expect(boundarySource).toContain("call('compatibility_dataset_to_json', handle, 0, 0)");
    expect(boundarySource).toContain("call('compatibility_row_materialisation_count')");
    expect(boundarySource).not.toContain("call('dataset_to_json'");
  });

  it('publishes application-facing dataset helpers from the boundary adapter', () => {
    expect(barrelSource).toMatch(/datasetRowCount,[\s\S]*datasetColumnCount,[\s\S]*rowMaterialisationCount,[\s\S]*getDatasetJson,[\s\S]*parseDatasetBytes,[\s\S]*executeOperation,[\s\S]*from '\.\/ColumnarBoundary\.ts'/);
  });
});
