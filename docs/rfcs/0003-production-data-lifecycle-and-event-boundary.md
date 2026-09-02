# RFC 0003: Production data lifecycle and governed event boundary

**Status:** proposed
**Programme:** P1-PT3A
**Proposed:** 2 September 2026
**Implementation:** deferred until this RFC is accepted

## Context

PT2 established a governed external corpus, but Nemosyne does not yet have one production contract for identity, consent, collection purpose, retained-data lifecycle, runtime provenance or collection events. Building ingestion or storage before fixing those meanings would turn incidental client shapes into a public privacy and replay contract.

The current surfaces are useful but fragmented:

- `TelemetryCollector` is the live local product-telemetry path. It defaults off and retains in-memory summaries, but the setting is duplicated across two unversioned, unscoped localStorage records that can disagree at startup.
- `TelemetryConsentManager` derives cryptographic pseudonyms and avoids retaining raw subject IDs, but it is not on the live collection path and erases only its own in-memory consent record.
- dev UX traces POST a separate trace stream to a local JSONL sink and use their own session UUID.
- study trials, gesture-capture uploads, representation judgements and investigation events each carry different identity, consent and provenance subsets; several are not active in the production composition root.
- `ResearchContext`, `NemosyneSession`, `DiscoveryEpisode`, canonical dataset fingerprints and `StudyFreezeManifest` already own important identities. A production-data plane must reference them rather than mint replacements.
- `.nemosyne` and review-bundle downloads are user-controlled export boundaries. They cannot be represented as remotely erasable after leaving service control.

RF-040 therefore remains open: local helper behavior is not production-path evidence for revocation, export or erasure across all applicable stores and artifacts.

### Current producer, store and export inventory

Unknown or dormant paths are part of the threat model; omission is not evidence that they retain nothing.

