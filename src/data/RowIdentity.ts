const rendererRowIds = new WeakMap<object, string>();
let nextRendererRowId = 1;

/**
 * Process-local identity for renderer/interaction bookkeeping.
 *
 * This is intentionally NOT analytical provenance and must never be persisted
 * into investigations, fingerprints, model evidence, or study manifests.
 * Clean row objects that are reused across derived JS Dataset instances retain
 * the same renderer identity without requiring reference-equality comparisons.
 */
export function rendererRowId(row: Record<string, unknown>): string {
  if (!row || typeof row !== 'object') return 'row:invalid';
  const existing = rendererRowIds.get(row);
  if (existing) return existing;
  const id = `row:${nextRendererRowId++}`;
  rendererRowIds.set(row, id);
  return id;
}
