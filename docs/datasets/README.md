# Datasets

Place the frozen, versioned dataset file(s) referenced by `tasks.json` here (e.g.
`fraud-transactions-v1.json`). The same file must be used, unmodified, across both
conditions (2D / VR) — a per-condition "equivalent" dataset is not
acceptable; it reintroduces exactly the confound the canonical 2D control exists to
eliminate (Stable Release roadmap, Gate 5).

Record the dataset's version/hash in `version.json`'s `datasetVersion` field once frozen.
