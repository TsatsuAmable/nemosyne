# RFC 0004: Governed data-plane vertical slice

**Status:** accepted
**Programme:** P1-PT4A
**Proposed:** 2 September 2026
**Accepted:** 2 September 2026
**Depends on:** accepted RFC 0003
**Implementation:** authorized for the bounded PT4B vertical slice; not implemented by this RFC

## Context

RFC 0003 and PT3B define governed event meaning and executable admission, but Nemosyne still has no production event family, durable consent receipt authority, data-plane authentication, ingestion service, replay ledger, governed durable store, service export or registered-store erasure traversal. The shipped Netlify configuration publishes a static client. The standalone WebSocket service is a collaboration signalling plane, not a product backend, and its room tickets must not become data-plane credentials.

The live `TelemetryCollector` is also unsuitable as the new authority. It records richer local diagnostic state behind an unversioned boolean, while `TelemetryConsentManager` is an off-path in-memory study helper. Reusing either would contradict RFC 0003's purpose-scoped receipts and lifecycle boundary.

PT4 needs one operational end-to-end path without silently deciding the architecture for every later product, study or learning family. This RFC therefore selects the smallest first family and the public trust boundaries needed to exercise it.

## Decision requested

### 1. Start with one bounded Product Mode family

Register `product.operation-applied.v1` only. Its source is a successful production `OPERATION_APPLIED` event after the Atlas/Rust operation commits. A new governed projection copies only the closed operation value:

```text
filter | sort | aggregate | cluster | hierarchical | density | anomaly | timeSlice | compare
```

It must never forward the source event's before/after datasets, row count or another arbitrary field.

The family has these fixed coordinates:

- purpose `product-analytics`;
- data class `PRODUCT_INTERACTION_METADATA` only;
- required purpose-specific profile pseudonym and product-session identity;
- forbidden investigation, discovery and dataset references;
- required application-build, deployment-configuration, UI-treatment and platform-runtime references, with all other runtime components forbidden;
- Product Mode only;
- `CONSENT_RECEIPT` authorization;
- `DISCARD_QUEUED` revocation behavior;
- `GOVERNED_EXPORT` visibility and `REGISTERED_STORE` erasure reachability;
- maximum canonical payload size 256 bytes.

The immutable consent notice is `product-analytics-operation-notice@1.0.0`. The immutable retention policy is `product-analytics-operation-retention@1.0.0`, with 30-day query retention from authoritative server receipt and deletion of expired storage bytes within the following 24 hours. Implementation must add the reviewed artifacts and compute their SHA-256 references; placeholders or self-asserted digests do not enable the family.

The existing telemetry setting remains local-only and is not a receipt. The new family remains default denied when consent, exact runtime configuration, a transport credential or the service endpoint is absent.

### 2. Give consent and identity a durable service authority

The governed data service owns versioned product-analytics consent receipts. An authenticated grant records the exact notice digest, purpose, receipt revision, grant time and current status. Revocation creates a new durable revision; it never mutates historical event evidence into a different meaning. Consent and lifecycle endpoints use closed version-1 JSON bodies and responses:

- `GET /v1/governance/consents/product-analytics/current` returns exactly `schemaVersion`, `purpose`, `status`, `revision`, `receipt`, `profilePseudonymId` and `effectiveAt`; denied or absent consent returns null revision/receipt/pseudonym fields;
- `POST /v1/governance/consents/product-analytics/grants` requires exactly `schemaVersion`, the fixed purpose, the exact notice reference, `confirmed: true`, a UUID action ID and the expected prior revision or null;
- `POST /v1/governance/consents/product-analytics/revocations` requires exactly `schemaVersion`, the fixed purpose, a UUID action ID and the expected current revision;
- `POST /v1/governance/consents/product-analytics/capture-authorizations` requires exactly `schemaVersion`, the fixed family ID, pre-generated event/producer/stream IDs and sequence, then returns the current receipt, pseudonym, server-authoritative authorization time, expiry and a one-use authorization ID.

Consent revision is a positive canonical decimal string. Grant and revoke responses contain exactly `schemaVersion`, purpose, status, revision, receipt, nullable pseudonym, effective time and action ID. Capture-authorization responses contain exactly `schemaVersion`, authorization ID, event/producer/stream IDs, sequence, family, receipt, pseudonym, authorized time and expiry. Refusals use a separate closed error schema with a bounded code and no identity echo.

