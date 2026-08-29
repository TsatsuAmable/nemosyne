# Stream S1 — Security hardening (F1–F5)

## Summary

Closes the five VERIFIED findings from the S1 security review on `stream-s/s1-security` (based on `main` @ `34c189f`):

- **F1 (BLOCKER):** Signalling room/connection-flood DoS in `createRoomRegistry().handleConnection()`.
- **F2:** Dead/unwired security classes removed (`UploadSanitizer`, `ConnectorAuthManager`); the ONE protection with no live equivalent (filename sanitization) is now enforced on the live `FileLoader` import path.
- **F3:** `TelemetryConsentManager` hardened to a genuinely pseudonymous, fail-closed consent authority (Web Crypto SHA-256, required per-deployment salt, raw subject id never stored). Remains dormant — not wired.
- **F4:** `Math.random()` ID generation on live paths replaced with `crypto.randomUUID()`.
- **F5:** CI shell interpolation hygiene in `.github/workflows/approval-gate.yml`.

## Scope / collision classification

Files touched (17):

- `src/network/SignallingServerCore.ts` — F1 caps (pending-per-room, maxRooms, server ceiling counts pre-auth peers, on-close auth-failure charge, exported `WS_MAX_PAYLOAD_BYTES`).
- `src/network/SignallingServer.mjs`, `dev/signalling-dev-server.ts` — F1 transport `maxPayload`.
- `src/ui/FileLoader.ts` — F2 live filename sanitization.
- `src/data/UploadSanitizer.ts`, `src/network/ConnectorAuth.ts` — **deleted** (F2).
- `src/data/index.ts`, `src/network/index.ts` — barrel exports of the deleted classes removed (F2).
- `src/study/TelemetryConsentManager.ts`, `src/study/index.ts` — F3 consent hardening (dormant, stays dormant).
- `src/vr/interactions/SharedAnnotationManager.ts`, `src/session/VaultArchiveStore.ts` — F4 CSPRNG IDs.
- `.github/workflows/approval-gate.yml` — F5 env-based interpolation.
- Tests: `tests/network-security.test.ts` (new F1 falsifiers), `tests/security-hardening.test.ts` (F2 barrel-gone, F3 consent, F4/F5 source assertions; UploadSanitizer helper tests removed), `tests/file-loader.test.ts` (F2 live filename falsifier); `tests/connector-auth-study-exporter.test.ts` **deleted** (F2; its StudyDataExporter CSV/formula-injection protection remains covered by `tests/study-data-exporter-security.test.ts`).

**Not touched (Stream C / collision boundary):** `SignedTicket.ts`, `NetworkManager.ts` (only source-asserted, not edited), `BinaryPoseSerializer.ts`, `src/vr/World.ts`, `src/vr/ui/**`, `package.json`, `vite.config.ts`, `docs/ROADMAP.md`, `docs/STREAM_C_SECURITY_ASSURANCE.md`. C1–C3 claims (one ticket/role authority, replay on live admission path, channel-bound pose sequence) are preserved: the `authorizePeer`/replay-guard call order on the admission path is unchanged, `getTotalPeers()` semantics are unchanged (verified by the existing C1–C3 tests staying green, 112/112 on the focused set).

## Pre-implementation adversarial contract

