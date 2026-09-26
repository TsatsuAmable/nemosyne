import type { EvidenceReceiptV1 } from './EvidenceReceipt.ts';

/**
 * TEC1 requirement-profile contract (RFC 0007 section 3).
 *
 * A requirement profile is a code/policy-owned statement of which epistemic
 * axes an analytical or representation operation needs from an evidence
 * receipt before it may consume the claim. Profiles exist so that evidence
 * requirements are explicit and machine-readable instead of being re-inferred
 * ad hoc at each downstream call site, and so that unmet requirements produce
 * typed refusals rather than guessed analytical facts.
 *
 * Profiles express axis *presence* and assumption *status* only. They
 * deliberately carry no numeric thresholds: absence of uncertainty, stability
 * or measurement context is explicit absence (never a favourable value), and
 * classifying a measured value as acceptable or unacceptable remains the job
 * of the separate scientific-admission rules and the Moneta evidence
 * protocol. Receipt presence alone never means admissible.
 */
export type EvidenceRequirementAxisV1 =
  'measurementContextEstablished' | 'geometry' | 'uncertainty' | 'stability' | 'sensitivity';

/**
 * Which assumption statuses a consuming operation refuses.
 *
 * `refuseViolated` rejects receipts carrying an assumption with status
 * `violated`. `refuseUnresolved` rejects receipts carrying an assumption with
 * status `unchecked` or `notTestableFromData`. An operation may tolerate
 * unresolved assumptions (for example a purely descriptive use) while still
 * refusing violated ones, or refuse both.
 */
export interface EvidenceAssumptionRequirementV1 {
  readonly refuseViolated: boolean;
  readonly refuseUnresolved: boolean;
}

export interface EvidenceRequirementProfileContractV1 {
  /** Stable identity of the owning policy, for refusal telemetry and audits. */
  readonly profileId: string;
  /** Axes that must be present on the receipt, checked in this order. */
  readonly requiredAxes: readonly EvidenceRequirementAxisV1[];
  readonly assumptionRequirement: EvidenceAssumptionRequirementV1;
}

const EVIDENCE_REQUIREMENT_PROFILE_BRAND = Symbol('EvidenceRequirementProfileV1');

/**
 * Authority-owned requirement profile. The brand symbol is deliberately not
 * exported, so only this module can construct a profile. A candidate, UI
 * caller or learned model cannot weaken an operation's requirements by
 * requesting fewer axes: it can only reference one of the frozen profiles
 * minted here, and the live resolver rejects anything else at runtime.
 */
export interface EvidenceRequirementProfileV1 extends EvidenceRequirementProfileContractV1 {
  readonly [EVIDENCE_REQUIREMENT_PROFILE_BRAND]: true;
}

const AXES: readonly EvidenceRequirementAxisV1[] = [
  'measurementContextEstablished',
  'geometry',
  'uncertainty',
  'stability',
  'sensitivity',
];

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAssumptionRequirement(value: unknown): value is EvidenceAssumptionRequirementV1 {
  return (
    isRecord(value) &&
    typeof value.refuseViolated === 'boolean' &&
    typeof value.refuseUnresolved === 'boolean' &&
    Object.keys(value).length === 2
  );
}

/**
 * Runtime guard for the nominal profile brand plus full structural
 * re-validation. TypeScript's brand already rejects forged profiles at compile
 * time; this guard also fails closed when untyped input reaches the live
 * resolver (for example through `any` at a boundary).
 */
