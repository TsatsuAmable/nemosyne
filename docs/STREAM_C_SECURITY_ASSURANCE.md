# Stream C - Security Authority & Live-Path Assurance

## Purpose

Stream C is the dedicated security, privacy/compliance, supply-chain, and hostile-boundary assurance lane for Nemosyne. It exists to prevent a recurring failure mode in which a hardened helper or isolated module is implemented and thoroughly unit-tested but the production path continues to use a different, weaker, or incompatible authority.

Stream C complements Stream A and Stream B:

- **Stream A** advances the planned product and research architecture.
- **Stream B** independently reviews the merged implementation and fixes defects forward.
- **Stream C** continuously audits security-sensitive and privacy-sensitive production boundaries, consolidates duplicate authorities, and requires adversarial evidence through the live call graph.

Stream C findings use the same repository-wide `RF-*` ledger and the same completion vocabulary as the master roadmap.

## General production-path evidence rule

This rule applies to **all Stream B reviews**, not only security work:

> A claimed product property is not `IMPLEMENTATION LANDED` merely because a helper, isolated module, mock, or unit test demonstrates it. When a property governs a production path, evidence must exercise the real production entry point and the authoritative call graph or boundary that is supposed to enforce it.

This includes security, correctness, scientific semantics, privacy/compliance, performance, recovery, concurrency, provenance, persistence, and UX state.

Unit tests remain necessary, but they are not sufficient evidence for a shipped-capability claim. A hardened module with no production wiring is evidence of an implementation artifact, not evidence that Nemosyne possesses the property.

### Consequences for review

- Security tests must attack the production ingress or admission path, not only the verifier/sanitizer helper.
- Scientific tests must traverse the authoritative analytical path whose result is presented to the investigator.
- Runtime/concurrency tests must exercise the real worker/WASM/browser lifecycle where that lifecycle is part of the claim.
- Privacy/compliance claims must cover actual retained/exported data and lifecycle effects, not only consent bookkeeping.
- Performance claims must measure the complete production workload, including preprocessing, copies, scheduling, allocation, and presentation costs.
- UX completion claims must demonstrate the real interaction trigger, visible response, completion state, recovery, and context preservation.

## Stream C operating rules

1. **One authoritative security protocol per boundary.** Do not retain parallel cryptographic or authorization implementations with divergent schemas or semantics.
2. **Fail closed on ambiguity.** Unknown roles, malformed claims, unsupported protocol versions, unavailable security capabilities, and stale/replayed credentials are rejection outcomes.
3. **Replay prevention belongs at admission.** A nonce cache in an unused verifier does not make the live signalling service replay-safe.
4. **Adversarial evidence follows the attacker-controlled path.** Production-path integration tests are required alongside unit tests.
5. **Do not violate analytical authority while hardening ingress.** Upload hardening must preserve the Rust/WASM analytical and parsing authority and must not introduce a shadow JavaScript parser.
6. **Compliance claims require lifecycle evidence.** Consent, pseudonymization, retention, export, revocation, and erasure must agree across every relevant store and artifact before a compliance property is claimed.
7. **Supply-chain trust should be minimal and explicit.** Remove third-party runtime origins when the production build already bundles the dependency.
8. **Unsafe and parser boundaries require fuzz evidence.** Raw `unsafe`, `unwrap`, or `expect` counts are not vulnerabilities by themselves; attacker-reachable boundary behavior is what must be proved.
9. **A green security helper test is never accepted as live enforcement evidence by itself.**

## Active Stream C findings

These findings are promoted into the repository-wide RF sequence after RF-036.

### RF-037 - Duplicate signalling ticket authorities and replay protection off the live path

**Severity:** Critical  
**Status:** `IMPLEMENTATION PARTIAL`

The live signalling server imports `verifySignedTicket` from `src/network/SignedTicket.ts`. That verifier checks HMAC integrity, expiry, room scope, and role, but does not consume the optional nonce. A valid captured ticket can therefore be replayed until expiry.

`src/network/SignedTicketVerifier.ts` does implement nonce consumption and replay rejection, but it is not the production signalling authority. More importantly, the two implementations are not interchangeable: they define different ticket schemas and different role ontologies.

**Required disposition:**

- define one versioned canonical room-ticket schema and role model;
- make one implementation the sole signing/verifying authority;
- make nonce mandatory for replay-sensitive tickets and consume it atomically with successful admission;
- define nonce-cache lifetime/cleanup and multi-instance deployment semantics explicitly;
- remove or migrate the obsolete implementation rather than leaving two authorities;
- prove valid admission and second-use rejection through `createRoomRegistry().handleConnection()` or the equivalent production gateway path;
- include expiry, room mismatch, malformed signature, unknown version, wrong role, concurrency, and replay cases.

### RF-038 - Scoped role token parser fails open to participant

**Severity:** High  
**Status:** `IMPLEMENTATION PARTIAL`

`authorizePeer()` currently maps every scoped-token suffix other than the exact string `observer` to the more privileged `participant` role. Typographical errors and unknown role names therefore fail open.

**Required disposition:**

- exact-allowlist `observer` and `participant`;
- reject every other suffix;
- prove rejection through the real room-registry admission path, not only a token parser helper;
- retain strict observer capability tests.

### RF-039 - Upload hardening policy is duplicated and production evidence targets the wrong module

**Severity:** High  
**Status:** `IMPLEMENTATION PARTIAL`

