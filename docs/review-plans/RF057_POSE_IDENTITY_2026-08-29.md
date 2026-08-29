# RF-057 — C2 channel-bound pose sequence identity and framing

**Stream:** C (security authority / live-path assurance)
**Checkpoint:** C2
**Base SHA:** `862c1bb`
**Risk classification:** High-risk change (security/integrity authority, cross-runtime trust boundary, worker/reconnect lifecycle).

## Pre-implementation adversarial contract

### 1. Invariant

An incoming pose frame can affect replay/staleness state and avatar state **only for the peer authenticated by the RTCDataChannel on which it arrived**. Binary frame shape and numeric fields fail closed: only an exactly-40-byte, finite, bounded frame whose embedded numeric ID matches the channel-bound peer's deterministic digest may advance that peer's monotonic sequence state; the embedded numeric ID is never a sequence-state key.

### 2. Authority and production path

- **Authority:** signalling-admitted string `peerId` passed to `NetworkManager._wireChannel(peerId, channel, peerRole)`. Per-peer monotonic sequence state is owned by the `NetworkManager` instance, keyed by that string. `BinaryPoseSerializer` is reduced to a strict codec plus a pure, caller-owned-state helper.
- **Production path:** signalling admission → `_wireChannel(peerId, channel, peerRole)` → binary frame decode (`BinaryPoseSerializer.deserialize`) → channel-bound numeric-ID match → channel-bound sequence advance → `remoteCameraPose` → `CollaborationCoordinator` → `PeerAvatarManager`.
- **Off-path mirror:** `CollaborativeStateSync` (exported from the network barrel but not wired into the production `World` path) is converted from shared-global serializer state to instance-local state with an optional trusted channel binding.

### 3. Failure modes

- **Forged numeric identity cross-peer DoS:** peer A sends `{ peerId: numeric(B), sequence: 0xffffffff }` over A's own channel; if the receiver keys sequence state by payload numeric, victim B's later legitimate poses are dropped. (The current defect.)
- **Mismatch not rejected:** if the payload numeric is validated against the *sequence key* rather than dropped, A's forged frame could still mutate A's own state or, worse, become a second authority.
- **Reset misses a lifecycle transition:** reconnect where the old channel is torn down before the new channel is wired (real `_handleOffer`/`_initiateConnection` order calls `_closePeer` first) could skip a reset-on-wire only path; a forged high sequence from the old generation must not carry into the new generation regardless of teardown order.
- **Stale close deletes replacement:** the existing close-handler guard (`this.channels.get(peerId) !== channel`) must not be regressed; the replacement's sequence state must survive the stale channel's `close`.
- **Frame too strict breaks legitimate peers:** a real unit-quaternion or room-scale position must still pass deserialize; over-strict bounds would drop legitimate poses.
- **Frame too lax lets malformed data through:** NaN/Infinity or unbounded components crossing into avatar transforms, or a 41+ byte frame being accepted and trailing bytes ignored.
- **Numeric-ID collision merges state:** if sequence state were keyed by the compressed numeric ID, two string peers whose hashes collide would share one counter.

### 4. Falsifying evidence (written before implementation)

Through the **real `NetworkManager._wireChannel` message boundary** (FakeDataChannel + real `MessageEvent` dispatch):

1. A's channel carries `{ numeric(B), 0xffffffff }`; B's next legitimate pose is still accepted; A's forged frame is dropped (no event, no state mutation).
2. Duplicate same-peer sequence rejected.
3. Out-of-order same-peer sequence rejected.
4. Reconnect: forged high sequence on the old channel generation cannot poison the replacement channel's state; stale close leaves replacement intact.
5. 39-byte and 41-byte frames rejected; exactly 40 bytes required.
6. NaN/Infinity position/quaternion and out-of-bound position/quaternion fail closed.
7. Forced numeric-ID collision (`vi.mock` on `sha256Uint31` for two named peers) leaves their sequence state independent.

### 5. Non-goals / dependencies

- No change to the collaboration protocol, `SignallingServerCore`, signalling admission, roles, or `Room`.
- No new dependencies. No Rust/WASM change.
- `CollaborativeStateSync` is fixed to be instance-local/channel-bindable, not promoted to a second production authority.
- The JSON `cameraPose` compatibility path keeps its existing finite checks; adding magnitude bounds there is recorded as `DEFER`/`SUGGESTION`, not part of this fix.
- Deployed-path proof remains owned by P1-W1/RF-054.

---

## Post-implementation adversarial review

**Disposition:** `High-risk change` (security/integrity authority).

### Implementation landed

- `BinaryPoseSerializer`: static global `_sequenceCounters` / `validateSequence` / `resetCounters` removed. `deserialize` now requires exactly 40 bytes and rejects NaN/Infinity, unbounded position magnitude (>1e6), and non-unit-with-tolerance quaternions (component |q|>1 or magnitude outside [0.5, 1.5]). New pure `acceptsSequence(state, key, seq)` — state is always caller-owned.
- `NetworkManager`: per-peer sequence state `_poseSequenceState: Map<string, number>` keyed by the signalling-admitted string `peerId`, plus `_remoteNumericIds` digest cache. Binary path: strict decode → channel-bound numeric-ID match (mismatch dropped before any state mutation) → channel-bound monotonic sequence advance → `remoteCameraPose`. Sequence state reset on replacement wiring and on every teardown path (`_closePeer`, close handler, `_handleLeave`, `kickPeer`, connectionstatechange, `disconnect`).
- `CollaborativeStateSync` (off-path, barrel-exported): converted from shared-global serializer state to instance-local `_sequenceState`; optional trusted `remotePeerId` binding in `setDataChannel` rejects numeric mismatches and keys sequence state by the trusted string.

