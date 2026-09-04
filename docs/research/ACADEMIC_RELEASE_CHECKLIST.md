# Academic Release Checklist

Use this checklist before Nemosyne is cited as a research artifact, submitted with a paper, or deposited in an archival repository.

## Repository identity

- [ ] Tag the exact software version used by the paper.
- [ ] Record the immutable commit SHA in the manuscript/artifact README.
- [ ] Add `CITATION.cff` once the preferred scholarly author name(s), affiliations and ORCID(s) are explicitly confirmed.
- [ ] Decide whether to archive releases through Zenodo or another DOI-granting repository; record the DOI only after it exists.
- [ ] Keep the software licence distinct from third-party material notices and dataset/model licences.

## Research provenance

- [ ] Paper claims map to a claim/evidence ledger.
- [ ] `references.bib` contains all cited scholarly work with verified metadata.
- [ ] Direct intellectual/design influences are acknowledged even when no code was incorporated.
- [ ] Closest prior systems are discussed, including work that weakens novelty claims.
- [ ] Historical `Draco` terminology is clearly distinguished from Moritz et al.'s Draco system and Moneta's current architecture.

## Code/material provenance

- [ ] Complete the third-party source/history audit.
- [ ] Complete asset/font/icon/model/shader/media audit.
- [ ] Complete npm/Rust dependency licence report for distributed artifacts.
- [ ] Create a root-level third-party notice file if verified obligations require one.
- [ ] Verify that all screenshots/figures are original or have appropriate publication rights/credits.

## Data

- [ ] Freeze exact `nemosyne-data` revision(s).
- [ ] Record licence/provenance for every dataset used in a paper.
- [ ] Confirm redistribution rights for datasets included in an artifact.
- [ ] Keep private/consented learning corpora outside public artifacts unless explicit governance permits release.
- [ ] Preserve known-answer and metamorphic fixtures used for correctness claims.

## Models and adaptive components

- [ ] Record Moneta/FitnessModel version and artifact hash where relevant.
- [ ] Record perception/gesture model version where relevant.
- [ ] Record training corpus snapshot and user-disjoint split identity where relevant.
- [ ] Record training code/environment and seeds.
- [ ] Preserve evaluation reports, failed promotion attempts and negative evidence relevant to claims.
- [ ] Demonstrate Research Mode freeze when a formal study depends on fixed adaptive components.

## Analytical runtime

- [ ] Record Rust/WASM kernel version.
- [ ] Record algorithm/schema/approximation parameters.
- [ ] Record browser/runtime and target hardware when claims depend on them.
- [ ] Distinguish historical analytical provenance preserved in `.nemosyne` from the runtime used to replay/open the artifact.

## Human studies

- [ ] Define whether the session is exploratory product research or a formal research study.
- [ ] Obtain ethics/IRB/institutional approval when required by the applicable institution and study.
- [ ] Freeze protocol, inclusion/exclusion criteria, tasks, outcomes and analysis plan before confirmatory collection where appropriate.
- [ ] Separate participants/users across train/test groups when learned models are evaluated.
- [ ] Record withdrawals/exclusions and missing data transparently.
- [ ] Report negative/null outcomes and deviations from protocol.
- [ ] Do not infer scientific-discovery benefit from engagement, preference or session duration alone.

## Statistical claims

- [ ] Define the estimand/outcome before choosing a test.
- [ ] Justify measurement scales and valid operations.
- [ ] Report uncertainty/effect sizes rather than only thresholded significance.
- [ ] Account for repeated measures/multiple comparisons where applicable.
- [ ] Address post-selection effects when representations/tasks/hypotheses were chosen adaptively.
- [ ] Keep heuristic utility/fitness scores separate from calibrated probabilities/confidence.
- [ ] Run sensitivity/stability analysis for conclusions that depend on analytical or representation choices.

## Paper-specific artifact

- [ ] Include a concise artifact README describing what reproduces which claim.
- [ ] Include environment setup or container/lockfiles where practical.
- [ ] Include analysis scripts used to generate reported numbers/figures.
- [ ] Include exported `.nemosyne` examples when they are part of the contribution and data rights permit it.
- [ ] Include video only when it contributes evidence or makes interaction inspectable, not as a substitute for evaluation.

## Venue policy check

Re-check immediately before submission:

- [ ] originality/concurrent submission policy;
- [ ] anonymisation policy;
- [ ] preprint policy;
- [ ] artifact/data availability policy;
- [ ] human-participant reporting requirements;
- [ ] GenAI use/disclosure policy;
- [ ] accessibility requirements;
- [ ] copyright/third-party media requirements;
- [ ] author ORCID/profile requirements;
- [ ] open-access/APC implications.

Venue rules change. Do not rely on a policy copied months earlier into this repository.
