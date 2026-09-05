# P1-PT7 Runtime/Model Registry & Reproducible Jobs — Review Plan

**Date:** 5 September 2026  
**Status:** IMPLEMENTATION / ADVERSARIAL REVIEW ACTIVE  
**Base:** `main@a835a516edd4be1a0fdd392d8444a3489b5a5085` (#664 / PT6D)

## Bounded objective

PT7 operationalises the Learning ontology without starting the PT8 gesture-training loop or changing Moneta/gesture model semantics.

The tranche must establish:

1. a replaceable durable content-addressed artifact store;
2. exact runtime provenance registry entries covering dataset, analytical kernel, representation/Moneta, NIL, gesture/perception, UI/platform and reproducibility-critical seeds;
3. explicit Product Mode versus Research Mode adaptation/treatment declarations;
4. reproducible training-job manifests binding data snapshot, feature schema, code commit, trainer, environment/container, config, seed, holdout policy and runtime baseline;
5. immutable job receipts binding the actual runner environment and exact model/evaluation outputs;
6. an operational model registry that references, rather than redefines, existing gesture and FitnessModel/Moneta artifacts;
7. signed and digested operator deployment manifests;
8. candidate -> shadow -> canary -> production state transitions, replacement and exact rollback;
9. privacy-safe aggregate observability of model distribution/load/inference failures;
10. explicit staged-promotion evidence and human promotion authority.

## Authority map

```text
existing domain model artifact semantics
  gesture-intelligence / FitnessModelRegistry / Moneta
              |
              | immutable artifact reference only
              v
PT7 operational model registry
              |
PT6 governed snapshot -> reproducible job manifest -> external/PT8 trainer
              |                               |
              |                               v
              |                       immutable job receipt
              |                               |
              +-------------------------------+
                              |
                              v
                       CANDIDATE registry entry
                              |
                   signed human-reviewed manifest
                              v
                    SHADOW -> CANARY -> PRODUCTION
                                           |
                                           +-> exact ROLLBACK
```

PT7 does **not** become analytical authority, representation authority, gesture-label authority, FitnessModel scoring authority, consent authority, or an automatic model-promotion authority.

## Promotion policy contract

A model may enter the operational registry only when a reproducible job receipt proves:

- exact immutable training dataset/snapshot identity;
- exact feature schema;
- exact source commit and training-code artifact;
- exact trainer entrypoint;
- exact environment/container artifact;
- exact config and random seed;
- exact runtime baseline;
- exact holdout policy;
- successful immutable model and evaluation outputs.

Deployment requires a signed operator manifest. The signing key id is itself inside the signed/digested content.

Lifecycle requirements:

- **CANDIDATE:** registered immutable lineage only; no runtime distribution evidence may be recorded.
- **SHADOW:** signed operator review; 0% user traffic. Review must cite the held-out report and applicable known-answer/failure/stability evidence.
- **CANARY:** must chain the exact shadow manifest; bounded non-zero rollout below 100%; human review remains authoritative.
- **PRODUCTION:** must chain the exact canary manifest; 100% active deployment; any prior production model becomes retained rollback history rather than being silently overwritten.
- **ROLLBACK:** must bind the exact current production deployment, the failed model artifact and a previously production-qualified rollback target.

Model-specific quality policy remains explicit and versioned. PT7 does not invent one universal metric threshold. Gesture evaluation must preserve abstention/coverage semantics; Moneta evaluation must preserve its group-disjoint statistical evidence. Known-failure and stability evidence are review obligations, not permission for a generic scalar score to auto-promote.

## Falsifiers

PT7 is not complete if any of these are possible:

- one logical artifact id/version is rebound to different bytes;
- content-addressed storage treats identical bytes under separate legitimate logical aliases as corruption;
- a runtime registry entry omits or silently reinterprets a runtime component;
- Research Mode permits undeclared adaptive mutation;
- a training receipt claims a runner environment different from its frozen manifest;
- a model registry entry points to a model other than the exact training output;
- FitnessModel or gesture parameters are redefined inside the operational registry;
- a deployment manifest can be altered after signing without refusal;
- a deployment can skip shadow/canary sequencing;
- a stale deployment manifest can be replayed;
- rollback can target a model that was never production-qualified;
- runtime observability accepts user/profile/session identifiers;
- a model can become production solely because a metric threshold passed without operator authority.

## Intentional non-goals

- no PT8 Python gesture-training implementation;
- no automatic retraining scheduler;
- no cloud/vendor-specific object store, queue or model service;
- no deployed learning service claim;
- no automatic canary traffic router;
- no new Moneta/FitnessModel scoring semantics;
- no claim that any trained model is scientifically or product-quality validated;
- no production promotion triggered from telemetry.

## Promotion condition

ADOPT only after focused PT7 tests plus exact-head Node 24, CodeQL, approval and all required CI gates are green, with no unresolved adversarial blocker. PT8 may begin only after that promotion.
