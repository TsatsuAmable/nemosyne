# S2 — Collaboration/security residuals (F8, F9, D3, D4)

**Date:** 2026-08-29
**Stream:** S (security) second wave — residuals recorded by C3 (#536) and the reconciliation review
**Base expectation:** `main` after #545/#546 merge
**Status:** PLANNED — pre-implementation adversarial contract (no code yet)

## Purpose

Close the four recorded non-blocking-but-live collaboration/security residuals that Stream C explicitly deferred. None is a privilege escalation, but two (D3, D4) are live availability/boundary defects and two (F8, F9) are the forbidden untrusted-field/ungated patterns that must not survive if either path is ever wired.

## Scope

| # | Finding (recorded) | Current state on main | Defect |
|---|---|---|---|
| F8 | JSON `cameraPose` receive branch ungated (`NetworkManager.ts:527-541`) | Live receive branch; channel-identity-bound, finite-validated, **no sequence/staleness gate, no magnitude cap**; no production emitter sends JSON `cameraPose` (production is binary-only) | Untrusted-field sequence bypass pattern; cosmetic avatar transform only |
| F9 | `CollaborativeStateSync.ts:60` fallback key `_remotePeerId ?? pose.peerId.toString()` | Test-only helper; never instantiated in `src/` | C2-forbidden untrusted-field keying pattern persists off-path |
| D3 | Ticket reconnect ejection (`SignallingChannel.ts:100-108,142-155` resends same single-use ticket) | Live: auto-reconnect resends the same ticket → `SignedTicketReplayGuard` consumes nonce on first success → second admission rejected `4001 ticket replay detected` | A ticket-authenticated peer cannot survive any transient signalling drop |
| D4 | `npm run preview --host` defeats `vite.config.ts` `preview.host:false` (`package.json:23`, `vite.config.ts:31-37`) | Live: the dev signalling plugin (`apply:'serve'` + `configurePreviewServer`) mounts an open Development relay on the preview server; `--host` exposes it to the LAN | Open unauthenticated relay reachable by anyone with LAN access to a preview host |

## Pre-implementation adversarial contract

### 1. Invariant

Every pose/sequence receive path is channel-bound and sequence/finite-gated, no untrusted numeric field keys sequence state anywhere in `src/` (on or off path), a ticket-authenticated peer survives reconnect without security weakening, and no dev-only open relay is exposed by a normal preview command.

### 2. Authority and production path

- **F8:** `NetworkManager._wireChannel` is the live receive authority for pose frames. The fix either routes JSON `cameraPose` through the same channel-bound sequence authority as the binary path (`_poseSequenceState` + `BinaryPoseSerializer.acceptsSequence`) or removes the JSON branch (since no production emitter sends it). The compatibility test `tests/network.test.ts:348-355` codifies the ungated behavior and must be updated with an explicit decision.
- **F9:** `CollaborativeStateSync` is off-path. The fix removes the untrusted-field fallback so the channel-bound key is the only keying; the 4 tests driving the fallback branch must be re-pointed to the channel-bound branch. If the class remains unwired, this is a hygiene fix that removes a latent C2 violation.
- **D3:** `SignallingChannel` owns reconnect; the server's `SignedTicketReplayGuard` is the authority on nonce consumption. The fix must make reconnect succeed for a legitimately-issued ticket WITHOUT reusing a consumed nonce and WITHOUT weakening replay protection (a hostile replayed ticket must still be rejected). Options: re-issue a fresh ticket on reconnect via a client callback, or a server-side generation/reconnect grace that does not replay a consumed nonce. Must not re-introduce replay.
- **D4:** `vite.config.ts` `preview.host:false` is the countermeasure. The fix removes `--host` from the preview script (restoring localhost-only preview) or otherwise ensures preview never mounts the open relay LAN-reachable. Dev `serve` stays `host: true` for the Quest workflow.

### 3. Failure modes

- **F8 fix re-introduces replay:** routing JSON cameraPose through the binary sequence gate but reusing a shared counter across both frame types in a way that lets one channel direction desync the other, or accepting a stale frame that the binary gate would reject.
- **F8 removal breaks a real consumer:** removing the JSON branch while some production consumer (e.g. a desktop companion or peer-avatar renderer) actually emits/receives `remoteCameraPose` over JSON.
- **D3 fix weakens replay:** a "reconnect grace" that accepts a replayed nonce, or a client that can mint fresh tickets itself (would let any client bypass the server's ticket authority).
- **D4 fix breaks the Quest workflow:** making preview localhost-only when an operator legitimately needs LAN preview for a device; or leaving `--host` and only documenting (doesn't close the boundary).
- **Test-vs-production confusion:** F8/F9 fixes proven only by helper tests while the live `_wireChannel` path is untested.

### 4. Falsifying evidence

- **F8:** tests dispatch real `message` events through `_wireChannel` for JSON `cameraPose`: stale/duplicate/out-of-order rejected, NaN/Infinity/magnitude>1e6 rejected, valid frame accepted; or (if removed) the branch no longer exists and a test asserts JSON cameraPose frames are dropped. `tests/network.test.ts:348-355` updated or removed with an explicit compatibility decision.
- **F9:** tests assert `CollaborativeStateSync` rejects/fails-closed when the channel-bound key is absent and never falls back to the payload numeric ID; source assertion that no `?? pose.peerId` fallback remains.
- **D3:** a live-path test: create a signed ticket, connect → authenticate → drop the socket → auto-reconnect with a fresh ticket (or governed grace) → second admission succeeds with the SAME claimed peer identity; a replayed (same nonce) ticket is still rejected. Also an end-to-end ws-level test if feasible.
- **D4:** test asserts `package.json` preview script contains no `--host` (source assertion) and/or that preview binds localhost only; a socket test asserting the preview dev relay is not reachable on a non-loopback interface.
- Regression: existing C1-C3 admission/replay/pose tests stay green.

### 5. Non-goals / dependencies

- No change to the signed-ticket signing scheme, HMAC secret handling, or role ontology.
- No collaboration/pose protocol redesign; no new capabilities.
- No UI, analytical, Moneta, or representation work (that is B-U2/B-V1).
- Multi-instance cross-registry nonce-store sharing (F11/D5) remains out of scope.
- No physical Quest evidence claims.

## File ownership

| Surface | Files |
|---|---|
| F8 | `src/network/NetworkManager.ts`, `tests/network.test.ts`, pose tests |
| F9 | `src/network/CollaborativeStateSync.ts`, `tests/collaborative-sync.test.ts`, `tests/zero-copy-network-sync.test.ts` |
| D3 | `src/network/SignallingChannel.ts`, `src/network/SignallingServerCore.ts` (only if reconnect-grace requires a server seam), ticket tests |
| D4 | `package.json` (preview script), `vite.config.ts` (only if countermeasure moves), workflow/script tests |

## Stream-rail collisions

- `vite.config.ts` is reserved to Stream B while B1/B2 active — B1/B2 are merged, so S2 may touch it only for the preview countermeasure; justify.
- `package.json` preview script change must not break Quest validation launcher scripts.
- One open security-stream PR: S2 is the only S-stream PR.

## Exit gate

S2 is complete when: every pose receive path is sequence/finite-gated channel-bound (F8), no untrusted-field sequence keying exists anywhere (F9), ticket-authenticated peers survive reconnect while replay remains rejected (D3), and normal preview is localhost-only (D4) — all proven through real production ingress, with C1-C3 claims intact.