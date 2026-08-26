# Quest 3S qualification corpus note

PERF-04 and physical Quest qualification should use versioned artifacts from `TsatsuAmable/nemosyne-data`, not ad-hoc local CSV files.

Each recorded run should identify the corpus version, dataset ID, tier, artifact role and SHA-256 alongside the Nemosyne commit/release. The corpus is intentionally mixed: real-world snapshots pressure realistic skew, missingness, graph density and scientific semantics; deterministic synthetic truth fixtures provide post-hoc correctness controls and a null dataset provides a negative control for chance-pattern discovery.

Large artifacts remain outside Nemosyne's Git history. `GitHubCorpusConnector` is the acquisition boundary and delegates verified CSV/JSON/NTC1 bytes to the existing Rust/WASM kernel loaders without JavaScript row rematerialisation.

See `docs/NEMOSYNE_DATA_CORPUS.md` for the connector trust model. Device qualification remains governed by `docs/QUEST_3S_TELEMETRY.md`; the corpus adds reproducible input identity rather than replacing the physical-headset evidence requirements.
