/**
 * RFC 0009 tranche 3 (F1) falsifying evidence: the third governed surface.
 *
 * `InvestigationContinuityController.openPortable` is the surface an analyst
 * reaches with an *externally supplied* file, and it accepts arbitrary bytes. It
 * derived its status line from `success` alone, so a governed V3 archive that
 * this build cannot govern reported "investigation evidence did not replay
 * exactly" — blaming the bytes for a capability limit the loader had already
 * ruled out — and a governed archive that did verify reported a bare
 * "Investigation verified", reading as a claim about its governed standing that
 * nothing on the path had checked.
 *
 * These falsifiers *mount the surface* rather than asserting over a
 * fixture-supplied message string. That distinction is the whole point: this
 * controller already imported the real `ReplayVerificationResult` type, so the
 * compiler checked it and it still ignored `evidence`. Widening a type forces a
 * producer to populate a field; it cannot force a consumer to read one. Only
 * driving the surface with a real archive tests the property.
 */
import { describe, expect, it } from 'vitest';
import { InvestigationContinuityController } from '../src/app/investigation/InvestigationContinuityController.ts';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { strToU8 } from 'fflate';
import {
  DIGEST,
  FIXTURE_DATASET,
  governedArchive,
  governedPayload,
  reproducibleIdentity,
  runner,
} from './helpers/f1GovernedArchive.ts';

/**
 * Every session-state access is a failure: `openPortable` documents that no
 * current product state is mutated before it returns a refusal, and the
 * no-snapshot branch additionally must not reopen anything.
 */
const UNTOUCHED = new Proxy({}, {
  get(_target, property) {
    throw new Error(`Session state must not be touched on this path (read '${String(property)}')`);
  },
});

function controller(): InvestigationContinuityController {
  return new InvestigationContinuityController({
    sessionController: {
      snapshotCurrentSession: () => {
        throw new Error('Session state must not be touched on this path');
      },
      saveSession: async () => {
        throw new Error('Session state must not be touched on this path');
      },
      restoreSnapshot: async () => {
        throw new Error('Session state must not be touched on this path');
      },
      restoreAutoSave: async () => {
        throw new Error('Session state must not be touched on this path');
      },
      archiveStore: UNTOUCHED as never,
    },
    // A real replay, not a stub: the property under test is what this surface
    // says about an actual governed archive.
    verifyPortableInvestigation: (bytes) => runner().replayArchive(bytes),
  });
}

async function verifiedGovernedArchive(): Promise<Uint8Array> {
  const identity = await reproducibleIdentity();
  // The digest cannot be known before the replay runs, so read the recomputed
  // one and pin it in, as the producing exporter would have. This pass is
  // *expected* to disagree — that disagreement is the only way to learn the
  // value — so it asserts on the digest's shape, not on the outcome.
  const probe = await runner().replayArchive(governedArchive(identity, DIGEST));
  if (!/^[0-9a-f]{64}$/.test(probe.investigationDigest)) {
    throw new Error(
      'F1 fixture could not reproduce an investigation digest from the replay; ' +
        `probe discrepancies were ${JSON.stringify(probe.discrepancies)}`,
    );
  }
  const archive = governedArchive(identity, probe.investigationDigest);
  const settled = await runner().replayArchive(archive);
  if (!settled.success) {
    throw new Error(
      'F1 fixture could not reach the governed happy path after pinning the ' +
        `recomputed digest; discrepancies were ${JSON.stringify(settled.discrepancies)}`,
    );
  }
  return archive;
}

