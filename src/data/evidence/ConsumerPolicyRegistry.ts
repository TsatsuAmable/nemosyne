/**
 * RFC 0009 tranche 3 — authority-owned consumer policy registry.
 *
 * `bindConsumerUsesV1` binds a persisted `uses` record only when the identity the
 * archive recorded agrees with the identity the *authority* requires. This module
 * is that authority's answer: it maps each consumer this build governs to the
 * exact requirement profile its owning policy demands. The map is owned here and
 * nowhere else, so neither a call site nor the archive can supply a policy of its
 * own — an archive able to select its own governing contract is exactly what
 * RFC 0009 forbids, and what the loader's refusal has always been protecting.
 *
 * RFC 0009 tranche 3 slice 2 (owner decision 2026-10-02) lands the first entry:
 * the governed descriptive-statistics consumer — whose identity is minted by the
 * Rust kernel (`wasm/src/data/governed_consumer.rs`, mirrored in TS as
 * `DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1`) — is governed under
 * `descriptive-summary/v1`. The entry could only land together with the producer
 * that mints conforming uses: `bindConsumerUsesV1` reports `MISSING_USE` for every
 * governed consumer an envelope fails to name, so until the kernel attested the
 * consumer and the composition minted its uses, this entry would have refused
 * every package this build itself exports. Slice 2 is that slice, and the
 * production-path falsifier (`tec1-governed-use-minting.test.ts`) proves binding
 * is reachable end to end.
 */

import { DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1 } from './GovernedConsumerAttestation.ts';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from './EvidenceRequirementProfile.ts';

/**
 * The consumers this build's authority governs, and the profile each requires.
 *
 * Module-private by design. It is deliberately never exported and never handed
 * out: an exported `Map` would let any caller add an entry and so authorize an
 * archive's invented consumer.
 */
const governedConsumersById = new Map<string, string>([
  [
    DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
    DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
  ],
]);

/**
 * The authority-owned consumer policy for this build.
 *
 * Consumers absent from the returned map are not governed: a use naming one is
 * refused as a build/policy limit rather than treated as a corrupt archive.
 *
 * Returns a *snapshot* rather than the live map. `Object.freeze` does not make a
 * `Map` immutable — its entries live in internal slots, so a frozen map still
 * accepts `set`, and a `ReadonlyMap` annotation is a compile-time guarantee only.
 * Handing out a copy means a caller cannot reach the authority's map at all, so
 * "no module outside this one can add an entry" is a real runtime property
 * rather than a typing convention, and it is falsified as one.
 */
export function governedConsumerPolicyV1(): ReadonlyMap<string, string> {
  return new Map(governedConsumersById);
}
