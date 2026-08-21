# Pairwise Feature Snapshot Ledger

The pairwise feature snapshot ledger is an append-only store for the frozen candidate feature vectors captured at researcher judgement time.

Each snapshot is keyed by dataset fingerprint, RepresentationGraph ID, and FitnessModel version. Duplicate evidence is rejected, schema and provenance are validated on append, and restore is staged before live state is replaced.

The ledger is deliberately storage-only. It does not interpret researcher preference, train a model, or alter Moneta policy.