Grant, revoke and capture authorization serialize on the principal/purpose row. The expected revision is a compare-and-swap guard. The action ID is an idempotency key scoped to principal, endpoint and canonical request digest: an exact retry returns the prior result, while reuse with different content is a conflict. Grant additionally requires an explicit client confirmation made while displaying the exact notice digest. Endpoint scopes are distinct: `consent:read`, `consent:write`, `events:capture`, `events:write`, `events:export` and `events:erase`; one scope does not imply another.

The authenticated principal remains outside event envelopes. The service maps the exact OpenID Connect issuer and subject to:

- a protected deletion handle available only to consent/lifecycle operations; and
- a keyed, purpose-specific profile pseudonym unavailable as a cross-purpose correlator.

Purpose pseudonyms use a minimum 256-bit versioned server key and lowercase hexadecimal HMAC-SHA-256. The preimage is the ASCII domain `nemosyne:purpose-pseudonym:v1\n` followed by each exact UTF-8 issuer, subject and purpose value as an unsigned 32-bit big-endian byte length then those bytes. Their external form is `ppv1_<key-version>_<64-lowercase-hex>`. The protected deletion handle uses a separate minimum 256-bit key and the domain `nemosyne:deletion-handle:v1\n` with the same framing over issuer and subject; it is never returned by product-data APIs. Secrets, raw identity-provider tokens, issuer subjects and deletion handles are forbidden in governed event payloads and logs. Rotation creates a new purpose pseudonym and therefore a new stream; the protected mapping retains only the old-version associations still needed for retention, export or erasure.

The application orchestrator generates `psv1_<UUIDv4>` as a product-session ID and `piv1_<UUIDv4>` as a producer-instance ID for each page/process start. It generates `strv1_<UUIDv4>` with sequence zero for the first stream. Restart, purpose/mode/pseudonym/key change, lost sequence state or an unrecoverable queue/sequence conflict starts a new stream and never guesses the prior sequence.

The client refreshes display state at startup, but startup state never authorizes capture. After a successful operation, the governed projection asynchronously requests a one-use capture authorization; the operation itself does not wait. Issuance is the linearizable consent decision. The producer then assigns client-provenance `capturedAt`, which must be no earlier than `authorizedAt` and no later than the authorization expiry, and uses the returned receipt and pseudonym. Client admission accepts only that matching authorization. Ingestion independently resolves the authorization by authenticated principal plus envelope `eventId`, verifies that its bound receipt, pseudonym, family, producer, stream and sequence equal the envelope, then consumes it in the storage transaction. The authorization ID is service-control metadata and must not be added to the closed envelope or substituted for the `CONSENT_RECEIPT` evidence ID. Revocation serializes against issuance, causes every active client to discard this family's queue when observed, and makes all previously issued but uncommitted authorizations inadmissible under `DISCARD_QUEUED`. A modified or disconnected client therefore cannot turn cached startup state into a later valid capture.

### 3. Use a separate authenticated HTTPS data plane

The first data plane is a single Node service deployed separately from the static client and collaboration signalling server. It is not Vite middleware and has no development-sink fallback. The client does nothing when its explicit HTTPS endpoint is absent.

The browser obtains short-lived JWT access tokens through OpenID Connect Authorization Code with PKCE S256; implicit flow, opaque access tokens, ID tokens used as access tokens and a client secret shipped in JavaScript are forbidden. Access and, where supported, rotating refresh tokens remain in memory rather than browser persistence. Requests send the access token with scheme `Bearer` in the `Authorization` header.

The accepted token profile requires `typ=at+jwt`; a configured asymmetric JWS algorithm from the closed set `RS256 | ES256 | EdDSA`; an HTTPS issuer; a required non-empty `kid`; exact non-empty `iss`, `sub`, `aud`, `exp`, `iat`, `jti` and space-delimited `scope` claims; a configured audience; a maximum five-minute lifetime; and at most 60 seconds of clock skew. Issuer is limited to 2,048 UTF-8 bytes, subject and token ID to 256 bytes, and the scope string to 2,048 bytes. `none`, HMAC algorithms, unexpected algorithms, missing claims, multiple unapproved audiences and tokens outside the configured issuer/audience/scope fail closed. JWKS is fetched only from the configured issuer's HTTPS metadata, bounded to 256 KiB and five seconds, cached for at most one hour, and refreshed once on an unknown `kid`; an unavailable, stale or still-unknown key refuses authentication without falling back. The service binds `(iss, sub, jti)` to a revocable credential-session row, so local revocation takes effect while the JWT has time remaining.

