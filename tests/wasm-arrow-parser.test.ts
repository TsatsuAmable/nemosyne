import { describe, it, expect } from 'vitest';
import { parseDataset } from '../src/data/Parsers.js';

describe('Sprint 13.2: Zero-Copy Apache Arrow WASM Ingestion Engine', () => {
  it('parses binary columnar Apache Arrow RecordBatch payload', async () => {
    // Generate binary 64-bit float buffer for x, y, z
    const buffer = new Float64Array([
      1.0, 2.0, 3.0, // Row 0
      4.0, 5.0, 6.0, // Row 1
    ]);

    const dataset = await parseDataset(buffer.buffer, 'arrow_payload.arrow');
    expect(dataset).toBeDefined();
    expect(dataset.name).toBe('arrow_payload.arrow');
    expect(dataset.rowCount).toBe(2);
    expect(dataset.columns.length).toBeGreaterThanOrEqual(3);
  });
});
