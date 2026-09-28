/** RFC 0009 persisted data only. Parsing never mints a replay authority. */
import { parseEvidenceReceiptBundleV1, type EvidenceReceiptBundleV1 } from './EvidenceReceipt.ts';

export interface PersistedEvidenceUseV1 {
  readonly consumerId: string;
  readonly receiptId: string;
  readonly requirementProfileId: string;
}

export interface PersistedEvidenceReceiptsV1 {
  readonly schemaVersion: '1';
  readonly bundle: EvidenceReceiptBundleV1;
  readonly uses: readonly PersistedEvidenceUseV1[];
}

function closedRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[PersistedEvidenceReceipts] expected an object');
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error('[PersistedEvidenceReceipts] unsupported shape');
  }
  return value as Record<string, unknown>;
}

function identity(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('[PersistedEvidenceReceipts] identities must be non-empty primitive strings');
  }
  return value;
}

/** Snapshots the closed envelope, retaining order and exact historical identities. */
export function parsePersistedEvidenceReceiptsV1(value: unknown): PersistedEvidenceReceiptsV1 {
  const envelope = closedRecord(value, ['schemaVersion', 'bundle', 'uses']);
  if (envelope.schemaVersion !== '1' || !Array.isArray(envelope.uses)) {
    throw new Error('[PersistedEvidenceReceipts] unsupported schemaVersion or uses');
  }
  const bundle = parseEvidenceReceiptBundleV1(envelope.bundle);
  const seen = new Set<string>();
  const uses = envelope.uses.map((value) => {
    const use = closedRecord(value, ['consumerId', 'receiptId', 'requirementProfileId']);
    const result = {
      consumerId: identity(use.consumerId), receiptId: identity(use.receiptId),
      requirementProfileId: identity(use.requirementProfileId),
    };
    const key = JSON.stringify([result.consumerId, result.receiptId, result.requirementProfileId]);
    if (seen.has(key)) throw new Error('[PersistedEvidenceReceipts] duplicate use');
    seen.add(key);
    return Object.freeze(result);
  });
  // Existence and authority-owned consumer policy are checked by the future
  // governed loader, not inferred from opaque IDs at this data-only boundary.
  return Object.freeze({ schemaVersion: '1', bundle, uses: Object.freeze(uses) });
}
