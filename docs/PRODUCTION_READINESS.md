# Production readiness

> Generated from `governance/production-capabilities.json` and `governance/production-readiness.json`.
> `docs/ROADMAP.md` remains the canonical implementation-status and sequencing authority. This page makes service and verification debt discoverable without promoting repository evidence into deployment evidence.

## Deployment policy

- **State:** DEFERRED_BY_OWNER
- **Effective:** 2026-09-05
- **Blocks forward development:** no
- **Reason:** Production deployments are intentionally deferred while implementation, repository verification and product-transition work continue up to the deployment boundary.

## Service inventory

| Service | Plane(s) | Target | Implementation | Deployment | Verification | Roadmap |
| --- | --- | --- | --- | --- | --- | --- |
| governance-service | product, data | RUNNABLE_AND_DEPLOYABLE | IMPLEMENTATION_INCOMPLETE | DEFERRED_BY_POLICY | REPOSITORY_PARTIAL | PT4, P1-W |
| collaboration-signalling-service | realtime | RUNNABLE_AND_DEPLOYABLE | READY_TO_DEPLOY | DEFERRED_BY_POLICY | REPOSITORY_VERIFIED | RF-054, P1-W1 |
| production-live-source-contract | data | CONFIGURABLE_EXTERNAL_SOURCE | CLIENT_READY | DEFERRED_BY_POLICY | REPOSITORY_PARTIAL | RF-054, P1-W |
| learning-plane-jobs | learning | REPRODUCIBLE_GOVERNED_JOBS | REGISTRY_AND_JOB_CONTRACTS_READY | NOT_REQUIRED_YET | REPOSITORY_PARTIAL | PT6, PT7, PT8, PT9 |

### governance-service

Product-intended PostgreSQL/OIDC governance substrate for authenticated, consent-aware ingestion, durable storage, export and erasure. The browser client exists, but the repository still lacks a runnable service entry point and end-to-end service evidence.

**Sources:** `src/governance-service`

**Capability refs:** `product-analytics-browser-client`

**Verification obligations:** `RDO-001`, `RDO-002`, `RDO-003`

### collaboration-signalling-service

Fail-closed signalling runtime with readiness surface, container contract and operator-issued one-use signed collaboration invites. Repository tests cover real two-peer service admission and replay rejection; deployed wss:// evidence is intentionally deferred.

**Sources:** `src/network/SignallingServer.mjs`, `src/network/SignallingServerCore.ts`, `src/network/SignedTicket.ts`

**Capability refs:** `collaboration-client`, `collaboration-signalling-service`

**Verification obligations:** `RDO-004`, `RDO-005`, `RDO-006`, `RDO-007`

### production-live-source-contract

Production live ingest is a configured external-source contract. The bundled /__demo-stream server is a development fixture and is not itself a required production deployable.

**Sources:** `src/vr/coordinators/LiveStreamCoordinator.ts`, `src/data/connectors/WebSocketAdapter.ts`, `src/data/connectors/PollingAdapter.ts`

**Capability refs:** `live-ingest`

**Verification obligations:** `RDO-008`, `RDO-009`, `RDO-010`

### learning-plane-jobs

PT6/PT7 now provide governed user-disjoint snapshots, held-out evaluation artifacts, content-addressed learning artifacts, exact runtime/model registry lineage, reproducible job manifests/receipts, signed staged deployment manifests and rollback metadata. PT8/PT9 still own concrete model-update loops and model-specific qualification evidence; no deployed learning service is claimed.

**Sources:** `src/learning`, `src/fitness`, `src/judgement`

**Capability refs:** `learned-fitness-training`

**Verification obligations:** `RDO-011`, `RDO-012`, `RDO-013`

## Verification obligations

