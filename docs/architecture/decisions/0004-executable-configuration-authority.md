# ADR-0004: Executable configuration is authoritative for machine facts

**Status:** Accepted  
**Date:** 2026-08-26  
**Supersedes:** none  
**Superseded by:** none

## Context

Agent and developer documentation had begun duplicating dependency versions, coverage thresholds, CI ordering, test counts, and other facts already encoded in executable configuration. Those copies drifted and could instruct an automated contributor to make incorrect changes with high confidence.

## Decision

Machine-readable/executable configuration is the sole authority for facts it directly defines, including package versions, scripts, toolchain versions, CI topology, coverage thresholds, and build/test configuration.

Human and agent documentation should link to the executable source instead of duplicating values unless a frozen historical measurement is explicitly labeled as such. Documentation authority and lifecycle are checked by `docs/DOCS_MANIFEST.json` and `npm run docs:check`.

## Consequences

- Agent adapters remain small and defer to `AGENTS.md` plus executable configuration.
- Historical metrics belong in archived or clearly dated evidence documents.
- CI/doc checks can detect common stale-instruction patterns.
- Updating a threshold or dependency should not require hunting through several prose files.
