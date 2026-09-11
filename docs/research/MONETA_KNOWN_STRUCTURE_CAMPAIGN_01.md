# Moneta Known-Structure Campaign 01

**Status:** EXECUTABLE CONTROL CAMPAIGN  
**Scientific gate:** `MONETA_EVIDENCE_PROTOCOL.md`  
**Campaign implementation:** `dev/xr-lab/MonetaKnownStructureCampaign.ts`  
**Production analytical authority:** Rust/WASM `DatasetStructureProfile`  
**Run:** `npm run experiment:moneta-known-structure`

## Purpose

This is the first executable bridge from the XR Experimental Engine / Moneta benchmark corpus into the existing production analytical kernel. Its job is deliberately modest: prove that the research harness can detect a known information-preservation failure without creating a second TypeScript clustering/statistics implementation.

It is **not** evidence that Full Moneta chooses good representations for humans. It is a control experiment establishing that machine-verifiable structure can be planted, perturbed, projected and assessed through the same Rust/WASM structure-profile authority Moneta already consumes.

## Exact-generative dataset

The campaign deterministically generates three compact, well-separated planar clusters. Ground-truth cluster labels remain inside the benchmark harness and are never supplied as an analytical column to the Rust kernel.

The campaign then applies bounded seeded measurement perturbations that preserve those labels. This gives an exact answer to a narrow question: does the candidate projection still permit the production kernel to recover the planted three-cluster structure?

## Controls

1. `preserve-xy` — identity planar projection.
2. `rotate-xy` — 45-degree distance-preserving rotation.
3. `collapse` — deliberate information-destroying projection mapping every observation to the same coordinates.

These are calibration controls, not product representation candidates.

## First result

Configuration:

- seed: `20260911`;
- 48 observations per planted cluster;
- 144 total observations;
- 8 perturbation runs per representation;
- perturbation magnitude: `0.1`;
- analytical evaluator: real Rust/WASM `DatasetStructureProfile`.

Observed result:

| Control | Planted three-cluster recovery | Interpretation |
| --- | ---: | --- |
| `preserve-xy` | 8 / 8 | expected structure survives |
| `rotate-xy` | 8 / 8 | expected structure survives distance-preserving transform |
| `collapse` | 0 / 8 | deliberate information loss is detected |

The evidence protocol returns `ELIGIBLE` for all three controls because eligibility is an evidence-admissibility decision, **not** a representation-quality score. The collapsed control is admissible evidence of a bad representation. This separation is intentional and important.

## What this establishes

**Finding:** the experimental path can distinguish a deliberately structure-destroying representation from two structure-preserving controls using the production Rust analytical authority across repeated valid perturbations.

**Finding:** scientific admissibility and representation utility remain separate. A candidate cannot be marked scientifically invalid merely because it performs poorly, and a scientifically admissible candidate is not promoted merely because the evidence is well formed.

**Finding:** the benchmark does not need human validation for this exact planted-structure claim.

## What this does not establish

- that Rust silhouette/cluster evidence is a complete representation-preservation metric;
- that three-cluster recovery predicts human discovery value;
- that the control dataset resembles realistic investigations;
- that Full Moneta's candidate search objective is correct;
- that a particular representation is globally preferable;
- that local semantic neighborhoods are preserved merely because global cluster structure is preserved.

## Next adversarial expansions

The next campaign should make the controls harder rather than merely adding more repetitions:

1. **Local/global conflict:** preserve global clustering while corrupting a selected local neighborhood.
2. **Summary-statistic trap:** Anscombe/Datasaurus-style datasets that defeat summary-equivalence heuristics.
3. **High-dimensional instability:** `p >= n` synthetic families where candidate rankings are measured across perturbations/resamples and the evidence gate must abstain without explicit stability evidence.
4. **Adaptive-search calibration:** generate/select among many candidate structures, then compare naive inferential reporting with sample-split or selection-aware calibration.
5. **Compositional control:** compare raw-Euclidean and log-ratio/simplex-respecting treatment of a planted compositional signal; the former must fail the evidence protocol before utility scoring.
6. **Human bridge:** only after machine controls are credible, test whether representation-preservation measures correlate with investigator task success and discovery.

## Design constraint

Do not grow this file into a replacement statistical toolkit. Where Nemosyne already has Rust analytical authority or mature external prior art, the campaign should call it. New statistical machinery requires an explicit prior-art and authority decision.
