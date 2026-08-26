# ADR-0002: Runtime-local handles and durable identity

**Status:** Accepted  
**Date:** 2026-08-26  
**Supersedes:** none  
**Superseded by:** none

## Context

Nemosyne may host more than one WASM runtime, including a main-thread runtime and analytical Workers. Integer dataset handles are allocator/runtime-local. Treating a handle created by one runtime as meaningful in another can address unrelated data or fail unpredictably. Investigations also need identity that survives runtime restart, Worker replacement, save/export, and replay.

## Decision

A WASM handle is a runtime-local capability only. It must never be used as durable or cross-runtime dataset identity.

Cross-runtime registration and verification use stable dataset/output fingerprints plus explicit registration/transfer protocols. Generation/version fences protect asynchronous results from stale runtime or dataset state. Durable investigation/provenance identity records fingerprints and versioned semantics, not process-local handles.

## Consequences

- Workers load/register data in their own WASM runtime and retain their own handles.
- Main-thread handles are not serialized as authoritative cross-runtime identifiers.
- Async results must prove the input/generation they belong to before commit.
- Runtime replacement does not change the durable identity model.
- Transport optimizations may reduce copying, but cannot collapse runtime-local capability and durable identity into the same field.
