const rendererRowIds = new WeakMap<object, string>();
const durableRowIds = new WeakMap<object, string>();
let nextRendererRowId = 1;

/**
 * Associate a row object with the durable observation identity supplied by the
 * Rust dataset ABI. The association itself is process-local; the identity value
 * is durable because it is carried separately in `DatasetJSON.rowIds`.
 */
export function registerDurableRowId(row: Record<string, unknown>, id: string): void {
  if (!row || typeof row !== 'object' || !id) return;
  durableRowIds.set(row, id);
}

/** Return the durable Rust-owned identity for a row when one is known. */
export function durableRowId(row: Record<string, unknown>): string | undefined {
  if (!row || typeof row !== 'object') return undefined;
  return durableRowIds.get(row);
}

/**
 * Identity used by renderer/interaction bookkeeping.
 *
 * Prefer the Rust-owned durable observation ID when a row crossed the dataset
 * ABI with one. Otherwise fall back to a process-local WeakMap ID for legacy or
 * purely JS-created rows. Neither form is an analytical variable, and renderer
 * identity must never be included in fingerprints or model evidence.
 */
export function rendererRowId(row: Record<string, unknown>): string {
  if (!row || typeof row !== 'object') return 'row:invalid';
  const durable = durableRowIds.get(row);
  if (durable) return `dataset-row:${durable}`;
  const existing = rendererRowIds.get(row);
  if (existing) return existing;
  const id = `row:${nextRendererRowId++}`;
  rendererRowIds.set(row, id);
  return id;
}
