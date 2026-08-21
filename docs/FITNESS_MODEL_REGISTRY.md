# Fitness Model Registry

The V3 Fitness Model Registry stores immutable, content-addressed model artifacts and an append-only activation history. Registration and activation are deliberately separate operations.

Every artifact records the training-dataset hash, curation-policy hash, feature-schema version, parameters, held-out evaluation summary, and optional parent model hash. Artifact hashes are deterministic over canonicalized content. Reusing the same semantic model ID/version with different content is rejected.

Promotion, rollback, and disable are explicit state transitions. Historical investigations can therefore pin an exact artifact hash while current runtime policy may move or roll back independently.

This module does not train a model and does not decide whether a candidate is empirically better. A later offline evaluation/training slice must produce the artifact and demonstrate benefit against the bootstrap heuristic before promotion is scientifically justified.
