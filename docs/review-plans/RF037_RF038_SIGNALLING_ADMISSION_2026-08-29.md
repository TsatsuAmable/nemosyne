# RF-037 / RF-038 canonical signalling admission authority — adversarial review plan (29 August 2026)

**Checkpoint:** Stream C, C1 — `fix(rf-037/rf-038): converge signalling admission authority`
**Branch:** `stream-c/c1-rf037-rf038`
**Base SHA:** `a8be01af10e36e595e52571c91613cc070035b51`
**Risk classification:** High-risk change (security authority — mandatory pre/post adversarial review).

## 1. Pre-implementation adversarial contract

### 1.1 Invariant

1. Exactly **one** live ticket authority exists in production code. It is versioned, HMAC-SHA256-signed, role-ontology-exact (`observer` | `participant`), and replay-safe: a nonce is consumed atomically with the *successful* admission of a ticket through the real admission path.
2. `createRoomRegistry().handleConnection()` is the enforcement point. A ticket that was verified and admitted once (same nonce, same room scope) is **deterministically rejected on second use** with a replay outcome. No valid second admission exists for the same nonce within one registry instance.
3. Every role value that is not exactly `observer` or `participant` is **rejected** (fail closed) at every role-resolution site in `authorizePeer`: the scoped-token suffix, ticket claims, tokenValidator claims, and requested-role fallback. No typo, casing variant, prefix/suffix, empty suffix, or unknown role name may resolve to `participant`.
4. Malformed, tampered, wrong-room, expired, future-issued, unknown-version, missing-nonce, unknown-role, and replayed tickets all fail closed through `handleConnection` (no admission, no partial privilege).

### 1.2 Authority and production path

- **Authority:** `src/network/SignedTicket.ts` becomes the canonical signing/verifying authority (schema `version/room/role/issuedAt/exp/nonce`, role `observer|participant`, Node `crypto` HMAC-SHA256, synchronous). It owns the wire format already consumed by the live path (`payloadB64.signatureHex`, detected via `token.includes('.')` in `authorizePeer`) and owns the replay guard (`SignedTicketReplayGuard`).
- **Production path under test:** `createRoomRegistry()` (SignallingServerCore.ts) → `handleConnection()` → (URL token or in-band `auth` message) → `authorizePeer(roomId, token, requestedRole)` → `verifySignedTicket()` + `SignedTicketReplayGuard.consume()`. Replay enforcement and role allow-listing must be exercised through this exact chain, not a helper in isolation.
- **Transport wiring:** `src/network/SignallingServer.mjs` and `dev/signalling-dev-server.ts` both call `handleConnection` unchanged; the canonical authority is consumed inside the registry, so no transport change is needed.

### 1.3 Failure modes (how this design could silently be wrong)

- **Decorated authority:** the canonical verifier is implemented and unit-tested, but `authorizePeer` keeps calling a different (replay-permissive) code path, so `handleConnection` still admits a replayed ticket. Falsified by production-path second-use test.
- **Second authority left live:** `SignedTicketVerifier.ts` (divergent schema/role/crypto) remains exported from `src/network/index.ts` or imported by any production file, so a competing live verifier exists. Falsified by barrel-export inspection + `rg` over production imports.
- **Replay window unbounded:** nonce cache grows without eviction (memory exhaustion) or evicts by wall-clock instead of ticket expiry (replay after eviction). Falsified by eviction/cleanup test.
- **Nonce consumed but not atomic with admission:** nonce consumed on a ticket that is then rejected for a later check, or admission granted on a nonce that was already consumed by a *failed* attempt (allows replay after a rejection). Falsified by ordering test: failed attempt must not burn/allow the nonce; only success consumes.
- **Role fail-open resurfaces:** scoped-token parser or `tokenValidator` role resolution still maps any non-`observer` value to `participant`, or a ticket/token carries `analyst`/`collaborator`/`administrator` and is admitted. Falsified by `secret:admin`, `secret:PARTICIPANT`, `secret:`, `secret:participant-extra`, and unknown-role-ticket production-path tests.
- **Crypto/ontology split-brain:** creator stamps a different schema/role set than the verifier accepts (e.g., creator allows `analyst`, verifier rejects), so "canonical creator → canonical verifier" is not one schema. Falsified by cross-consistency test (create with canonical creator, verify with canonical verifier, matching roles).
- **Passing tests but wrong production:** tests exercise `verifySignedTicket` in isolation or a mocked `tokenValidator`, never the real `handleConnection` chain, so the production claim is unproven. Falsified by requiring all admission tests to traverse `createRoomRegistry().handleConnection()`.
- **Cross-check order regression:** an expired-but-replayed or replayed-but-expired ticket must fail closed regardless of which check fires first; no error path may return `valid`.
- **Legacy-role ticket smuggled in:** a ticket payload containing a `capabilities` claim or legacy role is honored as a capability/role authority. The server derives capabilities only from the allow-listed role and ignores foreign claims.