| Surface | Current status | Current retention/export | Current deletion reach | PT3 disposition |
| --- | --- | --- | --- | --- |
| `TelemetryCollector` | production-live, default off | in-memory aggregates plus dataset label, last raw error text and a bounded raw frustration-event trail; included by analysis-story export | `reset()` clears counters/error but not the analyzer trail; reload/disposal ends memory retention | operational/product metadata plus possible `DIAGNOSTIC_CONTENT`; not governed collection until payloads are minimized and registered |
| telemetry preference stores | production-live | `nemosyne-vr-settings.telemetryEnabled` and the separate `nemosyne-telemetry-consent.enabled` localStorage record persist until overwritten/browser-cleared; the collector loads the latter while the Settings panel loads the former, so stale/divergent values are possible | a normal Settings toggle writes both, but neither load path reconciles them; browser clear is the only whole-client removal | local product persistence; neither boolean is a versioned authorization receipt, and PT3 migration must fail closed on disagreement |
| other `SettingsPanel` preferences | production-live | `nemosyne-vr-settings` also includes collaboration room/name and other settings until overwritten/browser-cleared | active-client overwrite/browser clear only; no remote or subject-wide traversal | local product persistence; do not promote incidental settings into governed identity or authorization |
| `AnalysisStoryExporter` | production-live, user initiated | downloaded PNG/JPEG scientific-view screenshots or unsanitized JSON containing dataset metadata, camera/theme state, telemetry and analysis operations with unrestricted parameters | outside service control after download | compound `PRODUCT_INTERACTION_METADATA`, `DIAGNOSTIC_CONTENT` and `SCIENTIFIC_SESSION_CONTENT`; user-directed export |
| review bundles | production-live, user initiated | downloaded telemetry, metadata or full session/dataset rows | outside service control after download | metadata plus possible `SCIENTIFIC_SESSION_CONTENT`, user-directed export |
| `SessionStore` | production-live | IndexedDB autosave/manual snapshots and shared settings until per-ID delete/browser clear | per-session delete; no subject-wide traversal | `SCIENTIFIC_SESSION_CONTENT`, local product persistence |
| `VaultArchiveStore` | production-live | IndexedDB full snapshots and archive index until per-archive delete/browser clear | per-archive delete; no subject-wide traversal | `SCIENTIFIC_SESSION_CONTENT`, local product persistence |
| `.nemosyne` package | production-live, user initiated | downloaded raw dataset, command log, discoveries, NIL outcomes and provenance | outside service control after download | `SCIENTIFIC_SESSION_CONTENT`, user-directed export |
| dev UX trace sink | development-only | in-memory buffer, dev-server JSONL/session-manifest files and terminal projection until operator deletion | local file/operator cleanup only | may contain `RAW_SPATIAL_TRAJECTORY` and interaction metadata; excluded from production deployment |
| `RemoteDebugStreamer` and remote-log sink | DEV-gated | in-memory console/error/user-agent queue POSTed to `/__remote-logs`; Vite sink appends a local log file until operator deletion | local buffer disposal plus file/operator cleanup | `DIAGNOSTIC_CONTENT`; excluded from production builds and never a governed fallback sink |
| dev evidence telemetry override | validation-only | temporarily enables the live in-memory collector during load tests and posts summaries to the local evidence sink | restores the previous preference after the run; evidence files require separate cleanup | `GOVERNED_VALIDATION_EVIDENCE`; a validation override is not product-analytics consent |
| Quest/load-test evidence sinks | validation-only | governed evidence directories/reports until campaign retention action | session/evidence-directory tooling; no subject lifecycle claim | `GOVERNED_VALIDATION_EVIDENCE`; not product analytics |
| `GestureCaptureUploader` | dormant/off-path | in-memory queue plus configured feature/raw upload and delete endpoint | helper-local/API behavior only | derived/raw gesture classes; cannot activate before PT6 consent and registry gates |
| representation judgement/learning stores | dormant/off-path | currently in-memory/test-oriented records | helper-local only | `HUMAN_JUDGEMENT_DISCOVERY_EVIDENCE`; cannot activate before PT9 admission rules |
| formal study records/export | dormant/off-path from normal product | in-memory trials/events, then downloaded bundle/CSV | process memory plus external download | `GOVERNED_STUDY_RECORD`, protocol-scoped collection/export |
| collaboration state/pose traffic | production-live realtime transport | transient peer/signalling state, camera pose and current dataset label are shared with room peers; no governed durable product-data store is claimed | connection/room lifecycle only; recipient copies are outside the sender's later control | excluded from the event envelope unless a later registered logging family is approved; UI/disclosure must describe the dataset-label sharing boundary |
| `broadcastUserTelemetry` peer API | dormant/off-path outside tests | arbitrary caller-supplied telemetry can be sent transiently to peers | channel/room lifecycle only | cannot become a collection or sharing bypass; activation requires a closed collaboration payload and explicit purpose |

PT3 implementation must turn this inventory into an executable store/family registry and must update the inventory when a producer, queue, sink, export or retention behavior changes.

## Decision requested

Accept the following boundary as the contract PT3 implementation must realise.

### 1. Preserve separate canonical identities

The production-data plane references, but does not redefine, these identity classes:

| Identity | Meaning | Rule |
| --- | --- | --- |
| installation | one installed client state | never substitutes for a person or durable investigation |
| profile pseudonym | purpose-bound pseudonymous product profile | raw account/study identifiers are not copied into collection events |
| product session | one bounded application run | not a durable investigation identity |
| investigation | durable analytical/reasoning lineage | must not be inferred from session identity |
| discovery episode | one governed discovery-lifecycle record | references its canonical investigation ancestry |
| dataset | exact scientific content and, when catalogued, catalogue ID/version/digest | canonical fingerprint remains the scientific identity authority |
| runtime/build | exact executing treatment and deployment | no fallback such as `unknown`, `dev` or a marketing version in governed evidence |
| model | semantic version plus immutable artifact digest when learned/adaptive | version alone cannot identify an adaptive artifact |
| study/rollout assignment | explicit treatment allocation | never inferred from UI state or feature availability |

