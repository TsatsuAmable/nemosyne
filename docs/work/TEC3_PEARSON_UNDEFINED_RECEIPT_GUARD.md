# TEC3 Pearson undefined-statistic evidence guard

**Scope:** one Rust-owned, fail-closed correction on the existing Pearson receipt; no `Facts` numerical/wire or V1 envelope format change. **Base:** `main@621275d9`. **Status:** MERGED via PR #1053 on 23 October 2026 (head `fc1786d9`, merge `d1ffed65`); wider TEC/FM0 remains open.

## High-risk pre-implementation contract

- **Invariant:** The canonical Rust Pearson calculator distinguishes a mathematically defined coefficient of exactly 0 from its compatibility fallback `0.0` for fewer than two pairwise valid observations or a denominator at/below the currently implemented `1e-12` threshold. Neither a descriptive nor inferential governed consumer may resolve an undefined Pearson receipt.
- **Authority/production path:** `statistics_columnar::pearson_pairwise` is the *single* numerical source. Expose a Rust-only diagnostic from the same algorithm; `statistics_evidence::compute_statistics_evidence` attaches an existing V1 `violated` assumption plus explicit limitation when the numerical output is the undefined sentinel. The sealed `descriptive-summary/v1` profile already refuses violated assumptions; TS only transports and resolves the Rust-issued claim.
- **Attack cases:** (1) constant x, varying y with multiple complete rows, (2) fewer than two pairwise-complete observations despite nonconstant full columns, (3) both columns sparse/absent, (4) legitimate orthogonal zero-correlation pattern. For each, compare Rust `Facts` numerical compatibility value, Rust-issued receipt support/assumptions and live WASM typed consumer decision. Positive nonzero pair validates no broad refusal. A stale receipt cannot mutate an old archive into a new claim.
- **Failure modes:** independently recomputing a threshold or Pearson algorithm in TS; declaring a null correlation when only a small n makes inference uncertain; silently changing `Facts.correlation.value` or historical digest semantics; treating a zero sentinel as established scientific evidence; reordering existing receipt assumptions on well-defined pairs; using a mock kernel rather than real WASM.
- **Falsifiers:** Rust unit parity tests for numerical value and diagnostic status; production real-WASM tests for constant/under-supported/legitimate-zero/nonzero pairs, bundle identity, `VIOLATED_ASSUMPTION` refusal for undefined and `RESOLVED` descriptive legitimate zero. Gate must fail on removal of Rust-emitted status.
- **Non-goals/dependencies:** no new significance test, no p-values, no confidence intervals, no universal variance cutoff beyond the already-used algorithm threshold, no historical mutation or V1 schema extension. Keep existing archives byte-preserved. This is a correction implementing accepted RFC 0007 / ADR 0007 explicit-assumption refusal, not an expansion of scientific authority. If review finds an actual new statistical policy needed, stop for separate owner RFC.

## Governed export availability tradeoff

The kernel's descriptive consumer attests **all** receipt IDs. `composeGovernedEvidenceReceiptSnapshot` refuses to mint a V3 use when any receipt fails the profile. A constant/sparse Pearson pair therefore makes **governed V3 export unavailable** for that dataset; it must not silently downgrade to V2. A caller may explicitly export the ordinary V2 package, which carries no governed evidence. Changing the kernel-minted coverage or suppressing invalid receipts requires a separate owner decision. The production-WASM test pins this refusal and explicit legacy availability.

## Exit

Exact-head host Rust + actual WASM Vitest + coverage + production smoke + CodeQL + approval gate; adversarial review and honest limitations. No Quest or human research claims.

## Next bounded follow-up: capture refusal diagnostics (23 October 2026)

**Status:** LANDED via PR #1054 (merge `4ec62b06`, 23 October 2026). No new authority decision, selective-receipt export, or rendered-UI qualification.

**Pre-implementation high-risk falsification contract.** The live Rust consumer still attests *all* receipts, so an undefined Pearson receipt must continue to block governed V3 export. Current Atlas composition knows the exact governed receipt/profile/refusal but `NemosyneSession._requireGovernedEvidenceBytes` catches all live acquisition exceptions and reports only “none is available” when no restored carrier exists.

- **Invariant:** the user/export caller receives a named, typed `GOVERNED_EVIDENCE_USE_REFUSED` with Rust-derived `receiptId`, authority-owned `profileId`, kernel-minted `consumerId`, and exact closed `EvidenceReceiptResolutionV1` status on a policy-rejected *live* capture when there is no restored carrier.
- **Path:** `composeGovernedEvidenceReceiptSnapshot` rejects at the existing `evaluateEvidenceReceiptAgainstProfileV1` check; only `NemosyneSession._requireGovernedEvidenceBytes` may re-expose this particular known type when *no* carrier is available. Re-use existing policy and resolver; do not change rule order or Rust/TS scientific outputs.
- **Falsifiers:** actual Rust/WASM constant-Pearson V3 export rejects with the typed receipt/profile/status, cannot serialize/adopt a carrier, and still permits explicit ordinary V2; a genuine defined zero V3 export still succeeds; unknown transport/capture errors retain the existing generic no-carrier refusal; a valid restored carrier remains subject to the existing exact binding, identity and policy checks rather than being blocked or downgraded by a live capture exception.
- **Risks:** leaking arbitrary transport exception detail, accidentally interpreting a captured failure as a valid receipt, bypassing replay/binding, or prohibiting RFC0009's allowed restored-carrier fallback.
- **STOP/non-goals:** do not change attested all-receipts coverage, do not omit invalid receipts or produce a weaker V3, do not claim a user-facing rendered UI or human qualification. Changing the governed-consumer scope requires a separate owner decision. Complete exact-head CI and independent code-path review before promotion.

### Bounded completion record (23 October 2026)

PR [#1054](https://github.com/TsatsuAmable/nemosyne/pull/1054) merged at `4ec62b06bf37532f18999eb554ef788e10934421`, head `c40393e401b04c454b9e9fa2df2f0dda643a3e5b`. Exact-head CI, Rust/WASM, all Vitest shards and aggregate coverage, production build, browser smoke, CodeQL and approval gate passed. Only the closed `GovernedEvidenceCapturePolicyRefusal` is surfaced to a governed-export caller when no restored carrier is usable. The policy and all-receipts attestation remain unchanged. Unknown transport errors remain concealed; restored-carrier binding and identity checks remain mandatory. This is **not** TEC/FM0 completion, selective-receipt export authorization or a claim about investigator-facing UI.
