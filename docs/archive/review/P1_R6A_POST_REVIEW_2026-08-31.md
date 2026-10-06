# P1-R6A Representation family/layout clarification review — 31 August 2026

**Base:** `main@fff946b0964397149be27d08f0c72245bbfb28f9`  
**Branch:** `refactor/p1r-r6-layout-compatibility`  
**Disposition before exact-head CI:** IMPLEMENTATION COMPLETE / REVIEW ACTIVE

## Reviewed invariant

Representation-family/layout tables describe search/presentation compatibility. They do not define the analytical object, semantic payload, or renderer authority.

## Findings

### R6A-F1 — fixed — the old reverse-map description was false

Ten reasoning families share seven layouts. `GRID_3D` is compatible with `POINT`, `DISTRIBUTION`, `CLUSTER`, `AGGREGATE`, and `TOPOLOGY`, so a single-valued `LAYOUT_TO_FAMILY.GRID_3D = POINT` cannot be a true reverse semantic mapping.

R6A adds the explicit many-to-many `FAMILY_TO_COMPATIBLE_LAYOUTS` / `LAYOUT_TO_COMPATIBLE_FAMILIES` relation and names the one-label legacy view `LAYOUT_PRIMARY_REASONING_FAMILY`. Legacy exports remain identity aliases, so this fix does not change current search, ranking, or rendering behavior.

### R6A-F2 — open / separately railed — candidate family membership is rank-effective

`FAMILY_TO_CANDIDATE_IDS` is not merely descriptive. `MonetaHypothesisEngine` emits candidates under these families and `BootstrapFitnessModel` uses family in both structure scoring and the configured prior.

`DENSITY_FIELD` remains a member of `CLUSTER`. After RF-065, the candidate supports bounded `binned-empirical-mass`, not `cluster-partition` or `continuous-density`. Authoritative cluster evidence can therefore still increase the structure score of a density candidate emitted under the CLUSTER family. This may be an intended proxy policy or stale ontology, but changing it would be rank-effective.

R6A therefore does **not** remove the membership. R6B must audit all multi-family candidate memberships and, if any correction changes ranking, mint a new fitness model/treatment identity before promotion.

## Regression review

- no candidate membership changed;
- no fitness weights, model version or treatment id changed;
- no renderer or geometry dispatch changed;
- no Rust/WASM payload or Worker protocol changed;
- legacy imports retain object identity;
- new tests require the many-to-many compatibility relation to be mechanically reversible;
- the Density Truth rail is updated to the merged #582 state without broadening physical Quest or continuous-density claims.

## Exit

R6A may merge only after exact-head typecheck/lint/tests/CI/CodeQL/governance gates pass. After merge, resync from `main` and execute R6B as a separate rank-sensitive checkpoint before R2D cluster migration.