The service never accepts tokens in URLs. Browser origins and redirect origins are allowlisted exactly; credential headers and request bodies are redacted from logs. The provider and TLS termination may be deployment-specific, but missing issuer, audience, allowed algorithm, JWKS authority, durable credential-session state, storage or origin configuration prevents service startup.

The ingestion boundary is `POST /v1/governed-events/batches` with `application/x-ndjson`: one raw governed-envelope JSON text per non-empty line. This preserves PT3B duplicate-key detection. A bounded raw-byte reader allows at most 2,000,000 bytes, at most 16 event lines and at most 1,250,000 bytes per line. It requires `Content-Encoding: identity` and fatal UTF-8 decoding. The whole request is framed and validated before the first event transaction, so a late encoding, line-count or size error cannot follow an earlier write.

Authentication is evaluated before parsing event bodies. An authenticated principal is not collection authorization: every line is independently admitted through `admitGovernedEventEnvelopeV1()` using current server authorities. Inside the event transaction, that authority proves the authenticated `(issuer, subject)` owns the exact receipt revision and that the envelope pseudonym equals the principal's current purpose/key-version mapping. The ordered, closed response has exactly `schemaVersion: "1"`, a server request ID and at most 16 dispositions containing exactly input index, nullable event ID, status and nullable bounded reason code. It never echoes an envelope or converts refusal into success. Status is one of:

- `STORED`;
- `EXACT_DUPLICATE`;
- `REFUSED_GOVERNANCE`;
- `EVENT_ID_CONFLICT`;
- `STREAM_OWNERSHIP_CONFLICT`;
- `SEQUENCE_CONFLICT`;
- `GAP_REFUSED`;
- `STORAGE_FAILURE`.

Events are processed sequentially in request order, one serializable transaction per line; explicit partial success is allowed. HTTP 200 means every line is `STORED` or `EXACT_DUPLICATE`; HTTP 207 carries any mixed/per-event refusal result. Whole-request authentication, media-type, encoding, UTF-8, request-size and line-count failures use a non-success HTTP status and perform no event admission or write.

The client queue contains at most 16 events and 64 KiB of encoded envelope text, permits one flush in flight and is never persisted. Overflow discards the whole optional queue, records only a content-free overflow counter and starts a new stream; it may not create an unrecoverable sequence gap. Only connection failure, HTTP 429/503 and `STORAGE_FAILURE` are retryable. Governance or identity/sequence conflicts discard the affected queue and start a new stream where required. The service permits at most two concurrent requests and 60 capture-authorizations plus 12 batches per minute per principal, 64 authenticated requests globally and one database writer; excess work receives 429 with bounded retry guidance before body parsing. The public listener also caps request headers at 16 KiB, active connections at 128, unauthenticated requests per source at 30 per minute, header receipt at five seconds and the complete request at ten seconds.

### 4. Use one transactional single-node store for the first slice

PT4 uses a versioned relational schema in a separately deployed single-node SQLite database on a local durable POSIX filesystem, not an ephemeral, network or memory filesystem. The Node service is the only writer. The data directory is mode 0700 and database artifacts are mode 0600. It fails closed on unavailable storage, unapplied migrations, failed startup integrity/recovery checks, invalid permissions or an unsupported schema version. The first slice claims process/host restart durability only: no multi-node availability, disk-loss survival, volume snapshot or backup.

Consent receipts, capture authorizations, protected identity/deletion mappings, governed envelopes, ingestion receipt time, authority decision coordinates, stream state and lifecycle dispositions live in separate tables behind purpose-scoped repository capabilities in that database. SQLite runs with WAL, foreign keys, `synchronous=FULL`, `secure_delete=ON` and a bounded automatic checkpoint threshold. A successful shutdown performs `wal_checkpoint(TRUNCATE)`; startup performs recovery and an integrity check before serving. A success response is emitted only after the full commit returns. Weaker settings fail configuration validation.

