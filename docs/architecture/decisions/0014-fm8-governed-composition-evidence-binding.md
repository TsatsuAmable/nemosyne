# ADR 0014: FM8 governed composition evidence binding

**Status:** Accepted by project owner, 24 October 2026.
**Scope:** FullMonetaEngine multi-snapshot composition only.
**Authority:** [RFC 0013](../../rfcs/0013-fm8-composition-evidence-binding.md) refined Option C, including its 22 October review addendum.

## Decision

- **Omitted `snapshots`:** retain the production caller's primary-snapshot coverage assertion; each element records `PRIMARY_ASSERTED`. No new evidence-family claim is implied.
- **Explicit `snapshots`:** require a nonempty list, coherent primary analytical-dataset fingerprint and kernel version, and one unambiguous *available* source for every primitive under a reviewed closed kind-to-family mapping. Initially allow only `DENSITY`, `DISTRIBUTION`, `CLUSTER`, and `GRAPH` with same-named source families. Unknown or unsupported mappings refuse until separately reviewed.
- No positional or primary fallback; secondary broker rejection refuses the whole composition.
- Register the actual selected snapshot/slice identity and primitive's evidence basis on the element. Version the bound composition from `composed-forma-v1` to `composed-forma-v2`; historical/unbound direct-runtime artifacts retain v1.
- Ensure list-order invariance, dataset/kernel coherence and fail-closed broker behavior with regression tests. Preserve selected graph relationships and primary admission obligations; default automatically derived per-snapshot node obligations are scoped to that snapshot, while caller-explicit obligations cannot be weakened.

## Rejected

Silent substitution, accidental vocabulary string equality, and blind list-position matching; all can render plausible geometry attached to unrelated evidence. A general per-primitive binding API is deferred, not silently introduced.

## Qualification boundaries

Implementation correctness is not FM8 scientific, user, device or production-scale completion. Revalidate SHADOW-0017 independently. Changing the closed mapping requires a new architectural review.
