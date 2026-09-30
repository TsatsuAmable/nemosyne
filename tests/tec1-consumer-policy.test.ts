import { describe, expect, it } from 'vitest';
import { bindConsumerUsesV1 } from '../src/data/evidence/ConsumerPolicy.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';

/**
 * RFC 0009 tranche 3 — authority-owned consumer-policy binding contract.
 *
 * Fixture discipline follows the profile contract test: every receipt is a
 * closed schema shape the Rust statistics family can emit, and the envelope
 * is built through the real `parsePersistedEvidenceReceiptsV1` parser, so
 * these falsifiers exercise production parsing plus binding together. The
 * live production path (governed loader wiring) is a later tranche; this
 * file pins the binding contract only.
 */

function receipt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    receiptId: 'descriptive:x',
    claimId: 'descriptive:x',
    estimand: 'descriptive finite-value summary for column x',
    measurementContext: { status: 'NOT_ESTABLISHED' },
    geometry: null,
    assumptions: [],
    sampleSupport: {
      totalRows: 3,
      rowsUsed: 2,
      rowsExcluded: 1,
      columns: ['x'],
      policy: 'completeCase',
      exclusionReasons: [{ reason: 'missing or non-finite numeric value', rowCount: 1 }],
    },
    uncertainty: null,
    stability: null,
    sensitivity: [],
    limitations: ['descriptive summary only; no population uncertainty has been estimated'],
    methodProvenance: {
      method: 'descriptive/finite-numeric',
      methodVersion: 'statistics-v1',
      kernelVersion: 'kernel',
      datasetFingerprint: 'fingerprint',
      parameters: [],
    },
    ...overrides,
  };
}

function rawBundle() {
  return {
    schemaVersion: '1',
    datasetFingerprint: 'fingerprint',
    kernelVersion: 'kernel',
    receipts: [
      receipt(),
      receipt({
        receiptId: 'descriptive:y',
        claimId: 'descriptive:y',
        estimand: 'descriptive finite-value summary for column y',
        assumptions: [
          {
            assumption: 'fixture violated assumption',
            status: 'violated',
            detail: 'fixture: violated',
          },
        ],
      }),
    ],
  };
}

function envelope(uses: unknown[]) {
  return parsePersistedEvidenceReceiptsV1({
    schemaVersion: '1',
    bundle: rawBundle(),
    uses,
  });
}

function use(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    consumerId: 'techno-core-provenance/v1',
    receiptId: 'descriptive:x',
    requirementProfileId: 'descriptive-summary/v1',
    ...overrides,
  };
}

