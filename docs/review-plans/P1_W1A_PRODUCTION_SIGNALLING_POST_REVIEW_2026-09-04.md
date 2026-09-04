# P1-W1a production collaboration signalling post-review — 2026-09-04

**Base:** `main@93f4595b3b83e0b949b87acc02f64ee2609133cb`  
**PR:** #653  
**Scope:** RF-054 / P1-W1a repository production signalling and private-preview admission

## Review disposition

**IMPLEMENTATION LANDED / DEPLOYMENT EVIDENCE OPEN**

The tranche now has a real repository production composition for collaboration signalling and a bounded private-preview admission path. It does **not** close RF-054 because the repository still has no evidence from an actually hosted `wss://` signalling deployment or a clean production browser journey against that deployment.

## Material findings and fix-forward

### 1. Dead production same-origin assumption

**Finding:** normal product composition previously inferred `/__signal` from the static site origin although the production static host does not provide that WebSocket service.

**Fix:** production requires `VITE_NEMOSYNE_SIGNALLING_URL`; development alone may derive the Vite endpoint. Missing production configuration is visibly unavailable and does not construct `NetworkManager`.

### 2. Runnable server was not sufficient without a credential producer

**Finding:** after the endpoint was made configurable, production collaboration could reach a fail-closed server but the browser had no production credential producer beyond an ad hoc `sessionStorage.nemosyne.collabToken` convention. Calling that path production-working would have been false.

**Fix:** the operator now issues short-lived participant invites using the canonical `SignedTicket.ts` authority through `src/network/server.ts`. The HMAC secret remains outside the browser bundle. The invite contains room + opaque ticket in the URL fragment, which the browser strips immediately and stages session-only.

### 3. Raw WebSocket open was being confused with admission

**Finding:** `SignallingChannel.connect()` previously resolved on raw transport open. A signed ticket could therefore be rejected by the server after the client had already reported collaboration connected.

**Fix:** canonical signed-ticket connections wait for an `admitted` service acknowledgement sent only after the synchronous `SignallingServerCore` listener has accepted the credential. Queue flush, `open`, connected state and invite cleanup occur only after that acknowledgement.

### 4. Replayed/invalid one-use credentials could enter retry behavior

**Finding:** transient reconnect logic is correct for reusable development transports but unsafe for a consumed signed ticket. A one-use ticket must not be replayed automatically or hammer the authentication throttle.

**Fix:** a successful signed-ticket connection requires a fresh credential for any later socket generation. Missing renewal, renewal callback failure, signed admission rejection and signed admission timeout are terminal for that automatic generation. The final ordering fix settles the intended terminal error before socket teardown so synchronous close implementations cannot overwrite it or accidentally reschedule reconnect.

### 5. Stale architectural text test blocked the new explicit config seam

**Finding:** `coordinator-consumer-contracts.test.ts` fossilized the exact old two-field constructor text rather than the consumer-owned options contract.

**Fix:** the test now permits the explicit `signallingConfig` seam and additionally asserts invite-room consumption remains owned by `CollaborationCoordinator` rather than moving back into `World`.

### 6. First invite issuer placement violated the server-only cryptographic island

**Finding:** an initial `src/network/CollaborationInviteIssuer.ts` imported `SignedTicket.ts`. Architecture policy correctly rejected it under `signed-ticket-authority-is-server-only`, despite the source comment claiming it was server-only.

**Fix:** the file was deleted. Ticket issuance now lives in `scripts/create-collaboration-invite.mjs`, outside the browser-reachable `src` graph, and imports the canonical authority through `src/network/server.ts`. The architecture rule was not weakened or exempted.

### 7. Health/readiness alone was weak service evidence

**Finding:** an HTTP-ready process did not prove the standalone WebSocket path could perform authenticated collaboration.

**Fix:** `tests/p1w1-signalling-service-runtime.test.ts` now starts the real ephemeral Production service, admits two independent `ws` clients with canonical one-use signed tickets, observes peer join, relays an offer while enforcing socket-bound peer identity, and requires a replayed consumed ticket to close with `4001`.

## Authority review

No second ticket verifier, replay guard or admission policy was introduced.

- **Signing/verifying authority:** canonical server-only `SignedTicket.ts`.
- **Replay authority:** the existing registry-local `SignedTicketReplayGuard` consumed by `SignallingServerCore`.
- **Room/peer admission authority:** `SignallingServerCore`.
- **Transport acknowledgement:** `SignallingServer.mjs` only reports that the core's earlier synchronous listener left the signed-auth socket admitted/open; it does not validate signatures or consume nonces itself.
- **Browser invite parser:** `CollaborationInvite.ts` validates only transport-safe shape/room syntax. It cannot create or cryptographically validate tickets.

## Security boundaries retained

- Production signalling URL must be `wss:` and contains no credentials/query/fragment.
- Invite base URL must be HTTPS.
- Invite credential is fragment-only, then session-only.
- The browser never receives the HMAC signing secret.
- Server Production startup requires authentication plus origin policy.
- Production ignores URL-carried auth tokens and accepts credentials in-band.
- Relayed `from` identity remains socket-bound, not message-authoritative.
- Signed ticket second use is rejected.
- Multi-replica replay safety remains explicitly unqualified because nonce state is registry-instance local.

## Evidence observed during fix-forward

Before the final documentation freeze, exact-head rehearsals established:

- architecture policy caught the misplaced issuer, then passed after moving issuance to the operator boundary;
- typecheck and lint passed after the server declaration and invite changes;
- production build passed;
- Rust kernel passed;
- coverage shards 1 and 2 passed;
- shard 3 exposed the synchronous-close renewal ordering bug described above, which was fixed rather than retried.

Because source and review documentation moved after those rehearsals, none of those runs are promotion evidence for merge. The final branch head must independently pass the complete promotion contract.

## Remaining limitations

1. No actual signalling service has been deployed by this tranche.
2. RF-054 needs a clean production browser journey against the deployed `wss://` URL before `VERIFIED COMPLETE`.
3. Signed private-preview invites are participant-only.
4. There is no production ticket-renewal broker; after a consumed invite loses transport, the investigator needs a fresh invite.
5. Multi-replica signed-ticket replay safety needs a shared atomic nonce store.
6. Live-ingest `/__demo-stream` remains a separate P1-W service-topology gap.

## Merge gate

Merge #653 only if the final exact head has green aggregate CI including all coverage shards and Chromium production/collaboration smoke, static analysis, Rust, architecture policy, CodeQL, Q8, Q9, UV0, approval gate, and no unresolved review threads. Re-check remote `main` immediately before merge and merge with the expected PR head SHA.
