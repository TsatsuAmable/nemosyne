# Nemosyne Research Obligations Manifest

**Status:** INITIAL ADVERSARIAL SEED  
**Authority:** research queue, not product/roadmap mutation authority.

## Provenance and loop

Definitive vision -> design doctrine / architecture / ADRs -> operational roadmap -> explicit claims, uncertainties and prerequisites -> research obligations -> RFL experiments / adversarial review -> findings -> proposed roadmap/design revisions or VSL invariants.

The manifest is reviewed whenever a governing vision, design, architecture or roadmap document changes, and on a regular scheduled review. A review may add, split, retire, block or reprioritise research obligations, but it MUST NOT silently rewrite governing documents or promote scientific claims.

## Initial adversarial extraction

| ID | Source | Obligation / falsifiable question | Evidence needed | State |
| --- | --- | --- | --- | --- |
| RO-001 | Vision §§2-3, 18-19 | Does spatial semantic investigation produce discoveries or correct judgements that appropriate 2D baselines do not, at acceptable attention/time cost? | Pre-specified comparative investigator study, task/oracle authority, null/negative controls | PLANNED |
| RO-002 | Vision §§4, 9; dataset-first architecture §§2-7 | Can dataset-first semantic embodiment preserve analytical meaning across dataset -> structure -> subset -> observation without collapsing into point-cloud primacy? | Known-structure corpus, semantic round-trip/metamorphic tests, raw-row fallback checks | ACTIVE |
| RO-003 | Vision §§9-11, 18; roadmap PT9 | Can Learned Moneta improve representation choice over non-learned baselines without leakage, post-selection bias or upgrading ABSTAIN? | Frozen train/holdout groups, admissible utility protocol, calibration/stability tests | BLOCKED: PT9 prerequisites |
| RO-004 | Dataset-first architecture §§4-6; Full Moneta frontier | Does additional compute buy semantic/discovery value rather than visual complexity, benchmark overfit or representation bloat? | Compute staircase, complexity penalties, sealed holdout, semantic-gain measures | PLANNED |
| RO-005 | Vision §§14,17; roadmap recursive governance | Do adversarial committees improve defect/falsifier yield enough to justify their attention and latency cost? | Review latency, unique defect yield, escaped defects, fix-forward rounds; negative/null result admissible | ACTIVE |
| RO-006 | Vision Appendix A; UXR3 | Are semantic working-set bounds invariant across all production representation families and hostile producer/consumer imbalance? | Cross-family perturbation, cancellation/stale-generation, long-session boundedness | ACTIVE |
| RO-007 | Vision §§12-13; UX doctrine | Is the interaction language learnable and comprehensible without hidden expert conventions across desktop and physical XR? | Task/comprehension study; simulator only for software behavior, physical/human evidence for human claims | PLANNED |
| RO-008 | Vision §§14.1-14.2; evidence protocol | Are evidence classes, benchmark oracles and promotion criteria sufficiently independent to prevent circular self-validation? | Adversarial provenance audit, negative controls, independent oracle/holdout checks | ACTIVE |
| RO-009 | Architecture ownership rules; ADR 0001 | Does Rust/WASM analytical authority remain singular under semantic embodiment, telemetry, learning and generated representations? | Boundary tests, authority audit, generated-candidate mutation falsifiers | ACTIVE |
| RO-010 | Vision §18; dataset-first architecture §5 | Is the proposed evolutionary representation grammar expressive enough to discover useful structures without making search intractable or truth mutable? | Grammar coverage study, out-of-grammar controls, QD/repertoire experiments, reproducibility and budget evidence | BLOCKED: EVO-0 |

## Review contract

Each review binds the exact source revisions it inspected and records additions, closures, changed dependencies and unresolved disagreements. Obligations require a claim owner, admissible evidence class, falsifier or decision rule, dependency state and durable evidence references before they can be promoted to SATISFIED.

SATISFIED means the stated research obligation has met its declared criterion. It does not mean the product vision is proven. FALSIFIED, ABSTAIN and negative/null outcomes are first-class terminal research results when justified by the protocol.
