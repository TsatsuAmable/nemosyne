# Judgement Curation and Partitioning

Wave 4 converts append-only `RepresentationJudgement` evidence into an auditable learning dataset without fitting or activating a model.

`JudgementDatasetBuilder` performs deterministic quality filtering with explicit exclusion reasons. Policies may require frozen study provenance and may restrict kernel, FitnessModel, and ontology versions. Evidence is never silently dropped.

Train, validation, and holdout assignment is deterministic from a declared partition seed. The partition key groups by both dataset fingerprint and researcher ID so repeated evidence from the same researcher on the same dataset cannot leak across evaluation boundaries.

This module does not train, rank, mutate Moneta weights, or promote a learned model. Its output is an evidence artifact for the later Fitness Learning pipeline.