Identifiers must be non-empty, type-distinguishable and generated by their owning authority. A collection envelope may correlate them only through explicit references. It may not collapse installation, profile, session and investigation identity into one convenient token.

The application/session orchestrator owns product-session identity. The Investigation/Atlas aggregate owns durable investigation identity. Persistence, export and collection adapters carry those identities but may not mint, reinterpret or repair them.

The present compatibility collision is decided explicitly:

- new live state receives a product-session ID and a durable investigation ID from separate owning generators;
- a new investigation may span product sessions, while one product session may open or create more than one investigation;
- new `DiscoveryEpisode` records reference the durable investigation ID;
- existing `.nemosyne` format-v2 packages preserve their historical `sessionId` as a provenance-bearing `legacyInvestigationId` on read, while opening the package creates a fresh product-session ID;
- existing discovery records retain their historical investigation ID exactly; migration may not silently mint new ancestry;
- the later PT3 implementation must introduce a separately reviewed `.nemosyne` format-v3 field for the durable investigation identity before governed collection is enabled. Format v2 remains readable under the explicit legacy mapping.

### 2. Authorize collection by explicit purpose

There is no generic `analytics` consent that authorizes every data flow. The initial closed purpose registry is:

| Purpose | Representative data | Minimum authorization |
| --- | --- | --- |
| operational diagnostics | bounded failure/performance diagnostics | explicit deployed policy plus user-visible disclosure; subject linkage requires explicit consent |
| engineering qualification | dev/validation diagnostics and governed campaign evidence | exact validation manifest/campaign policy; human-subject linkage requires the applicable study consent |
| product analytics | workflow and product-friction events | explicit product-analytics consent |
| derived gesture learning | derived pose/gesture features and corrections | explicit derived-gesture consent |
| raw trajectory research | raw hand/controller/head trajectories | separate explicit raw-trajectory consent and approved research/training protocol |
| Moneta learning evidence | representation judgements and admissible discovery outcomes | explicit Moneta-learning consent; recommendation acceptance alone is not ground truth |
| governed study collection | protocol-declared trial/events/measures | versioned study consent tied to the frozen protocol |
| consent/lifecycle enforcement | receipts, revisions, revocations and erasure traversal | necessary governance operation under the applicable account/study authority; never a product-learning purpose |
| local product persistence | local sessions, settings and vault archives | necessary local product operation plus accurate disclosure; no remote collection authority |
| user-directed export | `.nemosyne`, review, analysis-story and study downloads | explicit user action for the selected artifact and destination |
| optional backup/share | future remote session backup or sharing | separate destination- and purpose-scoped authorization; not implemented by this RFC |

Every optional purpose defaults denied. Granting one purpose cannot authorize another. Raw trajectories must never be classified as ordinary product analytics. A UI transition or settings toggle is not itself a durable consent receipt.

Every admitted envelope carries one or more immutable `AuthorizationReferenceV1` records, including events admitted without optional consent. An event-family definition declares the exact authorization basis or combination of bases it accepts:

- `CONSENT_RECEIPT` identifies the consent authority, receipt ID, revision, authorized purpose and the immutable notice/policy ID, version and digest evaluated at capture;
- `DEPLOYED_POLICY` identifies the approved policy ID, version and digest authorizing a necessary disclosed operation;
- `FROZEN_STUDY_PROTOCOL` identifies the protocol/freeze manifest ID, version and digest and must be combined with the applicable `CONSENT_RECEIPT` for governed study collection;
- `EXPLICIT_USER_ACTION` identifies the bounded action/transaction ID plus the export/share policy ID, version and digest;
- `VALIDATION_MANIFEST` identifies the qualification campaign/session manifest ID, version and digest and must be combined with study consent when it links human subjects.

