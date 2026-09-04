# P1-W1a production collaboration signalling — 2026-09-04

**Base:** `main@93f4595b3b83e0b949b87acc02f64ee2609133cb`  
**Branch:** `fix/p1w1-production-signalling`  
**Owner:** RF-054 / P1-W production service wiring

## Invariant

A production browser must never infer that the static web origin also hosts Nemosyne signalling. Collaboration is production-discoverable only when the browser is deliberately configured with a secure signalling endpoint and that endpoint is backed by a fail-closed, health-checkable service runtime.

Development may retain the Vite `/__signal` convenience endpoint, but no development transport may silently become the production default.

## Production authority

The intended path after this tranche is:

```text
production build
  -> VITE_NEMOSYNE_SIGNALLING_URL=wss://.../__signal
    -> CollaborationCoordinator
      -> NetworkManager
        -> SignallingChannel
          -> standalone SignallingServer.mjs
            -> SignallingServerCore
              -> canonical SignedTicket admission authority
```

The Vite signalling plugin remains development-only and is not production evidence.

## Changes

- Added `SignallingRuntimeConfig.ts` as the browser endpoint configuration authority.
- Production has no same-origin fallback. Missing production configuration makes collaboration explicitly unavailable and constructs no network client.
- Production endpoint validation requires `wss:` and rejects URL credentials, query strings and fragments.
- Added an 8-second initial WebSocket establishment bound while retaining the existing exponential reconnect policy.
- Refactored the standalone signalling executable into an importable/testable service runtime with:
  - Production as the default security profile;
  - fail-closed security-diagnostic startup;
  - strict `/__signal` WebSocket upgrade path;
  - `GET /healthz` liveness;
  - `GET /readyz` security-aware readiness;
  - heartbeat/idle-room cleanup;
  - graceful `SIGTERM` / `SIGINT` shutdown.
- Added `npm run start:signalling` and `deploy/signalling/Dockerfile`.
- Added production deployment documentation including the single-replica signed-ticket replay boundary.
- Added fast-lane falsifiers for browser config, unavailable product behavior, real service readiness and stalled-connection timeout/retry.
- Updated the production capability registry so the signalling service is inventoried separately from the browser collaboration client.

## Adversarial review questions

1. Can an ordinary production build still dial same-origin `/__signal` without explicit configuration?
2. Can an insecure `ws:` or credential-bearing signalling URL enter a production bundle?
3. Can the standalone service silently start in an open/research profile when production configuration is incomplete?
4. Does readiness distinguish a process that is alive from a service whose security configuration is safe?
5. Can a stalled initial WebSocket leave the product waiting indefinitely?
6. Did the change create a second ticket/admission authority instead of preserving `SignallingServerCore` / `SignedTicket.ts`?
7. Does the Docker contract accidentally imply multi-replica replay safety that the registry-local nonce guard cannot provide?
8. Are repository runtime tests being confused with actual deployed-service evidence?

## Falsifying evidence

- Production with no `VITE_NEMOSYNE_SIGNALLING_URL` returns no config and `CollaborationCoordinator.joinCollaborationRoom` records explicit unavailable state without constructing `NetworkManager`.
- Production `ws:` and URL-carried credentials/query parameters are rejected.
- Standalone service defaults to Production and refuses unsafe missing-auth/origin configuration.
- A configured ephemeral Production service returns `200` from `/healthz` and `/readyz`; unknown routes return `404`.
- A stalled fake WebSocket fails the initial connect promise after the bounded timeout and enters the existing reconnect schedule.

## Non-goals / remaining RF-054 work

- No hosting provider is invented by this PR.
- No claim is made that Netlify static hosting supplies WebSocket signalling.
- No multi-replica deployment is qualified until a shared atomic signed-ticket nonce store exists.
- No redesign of WebRTC media/data-channel semantics or room role ontology.
- No closure of live-ingest `/__demo-stream`; that is the next service-topology sub-tranche.
- RF-054 remains **IMPLEMENTATION LANDED / DEPLOYMENT EVIDENCE OPEN** until a clean production bundle joins a room through the actually deployed `wss://` endpoint and exercises the required collaboration/security falsifiers.

## Promotion contract

Before merge:

1. inspect the full diff for browser/server boundary leakage and unrelated changes;
2. fix all deterministic CI/type/lint/test failures;
3. require exact-head fast tests, aggregate CI, architecture policy, CodeQL, Q8/Q9 and approval gate;
4. require clean review threads;
5. re-check remote `main` immediately before merge.