### 1.4 Falsifying evidence (authoritative tests)

1. Production-path first-use-accept / second-use-reject: create a ticket via the canonical creator, `handleConnection` once → admitted (peer authenticated), `handleConnection` again with same ticket (fresh peerId, same room) → rejected with replay reason/close code.
2. Production-path fail-closed scoped tokens: `secret:admin`, `secret:PARTICIPANT`, `secret:`, `secret:participant-extra`, `secret:observer:participant` → all rejected 4001; exact `secret:observer` and `secret:participant` → accepted with the exact role; capabilities match the role (observer cannot relay `datasetOperation`).
3. Schema/role consistency: `createSignedTicket({room, role, exp})` output is accepted by the canonical verifier with `role` preserved; verifier rejects unknown roles (`analyst`, `collaborator`) and any malformed/legacy-ontology ticket.
4. Barrel authority: `src/network/index.ts` re-exports exactly one canonical ticket authority; `SignedTicketVerifier` / `SignedRoomTicket` / `CryptoCapabilityError` are absent from production exports.
5. Malformed-ticket production-path rejection: bad structure, tampered signature, wrong room, expired, future-issued, unknown role, missing nonce, unknown version → all rejected through `handleConnection`.

### 1.5 Non-goals / dependencies

- No change to the WebSocket protocol, `NetworkManager` pose path (C2 = RF-057), `Room`, `SignallingChannel`, or the `tokenValidator` extension surface.
- No new npm dependencies; Node `crypto` HMAC-SHA256 is the canonical mechanism (synchronous — coherent with the synchronous `authorizePeer`).
- Multi-instance nonce-store sharing is **out of scope**: replay protection is per-registry-instance; cross-instance replay requires a shared store and is recorded as residual risk, not claimed.
- Dev-profile (Development) open mode semantics are preserved; production profile is not weakened.
- The standalone server's URL `role` query-parameter parse (`=== 'observer' ? 'observer' : 'participant'`) is out of scope for C1 (requested role is not an authority in Production; the authoritative role comes from the ticket/secret). Recorded as DEFER.
- `tokenValidator` remains a supported extension point; it must return claims whose role is allow-listed, and `authorizePeer` enforces the ontology on its output.

## 2. Post-implementation adversarial review

### 2.1 Adversarial disposition

**Disposition: High-risk change (security authority).**

Adversarial questions and answers:

1. **Did the new implementation become the production path, or is it decorative?**
   — Yes, it is the production path. `createRoomRegistry()` creates a `SignedTicketReplayGuard` in its closure; `handleConnection()` (URL-token admission) and the in-band `auth` message handler both call `authorizePeer()`, whose ticket branch runs `verifySignedTicket()` and consumes the nonce via `signedTicketReplayGuard.consume()` before returning `authorized: true`. The standalone server (`SignallingServer.mjs`) and the Vite dev plugin (`dev/signalling-dev-server.ts`) both call `handleConnection` unchanged, so the replay-safe and fail-closed logic is on the live admission path for both transports. It is not decorative.

2. **Did it create a second authority?**
   — No. `src/network/SignedTicketVerifier.ts` (WebCrypto, `sessionId/participantId/analyst|observer|collaborator` ontology) is deleted; `src/network/index.ts` re-exports only the canonical `SignedTicket` authority (`createSignedTicket`, `verifySignedTicket`, `SignedTicketReplayGuard`) plus its types/constants. The `tokenValidator` option remains a supported *extension point*, but its role output is now filtered through the exact allow-list `normalizeNetworkRole`, so it cannot smuggle a foreign role into the ontology. A production barrel-export test asserts the removed identifiers are unreachable.

