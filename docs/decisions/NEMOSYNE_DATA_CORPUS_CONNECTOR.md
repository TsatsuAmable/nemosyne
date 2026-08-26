# Nemosyne data corpus connector decision

**Status:** accepted for qualification-corpus integration

## Decision

Static qualification data is acquired through a read-only `GitHubCorpusConnector` rather than the live `DataConnector` abstraction.

## Rationale

The live connector contract normalizes external updates into JavaScript `Dataset` rows. That is appropriate for small streaming windows, but it is the wrong boundary for 100k–10M-row qualification artifacts because it would recreate the row-major JavaScript data path that the Rust/WASM data-plane migration removed.

The corpus connector therefore owns only catalog discovery, repository/path/host constraints, byte ceilings and SHA-256 verification. Verified bytes are handed to `AnalyticalKernelPort.loadCsv`, `loadJson`, or `loadTypedColumns` (NTC1). Rust/WASM remains the parsing and analytical authority.

## Consequences

- Corpus artifacts can be frozen independently of Nemosyne releases while remaining reproducibly identified.
- Qualification telemetry can cite exact corpus version/artifact hashes.
- Failure to fetch, verify or ingest a corpus asset fails closed; there is no live-source or JavaScript analytical fallback.
- Large corpus assets belong in immutable GitHub Releases, not Nemosyne Git history.
- Public repository access needs no browser-held GitHub token. Private corpus access would require a separately designed credential boundary and is outside this decision.