### Adversarial answers

1. **Did the new sequence state become the production path or is it decorative?** It is the production path. `_wireChannel`'s binary message handler (the only real receive boundary) now calls `BinaryPoseSerializer.acceptsSequence(this._poseSequenceState, peerId, pose.sequence)` keyed by the trusted string. No other code path feeds `remoteCameraPose` for binary frames. The serializer no longer owns any mutable sequence state.

2. **Is the payload numeric ID still a second authority anywhere?** No. The payload numeric is only (a) checked to match `sha256Uint31(channelPeerId)` and (b) passed through as read-only `detail.numericPeerId` metadata consumed nowhere as an authority (`CollaborationCoordinator`/`PeerAvatarManager` use `detail.peerId`, the string). `_remoteNumericIds` cache is keyed by string and invalidated on replacement/teardown.

3. **Do the regressions exercise the real NetworkManager `_wireChannel` boundary?** Yes. `tests/rf057-pose-identity.test.ts` wires real `_wireChannel` instances and delivers frames via real `MessageEvent` dispatch through the captured message listener; none call serializer helpers directly. `zero-copy-network-sync.test.ts` exercises the strict codec and the pure helper plus the off-path `CollaborativeStateSync` through its `onmessage` boundary.

4. **Are malformed/out-of-contract frames explicitly rejected?** Yes: 39/41-byte frames, NaN/Infinity components, unbounded position, over-unit or degenerate quaternions all return `null` from `deserialize` and are dropped in `_wireChannel` before any state mutation; numeric-mismatch frames are dropped before sequence state. Each has a test.

5. **Did it cross Stream A/B ownership?** No. Changes are confined to the Stream-C-owned collaboration/network trust boundary (`src/network/*`) and its tests. No analytical/WASM/Rust path, no protocol, no `SignallingServerCore` change.

6. **Is the claim narrower than or equal to the evidence?** Equal. Claims are: (a) forged numeric identity from another channel cannot poison any sequence state; (b) duplicate/out-of-order same-peer frames are rejected; (c) reconnect resets sequence state under both replacement orderings and stale channels are inert after replacement; (d) exact 40-byte finite/bounded framing is enforced; (e) numeric-ID collisions cannot merge string-keyed sequence state. All are proved through the `_wireChannel` production boundary.

### Newly inferred failure modes tried

- **Mismatch order vs state mutation:** mismatch is checked before `acceptsSequence`, so a forged frame cannot even poison the forger's own counter (asserted).
- **Teardown-before-replacement ordering:** `_closePeer` first, then wiring — resets state (new test).
- **Stale-channel messages after replacement:** the `channels.get(peerId) !== channel` guard drops post-replacement stale frames including a forged max sequence (asserted).
- **`??` caching of a zero digest:** `0 ?? sha256Uint31(...)` correctly caches 0 (nullish coalescing only falls through on null/undefined).
- **Digest 0 collision between self and peer:** a self frame never leaves the machine; not reachable on this boundary.

### Disposition of items

- **BLOCKER:** none.
- **DEFER (valid, out of scope):** the JSON `cameraPose` compatibility path in `_wireChannel` keeps its finite-only checks; adding magnitude/quaternion bounds there is a robustness follow-up, not the RF-057 binary-path defect. `serialize()` remains permissive on the trusted local sender side. Deployed-path proof remains P1-W1/RF-054.
- **SUGGESTION:** if the 40-byte frame is ever versioned, drop the redundant numeric ID field entirely rather than continuing to carry it as checked metadata.
- **Residual risk:** a malicious peer can still advance its own channel's sequence state to the maximum (self-DoS of its own presence); this is inherent to sender-controlled monotonic replay protection and no longer affects other peers. The `sha256Uint31` 31-bit digest is collision-prone by design; the string-keyed state makes collisions harmless for sequence authority.

### Verification record

- Focused suites (jsdom-integration): `zero-copy-network-sync`, `network`, `network-authority-recovery`, `collaboration-embodied-presence`, `collaborative-sync`, `binary-pose-governor-binding`, `rf057-pose-identity` — all pass (66 tests, including 9 new RF-057 adversaries).
- `collaboration-recovery` (fast-node lane): 2 tests pass.
- `production-runtime-wiring` is WASM-lane; its single `CollaborativeStateSync.sendBinaryPose` assertion is send-side and unaffected. Full WASM/integration WASM files fail in this worktree from the broken `wasm/pkg` symlink (verified identical failures on pristine base) — environmental, not this change.
- `npm run typecheck` clean; `npx eslint <changed files>` clean; `npm run test:fast` 15 files/78 tests pass; `npm run test:ui` 3 files/13 tests pass; `npm run docs:check` passes.
- `architecture:check` not runnable under Node 25 (dependency-cruiser `^22||^24||>=26` constraint) — environmental.