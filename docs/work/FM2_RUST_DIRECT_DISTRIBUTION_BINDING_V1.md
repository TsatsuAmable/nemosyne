# FM2: Rust-issued direct empirical-distribution binding (v1)

**Status:** Distribution-only kernel producer and policy identity, implementation bounded. Normal browser direct-loop activation, replay binding, multi-family source admission and human/Quest qualification remain OPEN.

## Why this exists

The current RFC0009 governed V3 consumer covers **descriptive statistics** and attests every statistics receipt. Matching dataset/kernel identities cannot license a visualization of a separate semantic analytical method. Adding a mandatory direct consumer to that existing V3 policy would also break legacy exported packages whose kernel issued only descriptive uses. This tranche does **not** mutate that registry, the statistics receipt bundle or historical replay resolution.

## Bound contract

A new, independent Rust prepared-result operation `moneta_prepare_direct_distribution_binding_v1(handle, request)` computes the **existing** empirical distribution semantic producer against the supplied live Rust dataset handle. When it returns `READY`, the same Rust invocation serializes that exact envelope, hashes those producer bytes using SHA-256, and emits:

- Kernel-owned `nemosyne:consumer/direct-distribution/v1`, separately minted policy identity `direct-empirical-distribution/v1`, fixed claim kind `DESCRIPTIVE_EMPIRICAL_DISTRIBUTION`.
- The exact source bytes (`sourceJson`), their `sourceDigest`, and a uniquely source-bound `receiptId`.
- Original live dataset fingerprint and canonical Rust kernel contract version, checked against the source envelope and the live handle on return.

The TS closed requirement-profile registry mints an explicit descriptive, violated-assumption-refusing direct distribution profile. The dedicated bridge checks each kernel-issued fixed field, hashes the raw `sourceJson` string without float-reserialization drift, verifies exact live identity and still refuses unsupported/missing/invalid results. No caller-supplied semantic envelope is admitted for binding. Digest is **integrity protection**, not an origin-authenticating digital signature or evidence of statistical generalization.

## Falsifiers

Real Rust/WASM test: deterministic same-request binding; changed histogram request alters both source digest and receipt identity; exact source and profile identity; cross-consumer substitution and content substitution refuse; mismatched live dataset refuses; an invalid handle or Rust-refused source mints no binding; Atlas direct compilation and branch history remain empty.

Existing TEC1 governed export/replay tests must continue passing, proving the V3 descriptive-only consumers are unchanged. Build + real-WASM and exact-head hosted CI required.

## Remaining integration and design gates

1. Route this **separately versioned** source-and-consumer artifact through the owned analytical Worker port with request generation/dataset fencing, not an importable module-global bridge used as authority.
2. Define the authoritative policy for using this new claim and its source digest in a **governed persisted direct-use/replay carrier**, with negative tests for forged source, old replay, source divergence, omitted use and invalidated dataset.
3. Only then wire a typed kernel-issued evidence reference into `SemanticSnapshotV1` and prove actual normal-shell Chromium critique → alternative → compare → branch → replay. No inference, fabricated sample/uncertainty axes, TS-authored receipt, synthetic promotion or new panel.

The producer is a narrow capability **not yet a general, replay-governed FM2 direct consumer admission**. Broader policy adoption and human/device sign-off require separate evidence.