Current receipt/policy resolution, authenticated-principal binding, one-use capture-authorization consumption, replay/sequence checks and the event write occur inside one `BEGIN IMMEDIATE` transaction. Grant, revoke and erasure use the same writer serialization, so revocation cannot commit between authority evaluation and event storage.

A new stream starts at sequence zero. The same event ID and content digest is idempotent only after principal binding succeeds. The same event ID with different content, a different producer/purpose/profile/family/mode claiming a stream, or a different event claiming an occupied sequence is refused. A sequence above the next contiguous value is returned as `GAP_REFUSED` and is not stored; clients may retry missing events before retrying the gap. Server receipt time is the retention clock and server authority; capture time remains provenance.

The retention runner executes at startup before writes and at least hourly. Query/export predicates make an event unreachable exactly 30 days after server receipt time, never client `capturedAt`; expired storage bytes must be deleted within the next 24 hours, making the honest physical-row lifetime at most 31 days. A failed or more-than-24-hours-overdue purge makes readiness unhealthy and blocks further ingestion until lifecycle processing succeeds. Crash tests must kill the process after pre-commit and post-commit fault points, restart on the same volume and prove that no acknowledged partial event/replay state exists.

Runtime provenance is not silently promoted into attestation. The server independently pins application-build, deployment-configuration and UI-treatment references from its reviewed deployment manifest and requires exact equality. It validates the platform-runtime reference structurally and against an allowed version set, but records it as an authenticated-client claim unless a later attestation mechanism is reviewed. Missing or mismatched references fail admission; successful admission does not claim the client platform was independently attested.

### 5. Bound export and erasure to the registered service scope

Authenticated product-analytics export and erasure remain available after consent revocation. They use separate lifecycle scopes, re-resolve the principal through the protected mapping, and never accept a caller-supplied pseudonym.

- `POST /v1/governed-exports/product-analytics` accepts exactly `schemaVersion`, a UUID action ID and a server-receipt `from`/`to` interval of at most seven days. One snapshot-consistent read transaction first bounds the result to 100,000 records and 100 MiB, otherwise refusing before streaming. Records are totally ordered by `receivedAt` ascending then `eventId` ascending. Each closed record wrapper contains exactly `{ schemaVersion: "1", kind: "RECORD", receivedAt, envelope }`; receipt coordinates are never inserted into the closed envelope. The digest is SHA-256 over the UTF-8 bytes of `nemosyne:governed-export:v1\n` followed by PT3B canonical JSON for the array of those ordered record wrappers. The `application/x-ndjson` response begins with a closed manifest containing exactly `schemaVersion`, `kind: "MANIFEST"`, export/action IDs, interval, generated time, fixed purpose/family, record count and that digest, followed by one canonical JSON record wrapper per line.
- `POST /v1/governed-erasure/product-analytics` accepts exactly `schemaVersion`, a UUID action ID and expected consent revision. In one writer transaction it first creates a revoked consent revision, invalidates outstanding capture authorizations, logically deletes the principal's retained first-family events and stream state, and records per-artifact dispositions. An exact action retry is idempotent; reuse with different content conflicts. A later collection grant requires a new explicit notice confirmation and receipt revision, so another tab cannot recreate the erased state from old consent.

The separately versioned `consent-lifecycle-enforcement-retention@1.0.0` policy retains revoked receipt revisions, idempotency results and protected deletion mappings for at most 30 days after the last server-recorded lifecycle action solely to refuse replay and complete lifecycle traversal; they are unavailable to analytics. Expiry and the 24-hour purge-health rule use server time exactly as for event retention. Its reviewed artifact and digest are required before enablement.

The lifecycle registry enumerates the SQLite main database, WAL, temporary files and any declared volume snapshot/backup artifact. The first slice permits no snapshots or backups. After logical deletion it performs a bounded checkpoint and reports the main/WAL/temp dispositions plus `POLICY_GOVERNED_RETENTION` for still-required consent/lifecycle rows. The closed version-1 erasure response contains exactly request/action IDs, fixed purpose, result and the ordered registered-artifact dispositions. Result is `SERVICE_SCOPE_RESOLVED`, `PARTIAL` or `FAILED`; resolved means the selected product-event records are logically unreachable and every other registered artifact has an explicit completed or policy-governed disposition. Even `secure_delete` does not justify physical-media, subject-wide or GDPR-complete language on flash storage. A client-initiated erasure first clears its active in-memory queue. Unknown or unreachable local/offline/downloaded artifacts remain explicit boundaries and prevent broader completion claims.