describe('TEC1 consumer-policy binding (RFC 0009 tranche 3 contract)', () => {
  it('binds a conforming use and resolves its receipt under the exact recorded profile', () => {
    const bindings = bindConsumerUsesV1({
      envelope: envelope([use()]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'descriptive-summary/v1']]),
    });
    expect(bindings).toHaveLength(1);
    const binding = bindings[0];
    expect(binding.status).toBe('BOUND');
    if (binding.status !== 'BOUND') return;
    expect(binding.consumerId).toBe('techno-core-provenance/v1');
    expect(binding.use.receiptId).toBe('descriptive:x');
    expect(binding.resolution.status).toBe('RESOLVED');
  });

  it('passes receipt-level refusals through binding without promoting them', () => {
    const bindings = bindConsumerUsesV1({
      envelope: envelope([use({ receiptId: 'descriptive:y' })]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'descriptive-summary/v1']]),
    });
    expect(bindings).toHaveLength(1);
    const binding = bindings[0];
    expect(binding.status).toBe('BOUND');
    if (binding.status !== 'BOUND') return;
    expect(binding.resolution).toEqual({
      status: 'VIOLATED_ASSUMPTION',
      receiptId: 'descriptive:y',
      assumption: 'fixture violated assumption',
    });
  });

  it('refuses a required consumer with no use records, and binds nothing for empty policy', () => {
    const missing = bindConsumerUsesV1({
      envelope: envelope([]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'descriptive-summary/v1']]),
    });
    expect(missing).toEqual([{ status: 'MISSING_USE', consumerId: 'techno-core-provenance/v1' }]);

    // An empty uses array preserves an inspected bundle but establishes no
    // consumer enforcement: with no required consumers there is nothing to bind.
    expect(
      bindConsumerUsesV1({ envelope: envelope([]), requiredConsumers: new Map() }),
    ).toEqual([]);
  });

  it('refuses a use for a consumer the owning policy does not govern', () => {
    // An ungoverned use neither binds nor satisfies the required consumer:
    // the unknown identity refuses and the governed requirement stays missing.
    const bindings = bindConsumerUsesV1({
      envelope: envelope([use({ consumerId: 'analyst-column-x' })]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'descriptive-summary/v1']]),
    });
    expect(bindings).toEqual([
      { status: 'UNKNOWN_CONSUMER', consumerId: 'analyst-column-x' },
      { status: 'MISSING_USE', consumerId: 'techno-core-provenance/v1' },
    ]);
  });

  it('refuses a weaker recorded profile even when it would resolve', () => {
    // The archive records the descriptive profile while the owning policy
    // demands the inferential profile. Substituting the weaker recorded
    // profile would silently re-judge the requirement; exact agreement is
    // required in both directions.
    const weaker = bindConsumerUsesV1({
      envelope: envelope([use()]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'inferential-claim/v1']]),
    });
    expect(weaker).toEqual([
      {
        status: 'PROFILE_MISMATCH',
        consumerId: 'techno-core-provenance/v1',
        requiredProfileId: 'inferential-claim/v1',
        recordedProfileId: 'descriptive-summary/v1',
      },
    ]);

    const stronger = bindConsumerUsesV1({
      envelope: envelope([use({ requirementProfileId: 'inferential-claim/v1' })]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'descriptive-summary/v1']]),
    });
    expect(stronger[0]).toMatchObject({
      status: 'PROFILE_MISMATCH',
      requiredProfileId: 'descriptive-summary/v1',
      recordedProfileId: 'inferential-claim/v1',
    });
  });

  it('refuses a recorded profile the closed registry never minted', () => {
    const bindings = bindConsumerUsesV1({
      envelope: envelope([use({ requirementProfileId: 'retired/v9' })]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'retired/v9']]),
    });
    expect(bindings).toEqual([
      {
        status: 'UNKNOWN_REQUIREMENT_PROFILE',
        consumerId: 'techno-core-provenance/v1',
        profileId: 'retired/v9',
      },
    ]);
  });

  it('refuses a caller-forged profile identity even when policy and archive agree', () => {
    // Policy-map values are data, not authority: agreeing on an unminted
    // identity still fails closed instead of falling back to a current default.
    const bindings = bindConsumerUsesV1({
      envelope: envelope([use({ requirementProfileId: 'caller-forged/v1' })]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'caller-forged/v1']]),
    });
    expect(bindings[0]).toMatchObject({
      status: 'UNKNOWN_REQUIREMENT_PROFILE',
      profileId: 'caller-forged/v1',
    });
  });

  it('never resolves an inferred receipt identity against the Rust-issued bundle', () => {
    // `x` is the column the receipt describes, not a Rust-issued receipt ID.
    // Binding holds structurally but resolution refuses: inference is not identity.
    const bindings = bindConsumerUsesV1({
      envelope: envelope([use({ receiptId: 'x' })]),
      requiredConsumers: new Map([['techno-core-provenance/v1', 'descriptive-summary/v1']]),
    });
    expect(bindings).toHaveLength(1);
    const binding = bindings[0];
    expect(binding.status).toBe('BOUND');
    if (binding.status !== 'BOUND') return;
    expect(binding.resolution).toEqual({ status: 'RECEIPT_NOT_FOUND', receiptId: 'x' });
  });

  it('keeps one failing use from authorizing or poisoning its neighbours', () => {
    const bindings = bindConsumerUsesV1({
      envelope: envelope([
        use(),
        use({ consumerId: 'evidence-vault/v1', receiptId: 'absent-receipt' }),
      ]),
      requiredConsumers: new Map([
        ['techno-core-provenance/v1', 'descriptive-summary/v1'],
        ['evidence-vault/v1', 'descriptive-summary/v1'],
      ]),
    });
    expect(bindings).toHaveLength(2);
    expect(bindings[0].status).toBe('BOUND');
    if (bindings[0].status !== 'BOUND') return;
    expect(bindings[0].resolution.status).toBe('RESOLVED');
    expect(bindings[1].status).toBe('BOUND');
    if (bindings[1].status !== 'BOUND') return;
    expect(bindings[1].resolution).toEqual({
      status: 'RECEIPT_NOT_FOUND',
      receiptId: 'absent-receipt',
    });
  });

  it('returns envelope-ordered frozen bindings', () => {
    const bindings = bindConsumerUsesV1({
      envelope: envelope([
        use({ consumerId: 'b-consumer' }),
        use({ consumerId: 'a-consumer' }),
      ]),
      requiredConsumers: new Map([
        ['a-consumer', 'descriptive-summary/v1'],
        ['b-consumer', 'descriptive-summary/v1'],
      ]),
    });
    expect(bindings.map((binding) => binding.consumerId)).toEqual(['b-consumer', 'a-consumer']);
    expect(Object.isFrozen(bindings)).toBe(true);
    for (const binding of bindings) expect(Object.isFrozen(binding)).toBe(true);
  });

  it('accepts the parsed bundle fixture the profile contract accepts', () => {
    // Guards the fixture-shape assumption: if the bundle parser rejects these
    // receipts, the binding tests above test nothing.
    const bundle = parseEvidenceReceiptBundleV1(rawBundle());
    expect(bundle.receipts.map((receipt) => receipt.receiptId)).toEqual([
      'descriptive:x',
      'descriptive:y',
    ]);
  });
});
