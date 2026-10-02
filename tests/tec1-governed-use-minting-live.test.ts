/**
 * RFC 0009 tranche 3 slice 2 — the wasm-lane production-path falsifier.
 *
 * This is the half the kernel-free minting falsifier cannot cover: a *real*
 * governed export, written by the real session from a live Rust capture
 * (kernel-minted consumer attestation, minted uses), replayed back through the
 * real governed loader under the real registry. Nothing here is stubbed that
 * the production path would exercise, so the attested property is that this
 * build's own exports open under this build's own policy — minting and binding
 * agree because both read the same authority.
 *
 * The loader's refusal path over these bytes is pinned in the kernel-free
 * mutated-policy falsifier (`tec1-mutated-policy-refusal.test.ts`), which can
 * substitute the registry; here only the shipped authority must hold.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';
import {
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
} from '../src/data/evidence/GovernedConsumerAttestation.ts';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

function fixtureDataset(): Dataset {
  return new Dataset(
    'tec1-minted-uses-live',
    [
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
    ],
    [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: null, y: 6 }]
  );
}

describe('TEC1 minted governed uses on the live production path', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) {
      throw new Error(
        'RuntimeBridge failed to initialize WASM. Run npm run wasm:dev before this integration test.'
      );
    }
  });

  it('replays a real governed export to a verified, policy-enforced attestation', async () => {
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(fixtureDataset());
    const session = new NemosyneSession({ atlas });
    try {
      const bytes = await session.exportPortablePackage({}, undefined, {
        governedEvidence: true,
      });

      // The export's uses are the kernel-minted ones: one use per bundle
      // receipt, under the governed consumer and the authority-required
      // profile. Asserted against the same authority the loader binds with,
      // so this is the minted shape, not a fixture's.
      const envelope = parsePersistedEvidenceReceiptsV1(
        JSON.parse(new TextDecoder().decode(
          NemosynePackageManager.unpack(bytes).evidenceReceiptBytes!
        ))
      );
      expect(envelope.uses).toEqual(
        envelope.bundle.receipts.map((receipt) => ({
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptId: receipt.receiptId,
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        })),
      );

      // The real governed loader, on the real bridge, under the real registry:
      // the minted uses bind (BOUND) and their receipts resolve (RESOLVED), so
      // the run reports that the consumer policy was actually applied.
      const result = await new InvestigationReplayRunner(bridge).replayArchive(bytes);
      expect(result.success).toBe(true);
      expect(result.evidence).toEqual({
        envelope: 'present',
        integrity: 'verified',
        enforcement: 'consumer-policy',
      });
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);
});