3. **Does the regression exercise the real authoritative boundary?**
   — Yes. All new admission tests call `createRoomRegistry().handleConnection(...)` with real tokens (URL-token and in-band flows share the same `authorizePeer`). The RF-037 tests prove first-use acceptance, second-use replay rejection (including after the first peer disconnects), distinct-ticket acceptance, and malformed-ticket rejection — all through `handleConnection`. The RF-038 tests prove exact-allow-list scoped tokens and capability consequences through `handleConnection`. The only helper-level tests are the schema/crypto unit tests in `security-hardening.test.ts`, which complement (not substitute for) the production-path tests.

4. **Are failures/refusals explicit?**
   — Yes. Every rejection returns an explicit close code (`4001`) and a distinct reason: `ticket replay detected (nonce already consumed)`, `invalid scoped token role`, `invalid role in ticket`, `ticket missing required nonce`, `unsupported ticket version`, `invalid ticket cryptographic signature`, `ticket expired`, `ticket room scope mismatch`, `invalid role in token claims`. The stateless verifier returns discriminated `errorKind` values; auth-failure throttling still records each rejection. A `capability_unavailable`-style silent-continue path cannot occur because the canonical authority is Node `crypto` (always present) with no fallback.

5. **Did the PR cross another stream's ownership?**
   — Scope is contained to Stream C territory (`src/network` signalling admission + role parsing + security-boundary tests). Files touched: `SignedTicket.ts`, `SignallingServerCore.ts`, `index.ts`, `network-security.test.ts`, `security-hardening.test.ts`, plus two docs (`STREAM_C_SECURITY_ASSURANCE.md` — the owning programme doc, and a one-cell reference fix in `AI_XR_AGENT_HARNESS_SPEC.md` to the canonical authority name so the spec no longer names a deleted class). `package.json`, `vite.config.ts`, `NetworkManager`, `Room`, `SignallingChannel`, `BinaryPoseSerializer`, and all analytical/Moneta/representation/UI files are untouched. `ROADMAP.md` is deliberately not edited (implementation PRs must not edit it).

6. **Is the acceptance claim narrower than or equal to the evidence?**
   — Yes, and it is explicitly bounded. Claimed for C1: (a) replay-safe ticket admission through `handleConnection` within one registry instance; (b) exact `observer`/`participant` role ontology at every role-resolution site; (c) one canonical ticket authority in production exports. The evidence is the production-path tests above plus the schema/unit tests. Explicitly NOT claimed: multi-instance nonce-store sharing (replay protection is per-instance; cross-instance replay remains possible and is recorded as residual risk), Development open-mode semantics (unchanged; open mode admits without tickets), and the standalone server's URL `?role=` transport parse (still `=== 'observer' ? 'observer' : 'participant'`; the authoritative role comes from the ticket/secret in Production, and `authorizePeer`/`handleConnection` now normalize the requested role to the ontology anyway).

### 2.2 Verification evidence

- Focused lane (jsdom integration): `network-security.test.ts`, `security-hardening.test.ts`, `network.test.ts`, `network-lifecycle-authority.test.ts`, `adversarial-hardening.test.ts`, `collaboration-embodied-presence.test.ts`, `collaboration-recovery.test.ts` — **97/97 passed** (87 baseline + 10 new admission tests, 14 obsolete helper tests replaced by 15 canonical-authority tests).
- Full integration lane: 10 failing files are **pre-existing WASM-runtime module-resolution failures** (`Cannot find module .../wasm/pkg/nemosyne_wasm.js` in `tests/setup-wasm.ts`); one representative file (`tests/atlas-async-execution.test.ts`) was re-run at the pristine base SHA (changes stashed) and failed identically. All network/security tests pass; no new failures introduced.
- `npm run test:fast` — 44/44 passed. `npm run test:ui` — 13/13 passed.
- `npm run typecheck` — clean. `npx eslint` on all changed files — clean. `npm run docs:check` — passed.
- `npm run architecture:check` — **not runnable in this environment**: dependency-cruiser rejects Node `25.6.1` (requires `^22||^24||>=26`) before analysis. Environmental, not code-related.

