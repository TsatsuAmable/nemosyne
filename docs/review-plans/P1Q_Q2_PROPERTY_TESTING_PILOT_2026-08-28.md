# P1-Q Q2 Property Testing — Final Pilot Classification

**Date:** 28 August 2026  
**Original baseline:** `main@1843805696a02e87ae81ca8974d2c846f44f5cf3` (#495 merged)  
**Status:** **IMPLEMENTATION COMPLETE / FINAL CROSS-LANGUAGE PROMOTION EVIDENCE ACTIVE**

## Executive result

Q2 produced useful signal, but the right adoption shape is deliberately asymmetric rather than a blanket property-testing gate.

- **Deterministic boundary falsification: ADOPT.** The first Q2 review found a real RF-048 production defect in the >50,000-row asynchronous dataset-identity path before a generator library was needed. The repaired threshold regression remains required evidence.
- **TypeScript `fast-check`: ADOPT, bounded.** Exact `fast-check@4.9.0` is lockfile-backed and runs five deterministic, bounded identity properties through the existing fast Node/coverage lane. No standalone property-testing workflow was added.
- **Rust `proptest`: TARGETED ONLY.** `proptest 1.11.0` demonstrated strong generated-case and shrinking value against the Rust fingerprint authority, but its measured cold compile/dependency tax is too large to normalize in the ordinary merge path. It remains a manual high-authority falsification instrument with no permanent Cargo dependency.
- **Cross-language golden identity: ADOPT as deterministic contract evidence.** One shared fixture pins exact canonical JSON plus SHA-256 and is consumed by both the TypeScript canonical identity path and the production JS→WASM→Rust fingerprint boundary. This adds no dependency or standalone gate.

Q2 therefore improves falsification and parity evidence without turning randomized testing into a merge-time tax everywhere.

## Authority invariant

For every valid `DatasetJSON` under `sha256-canonical-dataset-v1`:

```text
await canonicalDatasetIdentityHexAsync(dataset)
=== canonicalDatasetIdentityHex(dataset)
=== production Rust dataset_fingerprint for the same scientific projection
```

The equality is byte-semantic, not merely shape-equivalent. All paths must commit to the same canonical projection, recursive object-key ordering, optional-field semantics, endpoint JSON types, and row sequence.

## 1. Deterministic falsifier and RF-048 repair

The initial Q2 review found that the asynchronous TypeScript path diverged after crossing the 50,000-row streaming threshold:

1. top-level keys were emitted in non-canonical order;
2. nested columns/edges used ordinary `JSON.stringify` instead of recursive canonical ordering;
3. row separators were wrong at 10,000-row chunk boundaries;
4. explicit `edges: []` could disappear from the async preimage.

The repair retained the existing `sha256-canonical-dataset-v1` algorithm and made the async implementation conform to it. `tests/q2-dataset-identity-parity.test.ts` now crosses the real threshold and retains deterministic coverage for chunk boundaries, nested edge ordering, explicit empty edges, absent edges, and the semantic distinction between those optional-field states.

This remains RF-048 evidence. Q2 does not create a second identity authority.

## 2. TypeScript fast-check classification — ADOPT, bounded

PR #498 merged the bounded TypeScript property-testing adoption.

- exact `fast-check@4.9.0` dev dependency;
- transitive `pure-rand@8.4.2` locked with integrity;
- five identity properties with deterministic seeds and 250 cases each;
- properties run through `FAST_NODE_TESTS`, reusing the existing required coverage/Node 24 path;
- no standalone property-testing gate.

Generated properties cover:

1. undeclared row-field exclusion;
2. row-ID/presentation-metadata exclusion;
3. JSON roundtrip identity;
4. graph endpoint JSON type sensitivity;
5. missing-value/null normalization.

Any future generated counterexample must be shrunk and retained as a deterministic regression. Seeded generation is complementary evidence, not a substitute for explicit boundary vectors.

## 3. Rust proptest classification — TARGETED ONLY

PR #499 merged the manual Rust pilot substrate without changing production Rust or Cargo manifests.

Hosted pilot evidence using transient `proptest 1.11.0` with default features disabled and `std` only:

- transient Cargo resolution: 84 → 99 packages;
- seven fingerprint properties × 256 cases = 1,792 generated cases, all passed;
- native baseline compile: 55.32 s, max RSS 1,535,804 KB;
- additional proptest compile + generated run: 38.43 s, max RSS 1,522,116 KB;
- warm generated run: 0.10 s, max RSS 47,668 KB;
- deliberate falsifier deterministically shrank to `x = 10` with seed `20260828`.

The warm signal is excellent, but the extra cold compile/dependency tax is disproportionate for ordinary merge-time use. Therefore:

- no permanent `proptest` dependency;
- no `Cargo.toml` or `Cargo.lock` change;
- no required proptest gate;
- manual workflow only for dense, high-authority Rust invariants where shrinking materially improves diagnosis.

Existing deterministic Rust vectors remain authoritative for exact ECMAScript number rendering and explicit UTF-16 comparator behavior.

## 4. Cross-language golden identity — final Q2 tranche

PR #500 adds one shared fixture for `sha256-canonical-dataset-v1` with:

- the JS-format dataset payload accepted by the production Rust boundary;
- the exact canonical JSON preimage expected from TypeScript;
- pinned SHA-256 `086ee326ccea7d4921c5287c2285957f0ced5b34fd1c8a3be98cb6be387bf0d9`.

The fixture stresses:

- missing declared value → scientific null;
- undeclared row metadata exclusion;
- `rowIds` and root presentation metadata exclusion;
- supplementary-plane/BMP key ordering through the UTF-16 canonical sort path;
- nested edge-attribute key ordering;
- numeric positional and stable string graph endpoint types.

`tests/q2-dataset-identity-cross-language-golden.test.ts` pins the TypeScript canonical preimage and digest. `tests/q2-dataset-identity-cross-language-wasm.test.ts` loads the same dataset through `RuntimeBridge.loadDatasetJson` and compares the production Rust `dataset_fingerprint` result with the same pinned digest.

The first hosted #500 attempt failed before the WASM golden assertion executed: Vite transformed `new URL(..., import.meta.url)` into a non-`file:` URL and Node `readFileSync` raised `ERR_INVALID_URL_SCHEME`. This was a test-harness fixture-loading defect, not a fingerprint mismatch. Both golden tests now resolve the fixture from `process.cwd()` using `node:path`, avoiding bundler URL rewriting. Evidence from the failed head is not promotion evidence.

## Q2 design boundaries

Q2 does **not** imply:

- randomized tests replacing deterministic regression tests;
- a blanket property-testing gate for every subsystem;
- a permanent Rust proptest dependency;
- a second JS or Rust dataset-identity implementation;
- a change to `sha256-canonical-dataset-v1`;
- a claim that `canonicalSha256HexStreaming` is constant-memory; that remains RF-029/RF-035 scale work.

Property testing is most valuable where the invariant is dense, authority-sensitive, and cheap enough to run. Boundary examples and golden vectors remain the durable contract surface.

## Promotion boundary

Q2 may be treated as complete only when the final #500 head has all of the following on the same current head association:

1. ordinary CI success including both new golden tests, coverage aggregate, browser smoke, Rust kernel, and required Node 24;
2. CodeQL success;
3. approval-gate success;
4. no unresolved review threads;
5. branch 0 behind current `main` and mergeable;
6. no head movement after evidence is collected.

Until those conditions close, status remains **IMPLEMENTATION COMPLETE / FINAL CROSS-LANGUAGE PROMOTION EVIDENCE ACTIVE**, not VERIFIED COMPLETE.