| ID | Service | Kind | State | Evidence / expected evidence | Closure contract |
| --- | --- | --- | --- | --- | --- |
| RDO-001 | governance-service | AUTOMATED | MISSING | expected: `tests/p1w-governance-service-runtime.test.ts` | Add a runnable repository service entry point with fail-closed configuration plus health/readiness coverage exercised through a real process boundary. |
| RDO-002 | governance-service | AUTOMATED | MISSING | expected: `tests/p1w-governance-service-lifecycle.test.ts` | Exercise authenticated consent-aware ingestion, durable storage, export, revoke-future-collection and applicable erasure through the runnable service boundary. |
| RDO-003 | governance-service | EXTERNAL_SERVICE | DEFERRED_BY_POLICY | — | Against an actually deployed service, run the clean production browser journey and verify authentication, consent, ingestion, export and erasure without upgrading local or repository evidence into deployment proof. |
| RDO-004 | collaboration-signalling-service | AUTOMATED | GREEN | `tests/p1w1-signalling-service-runtime.test.ts` | Keep real service startup, health/readiness, signed-ticket admission and bounded failure semantics green. |
| RDO-005 | collaboration-signalling-service | AUTOMATED | GREEN | `tests/p1w1-collaboration-invite.test.ts`, `tests/signalling-reconnect-ticket.test.ts` | Keep operator-issued invite consumption, server-bound peer identity and consumed-ticket replay rejection green. |
| RDO-006 | collaboration-signalling-service | EXTERNAL_SERVICE | DEFERRED_BY_POLICY | — | Run a clean production bundle through the actually deployed wss:// endpoint and capture RF-054 deployment evidence. |
| RDO-007 | collaboration-signalling-service | AUTOMATED | MISSING | expected: `tests/p1w-signalling-shared-nonce-store.test.ts` | Before enabling more than one signalling replica, introduce a shared atomic nonce store and prove one-use ticket replay safety across replicas. Single-replica operation does not require this obligation to be green. |
| RDO-008 | production-live-source-contract | AUTOMATED | GREEN | `tests/rf062f-feature-ports-production-path.test.ts` | Keep configured live-source adapters on the governed production path without silently depending on the bundled development stream. |
| RDO-009 | production-live-source-contract | MANUAL | GREEN | `dev/demo-stream-server.ts` | Keep /__demo-stream explicitly classified as a development fixture rather than a production service claim. This is a classification assertion, not an executable production-service test. |
| RDO-010 | production-live-source-contract | EXTERNAL_SERVICE | DEFERRED_BY_POLICY | — | When a real production live source is selected, exercise a clean configured source journey and capture endpoint, reconnect, parsing, bounded-ingest and failure evidence. |
| RDO-011 | learning-plane-jobs | AUTOMATED | GREEN | `tests/pt6d-gesture-training-snapshot-materialization.test.ts`, `tests/pt6d-gesture-evaluation-report.test.ts` | Keep immutable user-disjoint training snapshots and held-out evaluation artifacts bound to governed consent, label provenance and exact source identity. |
| RDO-012 | learning-plane-jobs | AUTOMATED | GREEN | `tests/pt7-runtime-model-registry.test.ts` | Keep exact artifact lineage, reproducible job inputs/receipts, runtime/model registry identity, signed staged deployment and rollback metadata fail-closed. |
| RDO-013 | learning-plane-jobs | MANUAL | GREEN | `docs/review-plans/P1_PT7_RUNTIME_MODEL_REGISTRY_2026-09-05.md`, `docs/review/P1_PT7_RUNTIME_MODEL_REGISTRY_POST_REVIEW_2026-09-05.md` | Keep the staged shadow/canary/production/rollback review contract explicit: model-specific held-out evidence, known-answer/failure/stability evidence, abstention/coverage where applicable, and signed human promotion authority remain prerequisites rather than an automatic scalar gate. |

## State semantics

- `GREEN` means the listed repository evidence currently exists; CI determines whether it still passes.
- `MISSING` means a required future check or artifact is deliberately named but not yet implemented.
- `DEFERRED_BY_POLICY` means closure requires a production/external boundary that the owner has intentionally deferred. It is not a pass.
- `NOT_REQUIRED_YET` means the service boundary is planned but deployment is not yet a selected product requirement.
- Repository evidence, simulator evidence, physical-device evidence and deployed-service evidence remain distinct evidence classes.

