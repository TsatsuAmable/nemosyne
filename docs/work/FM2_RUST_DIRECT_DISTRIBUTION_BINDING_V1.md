# FM2: Rust-issued direct empirical-distribution binding (v1)

**Status:** Distribution-only kernel producer and policy identity, plus the governed persisted direct-use/replay carrier implementation and its V1 fail-closed repair are present on this unmerged branch; roadmap promotion remains OPEN pending supervisor review and merge. Normal browser direct-loop activation, SemanticSnapshot admission, multi-family source admission and human/Quest qualification remain OPEN.

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

The replay regression must capture a carrier after a durable Rust filter, prove its fingerprint differs from the portable seed, replay the command log before fresh Rust verification, and finish `VERIFIED` in a clean replay. An altered transformation log must refuse the direct claim rather than admit `VERIFIED`; the inline and separate Worker-thread paths must retain their existing stale-worker and forged-source refusals. Existing TEC1 governed export/replay tests must continue passing, proving the V3 descriptive-only consumers are unchanged. Build + real-WASM and exact-head hosted CI required.

## Remaining integration and design gates

1. **FM2-WORKER IMPLEMENTED:** The independent source-and-consumer artifact travels through the existing analytical execution operation `directDistributionBinding` on inline and Worker ports. Only a resident Rust handle can mint it. The request is fenced by generation/version/fingerprint, the transport strips caller handles and compatibility payloads, and the response is revalidated from exact kernel source bytes; stale results and worker recycle refuse. Positive real-WASM Worker handler, separate Node Worker-thread runtime, failure and lifecycle tests are required for qualification.
2. **FM2-REPLAY IMPLEMENTATION PRESENT ON THIS BRANCH / NOT YET MERGED; ROADMAP OPEN:** `DirectDistributionReplayCarrierV1` records the Rust binding, exact request, source digest/receipt identity and closed direct use; package export/restore persists it as an additive `investigation/direct-distribution.json` entry with a manifest digest. Real replay re-runs the Rust direct producer only after the durable analytical command log has been replayed and verified against the reconstructed state, and refuses altered, missing, stale, mismatched, wrong-consumer, invalidated, rehashed-forged, and legacy-V1 direct-carrier claims. The real-WASM regression covers a carrier captured after a durable filter whose transformed fingerprint differs from the portable seed, plus an altered transformation log that must not become `VERIFIED`; existing inline, separate Worker-thread, stale-worker, V1/V2 replay and RFC 0009 V3/V4 statistics policy coverage remain unchanged. Physical/desktop browser qualification remains OPEN.
3. Only then wire a typed kernel-issued evidence reference into `SemanticSnapshotV1` and prove actual normal-shell Chromium critique → alternative → compare → branch → replay. No inference, fabricated sample/uncertainty axes, TS-authored receipt, synthetic promotion or new panel.

The producer is a narrow capability **not yet a general, replay-governed FM2 direct consumer admission**. Broader policy adoption and human/device sign-off require separate evidence.
