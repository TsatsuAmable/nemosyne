# RF-060 — Cache the authoritative current-dataset fingerprint

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE / POST-FIX CAUSAL EVIDENCE CAPTURED

## Trigger

Q3D post-RF-059 browser decomposition showed a material browser-side identity cost after the Rust sort cliff was removed. The dedicated pre-fix falsifier on exact source head `d83ad0693bb6b59af19724998a2720bfb207221d` measured the same deterministic 1k/8k/32k compact-sort production path with direct fingerprint timing enabled.

At 32k rows the pre-fix capture contained:

- 7 `AtlasCore._kernelFingerprintDirect` calls totalling ~733.1 ms;
- 2 `AtlasCore._kernelFingerprint` calls totalling ~207.7 ms;
- ~940.8 ms of repeated authoritative fingerprint work in total;
- controller total ~3.238 s;
- Atlas total ~2.611 s;
- Worker operation promise ~2.120 s;
- Atlas row-view materialization ~127.0 ms;
- synchronous `operation:applied` ~484.7 ms.

The fingerprint timings are nested with Worker/TDA activity, so ~940.8 ms is **not** an additive wall-clock saving claim. The evidence established that unchanged analytical state repeatedly re-entered Rust/WASM to recover an identity scalar that was already authoritative and stable until a governed lifecycle transition.

## Production invariant

`AnalyticalState` retains a successful fingerprint returned by the live Rust/WASM provider for the current governed analytical state. That retained scalar is authority evidence, not a browser-derived replacement.

The implementation preserves:

1. Rust/WASM remains the fingerprint authority whenever a live provider successfully resolves identity;
2. browser fallback identity is never retained as authoritative;
3. dataset replacement, advance, set-current, restore, handle/kernel invalidation and disposal revoke retained identity through the existing lifecycle fence;
4. mutation/typed-load outputs that already carry authoritative fingerprints remain directly reusable;
5. DatasetSpace reuses a retained authoritative scalar but still propagates a live provider failure when no retained scalar exists;
6. an empty/null provider result is not retained and does not prevent a later valid authoritative provider from winning;
7. Worker registration fencing, replay/provenance and cross-language identity semantics remain unchanged.

## Post-fix production evidence

The identical Q3D 1k/8k/32k compact-sort production-path staircase passed on exact evidence head `40b4455c2f68b64b06636eb97a621c850f51bdd7`, workflow run `33203651345`, artifact `9698807769` (`sha256:d6a47887d7592a857ea936ba2246beb6d70292ff0d1f2431ac0ff3361c48bf73`).

| Rows | Controller pre-fix | Controller post-fix | Change | Atlas pre-fix | Atlas post-fix | Change | Captured fingerprint work |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1k | 483.685 ms | 409.350 ms | -15.4% | 409.365 ms | 348.305 ms | -14.9% | 8 calls / 30.0 ms → 0 calls / 0 ms |
| 8k | 1432.280 ms | 1041.490 ms | -27.3% | 1252.165 ms | 927.700 ms | -25.9% | 8 calls / 222.8 ms → 0 calls / 0 ms |
| 32k | 3237.995 ms | 2195.710 ms | -32.2% | 2610.540 ms | 1794.805 ms | -31.2% | 9 calls / 940.8 ms → 0 calls / 0 ms |

At 32k the same capture also changed Worker-port promise time from ~2119.8 ms to ~1272.8 ms and synchronous `operation:applied` from ~484.7 ms to ~367.5 ms. Those nested stages contain scheduling and concurrent downstream work, so RF-060 does not assign their full deltas solely to fingerprint retention. The supported causal claim is narrower: the same production-path capture no longer performs repeated live fingerprint-provider calls, while controller and Atlas wall time materially improved under the same hosted harness.

Worker-internal Rust/WASM operation time changed only modestly (~580.9 ms → ~541.8 ms at 32k), which is consistent with RF-060 being a browser/authority-boundary optimization rather than another Rust sort algorithm change.

## Governance cleanup

Q3D is restored to `workflow_dispatch` only after the post-fix evidence run. The temporary PR trigger used solely to obtain the bounded before/after evidence is not promoted into recurring merge tax.

## Remaining measured seams

RF-060 deliberately does not absorb the next performance work. The post-fix 32k envelope still contains:

- controller ~2.196 s;
- Atlas ~1.795 s;
- main-thread Worker promise ~1.273 s;
- overlapping registration/residency stages (nested, not additive);
- synchronous `operation:applied` ~367 ms;
- structure discovery/recommendation ~313 ms;
- row-view reconstruction ~123 ms.

These remain owned by RF-029/RF-035/RF-051 and follow-on measured work. Physical Quest qualification remains separate.

## Non-goals / status boundary

RF-060 does not establish generic large-N support, Worker GC/RSS bounds, or Quest frame/memory qualification. The implementation is **LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`, until the broader whole-pipeline/device programme converges.
