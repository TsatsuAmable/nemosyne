# Historical review seeds — revalidate before reporting

Baseline: Nemosyne `6e9264dbcacb0dac5ce4ef29e8ca7f1e88f1dd54`, reviewed 20 September 2026. These are findings at that snapshot, not a live defect ledger. Repository authorities govern current status.

| Seed | Evidence at baseline | Important limit |
| --- | --- | --- |
| Worker residency disagreement | Port probe reported A and B resident after mutation; Worker replacement code destroyed prior handles and retained B | Real overlapping Worker/production failure was not reproduced |
| Semantic authority metadata retention | Module-level map stored cloned requests; insertion/lookups existed without deletion/reset; dataset destruction released Rust state only | Long-session memory impact and stale-authority exploitation were not measured |
| Duplicate semantic payload computation | TypeScript invoked builder for size and output; Rust exports rebuilt/serialised on both calls; distribution construction sorted observations | No end-to-end latency improvement was measured |
| Fresh-load copy amplification | Five Dataset.clone calls across the inspected use-case/state chain; both Atlas setters established fingerprint/registration material | Peak live memory and frame impact were not measured |
| Valid replay test accepted failure | Positive reopen assertion accepted either verified success or verification failure | Did not demonstrate an actual product reopen failure |

Focused baseline verification used the package's integration-test script with `worker-backpressure.test.ts`, `rf035-worker-resident-registration.test.ts`, and `rf062c-load-dataset-use-case.test.ts`: all 15 tests passed. This is historical evidence only; discover current scripts/toolchain and rerun applicable tests. The review did not run full CI, a real-Worker concurrency reproduction, browser profiling, or physical Quest qualification.

Use these seeds to ask better questions. If current code fixes a seed, verify the fix and omit it from open findings. Investigate adjacent failure classes rather than forcing the old conclusion.
