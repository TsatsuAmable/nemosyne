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
 * Identity registry of profiles minted by this module. Membership is checked
 * by object identity, which cannot be forged: object spread copies symbol
 * keys, `Object.getOwnPropertySymbols` exposes the brand, and prototype
 * inheritance passes property reads, but none of those produce an object
 * that is a member of this set. Only a reference to a genuinely minted
 * profile can satisfy the check, and holding such a reference is exactly
 * the governed case.
 */
const mintedProfiles = new WeakSet<object>();

/**
 * Minted profiles keyed by their stable `profileId`. This is the lookup the
 * governed replay resolver uses to bind a persisted requirement-profile
 * identity to the profile this build still mints; an identity absent from
 * this registry is unresolvable historical governance and must fail closed.
 */
const mintedProfilesById = new Map<string, EvidenceRequirementProfileV1>();

/**
 * Authority-owned requirement profile. The nominal brand keeps TypeScript
 * callers on the closed registry; the runtime guarantee is the module-private
 * identity registry above. A candidate, UI caller or learned model cannot
 * weaken an operation's requirements by requesting fewer axes: it can only
 * reference one of the frozen profiles minted here, and the live resolver
 * rejects anything else at runtime.
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
 * Runtime guard for authority ownership. The primary check is identity
 * membership in the module-private mint registry, which object spread,
 * symbol theft and prototype inheritance cannot satisfy; structural
 * re-validation is retained as a secondary check against corruption of a
 * minted object. TypeScript's nominal brand already rejects look-alikes at
 * compile time; this guard also fails closed when untyped input reaches the
 * live resolver (for example through `any` at a boundary).
 */
export function isEvidenceRequirementProfileV1(
  value: unknown
): value is EvidenceRequirementProfileV1 {
  if (!isRecord(value) || !mintedProfiles.has(value)) {
    return false;
  }
  if (
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
  // The identity-mint guard requires WeakSet membership, so register there
  // first, but keep the by-id registry insert strictly after validation: a
  // candidate that fails construction must never become resolvable by
  // identity (or poison a later retry under the same identity).
  mintedProfiles.add(candidate);
  if (!isEvidenceRequirementProfileV1(candidate)) {
    throw new Error('[EvidenceRequirementProfile] invalid requirement profile construction');
  }
  if (mintedProfilesById.has(profileId)) {
    throw new Error(
      `[EvidenceRequirementProfile] duplicate requirement profile identity '${profileId}'`,
    );
  }
  mintedProfilesById.set(profileId, candidate);
  return candidate;
}

/**
 * Resolve a requirement-profile identity against the closed authority
 * registry. Returns the minted profile carrying exactly this identity, or
 * `null` when no such profile is minted by this build — for example a
 * retired, tampered or misspelled historical identity.
 *
 * Replay governance must fail closed on `null`: substituting a current
 * default profile would silently re-judge historical evidence under today's
 * policy, which is exactly the drift RFC 0007's replay contract forbids.
 * This lookup cannot forge governance — it can only return objects already
 * minted inside this module.
 */
export function evidenceRequirementProfileByIdV1(
  profileId: string,
): EvidenceRequirementProfileV1 | null {
  if (typeof profileId !== 'string' || profileId.length === 0) return null;
  return mintedProfilesById.get(profileId) ?? null;
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
 * The governed replay resolver completes the RFC 0007 refusal vocabulary:
 * it compares the persisted bundle identity against the replay context
 * (`DATASET_MISMATCH`, `KERNEL_MISMATCH`) and binds resolution to an
 * explicit requirement-profile identity resolved against the closed
 * registry (`UNKNOWN_REQUIREMENT_PROFILE` when that identity is not minted
 * by this build, so historical governance can never silently fall back to a
 * current default profile). Defining the full vocabulary here keeps the
 * replay slice on one refusal contract instead of a parallel one.
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
    }
  | {
      readonly status: 'UNKNOWN_REQUIREMENT_PROFILE';
      readonly receiptId: string;
      readonly profileId: string;
    };

function axisSatisfied(axis: EvidenceRequirementAxisV1, receipt: EvidenceReceiptV1): boolean {
  switch (axis) {
    case 'measurementContextEstablished':
      // Established measurement semantics satisfy this axis unless the
      // governing Rust-issued analytical admission result explicitly rejects
      // the analytical use: a rejection is negative evidence and must never
      // be flattened into a satisfied requirement. An absent admission result
      // is not a rejection; profiles that need the admission result itself
      // remain a separate, deliberate policy addition.
      if (receipt.measurementContext.status !== 'ESTABLISHED') return false;
      return (
        receipt.measurementContext.analyticalAdmission === null ||
        receipt.measurementContext.analyticalAdmission.status === 'admitted'
      );
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