### 2.3 Adversarial trial results (failure modes attempted)

| # | Failure mode / attack | Result |
| --- | --- | --- |
| 1 | Same ticket replayed via a second `handleConnection` (same nonce/session) | REJECTED 4001, `ticket replay detected` |
| 2 | Replay after the first peer disconnects | REJECTED 4001 |
| 3 | Two distinct tickets (distinct nonces) | both accepted; participant/observer capabilities enforced |
| 4 | Scoped token `secret:admin`, `secret:PARTICIPANT`, `secret:`, `secret:participant-extra`, `secret:observer:participant` | all REJECTED 4001 `invalid scoped token role` |
| 5 | Legacy-role ticket (`analyst`, `collaborator`) validly signed | REJECTED `invalid_role` |
| 6 | Missing nonce / unknown version / tampered payload / forged sig / wrong room / expired / bad structure | all REJECTED through `handleConnection` |
| 7 | `tokenValidator` returning a foreign role, and foreign `requestedRole` on a participant secret | role never promotes beyond ontology (fails closed / least privilege) |
| 8 | Replayed-but-expired ticket | REJECTED `expired` (replay window bounded by ticket expiry; nonce eviction is memory hygiene) |
| 9 | Nonce consumed but admission later failing | Not possible: `consume` occurs only after all admission checks pass and immediately before `authorized: true`; single-threaded, no interleaving |
| 10 | Failed authentication attempt reusing a nonce that a later valid attempt needs | Nonce is consumed only on successful verification, so failed attempts cannot burn a nonce |

### 2.4 Classified findings

- **BLOCKER:** none.
- **DEFER (out of C1 scope):**
  0. **Ticket reconnect lifecycle (independent-review finding):** `SignallingChannel` re-sends the *same* token on every socket generation (`_openSocket` sends an in-band `auth` with `this.token` on each reconnect). With the C1 nonce-replay guard, a signed-ticket client that reconnects using the same ticket is now rejected as replay (nonce already consumed). Today production does **not** issue signed tickets (`createSignedTicket` has no production producer; collaboration uses plain/scoped shared secrets via `_loadStoredToken`), so this is not a current defect. When P1-W1 provisions signed tickets to clients, ticket issuance must be per-connection (or reconnect must obtain a fresh ticket); record this interaction explicitly rather than assuming the same ticket survives reconnects. This mirrors the RF-037 disposition that replay prevention is enforced at successful admission.
  1. Multi-instance nonce-store sharing for cross-server replay protection (RF-037 disposition asks for explicit semantics; per-instance store is the documented contract, shared store is future work).
  2. Plain secrets containing `.` or `:` are pre-existing edge cases (`token.includes('.')`/`token.includes(':')` detection); behavior remains fail-closed (rejected), only the rejection reason is generic. An operator choosing a `authToken` with `.`/`:` gets degraded token matching.
  3. Standalone server `SignallingServer.mjs` `?role=` query parse maps any non-`observer` to `participant`; Production ignores URL roles and the registry now normalizes requested roles, so no privilege escalation, but a dev-only transport tightening could make it exact.
  4. `tests/adversarial-hardening.test.ts` passes vacuously for its two `handleConnection` cases (object-shaped `roomId` arg is rejected by `isValidIdentifier` before admission; assertions hold on empty relay arrays). Pre-existing, out of C1 scope, but a Stream C/B follow-up should rewrite it to use the positional signature.
- **SUGGESTION:** expose the replay-guard active-nonce count on the security diagnostic for operator telemetry.

### 2.5 Residual risk (honest)

- Replay protection is per registry instance; two servers sharing an `authToken` can each admit the same ticket once. Documented, not claimed as covered.
- Development open mode remains trust-none (no ticket required); C1 does not change dev semantics.
- The integration-lane WASM failures are environmental (unresolvable `wasm/pkg/nemosyne_wasm.js` in the jsdom lane) and pre-date this change; they are tracked as an environment finding, not a C1 regression.