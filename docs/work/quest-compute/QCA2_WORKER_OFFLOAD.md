# QCA2 — Main-Thread / Worker Offload Audit

**Status:** READY AFTER QCA0  
**Purpose:** keep analytical and preprocessing work away from the XR/render thread using the Worker + Rust/WASM path already present.

## Work

Profile the production journey and classify non-render work as:

- already worker-owned;
- main-thread but safely movable;
- frame-critical and intentionally main-thread;
- boundary/serialization overhead.

Prioritize measured long tasks and expensive semantic/representation preparation. Reuse `AnalyticalRuntimeOwner`, `WorkerAnalyticalPort` and `analytical.worker.ts`; do not create a second worker framework.

Verify cancellation/generation fences, teardown, errors/refusals and dataset identity after each move.

## Exit

No measured high-cost analytical task remains on the XR/main thread without a documented reason. Compare frame-time/long-task distributions before and after.

**STOP:** worker crossing costs exceed the work moved.  
**ADOPT:** measurable responsiveness/frame-time improvement with unchanged authority and behavior.