Each reference repeats the exact purpose it authorizes. Unknown bases, missing coordinates, purpose mismatch, an expired or superseded policy where the family requires the current revision, and an incomplete required combination fail closed. Authorization evidence is distinct from transport authentication: authenticating a client or account does not authorize collection, and an authorization reference does not authenticate its sender.

### 3. Classify every registered event family

The initial closed data-class registry uses the ordered sensitivity levels `LOW < PSEUDONYMOUS < SENSITIVE < HIGHLY_SENSITIVE`:

| Data class | Allowed purpose(s) | Sensitivity | Boundary |
| --- | --- | --- | --- |
| `BOUNDED_OPERATIONAL_AGGREGATE` | operational diagnostics, engineering qualification | LOW, or PSEUDONYMOUS when identity-linked | bounded counters/timings without raw content |
| `PRODUCT_INTERACTION_METADATA` | product analytics, user-directed export | PSEUDONYMOUS | workflow/action metadata; no raw spatial trajectory, diagnostic text or scientific rows |
| `DIAGNOSTIC_CONTENT` | operational diagnostics, engineering qualification, user-directed export | SENSITIVE | error/console text, user-supplied labels, targets or other content-bearing diagnostics require minimization/redaction |
| `SCIENTIFIC_DATASET_REFERENCE` | product analytics, Moneta learning evidence, governed study collection, engineering qualification, user-directed export | SENSITIVE | exact fingerprint/catalogue coordinates without dataset rows; may still reveal which scientific data is used |
| `DERIVED_GESTURE_FEATURE` | derived gesture learning | SENSITIVE | derived behavioral/biometric features; no raw trajectory |
| `RAW_SPATIAL_TRAJECTORY` | raw trajectory research | HIGHLY_SENSITIVE | hand/controller/head samples; separate protocol and consent required |
| `HUMAN_JUDGEMENT_DISCOVERY_EVIDENCE` | Moneta learning evidence, local product persistence, user-directed export | SENSITIVE | investigator-authored judgement/reasoning; never inferred from acceptance clicks |
| `GOVERNED_STUDY_RECORD` | governed study collection, user-directed export | HIGHLY_SENSITIVE | protocol-controlled research record with frozen treatment and consent identity |
| `GOVERNED_VALIDATION_EVIDENCE` | engineering qualification | SENSITIVE | attributable engineering/qualification evidence; never silently reclassified as deployed operational telemetry, product data or study data |
| `SCIENTIFIC_SESSION_CONTENT` | local product persistence, user-directed export, optional backup/share | HIGHLY_SENSITIVE | datasets, session state, evidence and command history; remote transfer requires explicit destination-scoped authorization |
| `CONSENT_LIFECYCLE_RECORD` | consent/lifecycle enforcement | HIGHLY_SENSITIVE | protected receipt/revision/purpose/deletion-locator state; unavailable to analytics or learning |

An event family declares a non-empty set of data classes. Its purpose must appear in the allowed-purpose intersection of every declared class; an empty intersection is refused. `DatasetEvidenceReferenceV1` requires `SCIENTIFIC_DATASET_REFERENCE`, so combining dataset context with product interaction metadata is admissible only for explicitly consented product analytics or an explicit user-directed export and carries `SENSITIVE` effective classification. The effective sensitivity is the maximum declared level, including envelope identity/context metadata; storage or indexing cannot downgrade it.

An unlisted class is invalid. Payload schemas may narrow fields but cannot remove a required class, lower effective sensitivity or expand allowed purposes without a versioned registry decision. Credentials, private keys, pseudonymization secrets, raw authentication tokens and unrestricted environment/configuration values are forbidden payload and envelope content, not another admissible data class.

Each event-family definition must declare:

- one payload schema and schema version;
- collection purpose and a non-empty data-class set;
- whether profile, session, investigation or discovery identity, `DatasetEvidenceReferenceV1`, and each runtime-provenance component are required or forbidden;
- derived effective sensitivity, minimum-field and size rules;
- retention-policy identity;
- required authorization basis or combination of bases;
- export visibility;
- revocation behavior and erasure reachability;
- whether the family is admissible in Product Mode, Research Mode or both.

