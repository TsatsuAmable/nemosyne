# ADR-0003: Production-path evidence

**Status:** Accepted  
**Date:** 2026-08-26  
**Supersedes:** none  
**Superseded by:** none

## Context

Nemosyne repeatedly accumulated well-designed helpers and unit tests whose behavior was not wired into the production path they purported to protect. This can produce green tests while security, scientific, recovery, persistence, concurrency, or UX properties remain unenforced at runtime.

## Decision

A product property is not considered landed merely because an isolated helper, mock, module, or unit test demonstrates it. When a property governs a production path, acceptance evidence must exercise the real production entry point and the authoritative call graph or boundary responsible for enforcing it.

Unit tests remain required where useful. They establish local correctness but do not transfer authority to a production path that does not call the tested implementation.

## Consequences

- Security tests start at attacker-controlled ingress/admission paths.
- Worker/WASM claims require real Worker/runtime boundary evidence where the claim concerns that boundary.
- UX completion requires browser/XR product-path evidence rather than only controller-class tests.
- Persistence/replay claims must pass through actual serialization and reload paths.
- Reviewers inspect call graphs and wiring, not only the existence of hardened modules.
- Completion vocabulary distinguishes code landed from independently verified behavior.
