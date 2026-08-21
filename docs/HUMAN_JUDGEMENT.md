# Human Judgement Module

## Purpose

The V3 Human Judgement module records attributable researcher evidence about representation quality without applying that evidence as a learned model or automatic policy.

The public contract is `RepresentationJudgement`, with five evidence kinds:

- pairwise representation preference;
- absolute representation rating;
- explicit weight adjustment proposal/application;
- alternative rejection with reason codes;
- linkage between a representation and a DiscoveryEpisode validation outcome.

Every event carries dataset, kernel, Moneta, FitnessModel, Representation Ontology, NIL, representation-graph, and optional study/discovery provenance.

## Ledger semantics

`JudgementLedger` is append-only. Judgement IDs are unique and each investigation has a deterministic contiguous sequence. Corrections are represented as new events rather than edits or deletions. Restore is staged and atomic, so malformed history cannot partially replace a valid ledger.

## Research boundary

This module does not train, fit, rank, or alter Moneta. It creates the trustworthy evidence substrate required before Fitness Learning is permitted. In particular, a `WEIGHT_ADJUSTMENT` event records what a researcher proposed or explicitly applied; recording it does not cause an automatic weight mutation.

Learning infrastructure must consume a curated/exported judgement dataset in a later wave with explicit train/validation/holdout discipline and model provenance.
