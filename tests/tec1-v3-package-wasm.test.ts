import { expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from '../src/data/evidence/EvidenceRequirementProfile.ts';
import {
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
  parseGovernedConsumerAttestationV1,
} from '../src/data/evidence/GovernedConsumerAttestation.ts';
import { buildCanonicalInvestigationInputV3, computeGovernedInvestigationDigest } from '../src/investigation/InvestigationDigest.ts';
import { CANONICAL_DATASET_IDENTITY_ALGORITHM } from '../src/data/DatasetIdentity.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';

it('persists actual Rust-produced receipt values and their semantic commitment through V3 ZIP', async () => {
  const dataset = { name: 'v3-package', columns: [{ name: 'x', type: 'NUMERIC' as const }, { name: 'y', type: 'NUMERIC' as const }],
    rows: [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: null, y: 6 }] };
  const handle = bridge.loadDatasetJson(dataset);
  try {
    const bundle = bridge.statisticsEvidenceReceiptBundle(handle);
    const inspected = parsePersistedEvidenceReceiptsV1({ schemaVersion: '1', bundle, uses: [] });
    expect(inspected.bundle.receipts.length).toBeGreaterThan(0);
    const receiptId = inspected.bundle.receipts[0].receiptId;
    const envelope = { schemaVersion: '1', bundle,
      uses: [{ consumerId: 'fixture:inspected-claim', receiptId, requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId }] };
    const evidenceReceiptBytes = new TextEncoder().encode(JSON.stringify(envelope));
    const datasetFingerprint = bridge.datasetFingerprint(handle)!;
    const kernelVersion = bridge.kernelVersion()!;
    const state = { datasetFingerprint, immutableDatasetFingerprint: datasetFingerprint, kernelVersion,
      analyticalState: { datasetVersion: 0, datasetFingerprint }, eventLedger: [], analysisResults: [], observations: [], findings: [], annotations: [] };
    const investigationDigest = await computeGovernedInvestigationDigest(state, evidenceReceiptBytes);
    const restored = NemosynePackageManager.unpack(NemosynePackageManager.pack({
      manifest: { formatVersion: 3, sessionId: 'fixture', datasetFingerprint,
        datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
        analyticalDatasetFingerprint: datasetFingerprint, analyticalKernelVersion: kernelVersion,
        kernelVersion, datasetName: dataset.name, createdAt: 0, commandCount: 0,
        investigationDigestAlgorithm: 'sha256-canonical-investigation-v3', investigationDigest,
        evidenceReceiptDigest: sha256Hex(evidenceReceiptBytes), environment: {} },
      datasetBytes: new TextEncoder().encode(JSON.stringify(dataset)), commandLogBytes: new TextEncoder().encode('[]'), evidenceReceiptBytes,
    }));
    expect(JSON.parse(new TextDecoder().decode(restored.evidenceReceiptBytes))).toEqual(envelope);
    const root = buildCanonicalInvestigationInputV3(state, restored.evidenceReceiptBytes!);
    expect(root.governedEvidence.envelope.bundle).toEqual(bundle);
    expect(await computeGovernedInvestigationDigest(state, restored.evidenceReceiptBytes!)).toBe(investigationDigest);

    // RFC 0009 tranche 3 slice 2: the kernel mints the governed consumer
    // identity itself, and the TS mirror constant the policy registry keys on
    // is only its mirror. Pinned here, where the wasm binary is fresh (CI);
    // a renamed kernel consumer id fails this line instead of silently
    // de-governing the descriptive consumer.
    const attestation = parseGovernedConsumerAttestationV1(
      bridge.statisticsGovernedConsumers(handle)
    );
    expect(
      attestation.consumers.map((consumer) => ({
        consumerId: consumer.consumerId,
        receiptIds: [...consumer.receiptIds],
      })),
    ).toEqual([
      {
        consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
        receiptIds: inspected.bundle.receipts.map((receipt) => receipt.receiptId),
      },
    ]);
  } finally {
    bridge.destroyDataset(handle);
  }
});