export function isEvidenceRequirementProfileV1(
  value: unknown
): value is EvidenceRequirementProfileV1 {
  if (
    !isRecord(value) ||
    value[EVIDENCE_REQUIREMENT_PROFILE_BRAND] !== true ||
    typeof value.profileId !== 'string' ||
    value.profileId.length === 0 ||
    !Array.isArray(value.requiredAxes) ||
    !isAssumptionRequirement(value.assumptionRequirement)
  ) {
    return false;
  }
  const seen = new Set<string>();
  for (const axis of value.requiredAxes) {
    if (typeof axis !== 'string' || !AXES.includes(axis as EvidenceRequirementAxisV1)) {
      return false;
    }
    if (seen.has(axis)) return false;
    seen.add(axis);
  }
  // Object.keys enumerates the three string fields only; the brand is a
  // symbol key, so a look-alike with an extra own string field fails here.
  return Object.keys(value).length === 3;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

/**
 * Mint an authority-owned profile. Intentionally not exported: profiles are a
 * closed, policy-reviewed registry. Adding one is a deliberate policy change
 * in this module, not a caller-side parameter.
 */
function createEvidenceRequirementProfileV1(
  profileId: string,
  requiredAxes: readonly EvidenceRequirementAxisV1[],
  assumptionRequirement: EvidenceAssumptionRequirementV1
): EvidenceRequirementProfileV1 {
  const candidate = freeze({
    profileId,
    requiredAxes: freeze([...requiredAxes]),
    assumptionRequirement: freeze({ ...assumptionRequirement }),
    [EVIDENCE_REQUIREMENT_PROFILE_BRAND]: true,
  }) as EvidenceRequirementProfileV1;
  if (!isEvidenceRequirementProfileV1(candidate)) {
    throw new Error('[EvidenceRequirementProfile] invalid requirement profile construction');
  }
  return candidate;
}

/**
 * Requirements for operations justified purely by a descriptive summary of
 * observed values. They refuse claims with violated assumptions but may use
 * claims whose inferential assumptions are not testable from the data, since
 * a descriptive use does not rest on them. No advanced epistemic axis is
 * required because none is estimated by the descriptive statistics family.
 */
export const DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1: EvidenceRequirementProfileV1 =
  createEvidenceRequirementProfileV1('descriptive-summary/v1', [], {
    refuseViolated: true,
    refuseUnresolved: false,
  });

/**
 * Requirements for an operation that would make a population-level
 * inferential claim. Such a claim needs established measurement semantics
 * and measured uncertainty, and refuses receipts carrying violated or
 * unresolved assumptions. No receipt currently issued by the statistics
 * family satisfies this profile; an inferential operation must therefore
 * receive a typed refusal rather than a guessed analytical fact.
 */
export const INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1: EvidenceRequirementProfileV1 =
  createEvidenceRequirementProfileV1(
    'inferential-claim/v1',
    ['measurementContextEstablished', 'uncertainty'],
    {
      refuseViolated: true,
      refuseUnresolved: true,
    }
  );

/**
 * Typed resolution outcome of a receipt requirement check (RFC 0007
 * section 3). Everything except `RESOLVED` is a governed refusal: the
 * consuming operation must refuse or abstain rather than substitute a
 * different claim or a favourable default.
 *
 * The live resolver minted from the current Rust dataset handle produces
 * `RESOLVED`, `RECEIPT_NOT_FOUND`, `MISSING_REQUIRED_AXIS`,
 * `VIOLATED_ASSUMPTION` and `UNRESOLVED_ASSUMPTION`; a stale or replaced
 * dataset handle revokes the capability by throwing, as pinned by ADR-0007.
 * `DATASET_MISMATCH` and `KERNEL_MISMATCH` complete the RFC 0007 refusal
 * vocabulary and are reserved for the governed replay resolver, which must
 * compare persisted bundle identity against replay context; defining them
 * here keeps the replay slice on one refusal contract instead of a parallel
 * one.
 */
export type EvidenceReceiptResolutionV1 =
  | { readonly status: 'RESOLVED'; readonly receipt: EvidenceReceiptV1 }
  | { readonly status: 'RECEIPT_NOT_FOUND'; readonly receiptId: string }
  | {
      readonly status: 'MISSING_REQUIRED_AXIS';
      readonly receiptId: string;
      readonly axis: EvidenceRequirementAxisV1;
    }
  | {
      readonly status: 'VIOLATED_ASSUMPTION';
      readonly receiptId: string;
      readonly assumption: string;
    }
  | {
      readonly status: 'UNRESOLVED_ASSUMPTION';
      readonly receiptId: string;
      readonly assumption: string;
    }
  | {
      readonly status: 'DATASET_MISMATCH';
      readonly receiptId: string;
      readonly expectedDatasetFingerprint: string;
      readonly observedDatasetFingerprint: string;
    }
  | {
      readonly status: 'KERNEL_MISMATCH';
      readonly receiptId: string;
      readonly expectedKernelVersion: string;
      readonly observedKernelVersion: string;
    };

function axisSatisfied(axis: EvidenceRequirementAxisV1, receipt: EvidenceReceiptV1): boolean {
  switch (axis) {
    case 'measurementContextEstablished':
      return receipt.measurementContext.status === 'ESTABLISHED';
    case 'geometry':
      return receipt.geometry !== null;
    case 'uncertainty':
      return receipt.uncertainty !== null;
    case 'stability':
      return receipt.stability !== null;
    case 'sensitivity':
      // An empty sensitivity array means no sensitivity analysis was
      // performed; it is not a sensitivity result.
      return receipt.sensitivity.length > 0;
  }
}

/**
 * Evaluate one receipt against one authority-owned requirement profile.
 *
 * The check order is fixed so refusals are deterministic: receipt existence,
 * then violated assumptions, then unresolved assumptions, then required axes
 * in the profile's declared order. Claim-intrinsic assumption failures are
 * reported before operation-contextual axis requirements.
 *
 * This function evaluates policy only. It performs no recomputation, never
 * upgrades an absent axis, and never classifies a measured value as
 * acceptable: that is the separate scientific-admission authority.
 */
export function evaluateEvidenceReceiptAgainstProfileV1(
  profile: EvidenceRequirementProfileV1,
  receiptId: string,
  receipt: EvidenceReceiptV1 | null
): EvidenceReceiptResolutionV1 {
  if (!isEvidenceRequirementProfileV1(profile)) {
    throw new Error(
      '[EvidenceRequirementProfile] requirement profile is not authority-owned; ' +
        'caller-supplied profiles cannot weaken evidence requirements'
    );
  }
  if (receipt === null) {
    return freeze({ status: 'RECEIPT_NOT_FOUND', receiptId });
  }
  if (profile.assumptionRequirement.refuseViolated) {
    const violated = receipt.assumptions.find((item) => item.status === 'violated');
    if (violated) {
      return freeze({ status: 'VIOLATED_ASSUMPTION', receiptId, assumption: violated.assumption });
    }
  }
  if (profile.assumptionRequirement.refuseUnresolved) {
    const unresolved = receipt.assumptions.find(
      (item) => item.status === 'unchecked' || item.status === 'notTestableFromData'
    );
    if (unresolved) {
      return freeze({
        status: 'UNRESOLVED_ASSUMPTION',
        receiptId,
        assumption: unresolved.assumption,
      });
    }
  }
  for (const axis of profile.requiredAxes) {
    if (!axisSatisfied(axis, receipt)) {
      return freeze({ status: 'MISSING_REQUIRED_AXIS', receiptId, axis });
    }
  }
  return freeze({ status: 'RESOLVED', receipt });
}