Observability is limited to bounded counts, latency buckets and typed refusal/disposition codes. It excludes tokens, raw identities, pseudonyms, event bodies and user content.

## Options considered

### Reuse the telemetry boolean and collector

Rejected. The boolean is not a durable purpose-scoped receipt, and the collector retains fields that are outside the first family's closed payload.

### Reuse collaboration room tickets or the signalling service

Rejected. Room role/capability authority and product-data principal authority have different meanings, revocation and threat models. Reuse would create an authentication bypass and collapse infrastructure planes.

### Implement the slice as Vite middleware, an in-memory store or test-only adapter

Rejected. Those paths cannot prove deployable authentication, restart durability, transactional replay state or production lifecycle behavior.

### Store governed events in the existing browser session/vault IndexedDB

Rejected. Those stores own full scientific session content, silently tolerate some deletion failures and do not provide the required principal/purpose indexes, atomic replay state or service lifecycle boundary.

### Start with provider-specific serverless functions

Rejected for the first slice. The required transactional stream ledger and registered-store erasure should be demonstrated without making a hosting vendor the semantic authority. A later adapter may replace the single-node service if it preserves the same contract and evidence.

### Migrate all telemetry, study, gesture and learning paths at once

Rejected. It expands the trust surface before one complete path is falsified and would conflate distinct purposes and data classes.

## Consequences

### Security and privacy

- Authentication and consent remain independent fail-closed checks.
- Purpose pseudonyms reduce routine correlation but remain personal data, not anonymization.
- The single service/database is an intentionally narrow operational and security boundary; least-privilege deployment, key custody and recovery evidence are required before preview use.
- PT4 can claim logical erasure only for its registered service scope. Physical-media, RF-040 and subject-wide/GDPR claims remain open.

### Product and UX

- Product analytics remains optional and default denied.
- The consent control must show the immutable notice and distinguish remote product analytics from existing local diagnostics.
- Loss of the bounded in-memory queue is an explicit availability tradeoff; scientific or investigator state never depends on delivery.

### Scientific and architectural

- No analytical, representation, NIL, investigation or dataset authority moves into the data service.
- The source event may carry datasets internally, but the governed projection is a one-field closed metadata event.
- The new product-session ID is separate from durable investigation identity, avoiding a dependency on the later `.nemosyne` v3 migration.

### Operational and performance

- The service requires its own deployment, durable volume, OIDC configuration, migrations, retention runner and key material.
- Batch and payload limits bound CPU, memory and transaction size. Backpressure drops or retries optional analytics; it cannot stall an analytical operation.
- SQLite is a deliberate private-preview starting point, not a multi-region or multi-writer commitment.

### Compatibility and migration

- Existing local telemetry, sessions, vault archives, exports, study records, collaboration and development sinks are unchanged and are not silently registered.
- Later families require their own reviewed definitions, policies, producer projections, lifecycle reachability and production-path evidence.
- RFC 0003 does not need amendment because this decision implements its existing identities, purpose, authorization, envelope, revocation and erasure semantics.

## Pre-implementation adversarial contract

### Invariant

A successful operation can become a retained first-family record only when an authenticated principal obtains a linearizable one-use capture authorization under a current exact product-analytics receipt, the client and independent server admission boundaries accept the same bounded envelope, and one transaction rechecks principal/receipt/pseudonym ownership, consumes the authorization, establishes non-conflicting event/stream identity and commits the durable write. Revocation blocks later authorization and invalidates queued work. Export or erasure can reach only the authenticated principal's purpose-specific records, and erasure may report resolved only after every registered artifact has a completed or explicit policy-governed disposition.

### Authority and production path

```text
successful DataOperationController operation
  -> closed one-field governed projection
    -> linearizable capture authorization + bounded runtime provenance
      -> client PT3B admission
        -> bounded in-memory queue
          -> authenticated HTTPS NDJSON batch
            -> independent current-authority PT3B admission
              -> transactional replay ledger + durable store
                -> authenticated purpose export / registered-store erasure
```