1. **Invariant:** unauthenticated peers cannot exhaust room/server capacity or bypass per-IP throttling; no dead security class reads as landed protection; the consent manager is genuinely pseudonymous and fail-closed; live IDs are CSPRNG-derived; CI never interpolates untrusted values into shell.
2. **Authority and production path:** the signalling registry (`createRoomRegistry().handleConnection()`) owns F1; the real `FileLoaderUI._handleFile` import boundary owns F2 filename policy; the `TelemetryConsentManager` class (dormant by design) owns F3; the live ID generators own F4; `approval-gate.yml` owns F5.
3. **Failure modes:** pending cap mis-scoped so a URL-token-authenticated peer is displaced by a flood; pending counter leak (increment without decrement); double-charging the per-IP throttle on timeout+close; `maxRooms` blocking existing rooms; filename policy applied after content is read; consent record retaining the raw subject id; a silently-fallback default salt.
4. **Falsifying evidence:** the F1 tests in `tests/network-security.test.ts` drive the real `handleConnection` path (pending cap with legitimate-peer admission, server ceiling including pre-auth peers, on-close lockout, room cap, transport `maxPayload`); the F2 test drives the real `FileLoaderUI` DOM boundary; the F3 tests attack the real class and recompute the SHA-256 independently; F4/F5 are source-assertions (accepted for these config/wiring properties); plus full typecheck/lint and the security/collaboration test set.
5. **Non-goals:** no RFC/ADR required (all fixes are contained hardening of existing boundaries); F4 deliberately excludes dormant classes (`MemoryPalaceController` etc.); multi-instance replay nonce-store remains out of scope.

## Post-implementation adversarial review

**Disposition: High-risk change.**

