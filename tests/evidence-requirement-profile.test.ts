import { describe, expect, it } from 'vitest';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
  INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
  evaluateEvidenceReceiptAgainstProfileV1,
  isEvidenceRequirementProfileV1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import type { EvidenceReceiptV1 } from '../src/data/evidence/EvidenceReceipt.ts';

/**
 * TEC1 requirement-profile / typed-refusal contract (RFC 0007 section 3).
 *
 * Fast-lane fixtures mirror the Rust producer's value semantics per the
 * mock-seam discipline established by #818: every receipt here is a closed
 * schema shape the Rust statistics family can emit (the assumption statuses,
 * absent axes and established-context shape all exist in the producer
 * contract), and the live production path is pinned separately in
 * `tests/tec1-statistics-evidence-receipts.test.ts` against the real WASM
 * bridge. The violated-assumption fixture uses a status the Rust
 * `AssumptionStatus` enum can emit even though no current statistics claim
 * carries one; the evaluator branch must still fail closed for it.
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

function assumption(status: string, assumptionText: string): Record<string, unknown> {
  return { assumption: assumptionText, status, detail: `fixture: ${status}` };
}

function parse(receipts: unknown[]): readonly EvidenceReceiptV1[] {
  return parseEvidenceReceiptBundleV1({
    schemaVersion: '1',
    datasetFingerprint: 'fingerprint',
    kernelVersion: 'kernel',
    receipts,
  }).receipts;
}

const UNRESOLVED_INDEPENDENCE = 'observation independence for inferential interpretation';

describe('TEC1 authority-owned requirement profiles', () => {
  it('mints a closed frozen registry whose members pass the ownership guard', () => {
    for (const profile of [
      DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
      INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
    ]) {
      expect(isEvidenceRequirementProfileV1(profile)).toBe(true);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.requiredAxes)).toBe(true);
      expect(Object.isFrozen(profile.assumptionRequirement)).toBe(true);
      expect(typeof profile.profileId).toBe('string');
    }
    expect(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.requiredAxes).toEqual([]);
    expect(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.assumptionRequirement).toEqual({
      refuseViolated: true,
      refuseUnresolved: false,
    });
    expect(INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1.requiredAxes).toEqual([
      'measurementContextEstablished',
      'uncertainty',
    ]);
    expect(INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1.assumptionRequirement).toEqual({
      refuseViolated: true,
      refuseUnresolved: true,
    });
  });

  it('rejects caller-forged profiles that would weaken requirements', () => {
    const forged = {
      profileId: 'caller-forged/v1',
      requiredAxes: [],
      assumptionRequirement: { refuseViolated: false, refuseUnresolved: false },
    };
    expect(isEvidenceRequirementProfileV1(forged)).toBe(false);
    // Structural look-alikes copied from a real profile also fail: the brand
    // symbol is not reachable outside the minting module and JSON cannot
    // carry it.
    const cloned = JSON.parse(JSON.stringify(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1));
    expect(isEvidenceRequirementProfileV1(cloned)).toBe(false);
    expect(() =>
      evaluateEvidenceReceiptAgainstProfileV1(
        forged as unknown as typeof DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
        'descriptive:x',
        null
      )
    ).toThrow('authority-owned');
  });

  it('refuses unknown receipts with a typed not-found outcome', () => {
    parse([receipt()]);
    const outcome = evaluateEvidenceReceiptAgainstProfileV1(
      DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
      'missing-receipt',
      null
    );
    expect(outcome).toEqual({ status: 'RECEIPT_NOT_FOUND', receiptId: 'missing-receipt' });
    expect(Object.isFrozen(outcome)).toBe(true);
  });

  it('returns a typed missing-axis refusal and never treats absence as satisfied', () => {
    const [pearson] = parse([
      receipt({
        receiptId: 'pearson:x:y',
        claimId: 'pearson:x:y',
        estimand: 'Pearson linear association between x and y',
        assumptions: [
          assumption('notTestableFromData', UNRESOLVED_INDEPENDENCE),
          assumption('satisfied', 'Pearson r describes linear association only'),
        ],
        sampleSupport: {
          totalRows: 3,
          rowsUsed: 2,
          rowsExcluded: 1,
          columns: ['x', 'y'],
          policy: 'pairwiseComplete',
          exclusionReasons: [{ reason: 'missing or non-finite numeric value', rowCount: 1 }],
        },
      }),
    ]);

    // The inferential profile refuses violated and unresolved assumptions
    // before axis requirements, so the pearson refusal is claim-intrinsic.
    const refusal = evaluateEvidenceReceiptAgainstProfileV1(
      INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
      'pearson:x:y',
      pearson
    );
    expect(refusal).toEqual({
      status: 'UNRESOLVED_ASSUMPTION',
      receiptId: 'pearson:x:y',
      assumption: UNRESOLVED_INDEPENDENCE,
    });

    // A satisfied-assumption descriptive receipt fails the axis requirement
    // instead: absence of established measurement context is explicit absence.
    const [descriptive] = parse([receipt()]);
    const axisRefusal = evaluateEvidenceReceiptAgainstProfileV1(
      INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
      'descriptive:x',
      descriptive
    );
    expect(axisRefusal).toEqual({
      status: 'MISSING_REQUIRED_AXIS',
      receiptId: 'descriptive:x',
      axis: 'measurementContextEstablished',
    });

    // Axis checks follow the profile's declared order deterministically.
    const [establishedNoUncertainty] = parse([
      receipt({
        measurementContext: {
          status: 'ESTABLISHED',
          records: [
            {
              model: {
                column: 'x',
                scale: 'ratio',
                observationStructure: 'iid',
                compositionalGroup: null,
              },
              status: 'confirmed',
              basis: [{ source: 'manifest', rationale: 'declared domain semantics' }],
            },
          ],
          semanticAdmissionPolicy: 'requireConfirmed',
          analyticalAdmission: { status: 'admitted', issues: [] },
        },
      }),
    ]);
    const uncertaintyRefusal = evaluateEvidenceReceiptAgainstProfileV1(
      INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
      'descriptive:x',
      establishedNoUncertainty
    );
    expect(uncertaintyRefusal).toEqual({
      status: 'MISSING_REQUIRED_AXIS',
      receiptId: 'descriptive:x',
      axis: 'uncertainty',
    });
    expect(Object.isFrozen(uncertaintyRefusal)).toBe(true);
  });

  it('returns a typed violated-assumption refusal', () => {
    const [violating] = parse([
      receipt({
        receiptId: 'violated:x',
        claimId: 'violated:x',
        assumptions: [assumption('violated', 'fixture violated assumption')],
      }),
    ]);
    // The descriptive profile tolerates unresolved assumptions but still
    // refuses a violated one.
    const outcome = evaluateEvidenceReceiptAgainstProfileV1(
      DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
      'violated:x',
      violating
    );
    expect(outcome).toEqual({
      status: 'VIOLATED_ASSUMPTION',
      receiptId: 'violated:x',
      assumption: 'fixture violated assumption',
    });
  });

  it('resolves only when every requirement is met, without upgrading values', () => {
    const [inferentialReceipt] = parse([
      receipt({
        receiptId: 'pearson:x:y',
        claimId: 'pearson:x:y',
        estimand: 'Pearson linear association between x and y',
        measurementContext: {
          status: 'ESTABLISHED',
          records: [
            {
              model: {
                column: 'x',
                scale: 'ratio',
                observationStructure: 'iid',
                compositionalGroup: null,
              },
              status: 'confirmed',
              basis: [{ source: 'manifest', rationale: 'declared domain semantics' }],
            },
          ],
          semanticAdmissionPolicy: 'requireConfirmed',
          analyticalAdmission: { status: 'admitted', issues: [] },
        },
        assumptions: [assumption('satisfied', 'fixture satisfied assumption')],
        uncertainty: { method: 'fixture-interval', lower: 0.1, upper: 0.4, standardError: null },
      }),
    ]);
    const resolved = evaluateEvidenceReceiptAgainstProfileV1(
      INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
      'pearson:x:y',
      inferentialReceipt
    );
    expect(resolved.status).toBe('RESOLVED');
    if (resolved.status === 'RESOLVED') {
      expect(resolved.receipt).toBe(inferentialReceipt);
      expect(Object.isFrozen(resolved.receipt)).toBe(true);
    }
    expect(Object.isFrozen(resolved)).toBe(true);

    // The pearson producer shape (unresolved independence assumption) can
    // still resolve for a purely descriptive use: tolerance of unresolved
    // assumptions is policy, not an upgrade of the claim itself.
    const [pearson] = parse([
      receipt({
        receiptId: 'pearson:x:y',
        claimId: 'pearson:x:y',
        estimand: 'Pearson linear association between x and y',
        assumptions: [
          assumption('notTestableFromData', UNRESOLVED_INDEPENDENCE),
          assumption('satisfied', 'Pearson r describes linear association only'),
        ],
        sampleSupport: {
          totalRows: 3,
          rowsUsed: 2,
          rowsExcluded: 1,
          columns: ['x', 'y'],
          policy: 'pairwiseComplete',
          exclusionReasons: [{ reason: 'missing or non-finite numeric value', rowCount: 1 }],
        },
      }),
    ]);
    const descriptiveOutcome = evaluateEvidenceReceiptAgainstProfileV1(
      DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
      'pearson:x:y',
      pearson
    );
    expect(descriptiveOutcome.status).toBe('RESOLVED');
  });
});
