# nemosyne-data qualification corpus connector

Nemosyne uses `GitHubCorpusConnector` as a **read-only acquisition/catalog boundary** for `TsatsuAmable/nemosyne-data`. It is deliberately separate from `DataConnector`, whose live-source contract normalizes updates into JavaScript row objects. Qualification artifacts can contain millions of rows, so the corpus connector preserves raw bytes and delegates parsing/typed ingest to the existing Rust/WASM analytical authority.

## Trust model

The default catalog is:

`https://raw.githubusercontent.com/TsatsuAmable/nemosyne-data/main/manifests/catalog.json`

For frozen qualification campaigns, prefer an immutable release catalog URL through the connector's `catalogUrl` option. The connector fails closed when:

- catalog schema or repository identity does not match the configured corpus;
- a dataset/tier/role is not materialized;
- an artifact path traverses outside the repository;
- a manifest points at an arbitrary non-GitHub host or another repository;
- the declared or received artifact exceeds the configured byte ceiling;
- byte count or SHA-256 differs from the catalog;
- a compressed archive is presented as if it were directly ingestible;
- NTC1 is requested but the kernel does not expose typed-column ingest.

GitHub release redirects to `objects.githubusercontent.com` are accepted only after the initial manifest URL has already been constrained to a release path in the configured repository.

## Authority boundary

`loadIntoKernel()` dispatches verified bytes as follows:

- CSV → `AnalyticalKernelPort.loadCsv()`
- JSON → `AnalyticalKernelPort.loadJson()`
- NTC1 → `AnalyticalKernelPort.loadTypedColumns()`

The connector never parses large CSVs into `Record<string, unknown>[]`, never derives analytical facts, and never supplies a JavaScript approximation when the corpus or kernel is unavailable.

## Quest usage

Use the catalog's exact `corpusVersion`, dataset ID, tier, role and SHA-256 in telemetry. A result that cannot identify the exact corpus artifact is not reproducible qualification evidence.

The default 512 MiB artifact ceiling is intentionally conservative. Raising it should be an explicit qualification decision tied to expected Quest memory behavior rather than a way to make an oversized test happen accidentally.