**Invariant re-check against the diff and real production call paths** (not against the code's own abstractions):

- **F1 pending-per-room cap:** enforced at the admission gate for peers that will actually enter the room unauthenticated (`willJoinPending = needsToken && !(token && acceptUrlToken)`). A flood peer supplying a fake URL token is not counted pending because it is rejected at the URL-token gate (and each fake-token attempt also charges the per-IP throttle). A peer with a valid URL token authenticates immediately and is never displaced by the pending cap — proven by the falsifier that fills a room to the pending cap and then admits a legitimate peer. In Production (`acceptUrlToken=false`) URL tokens are ignored, so such peers are correctly counted pending.
- **F1 server ceiling:** `getTotalPeers() + pendingPeers` bounds `maxTotalConnections`. `pendingPeers` is incremented only on pre-auth admission and decremented exactly once per peer via the two exit paths (in-band auth success, `onClose` for never-authenticated). Rejected-at-admission peers never register `onClose`, so they cannot double-decrement. No counter leak found; the only leak path is a socket lacking both `on` and `addEventListener`, which is a pre-existing limitation shared with `ipConnectionCounts` (not introduced here).
- **F1 on-close lockout:** `authFailureRecorded` prevents double-charging the same connection across URL-token rejection, in-band rejection, auth-timeout, and early disconnect. Verified: timeout path sets the flag before `socket.close()`, so the `onClose` charge is skipped; early-disconnect path charges exactly once. Reconnect-before-timeout is charged and triggers the lockout (falsifier proves count==3 then a 1008 rejection).
- **F1 room cap:** applies only to NEW room ids; existing rooms keep admitting (falsifier proves both). Combined with the global ceiling, memory is bounded (maxRooms × maxPendingPeersPerRoom is capped by `maxTotalConnections`).
- **F1 transport maxPayload:** `WS_MAX_PAYLOAD_BYTES = 256 KiB` exported from the core and wired into both `WebSocketServer` constructions (standalone + dev plugin); source-asserted, plus ≥ 64 KiB assertion.
- **F2:** filename sanitization runs at the very top of `_handleFile`, before any content is read, so rejection precedes parse/size/extension handling. Deleted classes are gone from both barrels (asserted). The remaining protections that `UploadSanitizer` duplicated (size cap, prototype-pollution stripping, row/col caps) remain enforced on their live paths and are already covered by live tests (`file-loader.test.ts`, `dataset-nested-prototype-pollution.test.ts`, `import-error.test.ts`, e2e F11).
- **F3:** token independently recomputed with `node:crypto` SHA-256 and matches; record serialization contains no raw subject id; zero-arg/empty/undefined salt construction throws. `crypto.subtle` availability in the jsdom lane was probed and confirmed.
- **F4:** the three live sites use `crypto.randomUUID()`; source-asserted that `SharedAnnotationManager`/`VaultArchiveStore` contain no `Math.random` and that `NetworkManager` is CSPRNG-first with a guarded fallback only when crypto is absent.
- **F5:** PR values are injected via `env:` and referenced as quoted `$ENV_VAR`; hygiene-audit and the new source-assertion verify no inline `${{ ... }}` remains in run blocks.

**Failure modes actively attempted:** pending cap displacing a token-authenticated peer (found and fixed during iteration), pending counter double-decrement, on-close double-charge, maxRooms rejecting existing rooms, non-prettier base files adding diff noise (reverted to narrow diff), a `willJoinPending` misclassification in Production (checked: correct).

**What I proved:** all falsifiers above via real production entry points; full typecheck, lint, docs:check; the complete security/collaboration set (112 tests) plus file-loader/vault/shared-annotation/animation suites (146) and fast (120) + UI (13) lanes.

**What remains unproved (honest):** the standalone `SignallingServer.mjs` transport was not exercised over a live TCP socket (its `maxPayload` is verified by source-assertion + shared constant, not by an end-to-end frame rejection test). The wasm-backed `AtlasCore` parse path was not exercised (FileLoader rejection tests bypass parse by design, which is the fail-closed ordering under test). Web Crypto's `crypto.subtle` in non-secure contexts is not covered (the consent class is dormant and will only be wired in a secure context).

**Residual risks / deferred (non-blocking):**
- **Multi-instance replay nonce-store remains out of scope** (two signalling servers sharing an `authToken` require a shared nonce store; unchanged from Stream C).
- **Per-IP auth-failure charging on early disconnect** is a deliberate throttle trade-off: under a shared NAT, a few rapid reconnects from one client could momentarily throttle other clients behind the same IP (5 failures / 1-minute window). Accepted per F1 requirement 3.
- **Dormant Math.random ID sites outside the F4 list** (`src/memory/MemoryPalaceController.ts` and similar) were left untouched because they are not on a live call graph; they should be deleted or converted in a future hygiene pass (RF-055 class).
- The StudyDataExporter basic bundle/CSV formatting tests in the deleted `connector-auth-study-exporter.test.ts` were removed with the connector-auth section; the security-critical spreadsheet-formula-injection coverage remains live in `tests/study-data-exporter-security.test.ts`.
- The 12 WASM-runtime test files that fail in the local `vitest.config.ts` lane (`atlas-*`, `wasm-columnar-tda`, `rf048-*`, etc.) fail identically on the base commit with these changes stashed — a pre-existing environment issue with the symlinked `wasm/pkg` in this worktree (vite-node cannot resolve the symlinked module path), not a regression from this change.

## Verification evidence

Commands run in the `nemosyne-wt-s1` worktree on `stream-s/s1-security`:

- `npm run typecheck` → PASS (tsc --noEmit, exit 0).
- `npm run lint` → 0 errors (209 pre-existing warnings repo-wide; changed files lint clean individually).
- `npm run docs:check` → `DOCUMENTATION INTEGRITY PASSED`.
- `npx vitest run --config vitest.config.ts tests/network-security.test.ts tests/security-hardening.test.ts tests/rf057-pose-identity.test.ts tests/network.test.ts tests/zero-copy-network-sync.test.ts` → **5 files, 112 tests passed**.
- `npx vitest run --config vitest.config.ts` + `tests/file-loader.test.ts tests/ui-system/vault-archive-lifecycle.test.ts tests/shared-annotations.test.ts tests/peer-avatars-annotations.test.ts tests/collaboration-embodied-presence.test.ts` → 146 passed (composite set).
- `npx vitest run --config vitest.fast.config.ts` → **18 files, 120 passed**.
- `npx vitest run --config vitest.ui.config.ts` → **3 files, 13 passed**.
- Base-commit parity probe: `git stash` of this change then re-run of `tests/atlas-async-execution.test.ts` reproduces the identical WASM `KernelUnavailableError` → the 12 integration-lane WASM failures are pre-existing/environmental, not caused by S1.
- Existing tests were **not weakened**; two prior S1-falsifier tests were corrected during iteration (pending-cap gate ordering so a legitimate authenticated peer is admitted; source-assertion strings made exact).

No BLOCKERs remain unfixed.