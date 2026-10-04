# QCA0 — Quest Performance Baseline

**Status:** BASELINE CAPTURED / GOVERNED QUALIFICATION RE-RUN OPEN
**Purpose:** establish the device truth against which every optimization is judged.

## Work

Use the existing governed Quest validation/performance scripts to capture representative investigation workloads. Record:

- frame time and dropped/missed frames;
- CPU/main-thread time and long tasks;
- worker/WASM execution latency;
- GPU/render timing where exposed;
- draw calls, visible object count and material/geometry counts;
- JS heap/WASM memory and allocation trend;
- 5-minute profile first; 30/60-minute thermal/resource runs only where useful.

Capture browser/Quest version, build SHA, dataset/fixture identity and runtime flags.

## Exit

Produce a retained baseline artifact and identify the top three measured bottlenecks. No later QCA task may claim improvement without comparison to this baseline under the same workload.

**STOP:** instrumentation cannot produce trustworthy comparable measurements.  
**CONTINUE:** bottlenecks are measurable and attributable.

## Accepted engineering baseline — 4 October 2026

The `uxr0-functional-5m` profile ran through the production operator path on a
physical Meta Quest 3S (`panther`, Adreno 740, Oculus Browser 152, 90 Hz) from
clean build `a64ec6481fc2604eff99af939b6dbbda52ef5f57`. The operator accepted this
run as the QCA engineering baseline because the ADB-captured manifest identifies
the physical device exactly.

This acceptance does **not** rewrite the governed result. QV4 correctly retained
`INVALID_RUN` for PERF-04 and PERF-05 because the emitted summary declared
`deviceTarget: UNDECLARED`; only `META_QUEST_3S` is admissible. The pre-fix
`loadDurationMs` values (1.17 ms warmup, 0.69 ms measured) are also excluded from
comparison because they timed promise dispatch rather than representation-build
completion.

- Session: `PERF04-a64ec64-20261004T092850`
- Session ID: `cb33c665-fe65-4b6f-a66d-419b852df3bb`
- Raw evidence digest: `322f4c28d4a3dc2e51a3c443a5e6e618760783e0a03edb63eaadc384e6e405aa`
- Raw JSONL SHA-256: `58a7114302a33ad0bc0f669a4971d7753458b06ab206a198ecec64742d6e16f7`
- Custody bundle digest: `12f4fad9c0a666d393ee782a11e286171464d39d2530aa879930c498f546e497`
- Retained local bundle: `logs/validation/PERF04-a64ec64-20261004T092850/`

### Comparable 100k measured-step observations

| Signal | Observation |
| --- | --- |
| Frames | 1,235/1,235 dropped; render p50 224.27 ms, p95 244.49 ms, p99 253.64 ms; 4.41 FPS average |
| XR cadence | p95 248.63 ms; p99 259.34 ms; 14,544.11 ms maximum gap |
| Render load | 2,405,766 average / 2,414,728 maximum triangles; 28.02 average draw calls; 100,000 rendered nodes |
| Governor | LOD scale reached and ended at 0.4; 1,235 throttle events; rendered cardinality remained 100,000 |
| Memory | JS heap 225,000,000 bytes and WASM 154,664,960 bytes at start/peak/end; no observed trend in this profile |
| Visibility | Two interruptions totaling 5,376.1 ms; final state visible |

Thirty- and sixty-minute profiles were not run: the five-minute profile was
already catastrophically red, memory was flat, and longer soaks would not answer
the first optimization question. They remain available for comparison after the
frame/render bottleneck is materially reduced.

### Ranked findings and QCA handoff

1. **QCA4 first:** the 100k row-addressable representation submitted about 2.4M
   triangles per frame and sustained only about 4 FPS. Rendering/cardinality is
   the dominant measured bottleneck.
2. **QCA4 governor effectiveness:** 1,235 throttle events and a 0.4 LOD scale did
   not reduce the 100k rendered-node count. QCA4 must test bounded cardinality or
   geometry changes independently and retain only physical-Quest wins.
3. **QCA2 load/main-thread audit:** the production journey visibly stalled during
   representation construction, but the pre-fix timer captured only dispatch.
   Correct completion timing is required before attributing that cost or choosing
   worker work. The same journey's 100k TDA request correctly refused an estimated
   200,014,400,076-byte transient allocation; that refusal is not computation
   success and does not justify QCA1 SIMD work by itself.

QCA1 therefore begins with a hotspot audit and may close as a negative experiment
if no eligible Rust/WASM kernel dominates. QCA2 begins with corrected load and
main-thread evidence. QCA3 remains blocked on QCA2 transfer/synchronization
measurements. QCA4 is directly authorized by the render evidence above.

### Measurement-integrity follow-through

The QCA0 implementation branch makes all governed UXR0 profiles explicitly target
`META_QUEST_3S`, awaits the real `World.loadDataset()` completion boundary, fails
closed on rejection, fences late completion after stop/dispose, and prevents an
aborted run from emitting a performance recommendation. A corrected exact-head
physical run remains required for governed PERF-04/PERF-05 qualification; the
historical `INVALID_RUN` disposition remains immutable.
