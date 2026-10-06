# P1-R2C Density post-review — 31 August 2026

**Review base:** `main@4807ffa5b0813cdad61c7de482d9bfcdc8678cf3` (#581 merged)

## Classification

**R2C STOP GATE REMAINS OPEN pending fix-forward evidence.**

The independent review of #579–#581 confirms the production density path is row-free at the Three.js boundary and the #581 instancing repair restored the measured draw-call envelope. However, one M4 requirement was not satisfied: the Rust density builder still materialized every canonical valid `(x, y)` pair into an O(N) transient vector before deriving domains and the bounded grid. #581 explicitly recorded that the allocator peak was unmeasured/unremoved.

A second evidence-rail defect was found: the dedicated M4 workflow did not trigger on `wasm/src/moneta/density_embodiment.rs` or other density analytical-authority seams, so a Rust semantic/performance change could bypass exact-head browser evidence.

## Fix-forward

The accompanying fix-forward:

- replaces `valid_pairs()` materialization with a two-pass resident-column traversal;
- first pass derives canonical valid count and bivariate domains;
- second pass increments the bounded density lattice directly;
- retains the governed equal-width, left-closed/right-open/final-closed and constant-domain-final-bin semantics;
- adds a focused Rust regression over the two-pass scan/grid seam;
- expands the M4 workflow path filter to include the Rust density builder, density contract, resident columnar storage, Worker dispatch and WASM bridge seams.

The implementation remains O(N) time but removes the additional O(N) pair-copy memory term. Data-dependent density output allocation remains bounded by the governed grid (`<= 400` cells).

## Exit requirement

Do not classify R2C as verified complete or select R2D/R2E until the fix-forward exact head passes ordinary CI plus the dedicated M4 browser evidence workflow. After that pass, re-review the exact head and update the canonical roadmap in the normal serial roadmap-sync step.
