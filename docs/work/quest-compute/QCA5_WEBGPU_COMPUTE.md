# QCA5 — WebGPU Compute Spike

**Status:** EXPERIMENTAL / AFTER QCA0  
**Purpose:** test GPU compute for bounded non-authoritative preprocessing where WebGPU availability and workload shape make it plausible.

## Candidate work

Only select a measured hotspot with regular parallel structure, such as geometry transforms, field/density preparation or other presentation-side preprocessing. Do not move authoritative DatasetEvidence or governed Moneta decisions to WebGPU.

## Protocol

- capability-detect and preserve existing WASM/CPU fallback;
- differential-test output tolerances appropriate to the non-authoritative task;
- measure upload/readback cost as part of the benchmark;
- measure end-to-end Quest latency/frame impact, not kernel time alone;
- record browser/runtime version because support is evolving.

## Exit

**STOP:** transfer/compilation complexity dominates, support is unreliable, or the task would create scientific authority ambiguity.  
**CONTINUE/ADOPT:** only after a bounded workload shows material device-level benefit and a robust fallback.
