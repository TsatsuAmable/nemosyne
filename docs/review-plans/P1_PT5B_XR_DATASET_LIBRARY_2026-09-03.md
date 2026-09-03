# P1-PT5B pre-implementation adversarial review — XR dataset library

**Date:** 3 September 2026  
**Base:** `main@8777a218d160f7d55c29fbb267c7d14776362d7e`  
**Risk:** High, because this touches the product ingestion boundary and ordinary XR workflow.

## Product claim

An investigator in XR can browse and open approved `nemosyne-data` datasets without leaving the headset, then review/correct column types using human-facing language.

## Invariants

- XR does not gain a second parser, topology authority, or integrity path.
- Remote selection still terminates at the existing `FileLoader -> Atlas -> Rust` authority.
- Only governed datasets and locally supported materialized tiers are shown as loadable.
- Integrity, byte, row, schema and governance refusals remain fail-closed.
- XR status must surface refusal instead of reporting false success.
- Schema correction remains explicit and destructive reload semantics remain confirmed.
- Internal enum names are not required knowledge for ordinary user actions.

## Likely failure modes

1. XR catalogue code bypasses the PT5A governed loader.
2. Candidate/retired entries become selectable.
3. Headset and desktop catalogue versions drift.
4. An async open failure is swallowed and the UI reports success.
5. Shared loader lifecycle leaves a stale provider after disposal.
6. Row-count/catalogue metadata drift survives Rust parsing.
7. Friendly labels accidentally change the underlying analytical column type values.

## Non-goals

- arbitrary local-file picking APIs inside every headset runtime;
- replacement of the broader hand-wheel/navigation system;
- changing Rust/WASM analytical semantics;
- claiming complete PT5 journey parity beyond dataset browse/open and column review.
