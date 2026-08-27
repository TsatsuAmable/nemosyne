# Security validation re-review — 27 August 2026

**Baseline validated:** `main@a33ceb7ea2c04a7d46796f014138f514658739ec` after RF-048 (#463) and P1-U3 follow-up (#464). The planning branch was subsequently synchronized to `main@9b3c990268e7446ed95751f264cbf66729b95805` after #465; #465 does not alter the security paths reviewed here.

This note validates an external re-review against the current repository rather than accepting clone-to-clone observations at face value. `docs/ROADMAP.md` remains the implementation-status authority.

## Result

The re-review is materially correct. Four previously reported security/live-path defects are already represented by the existing Stream-C roadmap and remain open. One supply-chain item is fixed. One new collaboration integrity/availability defect is confirmed. The randomness observation is useful as evidence of a **finding-class validation** problem, but the specific annotation/bookmark ID generator is not an authentication or authorization boundary and should not be overstated as a security vulnerability.

| Observation | Validation | Roadmap disposition |
| --- | --- | --- |
| Replay-safe `SignedTicketVerifier` remains off the live signalling path while `SignallingServerCore` imports replay-permissive `SignedTicket.ts` | **CONFIRMED** | Existing **RF-037 Critical** remains authoritative. Do not add a duplicate finding. |
| `UploadSanitizer` remains isolated rather than governing the FileLoader → Atlas → Rust ingress path | **CONFIRMED** | Existing **RF-039 High** remains authoritative. |
| `TelemetryConsentManager` remains separate from the actual telemetry lifecycle and cannot substantiate end-to-end erasure claims | **CONFIRMED** | Existing **RF-040 High** remains authoritative. |
| GitHub Actions pinning was converted to immutable commit SHAs and is mechanically checked | **CONFIRMED FIXED** | No new RF. Preserve #443/check-actions-pinned enforcement. |
| Shipped import map/CSP still references unpkg Three.js despite bundled `three` | **CONFIRMED** | Existing **RF-041 Medium** remains authoritative. |
| `SharedAnnotationManager` uses `Date.now()` + `Math.random()` for network-shared annotation/bookmark IDs | **CONFIRMED, severity corrected** | Not an auth/security token: an admitted malicious peer can already choose arbitrary IDs in remote deltas. Treat as collision/integrity/maintainability work and as evidence for RF-058 class-wide validation discipline. Prefer `crypto.randomUUID()` or a governed participant-id + monotonic-counter identity if/when changed. |
| Binary pose replay/staleness validation keys sequence state by the untrusted numeric `pose.peerId` inside each 40-byte frame, while routing uses the trusted channel-bound string peer ID | **CONFIRMED** | New **RF-057 Medium**. Bind pose sequence authority to the authenticated/channel-bound peer identity, not a payload claim. |
| `BinaryPoseSerializer.deserialize()` accepts frames longer than the declared 40-byte protocol | **CONFIRMED** | Fold into RF-057 strict framing. |

## RF-057 technical trace — collaboration pose identity/sequence authority

The production `NetworkManager` derives a numeric pose ID as `sha256Uint31(this.peerId)` and serializes it into each pose frame. On receive, `_wireChannel(peerId, channel, peerRole)` already has the signalling-authoritative string `peerId`, but the binary branch does:

```text
pose = BinaryPoseSerializer.deserialize(event.data)
BinaryPoseSerializer.validateSequence(pose.peerId, pose.sequence)
remoteCameraPose.detail.peerId = channel-bound peerId
```

`BinaryPoseSerializer.validateSequence()` stores a static global counter keyed by the **payload numeric peerId**. Therefore a room peer can send a frame over its own authenticated data channel while placing another peer's public, reproducible numeric ID in the payload and a very high sequence value. That poisons the victim numeric counter on the receiver. Later genuine victim poses use the same numeric ID and lower ordinary sequence values and are rejected, while avatar routing still labels the accepted forged packet as the attacker's channel-bound identity. This is not identity impersonation, but it is a session-scoped cross-peer presence integrity/availability attack.

The same boundary is too permissive in two additional ways:

- the declared wire format is exactly 40 bytes, but `deserialize()` accepts any buffer of length `>= 40` and ignores trailing bytes;
- the seven float fields are not rejected when non-finite, so NaN/Infinity can cross the data-channel boundary into avatar transforms unless a downstream layer happens to contain them.

### RF-057 required implementation contract

**Invariant:** an incoming pose frame can affect only replay/staleness state and avatar state for the peer authenticated by the RTCDataChannel on which it arrived. Binary frame shape and numeric fields fail closed.

**Authority / production path:** signalling-admitted string `peerId` → `_wireChannel(peerId, channel, peerRole)` → binary frame decode → channel-bound sequence validation → `remoteCameraPose` → `CollaborationCoordinator` → `PeerAvatarManager`.

**Falsifying tests:** through the real `_wireChannel` message path, not only `BinaryPoseSerializer` helpers:

1. attacker A sends `{ peerId: numeric(B), sequence: 0xffffffff }`; B's next valid pose is still accepted;
2. a payload numeric ID that does not correspond to the channel-bound peer is rejected, or the protocol removes the payload identity entirely;
3. duplicate/out-of-order sequence numbers from the same trusted peer are rejected;
4. peer leave/reconnect/session generation cannot inherit poisoned/stale sequence state accidentally;
5. exact 40-byte framing is required; 39-byte and 41-byte frames are rejected;
6. NaN/Infinity position/quaternion components are rejected; quaternion policy is explicit;
7. a collision in the compressed numeric ID cannot merge two peers' sequence state because the authoritative counter key is the trusted string/channel identity.

**Preferred repair:** move sequence ownership out of the serializer's static global map and into the connection/peer lifecycle owned by `NetworkManager`, keyed by trusted string peer identity (and, if needed, connection generation). Treat the numeric field as redundant wire metadata or version the pose frame to remove it. Reset/revoke sequence state deliberately on peer lifecycle transitions. Keep `BinaryPoseSerializer` as a strict codec, not an identity authority.

## RF-058 — class-wide security validation discipline

The re-review also confirms a recurring engineering pattern already visible in RF-030 and RF-037/RF-039/RF-040: a hardened helper or one scanner-reported location can be fixed while the production authority or the rest of the defect class remains unchanged.

The CodeQL randomness changes are a useful example. Seeded synthetic demo-data generation is fine for reproducibility but has essentially no security value. Meanwhile a separate `Math.random()` remains in shared annotation/bookmark IDs. That remaining use is also not a strong security vulnerability, but the mismatch proves that **scanner-line remediation is not the same thing as threat-class remediation**.

For every security/static-analysis finding, the project should require this closure sequence:

1. identify the protected asset and attacker-controlled input;
2. trace the actual production entry point and authority;
3. classify the finding as vulnerability, robustness/integrity issue, maintainability issue, or non-security false positive;
4. search repository-wide for the relevant pattern/class, including alternate implementations and bypass paths;
5. write the cheapest production-path falsifier for material risks;
6. fix at the authoritative boundary, not only a wrapper/helper;
7. record deliberately accepted non-security uses so later agents do not repeatedly "fix" harmless code;
8. only then close the finding/class.

RF-058 should be process/governance work and may run in parallel with technical Stream-C fixes. It should not become an excuse to block ordinary development on harmless lint findings.

## Priority

1. **RF-037/RF-038** remain first because collaboration admission/authentication is the critical trust boundary.
2. **RF-057** follows immediately because it is a concrete authenticated-room cross-peer DoS/integrity defect and is locally bounded.
3. **RF-040** telemetry/privacy lifecycle and **RF-039** upload ingress retain High priority for preview.
4. **RF-041** remote runtime trust, **RF-042**, and **RF-043** follow their existing Stream-C ordering/evidence lanes.
5. **RF-058** runs in parallel as validation discipline and should be applied to each of the above rather than producing a separate duplicate security implementation.

## Non-findings / scope boundaries

- `sha256Uint31(peerId)` is not itself being treated as a broken cryptographic authentication primitive; the defect is using an attacker-controlled copy of that numeric value as sequence-authority identity when a trusted channel identity already exists.
- Annotation/bookmark IDs are not credentials or authorization capabilities. Moving them to `crypto.randomUUID()` improves uniqueness and audit clarity, but does not stop an authorized malicious peer from sending a chosen ID unless the collaboration mutation protocol separately authenticates/authorizes object ownership semantics.
- The RF-030 kernel-inline resource-guard fix is evidence that the architecture can fix this class correctly: enforcement moved to the authority where callers cannot bypass it. The same principle should govern security fixes.