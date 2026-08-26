# ADR-0001: Rust/WASM analytical authority

**Status:** Accepted  
**Date:** 2026-08-26  
**Supersedes:** none  
**Superseded by:** none

## Context

Nemosyne previously carried analytical behavior across JavaScript/TypeScript and Rust, creating semantic drift, duplicated scale-sensitive work, and ambiguity about which result was authoritative. The product also needs analytical behavior to remain deterministic, inspectable, and viable on large datasets without blocking the XR presentation layer.

## Decision

Rust/WASM is the sole authority for canonical analytical data, N-dependent analysis, statistics, topology, clustering, scientific evidence, and scale-sensitive data-derived reduction/layout computation.

TypeScript owns orchestration, interaction, rendering/presentation, persistence adapters, scheduling, and bounded transformation of authoritative analytical payloads into UI/Three.js structures. It must not maintain an independent analytical implementation or silent analytical fallback.

When the kernel cannot execute an operation safely or within a governed resource envelope, the system exposes an explicit unavailable/refused/unsupported state rather than substituting a plausible JavaScript result.

## Consequences

- Analytical semantics have one implementation authority.
- Cross-language tests validate transport/contracts rather than maintaining two algorithms for parity.
- Large-data and scientific changes normally begin in Rust.
- TypeScript loops are acceptable for bounded presentation/orchestration work, but not as hidden dataset-wide analytical reductions.
- Kernel unavailability and governed refusal are product states that need user-visible handling and provenance where applicable.
