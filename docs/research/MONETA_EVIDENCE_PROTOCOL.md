# Moneta Evidence Protocol

**Status:** PUBLIC SCIENTIFIC CONTRACT / PRE-PT9 PREREQUISITE  
**Executable authority:** `dev/xr-lab/MonetaEvidenceProtocol.ts`  
**Benchmark authority:** `dev/xr-lab/MonetaBenchmarkCorpus.ts`  
**Canonical execution authority:** `docs/ROADMAP.md`

## Why this exists

The XR Experimental Engine makes candidate generation and evaluation cheap. That creates a new failure mode: Nemosyne can optimize a convenient proxy faster than humans can notice that the proxy is scientifically invalid. Full Moneta therefore needs an evidence-admissibility boundary **before** representation utility, performance or preference optimization.

This protocol is that boundary. It is intentionally a gate, not a ranking function. A candidate that violates measurement, inference or evidence-authority constraints is not allowed to compensate with higher speed, lower GPU cost, visual appeal or aggregate fitness.

## Constitutional rule

> **Scientific validity is a feasibility constraint, not a soft objective.**

The following are therefore outside any scalar or learned utility function:

- measurement-scale legality;
- compositional/simplex semantics where applicable;
- selection-aware calibration for inferential claims made after adaptive candidate search;
- explicit perturbation/stability evidence in high-dimensional regimes where `p >= n`;
- benchmark-oracle authority;
- human validation for claims that depend on perception, discovery utility, comfort or meaning.

A learned or evolutionary search process may optimize only among candidates that survive this gate.

## Executable dispositions

`MonetaEvidenceProtocol` returns one of:

- `INVALID` — evidence violates a hard scientific/evidential constraint;
- `ABSTAIN` — evidence is not yet strong enough to promote the candidate;
- `MACHINE-FALSIFICATION-ONLY` — the benchmark can reject pathology but cannot establish the preferred representation;
- `REQUIRES-HUMAN` — machine evidence cannot close the claim;
- `ELIGIBLE` — candidate may proceed to later multi-objective evaluation.

`ELIGIBLE` does **not** mean correct, optimal, novel or ready for production. It means only that this gate found no known inadmissibility.

## Current enforced boundaries

1. Unknown or missing measurement scale is invalid.
2. Compositional variables represented as unconstrained raw Euclidean coordinates are invalid.
3. An inferential claim made after adaptive candidate selection requires an explicit selection-aware calibration/inference strategy.
4. A `p >= n` candidate without explicit perturbation/stability evidence must abstain. No universal numeric stability threshold is imposed here.
5. Diagnostic-only benchmark families can falsify collapse/pathology but cannot crown a representation.
6. Benchmark families own their oracle strength and human-validation requirement; candidate generators cannot self-upgrade evidential authority.
7. Human-dependent perceptual/discovery claims remain open until attributable human evidence exists.

## Statistical foundations and prior art

The protocol deliberately draws from mature statistical constraints rather than inventing replacement statistics. Consequential foundations include:

- **Compositional data analysis.** Aitchison geometry and log-ratio methods exist because closed relative data do not obey ordinary unconstrained Euclidean semantics. Recent applied work continues to show false or misleading conclusions from naïve relative-abundance analysis.
- **Adaptive/post-selection inference.** Once a system searches over candidate structures or representations and then reports inference on the selected result, selection itself changes the calibration problem. Split/selective/conformal-after-selection procedures are examples of admissible strategies depending on the claim.
- **High-dimensional inference.** `p >= n` is treated as a regime marker, not a universal impossibility theorem. Promotion requires method-appropriate guarantees and explicit stability/perturbation evidence rather than ordinary low-dimensional intuition.
- **Distributional uncertainty/stability.** Perturbation stability is evidence about how conclusions behave under plausible nearby distributions; it is not merely a visual robustness score.
- **Local error control.** Whole-representation or whole-graph fidelity can conceal failures in the local semantic neighborhood an investigator actually acts on. Future benchmark objectives must distinguish local from global preservation.

Primary/recent references used to establish the current boundary:

- Jeong, Y. & Rothenhäusler, D. **Calibrated Inference: Statistical Inference that Accounts for Both Sampling Uncertainty and Distributional Uncertainty.** *Journal of Machine Learning Research* 26, 2025.
- Bao, Y., Huo, Y., Ren, H. & Zou, C. **CAP: A General Algorithm for Online Selective Conformal Prediction with FCR Control.** *Journal of Machine Learning Research* 26, 2025.
- Melikechi, O., Dunson, D. B., Melikechi, N., et al. **Local graph estimation with pathwise false discovery control.** *Nature Communications* 17, 6353 (2026). doi:10.1038/s41467-026-72796-9.
- Bennett, A. R., Lundstrøm, J., Chatterjee, S., et al. **Compositional data analysis enables statistical rigor in comparative glycomics.** *Nature Communications* 16, 795 (2025).

These references justify constraints and research questions. They do not establish that Nemosyne/Moneta's eventual representation objective is correct or novel.

## Relationship to Full Moneta

The intended order is:

```text
candidate generation / RepresentationGraph search
  -> hard representation feasibility
  -> Moneta Evidence Protocol
  -> structure-preservation / task / resource / stability objectives
  -> Pareto set and inspectable alternatives
  -> S5 human evidence where claim-required
  -> learning evidence
```

The evidence protocol must not be bypassed by an evolutionary algorithm, learned ranker, LLM committee, human-preference model or runtime resource governor.

## Benchmark strategy

The current benchmark corpus deliberately mixes oracle classes:

- exact-generative synthetic statistical structures;
- exact-generative manifolds and graph communities;
- diagnostic-only Anscombe/Datasaurus families;
- labeled anomaly datasets;
- task-solution visual-analytics challenges;
- human-preference priors such as Draco/VizML.

No one family defines the correct visualization. Known-structure datasets answer whether a representation preserves planted structure. Preference corpora answer how choices compare with established human priors. Human studies are still required to test whether investigators actually perceive, understand or discover the intended structure.

## Next falsification campaign

The first campaign should deliberately search for counterexamples to Moneta's current evaluation assumptions:

1. candidates with high global preservation but damaged investigator-local structure;
2. candidates whose rank changes under small valid perturbations;
3. naïve confidence attached after representation search versus selection-aware calibration;
4. compositional datasets rendered/analysed with Euclidean versus log-ratio/simplex-respecting candidates;
5. `p >= n` datasets where apparent structure is unstable across resampling/perturbation.

Surviving candidates become eligible for later human evaluation. Failure is useful evidence and must remain in the evolutionary/provenance archive rather than being discarded.

## Change control

Changes that weaken a hard gate, add a universal numeric threshold, or convert a human-dependent claim into machine-only authority are **high-risk scientific-governance changes**. They require:

- explicit prior-art/evidence review;
- a falsifiable rationale;
- exact-head tests;
- adversarial review;
- human/project-owner judgement where the change alters epistemic authority.
