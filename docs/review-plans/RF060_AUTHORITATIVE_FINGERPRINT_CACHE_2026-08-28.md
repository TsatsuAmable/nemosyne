# RF-060 — Cache the authoritative current-dataset fingerprint

**Status:** IMPLEMENTATION ACTIVE / PRE-FIX FALSIFIER CONFIRMED

## Trigger

Q3D post-RF-059 browser decomposition showed a material browser-side identity cost after the Rust sort cliff was removed. The dedicated pre-fix falsifier on exact source head `d83ad0693bb6b59af19724998a2720bfb207221d` then measured the same deterministic 1k/8k/32k compact-sort production path with direct fingerprint timing enabled.

At 32k rows the captured operation contained:

- 7 `AtlasCore._kernelFingerprintDirect` calls totalling ~733.1 ms;
- 2 `AtlasCore._kernelFingerprint` calls totalling ~207.7 ms;
- ~940.8 ms of repeated authoritative fingerprint work in total;
- controller total ~3.238 s;
- Atlas total ~2.611 s;
- Worker operation promise ~2.120 s;
- Atlas row-view materialization ~127.0 ms;
- synchronous `operation:applied` ~484.7 ms.

The fingerprint timings are nested with Worker/TDA activity, so ~940.8 ms is **not** claimed as additive wall-clock savings. The evidence does establish that unchanged analytical state repeatedly re-enters Rust/WASM to recover an identity scalar that is already authoritative and stable until a governed lifecycle transition.

## Production invariant

`AnalyticalState` may retain a successful fingerprint returned by the live Rust/WASM provider for the current governed analytical state. That retained scalar is authority evidence, not a browser-derived replacement.

The implementation must preserve:

1. Rust/WASM remains the fingerprint authority whenever a live provider successfully resolves identity;
2. browser fallback identity is never retained as authoritative;
3. dataset replacement, advance, set-current, restore, handle/kernel invalidation and disposal revoke retained identity through the existing lifecycle fence;
4. mutation/typed-load outputs that already carry authoritative fingerprints remain directly reusable;
5. DatasetSpace reuses a retained authoritative scalar but still propagates a live provider failure when no retained scalar exists;
6. Worker registration fencing, replay/provenance and cross-language identity semantics remain unchanged.

## Required regression evidence

- repeated `getFingerprint(provider)` calls invoke the provider once while state is unchanged;
- DatasetSpace reuses a retained authoritative value without another provider call;
- advance/set/restore/invalidate force a fresh provider call;
- `commitKernelResult(... fingerprint)` returns the supplied authoritative fingerprint without provider work;
- provider failure/empty result does not cache browser fallback as authority;
- DatasetSpace provider errors still fail closed when no retained identity exists;
- the identical Q3D 1k/8k/32k staircase is rerun after the fix before any latency-improvement claim.

## Governance cleanup

The Q3D workflow is returned to `workflow_dispatch` only. The temporary PR triggers used to obtain the initial and RF-060 falsifier evidence are not promoted into recurring merge tax.

## Non-goals

This tranche does not optimize Worker structured-clone/scheduling, row-view reconstruction, synchronous structure discovery, TDA scheduling, dashboard rendering or physical Quest performance. Those remain separate measured findings.
