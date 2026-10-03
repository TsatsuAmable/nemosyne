# QCA0 — Quest Performance Baseline

**Status:** READY  
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
