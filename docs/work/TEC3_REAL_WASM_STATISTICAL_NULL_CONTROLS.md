# TEC3 real-kernel statistical null controls

**Roadmap:** TEC/FM0 -> scientific evidence qualification. **Base:** `main@c869344`. **Status:** Bounded real-WASM qualification in progress, not a TEC3/TEC1 closure claim.

## Pre-implementation adversarial contract

**Invariant:** Exact known-null analytical patterns issued by the actual Rust runtime retain their numerical null results and their *honest* receipt status across the live WASM/TypeScript ABI. A zero coefficient or zero entropy is not upgraded to significance, confidence, calibrated stability, or inferential admissibility by serialization or the consumer resolver.

**Producer/consumer path:** `RuntimeBridge.loadDatasetJson` -> Rust `data_prepare_statistics` (`Facts`) and Rust `statisticsEvidenceReceiptBundle` -> `parseEvidenceReceiptBundleV1` -> `statisticsEvidenceReceiptAuthority.resolveAgainst` with the sealed descriptive and inferential profiles. No mocked kernel or made-up receipts.

**Falsifiers and controls:**
- Orthogonal centered numeric arrays have exactly zero Pearson correlation; a perfectly positively associated companion establishes a nonzero positive control and rules out a producer returning zero for everything.
- A single-level categorical column has exactly one observed category and zero *empirical* Shannon entropy, with honest finite sample support, no uncertainty/stability and a typed inferential refusal; a two-level counterpart must have positive entropy.
- The descriptive profile may resolve a genuine, well-defined zero Pearson coefficient, but the inferential profile must refuse, preserving the independence/measurement/uncertainty boundary.
- All tests use the real Rust/WASM runtime, validate bundle fingerprint/kernel identity, release Rust dataset handles, and do not affect `Facts`, receipt formats, or production authority.

**Known STOP / separate design gap:** `pearson_pairwise` returns a numerical `0` when fewer than two pairs survive or the denominator falls below its threshold. Such a *degenerate/undefined* Pearson case must not be interpreted as scientifically evidenced zero association. This tranche deliberately does not endorse the sentinel or change the Rust numerical ABI/producer policy. A follow-up implementation needs a separately reviewed, versioned Rust evidence/refusal design and live-WASM falsifier. Do not label TEC3 complete from these tests.

**Exit:** exact-head CI, coverage, CodeQL and independent review pass; both positive controls and null cases exercise production Rust. No performance/hardware/user study claim.
