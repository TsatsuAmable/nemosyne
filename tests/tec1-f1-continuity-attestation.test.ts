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
    expect(result.message).toContain('governed evidence verified, no consumer policy enforced');
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
 * BOUNDARY, NOT DESIRED BEHAVIOUR — this falsifier pins a limitation that F1
 * makes reachable and that the next tranche has to remove.
 *
 * Before F1 a governed V3 package was refused at replay, so this path was
 * unreachable. Now that such a package loads, one that also carries resumable
 * workspace state reaches `verifyEmbeddedSnapshot`, whose investigation-digest
 * comparison recomputes the digest *without* the evidence envelope bytes
 * (`investigationDigestForSnapshot`). That can never equal a V3 manifest digest,
 * which is committed over those very bytes, so the open throws unconditionally.
 *
 * It fails closed — an exception, no state mutated, no overclaim rendered — so
 * this is not an integrity hole. It is a functional dead end, and the fix
 * belongs to the tranche that owns governed continuity export: the governed
 * resumable-workspace digest contract is a design decision the RFC has not made,
 * and inventing a refusal code for it here would pre-empt that design. When that
 * tranche lands, this test should fail, and that failure is the point of it.
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

    await expect(controller().openPortable(withWorkspace)).rejects.toThrow(
      /resumable workspace investigation digest does not match/i,
    );
  });
});