Unknown families, unknown versions, arbitrary payload extensions and a purpose/classification mismatch fail closed. Product telemetry, gesture-training data, Moneta evidence and governed study records remain separate classes even if a backend later shares transport or storage infrastructure.

### 4. Wrap collection in `GovernedEventEnvelopeV1`

The collection envelope is a versioned transport/persistence boundary, not a replacement for `WorldEventBus`, Atlas `ResearchEvent`, NIL commands, study-domain events or `DiscoveryEpisode`.

Every admitted envelope contains:

- exact envelope version, registered event-family ID and payload-schema version;
- immutable event ID, stream ID and monotonic stream sequence;
- capture timestamp and declared source component;
- explicit mode (`PRODUCT` or `RESEARCH`);
- only the profile/session/investigation/discovery identity references allowed by its family definition;
- a separate `DatasetEvidenceReferenceV1` when required by its family definition;
- `RuntimeProvenanceV1`;
- a non-empty set of `AuthorizationReferenceV1` records satisfying the family's exact basis requirements;
- `RetentionPolicyReferenceV1` with immutable policy ID, version and digest;
- bounded payload plus integrity digest.

The producer validates before record/queue/export. PT4 ingestion validates again before durable storage. Unsupported versions, missing required identity, forbidden identity, invalid digest and over-limit payloads are refused rather than repaired.

The event-family registry pins the allowed `RetentionPolicyReferenceV1`; a producer cannot select a weaker policy. The referenced policy owns duration, legal/operational basis, storage class, post-revocation disposition and deletion or review triggers. Policy revisions create new immutable versions rather than mutating the meaning of retained events.

A stream is owned by one producer instance, purpose-bound pseudonym, mode and event family. Each browser tab/process uses a distinct producer-instance identity. The producer assigns contiguous sequence numbers at capture; restart, identity/purpose/mode change or lost sequence state creates a new stream ID. Client capture time is provenance, not server time authority; ingestion records its own receipt time. Delivery may be retried, batched and arrive out of order. Ingestion therefore does not reject an event merely because arrival order differs: the same event ID plus digest is idempotent, the same ID with different content is refused, and conflicting sequence ownership or an unresolved gap receives an explicit non-success disposition rather than silent reordering.

`DatasetEvidenceReferenceV1` is context, not runtime identity. Its canonical scientific identity is the dataset fingerprint. A governed corpus reference additionally pins repository plus exact revision, catalogue schema version, corpus version, dataset ID/version/content digest and artifact tier/role/SHA-256. PT5 must populate these coordinates from the verified catalogue rather than from display labels or mutable `main` state.

### 5. Make runtime provenance exact

`RuntimeProvenanceV1` carries the exact applicable identities for:

- application source/build and deployment/configuration;
- Rust/WASM kernel;
- Representation Ontology/Graph treatment;
- Moneta engine and FitnessModel version plus artifact digest when learned;
- NIL;
- perception and gesture model/treatment;
- UI treatment and platform/runtime class;
- declared random seeds for reproducibility-bearing events.

An event-family definition may mark a component inapplicable, but an applicable component may not silently become `unknown` or inherit a hard-coded placeholder.

### 6. Keep Product and Research modes distinct

Product Mode may use only approved adaptive artifacts that are versioned, observable and rollbackable. The envelope records the exact artifact identities actually used.

Research Mode requires a frozen runtime vector or protocol-declared treatment variables. It must reuse and extend the existing `StudyFreezeManifest`/`StudyFreezeGuard` authority rather than create a parallel freeze mechanism. Unknown or drifting applicable runtime identity blocks the next governed collection event in Research Mode; it does not block ordinary local Atlas event recording.

### 7. Treat lifecycle claims as end-to-end properties