`UploadSanitizer.ts` is well-tested but is not the live `FileLoader` upload path. The production path is not naked: it performs a pre-read size cap, routes parsing through Atlas/Rust, validates row/column limits, and the `Dataset` boundary recursively removes dangerous prototype keys. The defect is therefore duplicated/orphaned policy and misleading evidence rather than proof of an unguarded prototype-pollution vulnerability.

**Required disposition:**

- consolidate upload size, filename, shape, and dangerous-key policy at the actual ingress/ownership boundaries;
- preserve Rust/Atlas as the authoritative parse path;
- do not add a JavaScript parsing fallback merely to reuse `UploadSanitizer.neutralizeObject()`;
- feed malicious JSON/CSV through the production `FileLoader -> Atlas -> Rust -> Dataset` path and prove the resulting dataset is safe;
- test oversized input before allocation/read, malformed structure, deep dangerous keys, column/row limits, and filename/control-character handling;
- remove or narrow orphan helpers after equivalent live-path guarantees exist.

### RF-040 - Telemetry consent/GDPR helper is off-path and cannot substantiate its current claims

**Severity:** High  
**Status:** `IMPLEMENTATION PARTIAL`

`TelemetryConsentManager.ts` is not the live telemetry authority. The live `TelemetryCollector` uses a simpler opt-in localStorage flag and defaults safely to disabled. The isolated manager should not simply be wired in as-is: its `ConsentRecord` retains the raw subject identifier, its pseudonym is a small fixed-salt non-cryptographic hash, and `executeRightToErasure()` deletes only an in-memory consent record rather than all linked telemetry, traces, exports, or persisted artifacts.

**Required disposition:**

- inventory every telemetry/trace/study/export store and its retention behavior;
- define one authoritative consent/lifecycle model and explicit scope semantics;
- avoid retaining raw subject identifiers when not necessary;
- use an appropriate pseudonymization design for the threat/privacy model;
- make revocation stop future collection at all live producers;
- make erasure traverse every applicable retained store/artifact or narrow the product claim honestly;
- add end-to-end production-path tests for default-off, grant, scoped collection, revoke, export behavior, and erasure;
- do not claim GDPR right-to-erasure support until lifecycle evidence is complete.

### RF-041 - Unnecessary unpkg trust widening in shipped HTML/CSP

**Severity:** Medium  
**Status:** `IMPLEMENTATION PARTIAL`

`index.html` contains a Three.js import map pointing at `unpkg.com`, and the production CSP allowlists that origin. Vite simultaneously chunks `three` from `node_modules`, so the remote script origin appears unnecessary for the normal production bundle.

**Required disposition:**

- prove dev, production, and smoke paths work without the remote import map;
- remove the import map if unnecessary;
- remove `https://unpkg.com` from `script-src` once no shipped path requires it;
- retain a browser production-smoke regression proving the tightened CSP/build path.

### RF-042 - Dev UX trace terminal output accepts control sequences

**Severity:** Low  
**Status:** `IMPLEMENTATION PARTIAL`

The dev UX trace server JSON-escapes persisted records but interpolates client-controlled values directly into ANSI-coloured terminal output. Control sequences can therefore alter developer-terminal presentation.

**Required disposition:**

- strip or visibly escape C0/C1 controls and ESC from every client-controlled string before terminal presentation;
- preserve machine-readable JSONL behavior;
- add a regression test with ANSI/OSC/control-character payloads.

### RF-043 - Rust parser/WASM ABI hostile-input fuzz evidence gap

**Severity:** High assurance gap  
**Status:** `IMPLEMENTATION PARTIAL`

The presence of `unsafe`, `unwrap`, and `expect` is not by itself a demonstrated vulnerability. The reviewed core memory views are guarded by tracked-allocation/range checks and commonly fail closed. The remaining gap is systematic evidence across attacker-reachable parser and ABI boundaries.

**Required disposition:**

Add fuzz/property campaigns covering at least:

- malformed and truncated CSV/JSON;
- pathological Unicode and deeply nested structures within governed limits;
- NaN, infinities, extreme magnitudes, extreme dimensions, and degenerate datasets;
- typed-buffer metadata, validity vectors, offsets, lengths, and mismatched shapes;
- stale, foreign, zero, overflowing, and boundary pointer/length pairs at exported WASM ABIs;
- allocation exhaustion and repeated allocate/deallocate/reinitialization sequences.

Every discovered defect must become a deterministic regression test in the normal PR gate. Fuzz/soak campaigns complement deterministic merge evidence; they do not replace it.

## Stream C exit criteria

Stream C is not complete merely because RF-037 through RF-043 are closed individually. The stream reaches a verified baseline only when:

- security-sensitive production entry points have one explicit authority each;
- attacker-controlled paths fail closed under malformed, stale, replayed, and ambiguous input;
- production-path integration tests prove the security properties claimed by the product;
- privacy/compliance wording matches actual lifecycle behavior;
- unnecessary runtime supply-chain trust has been removed;
- deterministic regressions exist for every fuzz-found security/correctness defect;
- Stream B independently re-reviews the resulting live paths.

## Relationship to the master roadmap

This document is a detailed work package under `docs/ROADMAP.md`. The master roadmap remains the implementation-status authority. RF-037 through RF-043 should be treated as active review/fix-forward findings until their dispositions and evidence are reflected in the master ledger.
