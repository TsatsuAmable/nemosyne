import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('live ingest analytical authority', () => {
  it('keeps schema inference out of TypeScript connector and coordinator code', () => {
    const normalize = read('src/data/connectors/normalize.ts');
    const coordinator = read('src/vr/coordinators/LiveStreamCoordinator.ts');
    const polling = read('src/data/connectors/PollingAdapter.ts');
    for (const source of [normalize, coordinator, polling]) {
      expect(source).not.toMatch(/inferType|ColumnType\.|rowsToDataset/);
    }
    expect(normalize).toContain('Rust/WASM is the sole analytical authority');
  });

  it('materializes full live row sets through Atlas Rust parsing', () => {
    const world = read('src/vr/World.ts');
    expect(world).toMatch(/materializeRows:[\s\S]*this\.atlas\.parseBytes\(bytes, 'json', topology\)/);
  });
});
