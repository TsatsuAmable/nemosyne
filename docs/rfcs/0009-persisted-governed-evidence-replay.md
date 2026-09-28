# RFC 0009 — Persisted governed evidence and replay integrity

**Status:** accepted
**Date:** 2026-09-28  
**Scope:** accepted TEC1 persistence contract; the first package/digest slice is implemented, while production replay integration and checkpoint completion remain open.

## Context

RFC 0007 and ADR-0007 define Rust-issued receipt bundles and governed resolution. The
exported replay resolver exists, but `NemosyneSession.exportPortablePackage` →
`NemosynePackageManager` → `InvestigationReplayRunner` does not persist or consume receipt
bundles, receipt uses, or governing requirement-profile identities. Structural validation
alone therefore cannot establish end-to-end replay evidence integrity.

RFC 0008 requires historical representation decisions and their digest-bearing signatures
to survive verbatim. The current package and digest contracts must not be silently extended
so that older readers ignore evidence which newer readers treat as authoritative.

## Decision requested

Adopt an explicit package format V3 and `sha256-canonical-investigation-v3` digest for
receipt-bearing investigations, while retaining the existing V1/V2 read contracts unchanged.
Accepted on 2026-09-28. The live roadmap still
controls sequencing and the independent gates for TEC1, PT9 and MCR2+.

### Persisted state and commitment

A V3 package must carry a reserved `investigation/evidence-receipts.json` entry. Its closed
version-1 envelope contains:

- `schemaVersion: '1'`;
- `bundle`: one unchanged Rust-issued `EvidenceReceiptBundleV1` for the final analytical
  dataset and issuing kernel;
- `uses`: records with exactly `consumerId`, `receiptId`, and `requirementProfileId`, each a
  non-empty primitive string. `consumerId` identifies a persisted semantic consumer, not a
  caller-generated assertion of use. A consumer's authority-owned policy must agree with
  its recorded profile; an archive cannot select a weaker profile.

The manifest declares format V3, the V3 digest algorithm, a required investigation digest,
explicit analytical dataset/kernel identities, and the SHA-256 digest of the exact receipt
entry bytes. The V3 semantic digest extends the existing semantic commitment with a
required `governedEvidence` member containing the parsed envelope and its member digest.
It commits the complete bundle, uses, profiles and analytical identities, not just a receipt
count or an `available` flag. Existing shared canonical JSON and SHA-256 utilities own
serialization/hashing; no second hashing implementation is introduced.

The envelope and each receipt remain data, never serialized capabilities. Receipt IDs remain
opaque Rust-issued IDs; TypeScript must not infer aliases from column names or aggregate
DatasetEvidence IDs. Unknown or extra envelope/use fields, duplicate use triples, duplicate
receipt identities and references to nonexistent consumers are invalid. Preserve array order
in the commitment; export snapshots one state and replay does not reorder or normalize it.

The first slice supports one final analytical dataset/kernel context. Multi-dataset or
historical intermediate-state receipts require a later versioned extension. An empty `uses`
array can preserve an inspected bundle but establishes no consumer enforcement. A claimed
receipt-dependent consumer with a missing use must refuse; emptiness cannot bypass policy.

### Verification and authority order

The production loader must complete these steps before exposing a usable replay capability:

1. Enforce the existing archive path, entry and decompression limits; dispatch on the exact
   package/digest version. Reject missing V3 declarations or reserved evidence entries.
   Existing total uncompressed-byte limits apply to receipts too; parsing must not bypass
   them or retain duplicate unbounded copies.
2. Verify the receipt entry byte digest and perform closed structural parsing, including
   the existing receipt provenance and duplicate checks.
3. Reconstruct the analytical dataset through the existing replay path. Compare the bundle
   identity with the reconstructed analytical fingerprint and the actual replay kernel,
   rather than trusting repeated manifest strings. Keep the original portable dataset
   fingerprint distinct from the transformed analytical fingerprint.
4. Verify consumer references and their owning policies, then recompute the V3 investigation
   digest over the restored semantic state and exact evidence envelope. A member checksum
   alone is not investigation integrity.
5. Resolve every required use under its exact historical profile ID and receipt ID, using
   the existing governed resolver/evaluator. An internal resolver may be staged to perform
   these checks, but no capability escapes until all checks succeed. Never substitute a
   current profile, newer receipt or freshly recomputed claim.

