# Moneta compositional zero-semantics boundary

Date: 2026-09-18
Status: research decision / implementation precursor

## Finding

The current `MonetaEvidenceProtocol` distinguishes compositional measurement scale and declares a composition handling mode, but it does not identify what observed zeros mean. That omission is scientifically material: a log-ratio declaration is not sufficient evidence when components contain zeros, and different zero-generating mechanisms justify different models or refusal rules.

Recent work sharpens this boundary. Alzeley & Tsagris (2026, arXiv:2608.29954) model **structural zeros** with a conditional logistic-normal construction because ordinary log-ratio transformations are undefined at zero. Tang et al. (2026, arXiv:2605.22181) distinguish zero-tolerant transformations, imputation for rounded/sampling zeros, and models for essential/structural zeros in high-dimensional compositional count data. These results reinforce, rather than replace, Aitchison's simplex geometry already cited by Nemosyne.

## Required evidence contract

Add an explicit zero-semantics field for compositional evidence. Candidate vocabulary:

- `not-applicable`: no compositional variables are in scope;
- `strictly-positive`: every governed compositional component is positive;
- `rounded-or-sampling-zero`: zero denotes censoring/detection/sampling rather than known absence;
- `structural-zero`: zero denotes a component that is genuinely absent under the governing domain model;
- `mixed`: more than one governed zero mechanism is present and identified;
- `unknown`: zero mechanism is not established.

This vocabulary is a protocol declaration, not an automatic statistical transformation.

## Fail-closed rules

1. A compositional candidate containing observed zeros MUST NOT become `ELIGIBLE` merely because `compositionHandling === 'log-ratio'`.
2. `unknown` zero semantics with observed compositional zeros MUST produce `ABSTAIN` or `INVALID`, depending on whether the missing semantics are recoverable metadata or a contradiction in the submitted evidence.
3. `rounded-or-sampling-zero` MUST require an identified preprocessing/model policy. A pseudocount is not self-justifying.
4. `structural-zero` MUST require a model/representation whose assumptions explicitly admit structural zeros. Ordinary log-ratio transformation alone is inadmissible.
5. `mixed` MUST require component/observation-level provenance sufficient to distinguish mechanisms, or abstain.
6. The chosen zero policy, parameters and source metadata MUST be provenance-bound when they influence a Moneta scientific claim.

## Adversarial falsifiers

- compositional + observed zero + `log-ratio` + `unknown` zero semantics => cannot be `ELIGIBLE`;
- structural zero + ordinary log-ratio with no structural-zero model => cannot be `ELIGIBLE`;
- rounded/sampling zero + undeclared pseudocount => cannot be `ELIGIBLE`;
- strictly-positive composition + lawful log-ratio policy remains reachable;
- non-compositional evidence rejects compositional zero-semantics declarations;
- changing zero semantics or zero-policy parameters changes the evidence/provenance identity when the claim depends on them.

## Relationship to dataset-first Moneta

PRs #767/#768 move Moneta toward dataset-level semantic embodiments. This increases the importance of zero semantics: a dataset-level composition may encode absence, censoring, sampling sparsity or closure at different semantic layers. The spatial compiler must not erase those distinctions into visually identical zero-valued points/bars. Zero semantics belong upstream in governed evidence/semantic identity; rendering consumes the resulting authority artifact.

## High-dimensional implication

Zero handling and `p >= n` are not independent switches. Imputation, filtering or zero-aware transforms can alter effective dimension and induce selection. Any later high-dimensional promotion rule must bind the zero policy and, when data-adaptive, treat it as part of the selection procedure rather than as neutral preprocessing.

## Decision

Do not implement a universal zero transform. First extend the evidence schema and falsifiers so Moneta can represent/refuse zero mechanisms honestly. Statistical model implementations should then be introduced per claim/family with their own assumptions and calibration evidence.

## Sources

- Aitchison, J. (1982). The Statistical Analysis of Compositional Data. *JRSS B* 44(2):139-177. DOI: 10.1111/j.2517-6161.1982.tb01195.x.
- Alzeley, O. & Tsagris, M. (2026). Modelling compositional data with structural zero values. arXiv:2608.29954.
- Tang, W., Fačevicová, K., Nordhausen, K. & Taskinen, S. (2026). A critical comparison of handling zeros in high-dimensional compositional count data. arXiv:2605.22181.
