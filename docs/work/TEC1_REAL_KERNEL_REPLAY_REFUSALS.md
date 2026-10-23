# TEC1 real-kernel replay refusal qualification

**Roadmap:** TEC/FM0 evidence integrity, [RFC 0009](../rfcs/0009-persisted-governed-evidence-replay.md). **Status:** LANDED via #1050 (merge c869344, 23 October 2026), bounded test-only tranche. **Base:** `main@4382e1d`.

## High-risk pre-implementation falsification contract

- **Invariant:** A V3 archive exported by the *actual Rust/WASM kernel* cannot reach replay success if a persisted consumer use changes to an unauthorized historical profile or names an absent receipt, even when the modified receipt-entry SHA-256 in the manifest is coherent.
- **Authority/production path:** `NemosyneSession.exportPortablePackage` with `governedEvidence: true` -> `NemosynePackageManager.unpack/pack` -> `InvestigationReplayRunner.replayArchive` using `RuntimeBridge`, `ConsumerPolicyRegistry`, `ConsumerPolicy`. No mocked kernel or substituted registry.
- **Failure modes:** an archive changes a consumer use but retains a valid member checksum; a use whose profile matches no authority policy reaches dataset reconstruction; a receipt ID absent from the Rust bundle receives implied identity; a negative test passes only because the *outer investigation digest* is stale, rather than because the policy refused.
- **Falsifiers:** first show the unmodified, real-kernel exported archive replays with `enforcement: consumer-policy`. Then change one use in that archive, recompute its receipt-entry checksum (but retain the original investigation semantic commitment), re-pack, and require the exact typed `CONSUMER_POLICY_REFUSED` decision, `integrity: verified`, `enforcement: none`, `success: false`, `commandsReplayed: 0`, and zero discrepancies. Two independent mutations: unauthorized profile and dangling receipt ID.
- **STOP/non-goals:** Do not change Rust/TS authority, package formats, receiver policy, or completion status. No claim that a rewritten, fully re-committed archive is authenticated. No hardware/device evidence. CI and post-implementation review are required.

## Exit

Host CI (including WASM, focused test, coverage, security and smoke) must be green on the exact PR head; post-implementation review must confirm these negatives fail for the *policy decision*, not unrelated archive corruption. This proves only two bounded real-runtime policy-refusal cases, not full TEC/FM0 closure.

## Completion record (2026-10-23)

PR #1050 landed at `c869344952ce90bd3e744586a088ae32d61fda9d` after successful Rust/WASM, all three Vitest shards + aggregate, CodeQL, Chromium production/recovery smoke, and approval gate. Real Rust-issued V3 archives reject both unauthorized-profile and absent-receipt use mutations at the typed consumer-policy gate. This retires only this falsifier task, not TEC/FM0 or authenticity/calibration/claim coverage.
