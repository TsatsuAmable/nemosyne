# P1-Q Q2 Cross-Language Dataset Identity Golden — 2026-08-28

## Status

**IMPLEMENTATION LANDED / REVIEW ACTIVE.**

This tranche closes the deterministic cross-language evidence gap left after the Q2 fast-check adoption and targeted-only Rust proptest pilot. It adds one shared, dependency-free identity contract fixture and makes both the TypeScript authority adapter and the production Rust/WASM boundary prove the same pinned SHA-256.

## Why a golden contract

Q2 established three complementary testing roles:

- deterministic boundary regressions for known threshold/path defects;
- `fast-check` for inexpensive generated TypeScript identity invariants;
- targeted-only `proptest` for deep Rust falsification where shrinking justifies its large cold compile tax.

What remained was a durable byte-level contract that would fail if TypeScript and Rust drifted in different directions while each still passed its own local tests.

The golden fixture provides that contract without adding another implementation or dependency.

## Shared fixture

`tests/fixtures/q2-dataset-identity-golden.json` contains:

- algorithm id `sha256-canonical-dataset-v1`;
- the JS-compatible dataset payload consumed at the real Rust boundary;
- the exact canonical JSON preimage expected from the v1 projection;
- expected SHA-256 `086ee326ccea7d4921c5287c2285957f0ced5b34fd1c8a3be98cb6be387bf0d9`.

The source payload deliberately includes:

- declared columns authored in schema order;
- a missing declared row value paired with an explicit null in another row;
- undeclared row presentation values;
- durable `rowIds` and root presentation metadata that must not enter scientific identity;
- BMP private-use and supplementary-plane column names to exercise JavaScript UTF-16 key ordering;
- nested edge attributes authored in non-canonical key order;
- a positional numeric edge and a stable string-ID edge in the same dataset.

## TypeScript evidence

`tests/q2-dataset-identity-cross-language-golden.test.ts` runs in the existing fast Node lane. It proves:

1. the fixture is pinned to the current identity algorithm id;
2. `canonicalDatasetIdentityInput` plus `canonicalJsonStringify` emits the exact committed canonical JSON bytes;
3. `canonicalDatasetIdentityHex` emits the committed SHA-256.

This catches semantic-projection, optional-field, recursive-key-order, Unicode-order and scalar-rendering drift on the TypeScript side.

## Rust/WASM evidence

`tests/q2-dataset-identity-cross-language-wasm.test.ts` runs in the existing WASM lane. It loads the same fixture through `RuntimeBridge.loadDatasetJson`, which exercises the production `data_load_dataset_json -> Dataset::from_js_json -> dataset_fingerprint` path, then asserts the Rust fingerprint equals the same committed SHA-256.

This intentionally avoids a test-only Rust parser or a second canonicalization implementation.

## Gate and cost boundary

No dependency, production source, required workflow, or separate job is added. The two tests join the existing fast Node and WASM groups respectively, so Q2 gains stronger parity evidence using already-paid CI infrastructure.

## Promotion evidence required

Before this tranche is complete:

- the TypeScript golden must pass in its ordinary lane;
- the Rust/WASM golden must pass against a freshly built WASM package;
- global coverage thresholds and required `Node 24` must remain green;
- CodeQL and approval-gate must be green on the exact current head;
- review threads must be resolved;
- the branch must be 0 behind current `main`.

Only after those checks should the Q2 master review record be updated from its original active-pilot state to its final classification.