A consent authority owns versioned grants, revisions and revocations. Authorization validity is evaluated at capture, and revocation blocks every later capture for that purpose. Capture-time validity and post-capture disposition are separate:

- ordinary optional product/learning events queued at revocation are discarded by default;
- a governed study record captured before revocation follows the versioned consent notice, applicable legal/ethics basis, protocol withdrawal rule and retention policy, which together may require discard, restriction/quarantine, de-identification, erasure or justified retention;
- ingestion verifies the capture-time receipt revision and the event family's current post-revocation disposition; it does not treat either historical consent or current revocation as universal permission or universal deletion;
- already admitted records are never silently rewritten. Their registered lifecycle policy governs disposition and preserves an auditable result.

Export and erasure are store-registry operations, not consent-row operations. A future erasure result must enumerate every applicable registered store/artifact and return a fail-closed disposition for each. Nemosyne must not claim subject-wide or GDPR erasure while an applicable store is unknown, unreachable or untraversed.

User-downloaded `.nemosyne`, review, study or data exports are outside later service-side erasure control after download. Export UI and policy must disclose that boundary without implying remote recall.

Purpose-bound pseudonyms do not create a universal correlator in event records. The consent/identity authority holds a separate protected deletion handle that can resolve the purpose-specific pseudonyms and registered stores applicable to an authenticated erasure request. Raw account/study identity and pseudonymization keys remain outside event payloads. PT3 implementation must define key rotation and deletion-handle recovery without making event streams cross-purpose linkable by default.

Product purposes derive distinct pseudonyms so ordinary stores cannot join them by token. Governed studies use a separate protocol-bound participant pseudonym, not the product-profile token. The protected deletion mapping records only the associations required to traverse applicable stores, has its own retention/deletion policy and is unavailable to analytics, learning and event-family payloads. A PT3 falsifier must grant at least two purposes plus one study identity, then prove an authenticated erasure traversal reaches the correct stores without exposing a universal event correlator.

Offline browser stores are not always remotely reachable. Local erasure can traverse stores on the active client; service-side erasure reports inaccessible/offline client stores explicitly and cannot return complete while a required registered store is unresolved. Uninstalling or never reconnecting a client is an honest reachability boundary, not evidence of remote deletion.

### 8. Keep configuration and secrets outside evidence semantics

Deployment chooses endpoints, credentials, pseudonymization keys, retention implementations and regional storage. Governed events carry immutable versioned policy/configuration references, never secrets. Development sinks cannot become production sinks through a missing flag or fallback endpoint.

## Threat model

The contract assumes malformed or hostile client input at ingestion even when the official client performed capture validation. Relevant actors and boundaries include:

| Threat / boundary | Required response |
| --- | --- |
| compromised or modified client fabricates identity, consent or provenance | authenticate transport separately; validate registered schema, authorization revision, integrity and bounds again at ingestion; provenance remains a claim unless independently attested |
| replay, duplicate delivery, concurrent tabs or reordered offline batches | producer-instance streams, idempotent exact duplicates, conflict refusal and explicit gap disposition |
| cross-purpose linkage by store/operator | purpose-specific product pseudonyms, protocol-specific study pseudonyms and no universal event correlator |
| compromised pseudonymization key or deletion mapping | separate protected authority, rotation/recovery procedure, least access and auditable lifecycle operations |
| local/dev trace endpoint exposed in production | build/runtime exclusion plus no fallback from a governed endpoint to the dev sink |
| collaboration peer sends arbitrary fields or identities | realtime peer traffic is untrusted and cannot enter durable collection without a registered family and ordinary admission |
| curious or compromised storage/analytics operator | data minimization, class/purpose separation, bounded access and no secret material in events |
| exported recipient or copied local artifact | explicit user-action boundary and disclosure; never claim remote recall or completed service-side erasure |
| offline, lost or uninstalled client | report lifecycle reachability honestly; no completion while a required reachable-store action remains unresolved |

