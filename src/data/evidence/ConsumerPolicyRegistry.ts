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
 * It ships EMPTY, and that is a statement rather than a placeholder. A conforming
 * use can only be authored by a producer that knows which consumer consumes which
 * receipt under which profile, and this build has no such producer: governed
 * export refuses to write any non-empty `uses` (`NemosyneSession.ts:311-317`), and
 * no Rust-issued consumer identity exists anywhere in the kernel. Governing a
 * consumer here *before* such a producer exists would not add capability — it
 * would remove it. `bindConsumerUsesV1` reports `MISSING_USE` for every governed
 * consumer an envelope fails to name, so the first entry would refuse every
 * package this build itself exports, whose only mintable envelope shape is an
 * empty `uses` array.
 *
 * So entries arrive only with the slice that also gives a producer the ability to
 * mint conforming uses, and that slice owes the production-path falsifier proving
 * binding is reachable. Until then the loader enforces *policy* on every run while
 * governing nothing: a `uses`-carrying archive is refused because the policy does
 * not govern its consumer, not because this build cannot read uses. That
 * distinction is the whole point of routing the decision through this module
 * rather than keeping the answer hard-coded in the loader.
 */

/**
 * The consumers this build's authority governs, and the profile each requires.
 *
 * Module-private by design. It is deliberately never exported and never handed
 * out: an exported `Map` would let any caller add an entry and so authorize an
 * archive's invented consumer.
 */
const governedConsumersById = new Map<string, string>();

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