### Primary failure modes

1. A source event's datasets or row count leak through the projection.
2. The legacy telemetry boolean or client assertion substitutes for a current receipt.
3. Authentication is treated as consent, or a room ticket is accepted as a data credential.
4. Missing runtime/deployment identity becomes a placeholder.
5. Revocation races capture authorization or leaves queued/directly submitted records admissible.
6. Duplicate, conflicting or gap events partially mutate replay state or storage.
7. A crash leaves an event without replay state, or replay state without the event.
8. Export or erasure accepts a caller-selected pseudonym, crosses principals/purposes or permits old consent to recreate erased state.
9. Logical SQLite deletion is promoted into physical-media, local/offline/downloaded-artifact or subject-wide erasure.
10. Event bodies, tokens or stable identifiers enter logs/metrics.
11. The Vite, remote-log or collaboration service becomes a fallback sink.
12. Unit tests pass through fake ports while the real HTTP handler, durable adapter or World projection remains unprotected.

### Cheapest falsifying evidence

- Drive a real successful operation through the production World/composition path and prove default denial produces no queue entry or request.
- Grant the exact notice, repeat the operation and prove only the operation enum reaches the queue; race revoke against capture authorization and flush and prove one linearized outcome with no post-revocation commit.
- Exercise the real HTTP handler and durable adapter with missing/expired/wrong-audience/wrong-algorithm credentials, stale JWKS, stale/wrong-purpose/other-principal consent, malformed/oversized/invalid-UTF-8/duplicate-key envelopes and digest/retention mutations; prove zero writes.
- Send exact duplicates, event-ID conflicts, stream-owner conflicts, occupied sequences and gaps concurrently; restart the service and prove state and outcomes persist.
- Inject failure between validation and commit and prove transaction rollback leaves neither event nor replay mutation.
- Export and erase through the authenticated lifecycle entry points with two principals, two synthetic product-purpose mappings and one synthetic protocol-bound study identity; prove isolation and traversal without exposing a universal event correlator, plus per-artifact logical dispositions and honest offline/download boundaries.
- Remove each required build/deployment/UI/platform coordinate and prove the real producer refuses before queueing; prove separately that allowed client platform provenance is not reported as attested.
- Overflow the real client queue and saturate per-principal/global service limits; prove bounded memory, no stranded sequence gap, one flush at a time and typed retry behavior.
- Inspect production logs and observability output for tokens, principal identifiers, pseudonyms and event content.

### Non-goals and dependencies

- No migration of the existing telemetry collector, review/analysis-story exports, local sessions/vaults or RF-040 completion.
- No Research Mode, study, gesture, Moneta-learning, dataset-reference or optional backup family. Synthetic second-purpose/study identity fixtures exist only to falsify deletion-handle correlation and traversal.
- No `.nemosyne` v3 identity migration, multi-node database, backup, general account system or GDPR-compliance claim.
- `nemosyne-data` remains an external PT5 dependency and is not part of this data plane.

## Post-draft adversarial disposition

Independent trust-boundary review found and this draft corrected blockers in principal/receipt binding, consent serialization, revocation-at-capture, JWT validation, pseudonym framing, transactional replay and durability, logical-erasure wording, retention time, public schemas, resource limits, cross-purpose traversal, runtime-attestation claims, capture-authorization correlation, timestamp authority and export framing/digests. A final exact-workspace review found no blocker against acceptance. This disposition authorizes only the bounded PT4B implementation and is not implementation, deployment or production-path evidence.

## Verification plan

1. Accept this RFC after independent trust-boundary review and resolve every blocker.
2. Implement policy artifacts, one family, consent/identity authority, producer/queue, HTTP handler, transactional store and lifecycle endpoints in one bounded PT4B tranche.
3. Run the adversarial falsifiers above through real composition, HTTP and restarted-store entry points.
4. Perform independent post-implementation review against this invariant, including logs, deployment fail-closed behavior and store schema.
5. Keep PT4 and RF-040 status below completion wherever production/deployment evidence is absent.

## Resulting ADR

None until implemented. After conforming implementation and production-boundary verification, record `docs/architecture/decisions/0005-production-data-lifecycle-and-event-boundary.md` as required by RFC 0003.