describe('F1 falsifier 13: the continuity surface reports governed standing', () => {
  it('reports a use it cannot govern as a capability limit, not as damaged bytes', async () => {
    const archive = governedArchive(
      await reproducibleIdentity(),
      DIGEST,
      [
        {
          consumerId: 'fixture:inspected-claim',
          receiptId: 'receipt-1',
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        },
      ],
    );

    const result = await controller().openPortable(archive);

    expect(result.verification.success).toBe(false);
    expect(result.reopened).toBe(false);
    expect(result.resumable).toBe(false);
    // The exact overclaim this tranche had to remove: the envelope's integrity
    // was verified outright, so telling an analyst it "did not replay exactly"
    // sends them hunting for corruption the loader had already excluded.
    expect(result.message).not.toContain('did not replay exactly');
    expect(result.message).not.toMatch(/integrity mismatch/i);
    expect(result.message).toContain('cannot resolve');
  });

  it('does not render a governed archive as a bare verified, or as an older format', async () => {
    const result = await controller().openPortable(await verifiedGovernedArchive());

    expect(result.verification.success).toBe(true);
    // Widened from its slice-1 pin, which asserted the opposite: with the first
    // registry entry landed (RFC 0009 tranche 3 slice 2), a verifying run applies
    // the authority-owned consumer policy to the persisted uses, so the surface
    // must say the policy was applied rather than that nothing was enforced.
    expect(result.message).toContain('governed evidence verified under the consumer policy');
    expect(result.message).not.toContain('no consumer policy enforced');
    // The previous wording called every package that reached this branch "older".
    // The newest format reaches it, so that was simply false.
    expect(result.message).not.toContain('older');
    expect(result.message).not.toContain('Investigation verified.');
  });

  it('does not mutate product state to reach either verdict', async () => {
    // Asserted by construction: every session access above throws, and both
    // cases run to a returned verdict without tripping one.
    const archive = await verifiedGovernedArchive();
    const result = await controller().openPortable(archive);

    expect(result.reopened).toBe(false);
    expect(NemosynePackageManager.unpack(archive).extraFiles ?? {}).not.toHaveProperty(
      'continuity/session-v2.json',
    );
  });
});

/**
 * BOUNDARY, NOT DESIRED BEHAVIOUR — this pins a limitation that F1 makes
 * reachable and that the next tranche has to remove.
 *
 * Before F1 a governed V3 package was refused at replay, so this path was
 * unreachable. Now that such a package loads, one that also carries resumable
 * workspace state reaches `verifyEmbeddedSnapshot`, whose investigation-digest
 * comparison recomputes a digest from the snapshot alone
 * (`investigationDigestForSnapshot`). A V3 manifest digest is committed over the
 * evidence envelope bytes, which that composition never receives, so the
 * comparison cannot be satisfied. It fails closed — an exception, no state
 * mutated, no overclaim rendered — so this is not an integrity hole. It is a
 * functional dead end.
 *
 * WHAT THIS TEST ACTUALLY PROVES, stated narrowly because the first version of
 * it overclaimed: that the path is reachable, that the guard which fires is the
 * digest comparison (asserted by its message, which no earlier guard in that
 * method shares), and that the failure is contained. The mechanism above is an
 * argument from the composition, not something this test demonstrates — the
 * digest function is module-private, and the snapshot embedded here is a minimal
 * one that would not reproduce the replayed state even under a snapshot-derived
 * composition. So a *green* run here does not mean the comparison is unreachable
 * in principle for a faithful snapshot.
 *
 * It is therefore a marker, not a specification. It does not come with a
 * promise that it will fail the day any fix lands, and it must not be read as
 * the boundary being acceptable: the governed resumable-workspace digest
 * contract is a design decision RFC 0009 has not made, inventing a refusal code
 * for it here would pre-empt that design, and the tranche that owns governed
 * continuity export should replace this test with one pinning the contract it
 * defines.
 */
describe('F1 boundary: governed packages cannot yet carry resumable workspace state', () => {
  it('refuses rather than reopening, with no state mutated', async () => {
    const identity = await reproducibleIdentity();
    const payload = governedPayload({ identity });
    const probe = await runner().replayPayload(payload);
    const archive = NemosynePackageManager.pack({
      manifest: { ...payload.manifest, investigationDigest: probe.investigationDigest },
      datasetBytes: payload.datasetBytes,
      commandLogBytes: payload.commandLogBytes,
      evidenceReceiptBytes: payload.evidenceReceiptBytes,
    });
    const withWorkspace = NemosynePackageManager.pack({
      ...NemosynePackageManager.unpack(archive),
      extraFiles: {
        'continuity/session-v2.json': strToU8(
          JSON.stringify({
            schemaVersion: 2,
            sessionId: 'f1-session',
            originalDataset: FIXTURE_DATASET,
            eventLedger: [],
            analysisResults: [],
          }),
        ),
      },
    });

    // The governed replay itself succeeds — that is what makes this reachable.
    expect((await runner().replayArchive(withWorkspace)).success).toBe(true);

    // The manifest must actually carry a digest, or the guard below is never
    // reached and this test would be asserting nothing.
    expect(NemosynePackageManager.unpack(withWorkspace).manifest.investigationDigest)
      .toMatch(/^[0-9a-f]{64}$/);

    await expect(controller().openPortable(withWorkspace)).rejects.toThrow(
      /resumable workspace investigation digest does not match/i,
    );
  });
});
