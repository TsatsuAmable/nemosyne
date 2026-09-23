# RFC 0008 — Historical DatasetSignature keys are digest-bearing persisted state

- **Status:** accepted
- **Date:** 2026-09-23
- **Scope:** TEC2 governance correction; no format change in this tranche.

## Context

TEC2 (`feat/tec2-heuristic-terminology-migration`) renamed or removed the six
"bootstrap heuristic" fields at the Rust transport
(`docs/audits/TEC2_HEURISTIC_TERMINOLOGY_INVENTORY_2026-09-21.md`) and deleted
the TypeScript shadow recomputation of the correlation pair count. The
inventory and its closure record justified judging the
`DatasetStructureProfile` rename a non-material, non-public change partly on
the claim that no persistence, export, replay, or external consumer of the
profile, evidence envelope, or signature exists, and that the affected
`DatasetSignature` fields never reach persistence/export/replay.

That claim is wrong in one specific, material way, and this RFC corrects the
record and fixes the forward rule:

1. `RepresentationDecision` carries a full `datasetSignature`
   (`src/moneta/representation/RepresentationDecision.ts`). A representation
   decision is serialized into the portable investigation package
   (`investigation/representation.json`) by the export path
   (`src/session/NemosyneSession.ts` → `NemosynePackageManager.pack`,
   `src/session/NemosynePackage.ts`) and is restored verbatim on replay
   (`src/session/InvestigationReplayRunner.ts`,
   `parseRepresentationDecision`).
2. In the v2 semantic digest, the representation decision state — including
   its `datasetSignature` — is digest-bearing: the canonical digest input
   includes the representation state (`representationStateHash` →
   `investigationDigest`, `src/investigation/InvestigationDigest.ts`). A
   historical decision containing retired signature keys
   (e.g. `dependence.significantPairsCount`,
   `spectralStructure.periodicityConfidence`) therefore changes the digest if
   those keys are removed or altered.
3. A historical v2 package whose representation decision carries retired
   signature keys replays **because** representation decisions are restored
   verbatim, including unknown/retired signature keys. (This is a capability
   claim about the mechanism, verified against source; it does not claim that
   any particular shipped package contains such keys.) A validator that
   rejects retired keys at the replay/import boundary would break
   compatibility with historical packages and must not be added.

## Decision requested

The smallest durable choice: what governs future normalization, re-derivation,
stripping, or dropping of historical `DatasetSignature` keys that already exist
inside persisted `.nemosyne` representation decisions?

## Decision (accepted)

1. **Historical representation decisions are restored verbatim.** Replay and
   import code MUST NOT reject, strip, re-derive, or normalize unknown or
   retired `DatasetSignature` keys present in a historical representation
   decision. Verbatim restoration is the compatibility contract for all
   existing v2 packages. This decision does **not** touch the live wire
   boundary: `MonetaEvidenceAuthority.requireRetiredFieldAbsent`
   (`src/atlas/MonetaEvidenceAuthority.ts`) still rejects retired *transport*
   names in payloads received from the live kernel, and the tests pinning that
   guard (`tests/atlas-moneta-evidence-authority.test.ts`) stand. The
   prohibition on rejection applies to historical persisted decisions only —
   the live transport boundary and the replay/import boundary are different
   surfaces with opposite rules.
2. **Any future change to those keys is an explicit format migration.**
   Normalizing, re-deriving, stripping, or dropping historical
   `DatasetSignature` keys changes the persisted representation payload and
   therefore changes `representationStateHash`/`investigationDigest` for
   historical packages. Such a change requires an explicit package/format
   migration (RFC/ADR plus a `NEMOSYNE_PACKAGE_FORMAT_VERSION` or
   digest-algorithm version bump as applicable) in the same change — it may
   not ship silently inside a terminology or refactor tranche.
3. **No version bumps in this tranche.** `algorithmSuite`,
   `DATASET_EVIDENCE_SCHEMA_VERSION`, and `NEMOSYNE_PACKAGE_FORMAT_VERSION`
   remain unchanged: TEC2 changed transport names and removed a TypeScript
   shadow recomputation; it did not change persisted semantics, and current
   v2 packages replay under current semantics. Retired keys in historical
   decisions are legitimate persisted history, not schema violations.
4. **The TEC2 record is corrected** where it claims the affected
   `DatasetSignature` fields never reach persistence/export/replay
   (`docs/audits/TEC2_HEURISTIC_TERMINOLOGY_INVENTORY_2026-09-21.md` §1.4,
   summary table, closure record; `docs/STATISTICAL_FOUNDATIONS.md` migration
   debt section).

## Options considered

- **Reject retired keys at the replay/import boundary.** Rejected: this
  breaks historical v2 packages whose decisions legitimately carry the keys.
- **Normalize or strip retired keys on import.** Rejected without a version
  migration: it silently changes the digest of historical packages, which is
  exactly the failure mode decision 2 exists to prevent.
- **Verbatim restore plus a forward-only migration rule.** Accepted: keeps
  historical replay compatible, keeps the narrowed forward pipeline (live
  kernel → evidence adapter → signature) authoritative for new decisions, and
  forces any future normalization behind an explicit, versioned migration.

## Consequences

- **Compatibility:** all existing v2 packages, including decisions with
  retired signature keys, continue to replay and verify unchanged.
- **Scientific honesty:** retired heuristic names are not reintroduced on any
  forward path; they survive only as verbatim persisted history, which is
  explicitly permitted.
- **Migration burden:** deferred, not created. No migration is owed by this
  tranche; the rule binds future tranches that would otherwise mutate history.
- **Audit correctness:** the TEC2 inventory, closure record, and
  `docs/STATISTICAL_FOUNDATIONS.md` claims of "no persistence/export/replay"
  for the affected signature fields are corrected by this tranche.

## Verification plan

- A real v2 falsifier on the production export/replay path
  (`NemosyneSession.exportPortablePackage` → `NemosynePackageManager.pack` →
  `InvestigationReplayRunner`), with `investigationDigest` present: a
  representation decision whose `datasetSignature` carries the historical
  keys must survive verbatim replay with digest verification passing.
- Verbatim persistence must be asserted non-vacuously: besides digest
  equality, the unpacked `investigation/representation.json` payload must be
  shown to literally still contain `dependence.significantPairsCount` and
  `spectralStructure.periodicityConfidence`, so the test cannot pass if both
  sides dropped the keys identically.
- Counter-controls: deleting either historical key changes/rejects the
  digest; corrupting the manifest `investigationDigest` fails closed.
- The export and replay sides must use the same kernel-bridge mock family
  (`tests/helpers/kernelMock.ts`) and no `kernelVersionOverride`, so
  `manifest.kernelVersion` and the replay-side kernel version agree — this is
  load-bearing: replay compares the two and records a kernel-identity
  discrepancy otherwise. This is the RF-047 falsifier pattern
  (`tests/rf047-replay-tamper-falsifying.test.ts`).
- No v1 or digest-less fixture may stand in for this evidence.

## Resulting ADR

None yet. This tranche lands the RFC as a bounded governance correction plus
falsifier; an immutable ADR is owed only if a future format migration is
actually proposed under decision 2.