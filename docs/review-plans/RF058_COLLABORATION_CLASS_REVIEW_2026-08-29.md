# RF-058 Collaboration Trust-Boundary Class Review (Stream C, Checkpoint C3)

**Date:** 2026-08-29
**Branch:** `stream-c/c3-rf058-review`
**Base SHA:** `9b49796` (C1 #530 and C2 #534 merged into main)
**Head SHA:** see commit on `stream-c/c3-rf058-review`
**Scope:** collaboration trust boundary only (signalling admission, ticket/role authority, pose/sequence integrity, and the helpers/tests that claim those properties). RF-039/RF-040/RF-041/RF-042/RF-043 are explicitly the next Stream C wave and are out of scope except for the quick off-path inventory below.

**Verdict:** NO MATERIAL RESIDUAL. Review-only checkpoint; no PR warranted.

## Method

Class-wide `rg` searches over the whole repository (excluding `node_modules`, `wasm/pkg`, lockfile) for each of the four RF-058 classes, then production-path verification of every surface found:

1. **Auth/admission class:** every ticket/role/token/authority symbol, every `:` split and role query-param parse, every `createRoomRegistry`/`authorizePeer`/`handleConnection` caller, every `tokenValidator`/`allowOpenNoToken`/`acceptUrlToken` site, and the two production servers plus the client channel.
2. **Pose/collaboration integrity class:** every sequence/staleness/camera-pose site (NetworkManager binary + JSON paths, PeerAvatarManager, CollaborativeStateSync, BinaryPoseSerializer), and every frame-acceptance site for exact-length/finite/bound checks.
3. **Helper-only test class:** admission and pose tests were audited for mocking the authority they claim to test, or for being vacuous.
4. **Off-path security helpers (RF-055 inventory):** SharedAnnotationManager, ConnectorAuth, UploadSanitizer, TelemetryConsentManager, SignedTicketVerifier remnants — quick scan limited to the collaboration trust boundary.

Verification run in the worktree (5 files, 105 tests, all passed):

```bash
npx vitest run --config vitest.config.ts tests/network-security.test.ts tests/security-hardening.test.ts tests/rf057-pose-identity.test.ts tests/network.test.ts tests/zero-copy-network-sync.test.ts
# 5 passed / 105 passed
```

## Findings

| # | File:line | Finding | Classification | Production-path relevance | Disposition |
|---|-----------|---------|----------------|---------------------------|-------------|
| F1 | `src/network/SignedTicket.ts:8-9` | Doc comment still names the deleted `SignedTicketVerifier.ts` as "the off-path WebCrypto duplicate". Historical prose; the module is deleted and unreachable. | false positive / accepted harmless | None | NONE |
| F2 | `src/network/index.ts:12-16` | Barrel re-exports exactly one canonical ticket authority (`createSignedTicket`, `verifySignedTicket`, `timingSafeEqualString`, `SignedTicketReplayGuard`, types/constants). No production import of `SignedTicketVerifier`, `SignedRoomTicket`, `CryptoCapabilityError`, `timingSafeEqualBytes`, or `sessionId`/`participantId` ticket claims exists. | false positive / accepted harmless | Barrel is the sole production export surface; enforced by `tests/network-security.test.ts:646-654`. | NONE |
| F3 | `src/network/SignallingServer.mjs:88` | Role parsed from `?role=` via `=== 'observer' ? 'observer' : 'participant'`. Any non-observer value resolves to `participant` — but `participant` is also the default requested role, and `handleConnection` re-normalizes through `normalizeNetworkRole`, so no foreign role can be promoted. Divergent style only; same outcome as the dev plugin's exact allow-list. | maintainability problem | Live standalone server admission; no escalation possible. | DEFER |
| F4 | `dev/signalling-dev-server.ts:24-41` | Dev/preview plugin uses an exact `observer|participant` role allow-list and `securityProfile: 'Development'` (open mode by default). `apply: 'serve'` means it never ships in production. | false positive / accepted harmless | Dev-only Vite plugin; not a production sink. | NONE |
| F5 | `src/network/SignallingServerCore.ts:449-539` | `authorizePeer` is the single role-resolution authority. Every branch (scoped `secret:role`, signed ticket claims, `tokenValidator` claims, requested-role fallback) is filtered through the exact allow-list `normalizeNetworkRole` (line 177). Scoped token rejects multi-colon/unknown/empty suffixes. Ticket path fails closed on invalid signature (does not fall through to scoped parse). `tokenValidator` is dormant (no production caller supplies it) and its role output is allow-listed. | false positive / accepted harmless | Canonical admission authority; all security tests attack it via `handleConnection`, never a mock. | NONE |
| F6 | `src/network/SignallingServer.mjs:46-89`, `src/network/SignallingChannel.ts:73-108` | No alternate admission path: `createRoomRegistry` is called only by the standalone server and the dev plugin, both routing into `handleConnection`. The client never places the token in the URL; auth is in-band (`auth` message) with the server normalizing the claimed role. `allowOpenNoToken` is only ever forced true for the explicit `Development` profile / `--allow-open` flag, and produces a diagnostic warning. Production ignores URL-supplied tokens (`acceptUrlToken` default false, `SignallingServerCore.ts:286-288`). | false positive / accepted harmless | Production admission is single-path. | NONE |
| F7 | `src/network/NetworkManager.ts:387-555` | Binary pose path binds sequence state to the channel-bound string peer identity (`_poseSequenceState` keyed by `peerId`, never the payload numeric ID), cross-checks the payload numeric ID against `sha256Uint31(peerId)`, and rejects non-40-byte / NaN / Infinity / out-of-bound frames via the strict `BinaryPoseSerializer` codec. No `_sequenceCounters`/`validateSequence` remains anywhere in the repo. | false positive / accepted harmless | Live receive path; adversarial cases covered by `tests/rf057-pose-identity.test.ts` through the real `_wireChannel` message handler. | NONE |
| F8 | `src/network/NetworkManager.ts:527-541` | JSON `cameraPose` receive path is identity-bound to the channel (`payload.peerId !== peerId` guard, line 472) and finite-vector validated, but has **no sequence/staleness gate** — it bypasses the C2 replay/staleness authority for pose frames. No production emitter sends JSON `cameraPose` (the production emitter, `CollaborationCoordinator.update()` → `broadcastCameraPose`, is binary-only), so the branch is reachable only by hostile peers and tests. Effect is cosmetic avatar transform for an already-authenticated channel peer — identical to what the binary path already permits, so no privilege or capability is unlocked. | integrity/robustness problem | Reachable receive branch, but no privilege/authority escalation and no analytical sink. | DEFER |
| F9 | `src/network/CollaborativeStateSync.ts:60` | Sequence key falls back to the payload numeric ID (`this._remotePeerId ?? pose.peerId.toString()`) — the C2-forbidden untrusted-field keying pattern persists in this helper. However `CollaborativeStateSync` is **never instantiated in production** (barrel export + a type-only import in `PeerAvatarManager`; only tests construct it), so the fallback is not reachable from any live path. Tests exercise the fallback branch in 4 of 5 `setDataChannel` calls. | maintainability problem | Off-path helper only; no production sink. | DEFER |
| F10 | `tests/zero-copy-network-sync.test.ts`, `tests/collaborative-sync.test.ts`, `tests/production-runtime-wiring.test.ts:146-159` | Helper-level tests for `CollaborativeStateSync`/`acceptsSequence` exist and pass; they are not mistaken for production evidence because the production-path pose tests (`rf057-pose-identity.test.ts`) and admission tests (`network-security.test.ts`) exercise the real call graph. Minor: the `production-runtime-wiring` test title implies CollaborativeStateSync is production-wired, which it is not. | maintainability problem | Test-only; production evidence exists independently. | DEFER |
| F11 | `src/network/SignallingServerCore.ts:349,381-393` | Replay guard nonce store is per-registry-instance; cross-instance replay with a shared `authToken` is not protected. This is a documented, deliberate residual risk from C1, not a C3 regression. | false positive / accepted harmless (recorded residual) | Multi-instance deployment is out of scope for C1-C3. | NONE |
| F12 | `src/vr/interactions/SharedAnnotationManager.ts` | In-boundary consumer with its own payload/id/rate caps; remote deltas arrive via the participant-gated `stateDelta` event (NetworkManager `authoritativeRole === 'participant'`). No duplicate role/ticket authority. Not stale. | false positive / accepted harmless | Live collaboration rendering path, correctly gated. | NONE |
| F13 | `src/network/ConnectorAuth.ts` | Connector API bearer-token/scope auth for data-source connectors — not the signalling admission boundary; no role parsing that could reach `participant`. Out of the collaboration trust boundary. | false positive / accepted harmless | Not on the collaboration admission path. | NONE |
| F14 | `UploadSanitizer` / `TelemetryConsentManager` (RF-039/RF-040) | Off-path helpers whose consolidation is the explicitly-scoped **next** Stream C wave. Quick scan confirms neither claims a collaboration-trust-boundary property in the signalling/pose surface. | false positive / accepted harmless (out of scope) | Not in this boundary. | NONE (next wave) |

## Helper-only test audit (class 3)

- Admission: `tests/network-security.test.ts` and `tests/security-hardening.test.ts` drive `createRoomRegistry().handleConnection()` directly with real registries; `authorizePeer` is **never mocked** and no test bypasses the admission path. The barrel-authority test (`network-security.test.ts:646-654`) would fail if a competing verifier were re-exported. Non-vacuous.
- Pose: `tests/rf057-pose-identity.test.ts` dispatches real `message` events through the real `NetworkManager._wireChannel` handler with real `BinaryPoseSerializer` frames; only the `sha256Uint31` digest helper is mocked (to force a numeric-ID collision). Non-vacuous.
- No test mocks the very authority it claims to test.

## FIX-NOW findings

None. No security vulnerability and no material production-path regression was found in the reviewed collaboration trust boundary. All findings are false-positives or DEFER-class maintainability/integrity nits.

## PR decision

**No PR is warranted.** This checkpoint closes review-only with the review report as its deliverable, per the Stream C operating rules and ROADMAP C3 row ("review plus only material residual fixes; no PR required if clean"). No source or test changes were made.

## Deferred work (not recursive scope)

- **F8 (JSON `cameraPose` receive branch):** either route it through the same channel-bound sequence authority as the binary path, or remove the branch since no production emitter exists. The sole blocker is the compatibility test `tests/network.test.ts:348-355` which codifies the un-gated behavior; a future focused change should update or delete that assertion with an explicit compatibility decision.
- **F9 (`CollaborativeStateSync` fallback):** when the helper is either wired to a production path or deleted, the `_remotePeerId ?? pose.peerId.toString()` fallback must be removed and the tests must drive the channel-bound key branch.
- **F3 (role ternary in `SignallingServer.mjs:88`):** cosmetic alignment with `normalizeNetworkRole`; no behavior change required.

## Residual risk statement (honest)

- Multi-instance nonce-store sharing remains out of scope (C1-recorded residual): replay protection holds within one running registry instance.
- Pose integrity is enforced on the production binary path; the un-gated JSON `cameraPose` receive branch (F8) remains until the deferred disposition lands. Its only effect is cosmetic avatar transform by an already-authenticated channel peer.
- `CollaborativeStateSync` (F9) is not production-wired; if it is ever wired, the untrusted-field fallback must be removed first.

## Stream C exit gate assessment

Per ROADMAP C3 (line 700), the exit gate requires: one authoritative signalling ticket/role protocol — satisfied; replay protection on the live admission path — satisfied; fail-closed role parsing — satisfied; channel-bound pose sequence/replay state — satisfied; exact/finite framing validation — satisfied; no material duplicate/bypass authority in the reviewed collaboration trust boundary — satisfied. The remaining items are non-material DEFERs, not exit-gate blockers. C1-C3 establish the baseline; Stream C may proceed to its next wave (RF-039/RF-040/RF-041/RF-042/RF-043) and Stream B independent re-review of C1/C2 remains outstanding as planned.

## Verification evidence

- `npx vitest run --config vitest.config.ts` over the 5 collaboration/security test files: **105/105 passed** (network-security, security-hardening, rf057-pose-identity, network, zero-copy-network-sync).
- `npm run typecheck` and `npm run docs:check`: run as part of the checkpoint close-out (no source changes, doc only).
- Integration-lane WASM failures are environmental (symlinked `wasm/pkg`) and were not chased, per the checkpoint instructions.