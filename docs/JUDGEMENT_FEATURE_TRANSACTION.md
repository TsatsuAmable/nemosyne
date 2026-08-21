# Judgement + Feature Evidence Transaction

## Purpose

Pairwise learning is only reproducible when the researcher judgement and the exact Moneta candidate features shown at that moment are preserved together.

`JudgementFeatureTransaction` coordinates the existing `AnalystJudgementController` with an append-only `PairwiseFeatureSnapshotLedger`.

## Atomicity

Before recording a pairwise judgement, the transaction:

1. captures candidate feature snapshots from the exact `RepresentationDecision`;
2. snapshots both append-only ledgers;
3. appends the candidate feature batch;
4. appends the human judgement;
5. restores both ledgers to their previous snapshots if either append fails.

This prevents orphan judgements and orphan feature evidence.

## Boundaries

The transaction does not train, promote, activate, or mutate a FitnessModel. It only makes the evidence join durable and auditable.
