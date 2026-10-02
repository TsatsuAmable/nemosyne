/**
 * RFC 0009 tranche 3 slice 2 — the kernel-issued governed consumer attestation.
 *
 * The Rust kernel (`wasm/src/data/governed_consumer.rs`) attests, for every
 * receipt bundle it issues, which governed consumers consume its receipts and
 * which receipt ids each one consumes. That attestation reaches TypeScript as
 * the *unparsed* payload of a governed-evidence capture readout and is parsed
 * here, exactly once, with the same strict closed-record discipline
 * `EvidenceReceipt.ts` applies to bundles.
 *
 * This is a data-only module, like every evidence parser: it never mints a
 * consumer identity and never consults a policy. The consumer ids come from the
 * kernel alone; `ConsumerPolicyRegistry.ts` decides which ones this build
 * governs. The one constant in this file is the TypeScript mirror of the
 * kernel's minted consumer id — the wasm integration suite pins the two to be
 * equal, so neither side can rename a governed consumer unilaterally.
 */

export const GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION = '1' as const;

/**
 * TypeScript mirror of the kernel minted constant
 * `DESCRIPTIVE_STATISTICS_CONSUMER_ID` (`wasm/src/data/governed_consumer.rs`).
 * It exists so the authority registry can map the consumer to its profile and
 * so composition can refuse a kernel mint that disagrees with it; it is not a
 * minting site, and no TS code may derive a consumer id from data content.
 */
export const DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1 =
  'nemosyne:consumer/descriptive-statistics/v1';

export interface GovernedConsumerUseV1 {
  readonly consumerId: string;
  readonly receiptIds: readonly string[];
}

export interface GovernedConsumerAttestationV1 {
  readonly schemaVersion: typeof GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION;
  readonly datasetFingerprint: string;
  readonly kernelVersion: string;
  readonly consumers: readonly GovernedConsumerUseV1[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[GovernedConsumer] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) {
    throw new Error(`[GovernedConsumer] ${label} has an unsupported shape`);
  }
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[GovernedConsumer] ${label} must be a non-empty string`);
  }
  return value;
}

/**
 * Parse and freeze one kernel-issued governed-consumer attestation.
 *
 * The kernel mint guarantees the honest shape (non-empty identities, receipt
 * ids that live in the bundle it was minted over, no duplicates); this parser
 * independently rejects anything else rather than trusting the mint across the
 * ABI boundary — the consumer side must not accept, from a transport layer, an
 * attestation the kernel side could not have produced *structurally*. Receipt
 * *coverage* (each attested id actually being in the bundle) is checked by the
 * composition layer against the parsed bundle, which has the receipts.
 */
export function parseGovernedConsumerAttestationV1(
  value: unknown
): GovernedConsumerAttestationV1 {
  const outer = record(value, 'governed consumer attestation');
  exactKeys(
    outer,
    ['schemaVersion', 'datasetFingerprint', 'kernelVersion', 'consumers'],
    'governed consumer attestation'
  );
  if (outer.schemaVersion !== GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION) {
    throw new Error('[GovernedConsumer] unsupported attestation schemaVersion');
  }
  if (!Array.isArray(outer.consumers)) {
    throw new Error('[GovernedConsumer] attestation.consumers must be an array');
  }
  const attestation: GovernedConsumerAttestationV1 = {
    schemaVersion: GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION,
    datasetFingerprint: nonEmptyString(outer.datasetFingerprint, 'attestation.datasetFingerprint'),
    kernelVersion: nonEmptyString(outer.kernelVersion, 'attestation.kernelVersion'),
    consumers: outer.consumers.map(
      (entry: unknown, index: number): GovernedConsumerUseV1 => {
        const item = record(entry, `attestation.consumers[${index}]`);
        exactKeys(item, ['consumerId', 'receiptIds'], `attestation.consumers[${index}]`);
        const receiptIds = item.receiptIds;
        if (!Array.isArray(receiptIds)) {
          throw new Error(`[GovernedConsumer] attestation.consumers[${index}].receiptIds must be an array`);
        }
        if (receiptIds.length === 0) {
          throw new Error(
            `[GovernedConsumer] attestation.consumers[${index}] must claim at least one receipt`
          );
        }
        return {
          consumerId: nonEmptyString(item.consumerId, `attestation.consumers[${index}].consumerId`),
          receiptIds: Object.freeze(
            receiptIds.map((receiptId, idIndex) =>
              nonEmptyString(receiptId, `attestation.consumers[${index}].receiptIds[${idIndex}]`)
            )
          ),
        };
      }
    ),
  };

  const seenConsumers = new Set<string>();
  for (const consumer of attestation.consumers) {
    if (seenConsumers.has(consumer.consumerId)) {
      throw new Error('[GovernedConsumer] duplicate attested consumer identity');
    }
    seenConsumers.add(consumer.consumerId);
    const seenReceipts = new Set<string>();
    for (const receiptId of consumer.receiptIds) {
      if (seenReceipts.has(receiptId)) {
        throw new Error('[GovernedConsumer] duplicate attested receipt identity');
      }
      seenReceipts.add(receiptId);
    }
  }

  return Object.freeze({
    ...attestation,
    consumers: Object.freeze(attestation.consumers.map((entry) => Object.freeze(entry))),
  });
}
