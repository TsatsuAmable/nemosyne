# P1-W1a production collaboration signalling — 2026-09-04

**Base:** `main@93f4595b3b83e0b949b87acc02f64ee2609133cb`  
**Branch:** `fix/p1w1-production-signalling`  
**Owner:** RF-054 / P1-W production service wiring

## Invariant

A production browser must never infer that the static web origin also hosts Nemosyne signalling, must never embed the signalling HMAC authority, and must never report a one-use signed-ticket connection as established merely because the WebSocket transport opened.

Collaboration is production-discoverable only when the browser is deliberately configured with a secure signalling endpoint, admission can be provisioned through an operator/server boundary, and that endpoint is backed by a fail-closed, health-checkable service runtime.

Development may retain the Vite `/__signal` convenience endpoint, but no development transport or credential shortcut may silently become the production default.

## Production authority

```text
operator
  -> npm run collaboration:invite
    -> src/network/server.ts
      -> canonical SignedTicket.ts HMAC authority
        -> HTTPS invite fragment (opaque one-use ticket + room)

production browser
  -> consumeCollaborationInvite() at boot
    -> session-only ticket + scoped room
  -> VITE_NEMOSYNE_SIGNALLING_URL=wss://.../__signal
    -> CollaborationCoordinator
      -> NetworkManager
        -> SignallingChannel
          -> standalone SignallingServer.mjs
            -> SignallingServerCore
              -> canonical SignedTicket verification + replay guard
            -> admitted acknowledgement after core acceptance
```

The Vite signalling plugin remains development-only and is not production evidence. Ticket signing remains outside the browser-reachable `src` graph.

## Changes

- Added `SignallingRuntimeConfig.ts` as the browser endpoint configuration authority.
- Production has no same-origin fallback. Missing production configuration makes collaboration explicitly unavailable and constructs no network client.
- Production endpoint validation requires `wss:` and rejects URL credentials, query strings and fragments.
- Added an 8-second initial connection/admission bound.
- Refactored the standalone signalling executable into an importable/testable service runtime with Production as the default profile, fail-closed security diagnostics, strict `/__signal`, `/healthz`, `/readyz`, heartbeat/idle cleanup and graceful shutdown.
- Added `npm run start:signalling` and `deploy/signalling/Dockerfile`.
- Added operator command `npm run collaboration:invite` for short-lived participant tickets signed through the canonical server authority.
- Added browser-safe `CollaborationInvite.ts` to consume ticket + room from URL fragments, strip the fragment immediately, and stage the invite in session storage only.
- Invite-scoped room selection now precedes persisted room settings unless the caller explicitly supplies a room.
- Signed-ticket `SignallingChannel.connect()` now waits for post-admission acknowledgement rather than equating raw WebSocket open with successful collaboration admission.
- Signed-ticket rejection, missing renewal credentials and renewal callback errors are terminal for that automatic connection generation; one-use tickets are not replayed.
- Added real two-peer WebSocket service evidence and consumed-ticket replay rejection.
- Updated the production capability inventory so service and browser client remain distinct capabilities.

## Adversarial review questions

1. Can an ordinary production build still dial same-origin `/__signal` without explicit configuration?
2. Can an insecure `ws:` or credential-bearing signalling endpoint enter a production bundle?
3. Does any browser-reachable source import `SignedTicket.ts`, `SignallingServerCore.ts` or Node crypto authority?
4. Can a production participant obtain admission without embedding the signing secret in the browser bundle?
5. Can an invite credential enter ordinary HTTP/proxy request logs through a query parameter?
6. Can raw WebSocket `open` be mistaken for successful signed-ticket admission?
7. Can an invalid, replayed, or already-consumed ticket create an automatic reconnect storm?
8. Can a client spoof its peer identity in a relayed signalling message?
9. Can the standalone service silently start in an unsafe profile or without origin enforcement?
10. Does the Docker contract imply multi-replica replay safety that the registry-local nonce guard cannot provide?
11. Are repository runtime tests being confused with actual deployed-service evidence?

## Falsifying evidence

- Production with no `VITE_NEMOSYNE_SIGNALLING_URL` returns no config and records explicit collaboration unavailability without constructing `NetworkManager`.
- Production `ws:` and URL-carried signalling endpoint credentials/query parameters are rejected.
- The architecture policy rejects browser-reachable imports of the signed-ticket/server authority. It caught an initial misplaced invite issuer under `src/network`; the issuer was moved to the operator script boundary instead of weakening policy.
- Invite tests prove an HTTPS fragment-only ticket/room, canonical ticket verification, immediate fragment stripping, and stale-credential clearing on malformed replacement invites.
- Signed-ticket reconnect tests prove raw transport open is insufficient, admission is required, and terminal credential failures do not schedule retries.
- A configured ephemeral Production service returns `200` from `/healthz` and `/readyz`.
- The real service test admits two independent signed-ticket peers, relays an offer with the socket-bound peer identity rather than the message-supplied spoofed identity, and rejects second use of a consumed ticket with close code `4001`.

## Non-goals / remaining RF-054 work

- No hosting provider is invented by this PR.
- No claim is made that Netlify static hosting supplies WebSocket signalling.
- No multi-replica deployment is qualified until a shared atomic signed-ticket nonce store exists.
- Invite issuance is participant-only in this tranche; observer invite UX is not claimed.
- No ticket-renewal broker is introduced. A lost connection after one-use ticket admission requires a fresh invite until such a broker exists.
- No redesign of WebRTC media/data-channel semantics or room role ontology.
- No closure of live-ingest `/__demo-stream`; that is the next service-topology sub-tranche.
- RF-054 remains **IMPLEMENTATION LANDED / DEPLOYMENT EVIDENCE OPEN** until a clean production bundle joins a room through the actually deployed `wss://` endpoint and exercises the collaboration/security falsifiers there.

## Promotion contract

Before merge:

1. inspect the full diff for browser/server boundary leakage and unrelated changes;
2. fix all deterministic CI/type/lint/test failures rather than retrying them away;
3. require exact-head fast tests, aggregate CI, architecture policy, CodeQL, production build/Chromium smoke, Q8/Q9, UV0 and approval gate;
4. require clean review threads;
5. re-check remote `main` immediately before merge;
6. any head movement revokes previous promotion evidence.
