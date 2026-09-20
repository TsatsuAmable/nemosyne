# TEC0 Evidence Propagation Audit

**Status:** EXACT-MAIN AUDIT COMPLETE / TEC1 MIGRATION REQUIRED  
**Baseline:** `main@7c096eaae8909b3d4cc04b4a040bb6373a6e35de` (#802)  
**Scope:** `MeasurementModelRecord -> AnalyticalGeometry -> EvidenceClaim<T> -> Rust/WASM transport -> DatasetEvidence -> DatasetEvidenceSignature -> SemanticEmbodimentGraph -> RepresentationGraph`

## Verdict

The repository has two evidence paths that do not yet meet at the production transport boundary.

1. Rust owns a research-grade `EvidenceClaim<T>` contract with estimand, method provenance, analytical geometry, assumptions, sample support, uncertainty, stability, sensitivity and limitations.
2. Production Moneta is fed through `DatasetStructureProfile -> StructureProfileEvidenceAdapter -> DatasetEvidence`. `DatasetEvidence` carries value, method provenance, optional uncertainty and limitations, but it has no first-class fields for estimand, analytical geometry, assumptions, sample support, stability or sensitivity.

This is a **required migration**, not evidence that those absent axes are favourable. MCR1's `evidenceRefs` prove that a semantic node names some evidence identity, but the current production evidence identity cannot resolve to the full governing claim. MCR2 therefore remains correctly gated.

## Propagation matrix

| Evidence axis | Rust `EvidenceClaim<T>` | Production structure-profile transport | `DatasetEvidence` | `DatasetEvidenceSignature` | Semantic / representation handoff | TEC0 classification |
| --- | --- | --- | --- | --- | --- | --- |
| claim / estimand | first-class `claim_id`, `estimand` | structure-profile facts/heuristics, not claim envelope | stable `id` + semantic `name`, no estimand | facts selected into signature | semantic `evidenceRefs`; graph has schema version | **Required migration** |
| measurement semantics / analytical geometry | `geometry: Option<AnalyticalGeometry>`; measurement model exists upstream | not transported by structure-profile ABI | no geometry field | cannot preserve absent geometry | no resolvable geometry from `evidenceRefs` | **Blocker for claims whose admissibility depends on geometry** |
| assumptions | `Vec<AssumptionCheck>` with satisfied/violated/unchecked/not-testable | not transported as governed axis | no assumptions field | absent | absent behind semantic ref | **Blocker for inferential/admissibility use** |
| sample support | first-class counts, columns, policy and exclusion reasons | selected estimators expose ad-hoc counts/sampling parameters | sampling policy/parameters can describe method, but no common support contract | some observed/sample counts copied for selected facts | no common support receipt | **Required migration** |
| uncertainty | first-class optional Rust uncertainty | structure-profile adapter normally emits `kind: none` | first-class optional uncertainty | signature largely consumes point facts, not uncertainty as a decision axis | semantic refs do not themselves expose uncertainty | **Required migration; missing must remain unknown/none, never favourable** |
| stability | first-class optional method/score/repetitions | cluster profile exposes `stabilityConfidence`, explicitly legacy/heuristic | embedded inside cluster value, not governed stability axis | can become cluster-related fact with epistemic source | no generic stability receipt | **Required migration; heuristic compatibility only meanwhile** |
| sensitivity | first-class factor/tested-values/material-change results | not transported | no field | absent | absent | **Required migration** |
| limitations | first-class | adapter explicitly appends suite/profile limitations | provenance `limitations[]` | per-fact epistemic notes preserve only selected interpretation; full limitations remain in DatasetEvidence | semantic ref can point back only if evidence envelope remains available | **Retained in DatasetEvidence, summarized downstream** |
| method provenance | first-class method/version/kernel/dataset/parameters | suite provenance + bounded estimator manifests; adapter explicitly states suite-level limitation | strong method/kernel/parameters/seed/policies/limitations | evidence ID + method retained in epistemic map | graph records evidence schema version; semantic node records refs | **Intentional summarization downstream if original envelope is resolvable** |
| dataset identity | method provenance fingerprint | structure profile provenance fingerprint | envelope fingerprint | signature carries evidence-derived epistemic identity | representation provenance repeats fingerprint; MCR1 cross-checks | **Retained / fail-closed cross-check** |
| evidence identity | `claim_id` | profile has no general claim receipt | adapter creates stable evidence IDs | per-fact `evidenceId` | `SemanticEmbodimentNodeV1.evidenceRefs` | **Compatibility identity, not yet full `EvidenceClaim` identity** |

## Exact production seam

The live Moneta path is currently:

```text
Rust DatasetStructureProfile
  -> WASM JSON ABI (`data_compute_structure_profile`)
  -> DatasetHandleBridge
  -> MonetaEvidenceAuthority
  -> structureProfileToDatasetEvidence()
  -> DatasetEvidence
  -> datasetEvidenceToSignature()
  -> EvidenceBackedMoneta / representation decision
```

`compute_statistics_evidence()` and the generic Rust `EvidenceClaim<T>` types are real implemented substrate, but they are not the authority envelope transported by this production Moneta seam. Treating their existence as proof of end-to-end propagation would therefore be false closure.

## Lossy edges

### E1. `EvidenceClaim<T>` -> production WASM transport

**Classification: required migration / blocker for affected claims.** The generic claim envelope is not the production structure-profile ABI. Geometry, assumptions, generic sample support, stability and sensitivity can disappear before TypeScript sees the evidence.

### E2. `DatasetStructureProfile` -> `DatasetEvidence`

**Classification: intentional compatibility plus required migration.** The adapter is deliberately honest about heuristic terminology and suite-level provenance, and selected bounded estimators carry useful support parameters. It must remain a compatibility path, not be mistaken for lossless `EvidenceClaim<T>` transport.

### E3. `DatasetEvidence` -> `DatasetEvidenceSignature`

**Classification: intentional decision-oriented summarization only while the original evidence envelope remains authoritative and resolvable.** The signature records per-fact evidence IDs/method/source and avoids invented defaults. It does not carry all limitations or uncertainty axes and therefore cannot become the sole evidence record.

### E4. `DatasetEvidence` / signature -> semantic embodiment

**Classification: required migration.** `evidenceRefs` are bounded identity hooks, which is the correct shape, but there is not yet a governed receipt/resolver proving each ref addresses a provenance-complete evidence claim with its admissibility axes.

### E5. semantic embodiment -> `RepresentationGraph`

**Classification: MCR1-compatible but not TEC-closed.** MCR1 validates non-empty governed semantic evidence refs and cross-dataset identity. It intentionally does not infer evidence. TEC1 must make the referenced evidence resolvable before MCR2 production compilation.

## TEC1 minimum closure

TEC1 should extend the existing evidence architecture rather than create another one:

1. Define one versioned production evidence receipt/envelope that can transport or resolve the governing Rust claim identity plus estimand, geometry, assumptions, support, uncertainty, stability, sensitivity, limitations and provenance.
2. Wire Rust/WASM transport to that contract for analytical families consumed by Moneta. Do not require every future method family at once.
3. Preserve `DatasetEvidence` as the compact Moneta envelope if useful, but make any summarization explicitly link to the governing receipt rather than synthesizing missing axes.
4. Add a resolver/validation seam for `SemanticEmbodimentNodeV1.evidenceRefs`; unknown, incompatible or incomplete required axes must fail closed or `ABSTAIN`.
5. Keep `DatasetEvidenceSignature` as a decision-oriented projection, never the evidence authority.
6. Add adversarial fixtures for violated/unresolved assumptions, low/filtered support, absent uncertainty, unstable evidence, material sensitivity and provenance mismatch. Missing fields must never improve representation feasibility or fitness.

A public-format/Rust-WASM trust-boundary decision is likely required before TEC1 because the current `DatasetEvidence` schema cannot express several Rust claim axes. Apply RFC/ADR governance before changing that boundary.

## TEC0 exit

TEC0's audit criterion is met on the stated baseline: every required evidence axis and lossy edge has an explicit classification. The evidence handoff itself is **not closed**. TEC1 is required before PT9 or MCR2 production promotion.
