# P1-PT4 STOP Review — Governed Product Data Vertical Slice

Date: 2026-09-03  
Status: VERIFIED COMPLETE / STOP  
Integration base reviewed: `main@bf262fe5e6a8d2f331f18be3c2da4fef07b783c3`

## Decision

**STOP PT4 and advance the forward implementation stream to PT5.**

PT4's bounded mission was to build the first authenticated, consent-aware ingestion/storage/export/erasure vertical slice with observability and to turn the temporary persistence proof into a coherent production persistence boundary. That mission is complete for the selected first Product Mode family and the exact claim boundary below.

This review does **not** declare production operations, high availability, backup/restore, physical-media erasure, broad product telemetry, research collection or all future event families complete.

## Production path reviewed

The selected first-family path is:

```text
browser Product Mode configuration
  -> OIDC Authorization Code + PKCE S256
  -> memory-only bearer credential
  -> successful post-commit OPERATION_APPLIED
  -> closed product.operation-applied.v1 projection
  -> one-use capture authorization
  -> runtime/provenance-bound governed envelope
  -> bounded in-memory queue
  -> authenticated NDJSON ingestion
  -> consent/capture/replay/sequence transaction
  -> PostgreSQL durable authority
  -> retention / export / registered-service erasure
```

The client and server durability boundaries are now intentionally separate:

```text
Browser durable product state: nemosyne-client IndexedDB
Server governed Product Mode state: PostgreSQL
Analytical authority: Rust/WASM
Portable investigation artifact: .nemosyne
```

## Exit criteria and evidence

### 1. Authenticated consent-aware collection

Verified through the PT4B2–B4 consent/data-plane/OIDC tranches and the PT4B8 browser producer. Product Mode authentication is separate from consent authorization. Browser authentication uses Authorization Code + PKCE S256; bearer credentials remain memory-only.

### 2. First governed event family and real producer

`product.operation-applied.v1` is a closed first family emitted only from successful production `OPERATION_APPLIED` outcomes. The producer projects only the governed operation token and does not leak investigation, discovery or dataset identity into the first-family payload.

### 3. Bounded ingestion and replay/sequence authority

The NDJSON ingestion surface applies request/resource bounds, exact framing, authenticated principal limits, one-use capture authorization, consent/pseudonym binding, stream sequencing and duplicate/conflict semantics before durable acceptance. Event insertion, stream advancement and capture consumption share the governed transaction boundary.

### 4. Runtime provenance pinning

The server independently pins reviewed application-build, deployment-configuration and UI-treatment coordinates rather than trusting arbitrary client assertions. Platform-runtime remains an authenticated client claim within the reviewed structural/version boundary rather than being falsely described as remote attestation.

### 5. Lifecycle, export and registered-service erasure

PT4B7 implements retention readiness/execution, bounded product-analytics export and registered-service erasure with durable idempotency and explicit lifecycle dispositions. Claims stop at service-controlled data; local/offline/downloaded artifacts and physical media remain outside the erasure claim.

### 6. Production persistence architecture

RFC 0005 is implemented for the PT4 boundary:

- PostgreSQL is the canonical production server persistence authority behind async-capable ports and one migration authority;
- production composition has no silent SQLite fallback;
- server consent/capture, credential-session revocation, governed-event stream/replay and lifecycle state use the PostgreSQL production boundary;
- SQLite is compatibility/test-only;
- one `nemosyne-client` IndexedDB database is the canonical browser durable application authority;
- legacy client stores and `localStorage` application state migrate one-way behind a versioned migration authority;
- bearer credentials and the governed-event queue remain non-persistent.

ADR-0005 records this durable architecture.

### 7. Adversarial and exact-head promotion evidence

Each material tranche underwent pre/post adversarial review and fix-forward. The final PT4B9C head passed the repository's required exact-head promotion set, including static analysis, Rust, production build, all coverage shards and aggregate thresholds, Chromium production and collaboration-recovery smoke, architecture policy, CodeQL, Q8, UV0, Q9 and approval before merge.

## STOP-review attacks

### Attack: Are we calling a protocol fake a live managed PostgreSQL deployment?

**No.** PT4B9B explicitly separates behavioral adapter/production composition evidence from live managed-cluster qualification. The latter remains later deployment/assurance evidence.

### Attack: Does PostgreSQL now become a scientific or dataset authority?

**No.** Rust/WASM remains the sole analytical and scale-sensitive authority. PostgreSQL persists governed product/service state; it does not become a hidden analytical implementation or default source-dataset cache.

### Attack: Did browser convergence make IndexedDB a second analytical authority?

**No.** `nemosyne-client` owns durable application state only. Analytical state remains governed by Rust/WASM and portable investigation semantics remain separate.

### Attack: Can production silently fall back to SQLite or another browser database?

**No for the reviewed production composition.** SQLite is compatibility/test-only, and RFC 0005 forbids silent production fallback. The browser production path converges on `nemosyne-client` with explicit no-persistence/storage-unavailable behavior rather than inventing another durable authority.

### Attack: Does erasure mean every copy is physically gone?

**No.** Registered-service erasure is bounded and explicit. Provider backups/replicas/snapshots, physical media, local/offline state and downloaded artifacts are not claimed erased by PT4.

### Attack: Is broad observability leaking governed content?

**No by contract.** PT4 observability is bounded to counts, latency buckets and typed refusal/disposition codes and excludes tokens, raw identities, pseudonyms, event bodies and user content.

## Residual work, explicitly re-scoped

The following remain important but do not keep PT4 open:

1. **Managed PostgreSQL qualification:** live driver/pool deployment evidence, failover, backup/restore, point-in-time recovery, health monitoring and real-server crash/fault injection.
2. **Provider/physical erasure policy:** backups, replicas, snapshots and storage-media lifecycle.
3. **Operational deployment:** secrets/role separation, production TLS termination, deployment manifests, alerting and capacity/cost evidence at the selected preview environment.
4. **Compatibility retirement:** remaining SQLite compatibility code may be removed when its reference value no longer justifies maintenance; duplicated deletion-handle framing should disappear with that retirement or be consolidated atomically with parity vectors.
5. **Future governed families:** gesture learning, Moneta judgement/discovery evidence and formal-study collection require their own scoped contracts/consent and must not inherit first-family assumptions automatically.
6. **Local artifact boundary:** `.nemosyne`, downloaded exports and device-local content need their own user-facing lifecycle/backup/sync semantics where product scope requires them.

These belong to PT5+ product/preview qualification, PT6+ learning collection, cross-cutting assurance or production-operations tranches. They must not be relabelled as already complete.

## Disposition

**VERIFIED COMPLETE / STOP for PT4's selected governed Product Mode vertical slice.**

The forward stream should now start PT5: integrate ordinary catalogue/data loading into the product and make the canonical Notice -> Question -> Hypothesis -> Investigation -> Understanding -> Validation -> Discovery workflow usable and observable in XR/desktop through NIL, with repeated live UX refinement and without reopening PT4 architecture unless a new finding crosses its frozen contract.