Malformed or integrity-invalid V3 input rejects the governed replay path. Well-formed input
whose dataset, kernel, profile, receipt or required axes cannot be resolved remains explicitly
unavailable with the existing typed refusal; it cannot authorize a dependent operation.
Partial success must not expose a capability for an investigation that failed verification.
Historical evidence may remain inspectable as unavailable data. Receipt resolution still
is not scientific admissibility, stability certification, or representation promotion.

### Compatibility and trust limits

V1/V2 packages retain their existing replay and digest behavior, including RFC 0008 retired
signature keys. They provide no governed receipt capability. Export without a captured
Rust-issued bundle remains explicitly V2/receipt-unavailable, and refuses any request that
requires a receipt-bearing export. It must not synthesize an empty successful V3 bundle.
Readers must never retry a malformed V3 package as V2. Older readers should reject V3.

An attacker who rewrites the entire archive, version declarations and every digest can
create a different internally consistent document. Self-contained hashes do not prove Rust
issuance, authentication, custody or historical truth. Even a valid replay capability proves
only consistency and identity under this replay contract; it is not a live Rust capability
or trusted promotion input. Any downstream claim requiring authenticated origin still needs
its separately governed authenticity/admission evidence. Rewriting an archive as V2 cannot
obtain governed receipt authority because V2 never provides it.

## Options considered

- **Optional V2 companion:** less migration work, but older readers can ignore evidence
  commitments and missing metadata is ambiguous. Rejected for governed consumption.
- **Recompute at import:** simple operationally, but changes historical claims and policy.
  Rejected by RFC 0007 identity and RFC 0008 verbatim-history requirements.
- **Explicit V3 with retained legacy readers:** selected. It makes required evidence
  visible in format dispatch and leaves historical digest semantics unchanged.

## Consequences and implementation order

This changes a public format and adds validation/storage cost; it introduces no analytical
method, service, authentication protocol or numerical calculation. Bundles are captured once
from the authoritative live Rust path through the injected analytical port. Failed capture
is unavailable evidence, never a TypeScript substitute.

After acceptance, use separate reviewed tranches:

1. Add V3 package parsing/packing and digest dispatch in `src/session/NemosynePackage.ts`
   and `src/investigation/InvestigationDigest.ts`, retaining V1/V2 readers and limits.
2. Wire authoritative capture/export and governed replay in `src/session/NemosyneSession.ts`,
   `src/session/InvestigationReplayRunner.ts`, and the existing Atlas analytical port/adapters.
   The port must expose the existing Rust producer without a module-global alternate path.
3. Bind actual semantic consumers using Rust-issued identities and authority-owned profile
   requirements. DatasetEvidence aliases need an explicit Rust-issued migration; they are
   not inferred by this format. Qualify production consumption before any TEC1 closure claim.

These tranches share session/digest authority and remain sequential. Independent review,
fixture design and non-colliding documentation may run in parallel.

## Verification plan

Use the real export → pack → clean-room replay entry points with real Rust-issued receipts:

- Positive round trip retains exact bundle, analytical identity, consumer and profile IDs;
  a required consumer resolves only after full investigation integrity passes.
- Mutate/remove the entry, manifest commitment, receipt metadata, use, policy or consumer;
  each refuses before capability exposure. Updating only the member hash still fails the
  investigation digest. A weaker but valid registry profile fails consumer-policy binding.
- Exercise transformed datasets, wrong kernel/dataset, unknown profiles, missing receipts
  and axes, duplicate records, malformed input, archive bounds, and one failing use among
  otherwise valid uses. Missing uses cannot suppress a consumer's requirement.
- V1/V2 compatibility fixtures preserve signatures and historical digests verbatim; V3
  removal/version-skew cannot obtain receipt authority via legacy fallback.
- Check stale-handle capture, single authoritative acquisition, coherent export snapshots
  during concurrent state changes, and cleanup on parse/replay failure.
- Explicitly show that valid self-authored hashes do not satisfy any authenticated-origin
  or scientific-promotion gate. No mock-only test may stand in for production integration.

## Resulting ADR

[ADR-0008](../architecture/decisions/0008-receipt-bearing-package-and-digest.md) records the
implemented package/digest boundary only. Capture/export, governed replay and consumer-policy
integration remain subsequent tranches. RFC 0007, ADR-0007 and RFC 0008 remain governing dependencies.