This RFC does not claim client attestation, legal compliance or protection against a fully compromised service. PT3 implementation must document the deployed authentication, key, store and regional threat model before collection is enabled.

## Options considered

### Reuse the current telemetry boolean as global consent

Rejected. It is unversioned, unscoped and cannot authorize biometric, training, study or discovery-evidence collection.

### Wire `TelemetryConsentManager` directly into every producer

Rejected. Its cryptographic pseudonym behavior is useful, but the helper has no durable receipt/revision, store registry, queued-event revocation or end-to-end export/erasure semantics.

### Let each producer define its own envelope and lifecycle

Rejected. That preserves the current identity/provenance gaps and makes revocation or erasure unverifiable across the product.

### Use `WorldEventBus` or Atlas `ResearchEvent` as the collection schema

Rejected. Both have valid local/domain roles but lack the public trust-boundary metadata and closed payload registry required for governed collection. Recasting either would also conflate transport with interaction or investigation authority.

### Build the backend first and derive contracts from stored records

Rejected. Storage convenience would silently decide privacy, identity, replay and research semantics before review.

### Adopt one governed envelope around existing domain events

Proposed. This preserves current authorities, creates one admission boundary and allows PT4 transport/storage choices without changing event meaning.

## Consequences

### Privacy and security

- Optional collection is default-denied and purpose-scoped.
- Pseudonymization reduces direct identification but is not anonymization; the threat model covers correlation and key compromise without claiming they are fully solved in PT3A.
- Revocation and erasure remain unverified until all real producers, queues, stores and exports implement the registry contract.

### Scientific and research

- Dataset, analytical, representation, interaction, discovery and learning authorities remain separate.
- Governed collection events in Research Mode become rejectable when treatment identity is incomplete or drifting; ordinary local Atlas events keep their existing domain behavior.
- Product analytics cannot be promoted into scientific or model-training evidence merely because it shares an envelope.

### Compatibility

- PT3A does not itself change `.nemosyne`, catalogue, World event, NIL, study-event or Atlas-event formats. The accepted identity decision requires a separately reviewed `.nemosyne` v3 migration during later PT3 implementation before governed collection is enabled; format v2 remains readable through the explicit legacy mapping.
- Later envelope/schema changes use explicit versioning; unknown versions fail closed.
- Existing local telemetry remains default-off but does not become governed collection until a later production-path tranche migrates it.

### Operational

- PT4 must implement a registry-aware admission, storage, export and erasure vertical slice.
- PT5 catalogue/NIL integration consumes a commit-pinned PT2 corpus; it must not mutate this data-lifecycle contract implicitly.
- Retention durations and deployment infrastructure remain policy/configuration decisions recorded by identity, not hard-coded into this RFC.

## Pre-implementation adversarial contract

### Invariant

No governed event, retained artifact or export may imply a profile/investigation/discovery identity, collection purpose, consent state or runtime treatment that was absent, stale, defaulted or unverifiable at capture time. Governed collection events in Research Mode cannot be recorded under an unknown or drifting frozen runtime.

### Authority and future production path

TypeScript governance contracts own collection identity references, purpose authorization, lifecycle and envelope admission. They surround but do not redefine Atlas/Rust analytical authority, NIL interaction meaning, `DiscoveryEpisode`, canonical dataset identity or study-freeze authority.

The later enforcement path is:

```text
real producer
  -> registered family + current purpose authorization + runtime provenance
    -> fail-closed client admission
      -> bounded authenticated PT4 transport
        -> fail-closed ingestion admission
          -> registered durable store
            -> governed export / lifecycle traversal
```

### Primary failure modes

