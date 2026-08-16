# Statistical Method Register

**Status:** Template; no method is approved by this file alone.
**Authority:** Product architecture may require this register. The study package remains
authoritative for preregistered estimands, outcomes, exclusions, and inferential models.

Every analytical method used in a reproducible Atlas or research workflow gets one entry before
it is treated as validated or confirmatory. Exploratory methods must still record limitations and
provenance.

## Entry Template

```text
Method ID:
Method name:
Status: proposed | exploratory | validated | confirmatory
Version:
Implementation / crate / commit / digest:

Analytical question:
Research hypothesis or task:
Outcome and estimand:
Unit of analysis:
Design linkage: condition, participant/trial nesting, randomization unit
Published methodological precedent / DOI:

Input dataset and feature hashes:
Preprocessing and normalization:
Missing-value policy:
Exclusion policy:
Parameters:
Seed / resampling unit:
Precision and numerical tolerances:
Assumptions:
Diagnostics:
Multiplicity and stopping rules:
Sensitivity analyses:

Output schema:
Uncertainty method and interval:
Decision rule:
Failure states and warnings:
Output hash / replay identifier:

Independent reference implementation:
Validation fixtures:
Rust/JS conformance result:
Reviewer and approval date:
```

## Admission Rules

- Select a method from the question and estimand, not from a desired result.
- Freeze confirmatory methods before data collection.
- Validate Rust and TypeScript providers against independent references and edge-case fixtures.
- Test missingness, ties, degenerate inputs, seed determinism, tolerances, and resource limits.
- Treat numerical parity as implementation evidence, not proof that the study design or causal
  interpretation is valid.
- Persist method ID, version, parameters, seed, diagnostics, and output hash in every result.
