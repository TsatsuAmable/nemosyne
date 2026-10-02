/**
 * RFC 0009 tranche 3 — authority-owned consumer-policy binding.
 *
 * A persisted `uses` record authorizes a semantic consumer only when three
 * identities agree: the `receiptId` names a receipt in the same envelope's
 * Rust-issued bundle, the recorded `requirementProfileId` equals the
 * consumer's authority-owned required profile, and that profile resolves in
 * this build's closed requirement-profile registry. Anything else is a
 * governed refusal, never a weaker-profile substitution or an inferred alias:
 * consumer and receipt identities are matched only against Rust-issued bundle
 * IDs and the authority-owned policy map, so a `consumerId` invented at a
 * call site or a `receiptId` derived from a column name cannot bind.
 *
 * This module is data-only, like `PersistedEvidenceReceipts` parsing: binding
 * never mints a replay capability and never consults a live kernel. Since the
 * authority-owned policy gained its first governed consumer (RFC 0009 tranche 3
 * slice 2), binding is *reachable*: the governed loader passes the live
 * `ConsumerPolicyRegistry.ts` map as `requiredConsumers`, so a persisted use
 * conforms exactly when the governed producer minted it, and every refuser here
 * is also enforced on the replay path. Its refusals are classified by the loader
 * (`UNKNOWN_CONSUMER`/`MISSING_USE` → `CONSUMER_NOT_GOVERNED`,
 * `PROFILE_MISMATCH`/`UNKNOWN_REQUIREMENT_PROFILE` → `CONSUMER_POLICY_REFUSED`,
 * and a bound-but-unresolved resolution → `CONSUMER_POLICY_REFUSED`), so this
 * module still claims no enforcement wording of its own.
 */
import {
  evaluateEvidenceReceiptAgainstProfileV1,
  evidenceRequirementProfileByIdV1,
  type EvidenceReceiptResolutionV1,
} from './EvidenceRequirementProfile.ts';
import type { EvidenceReceiptBundleV1 } from './EvidenceReceipt.ts';
import type {
  PersistedEvidenceReceiptsV1,
  PersistedEvidenceUseV1,
} from './PersistedEvidenceReceipts.ts';

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

/**
 * A use whose identities agree with the authority-owned policy, with the
 * receipt evaluated under the exact recorded profile. `resolution` carries
 * the governed receipt outcome, so a bound use can still refuse admissibility
 * (`RECEIPT_NOT_FOUND`, `MISSING_REQUIRED_AXIS`, violated/unresolved
 * assumptions, dataset/kernel mismatch is loader-owned): binding is identity
 * agreement, not scientific promotion.
 */
export interface ConsumerUseBindingV1 {
  readonly status: 'BOUND';
  readonly consumerId: string;
  readonly use: PersistedEvidenceUseV1;
  readonly resolution: EvidenceReceiptResolutionV1;
}

/** A use or consumer that must refuse before any capability is exposed. */
export type ConsumerBindingRefusalV1 =
  | { readonly status: 'MISSING_USE'; readonly consumerId: string }
  | { readonly status: 'UNKNOWN_CONSUMER'; readonly consumerId: string }
  | {
      readonly status: 'PROFILE_MISMATCH';
      readonly consumerId: string;
      readonly requiredProfileId: string;
      readonly recordedProfileId: string;
    }
  | {
      readonly status: 'UNKNOWN_REQUIREMENT_PROFILE';
      readonly consumerId: string;
      readonly profileId: string;
    };

export type ConsumerBindingV1 = ConsumerUseBindingV1 | ConsumerBindingRefusalV1;

/**
 * Bind every recorded use against the authority-owned consumer policy and the
 * envelope's Rust-issued bundle.
 *
 * `requiredConsumers` maps each governed `consumerId` to the exact
 * `requirementProfileId` its owning policy demands. The map is supplied by
 * the calling policy authority — the governed loader passes the one
 * `ConsumerPolicyRegistry.ts` owns — and this function never invents policy
 * entries, weakens a requirement, or substitutes a current default for a
 * recorded historical identity.
 *
 * Check order is fixed so refusals are deterministic: unknown consumer, then
 * profile disagreement with the owning policy, then unresolvable recorded
 * profile, then receipt lookup and evaluation. Uses are processed in envelope
 * order; required consumers with no use records at all are reported in policy
 * order after all uses. A consumer whose uses all refuse is refused once per
 * use, not additionally reported missing.
 */
export function bindConsumerUsesV1(args: {
  readonly envelope: PersistedEvidenceReceiptsV1;
  readonly requiredConsumers: ReadonlyMap<string, string>;
}): readonly ConsumerBindingV1[] {
  const { envelope, requiredConsumers } = args;
  const bundle: EvidenceReceiptBundleV1 = envelope.bundle;
  const receiptsById = new Map(bundle.receipts.map((receipt) => [receipt.receiptId, receipt]));
  const seenConsumers = new Set<string>();
  const bindings: ConsumerBindingV1[] = [];

  for (const use of envelope.uses) {
    seenConsumers.add(use.consumerId);
    const requiredProfileId = requiredConsumers.get(use.consumerId);
    if (requiredProfileId === undefined) {
      bindings.push(freeze({ status: 'UNKNOWN_CONSUMER', consumerId: use.consumerId }));
      continue;
    }
    if (use.requirementProfileId !== requiredProfileId) {
      bindings.push(
        freeze({
          status: 'PROFILE_MISMATCH',
          consumerId: use.consumerId,
          requiredProfileId,
          recordedProfileId: use.requirementProfileId,
        }),
      );
      continue;
    }
    const profile = evidenceRequirementProfileByIdV1(use.requirementProfileId);
    if (profile === null) {
      bindings.push(
        freeze({
          status: 'UNKNOWN_REQUIREMENT_PROFILE',
          consumerId: use.consumerId,
          profileId: use.requirementProfileId,
        }),
      );
      continue;
    }
    const resolution = evaluateEvidenceReceiptAgainstProfileV1(
      profile,
      use.receiptId,
      receiptsById.get(use.receiptId) ?? null,
    );
    bindings.push(freeze({ status: 'BOUND', consumerId: use.consumerId, use, resolution }));
  }

  for (const consumerId of requiredConsumers.keys()) {
    if (!seenConsumers.has(consumerId)) {
      bindings.push(freeze({ status: 'MISSING_USE', consumerId }));
    }
  }

  return freeze(bindings);
}