1. Session identity is silently promoted into durable investigation identity.
2. A default/anonymous/raw identifier becomes a governed profile identity.
3. One consent scope authorizes another data class.
4. A consent-free event cites an unversioned, stale or purpose-mismatched deployed policy as authority.
5. Revocation stops one producer while traces, uploads or queues continue.
6. Deleting a consent record is reported as subject-wide erasure.
7. Arbitrary JSON becomes an unreviewed event family.
8. Duplicate/conflicting events or sequence ownership are accepted, or valid out-of-order delivery/client time is mistaken for replay/server time.
9. Hard-coded or missing build/model identity is emitted as provenance.
10. Product adaptive state silently enters a frozen research treatment.
11. A producer substitutes a weaker or mutable retention policy.
12. Downloaded exports are represented as remotely erasable.

### Falsifying evidence required before PT3 implementation promotion

- reject unknown envelope/payload versions, families, purposes, classes, modes and extra properties;
- reject missing, empty, forbidden or inconsistent identity references;
- prove every optional purpose defaults denied and cannot authorize another purpose;
- reject missing, unknown, stale, superseded or purpose-mismatched authorization references, including deployed-policy events that do not require optional consent;
- require the complete protocol-plus-consent and human-validation-plus-consent authorization combinations where applicable;
- revoke a grant and prove later capture is refused while each queued/retained family follows its explicit post-revocation policy;
- reject an unknown, mutable, unversioned or family-incompatible retention-policy reference;
- prove exact duplicates are idempotent, conflicting duplicates/sequence ownership fail closed and out-of-order batches receive explicit gap handling;
- mutate every applicable Research Mode runtime component independently and block the next governed event;
- require exact learned-artifact digests for adaptive Product Mode events;
- reject raw trajectories classified as product analytics;
- mutation-test the closed event-family registry;
- grant multiple product purposes plus a study identity and prove erasure traversal without a universal event correlator;
- keep explicit tests proving local session deletion and downloaded-export boundaries are not subject-wide erasure evidence.

### Non-goals and dependencies

- No backend, network transport, durable consent store or account system in PT3A.
- No production wiring of telemetry, trace, gesture, judgement or study producers.
- No `.nemosyne`, Atlas, NIL or study-event format mutation in PT3A; the accepted contract schedules the separately reviewed v3 identity migration for later PT3 implementation.
- No RF-040 completion, GDPR compliance claim or product-path erasure claim.
- PT3 implementation starts only after this RFC is accepted; PT4 and PT5 consume the resulting contract.

## Post-draft adversarial disposition

Independent adversarial review found and this draft corrected blockers in the live producer/store/export inventory, product-session versus investigation compatibility, compound data classification, dataset-reference provenance, stream/replay semantics, purpose-specific pseudonym separation, post-revocation disposition, authorization evidence and retention-policy immutability. The corrected inventory explicitly includes both potentially divergent telemetry preference records, screenshot and unrestricted analysis-story exports, the remote debug sink, validation overrides and transient collaboration dataset-label sharing.

No blocker remains against proposing the RFC. One deliberate defer remains: `RAW_SPATIAL_TRAJECTORY` is not authorized for `engineering qualification`. Current dev traces stay excluded from production, and a later reviewed registry/RFC change is required before raw human spatial traces may be collected for qualification; they cannot be relabelled as generic validation evidence. Executable schemas must also select stable purpose IDs and digest algorithms/canonicalization before implementation promotion.

This disposition is review evidence for the proposal, not RFC acceptance, implementation evidence or production-path verification.

## Verification plan

1. Review the identity/purpose/classification matrix against every current producer, store and export path.
2. Implement pure closed-schema contracts and validators in a later PT3 tranche.
3. Add the listed negative tests before connecting any producer.
4. Exercise each real producer at its capture boundary, then exercise PT4 ingestion independently.
5. Prove lifecycle traversal against all registered stores before changing RF-040 status.
6. Create an immutable ADR only after the accepted contract is implemented and production boundaries conform.

## Resulting ADR

None while proposed. If accepted and implemented, record the durable boundary in `docs/architecture/decisions/0005-production-data-lifecycle-and-event-boundary.md`.
