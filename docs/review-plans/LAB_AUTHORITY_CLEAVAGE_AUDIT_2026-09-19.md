# Laboratory Authority Cleavage Audit

**Specimen:** `main@ce854e47c5a3abeba660d0cea4bf1b945cc566f0`  
**Disposition:** REMEDIATION REQUIRED, staged to preserve product/specimen contracts.

## Constitutional boundary

Nemosyne owns product truth and runtime behavior: vision/design/architecture/roadmap, Rust/WASM analytical authority, Moneta production decisions, XR runtime, interaction/resource governors, native QV adjudication, generic product-development simulator adapters, and the thinnest instrumentation needed for an external laboratory to drive a pinned specimen.

Nemosyne-data owns laboratory behavior: experiment/campaign orchestration, benchmark/oracle registries, perturbation plans/runners, research scenarios, research evidence calibration/analysis, adversarial review, research obligations, durable evidence and distributed VSL/RFL coordination.

## Current classification

| Path | Disposition | Reason / target |
| --- | --- | --- |
| `dev/xr-simulator/**` | KEEP | Generic product-development WebXR/IWER adapter and deterministic product scenario surface. It exercises Nemosyne runtime behavior and remains a specimen capability. |
| native Quest/QV machinery | KEEP | Product validation manifest, device attribution and native adjudication are Nemosyne authority. Lab indexes/references their evidence; it does not reimplement the state machine. |
| `dev/xr-lab/MonetaEvidenceProtocol.ts` | THIN/REASSESS | Currently cited as an executable scientific gate and coupled to product tests. Scientific protocol authority belongs in data lab; Nemosyne should ultimately expose only production admission/specimen interfaces required to enforce a promoted protocol. |
| `dev/xr-lab/MonetaBenchmarkCorpus.ts` | MOVE | Benchmark/oracle registry is laboratory authority. A copy already exists under `nemosyne-data/lab/benchmarks`; retire product copy after consumers are migrated. |
| `dev/xr-lab/MonetaKnownStructureCampaign.ts` | MOVE | Campaign execution is laboratory authority. A data-lab counterpart already exists. |
| `dev/xr-lab/Portable*Perturbation*` | MOVE | Perturbation plans/runners are RFL laboratory machinery; counterparts already exist in nemosyne-data. |
| `dev/xr-lab/ResourcePressurePerturbation.ts` | MOVE/THIN | Research campaign driver belongs in data lab. If a product-side primitive is required, retain only a thin specimen adapter over the production resource governor. |
| `dev/xr-lab/PortableXRExperiment.ts` | MOVE | Experiment schema/bundle orchestration is laboratory authority; counterpart exists in data lab protocols. |
| `dev/xr-lab/XRArchitectureCampaign.ts` | MOVE | Comparative campaign construction belongs in data lab; counterpart exists. |
| `dev/xr-lab/XRExperimentEvidenceContract.ts` | MOVE | Research evidence-comparability contract belongs with evidence custody; counterpart exists. |
| `dev/xr-lab/XRExperimentStatusReport.ts` | MOVE | Harness reporting belongs in data lab; counterpart exists. |
| `dev/xr-lab/ExperimentalProfiles.ts` | MOVE | Dataset/device/fault research envelopes are experiment definitions, not product authority. |
| `dev/xr-lab/EvidenceCalibration*.ts` | MOVE | Cross-evidence calibration is laboratory analysis. Nemosyne may emit attributable observations but must not own research calibration conclusions. |
| `scripts/run-xr-architecture-experiment.ts` | RETIRE/MOVE | Campaign CLI belongs in data lab, which already has `lab/engine/run-xr-architecture-experiment.ts`. |
| `docs/research/*` describing lab protocols/campaigns | MOVE/CANONICALISE | Canonical research protocols/results belong in nemosyne-data. Nemosyne may retain short references where the roadmap/product boundary depends on them. |

## Migration rule

Do not delete a product-side module merely because a data-lab copy exists. First verify parity and move the caller. If Nemosyne tests are testing a research protocol rather than product behavior, migrate the test with the protocol. If a test protects a product invariant, replace its dependency with a thin specimen/product contract before removing the lab module.

No migration may move Rust/WASM analytical authority, product QV adjudication, product runtime semantics, or generic WebXR product adapters into nemosyne-data.

## Ordered remediation

1. Land nemosyne-data research-obligation authority (#11).
2. Establish this inventory on exact current Nemosyne main.
3. In nemosyne-data, verify parity for each duplicated lab module and import any newer product-side behavior/evidence tests before deletion.
4. Add/strengthen the pinned specimen adapter for the few product behaviors laboratory runners need.
5. Migrate research-only tests, campaign CLIs and research docs to nemosyne-data.
6. Remove duplicated `dev/xr-lab` authorities from Nemosyne, leaving thin adapters only where demonstrated necessary.
7. Run full Nemosyne CI/VSL product regression and data-lab RFL/self-tests; adversarially inspect for authority inversion or evidence loss.

This audit is an ownership correction, not evidence that the duplicated modules are behaviorally identical. Parity must be demonstrated before retirement.
