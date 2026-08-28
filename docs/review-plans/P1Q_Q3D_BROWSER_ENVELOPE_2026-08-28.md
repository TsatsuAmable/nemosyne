# P1-Q Q3D — Browser operation-envelope decomposition

**Status:** PILOT COMPLETE / ADOPT SUBSTRATE / TARGETED EXECUTION

## Why this tranche exists

RF-059 removed the quadratic Rust row-identity remap and collapsed the 32k authoritative `sort` kernel from roughly 36.4 s to roughly 0.43 s on the same Q3C hosted harness. Q3D then decomposed the remaining browser-side envelope rather than preselecting another optimization.

## Production path measured

```text
DataOperationController.applyAsync
  -> pre-Atlas dataset/presentation preparation
  -> AtlasCore.applyAnalysisAsync
       -> Worker registration/residency fence
       -> WorkerAnalyticalPort.execute
       -> Worker-local Rust/WASM sort
       -> compact row-view return
       -> authoritative Atlas verification/adoption
       -> analytical commit
       -> evidence/result/graph recording
  -> presentation visual transform
  -> synchronous operation subscribers
       -> dashboard update
       -> TDA/structure discovery and recommendation
       -> spatial acceleration / telemetry / logging
  -> autosave request
  -> rendered-frame settlement
```

The hosted pilot used deterministic synthetic tabular datasets at 1k, 8k and 32k rows on the default compact `sort` production path.

## What Q3D established

The 32k decomposition showed that rendering/visual application is not the dominant residual operation cost. Material browser-side work remains in several places:

- main-thread Worker request/response and scheduling around the Worker-local Rust/WASM operation;
- authoritative fingerprint lookup and registration fencing;
- compact row-view reconstruction;
- synchronous post-operation structure discovery/recommendation;
- post-operation TDA work that can issue overlapping resident-registration checks;
- dashboard dataset refresh.

The refined Q3D pass measured the synchronous `operation:applied` event at roughly 475–485 ms at 32k, with structure discovery/recommendation around 400 ms and dashboard refresh around 40–50 ms. Visual application itself was only a few milliseconds.

RF-060's dedicated pre-fix run on source head `d83ad0693bb6b59af19724998a2720bfb207221d` further measured 7 direct plus 2 DatasetSpace authoritative fingerprint lookups totalling ~940.8 ms during the 32k captured operation. Those timings are nested with Worker/TDA activity and are not additive wall-clock claims; they are sufficient to justify the bounded RF-060 retention falsifier/fix.

## Read-only instrumentation

`src/app/browserEnvelopeDiagnostics.ts` is installed only when `VITE_NEMOSYNE_Q3D_BROWSER_PROBE=1`. It wraps existing production methods for timing and restores them on disposal. It does not change analytical parameters, result materialisation policy, fingerprints, persistence ordering, rendering policy or runtime authority.

Structured evidence contains timings and metadata only. No trace, screenshot, video, user dataset, heap snapshot or private payload is retained.

## Classification

- **ADOPT:** the read-only browser-envelope diagnostic substrate for bounded investigations.
- **TARGETED ONLY:** hosted Q3D execution when a measured performance hypothesis needs falsification or before/after evidence.
- **REJECT:** automatic execution on every PR. The cold WASM build and Chromium provisioning cost is not justified as routine merge tax.

The workflow is therefore `workflow_dispatch` only after the initial pilot and RF-060 pre-fix falsifier.

## Open measured seams

Q3D does not itself promote speculative solutions. Confirmed seams remain governed under RF-029/RF-035/RF-051 and follow-on RF items:

- Worker transport/scheduling versus Worker-internal operation time;
- synchronous structure discovery/recommendation after mutation;
- overlapping TDA recomputation/residency checks;
- compact row-view reconstruction;
- physical Quest resource/frame qualification.

## Non-claims

Q3D is synthetic hosted-Chromium evidence. It is not Quest memory/frame qualification, does not prove generic large-N support, and does not establish Worker GC timing or process RSS.
