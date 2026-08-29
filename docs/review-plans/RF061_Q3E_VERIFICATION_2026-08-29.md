# RF-061 Q3E verification rerun — 29 August 2026

**Purpose:** trigger a fresh governed Q3E production-browser measurement after RF-061 refusal-settlement fix-forward and RF-062A landing.

**Measurement baseline:** `main` at `d1132d998dacc076120d0d8124d308c6b54af113`.

This branch was reset to that exact `main` commit before this marker was added. The marker is documentation-only; runtime, test, build, WASM, TypeScript and workflow source are unchanged from the stated baseline. The Q3E artifact must pin the measured production bundle and WASM identities and is the authoritative evidence for the rerun.

## Required falsification

For the deterministic compact-sort path at 1k, 8k and 32k rows:

- exactly one dataset-version increment;
- exactly one derived generation requested;
- zero generic derived failures;
- zero deterministic stale settlements;
- no duplicate/coalesced schedule that hides work;
- at most one Worker registration for the derived generation;
- supported work completes with authoritative structures;
- unsupported work terminates only as an explicit governed `refused` outcome with no fabricated structures;
- controller and eventual derived-settlement timings remain visible separately.

The result will be recorded here and in the parent RF-061 review plan before promotion is claimed.
