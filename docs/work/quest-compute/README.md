# Quest Compute Acceleration

**Status:** active bounded optimization programme  
**Target:** Meta Quest browser/WebXR path  
**Authority boundary:** Rust/WASM remains analytical authority; optimizations must not create a second scientific implementation.

## Goal

Recover frame-time, CPU, memory and thermal headroom on Quest using the execution surfaces Nemosyne already owns before considering native-host escape hatches.

## Sequence

1. [QCA0 baseline](QCA0_BASELINE.md)
2. After QCA0, run [QCA1 WASM SIMD](QCA1_WASM_SIMD.md), [QCA2 worker/main-thread audit](QCA2_WORKER_OFFLOAD.md), and [QCA4 rendering fast wins](QCA4_WEBXR_RENDERING.md) where non-colliding.
3. [QCA3 transport/threads](QCA3_TRANSPORT_THREADS.md) follows measured QCA2 boundary costs.
4. [QCA5 WebGPU compute](QCA5_WEBGPU_COMPUTE.md) is experimental and advisory-only unless separately qualified.

## Governing rules

- Measure on the real Quest before making device-performance claims.
- Keep ordinary WebXR/browser deployment working.
- Prefer reversible, bounded changes with a comparison implementation.
- Adopt only measured wins. A negative experiment closes the task successfully.
- Do not move evidence admission, scientific calculation, representation promotion, or replay authority out of existing governed paths.
- Preserve exact-head benchmark artifacts and the test corpus/configuration used to produce them.
