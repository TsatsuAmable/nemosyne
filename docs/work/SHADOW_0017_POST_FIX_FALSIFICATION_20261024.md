# SHADOW-0017 post-fix falsification

**Scope:** independent-path test evidence over the merged FM8 patch at `main@323080714062949a70ee9a7cca656fb04dce9531`; separately reviewed on 10 November 2026 against `main@6a83340b`. The original SHADOW-0017 software defect is now dispositioned `VERIFIED_FIXED` in its canonical shadow ledger. No parallel finding or broad FM8 completion is asserted.

## Original failure (4 October 2026)

`FullMonetaEngine.synthesizeOrAdapt` once accepted `snapshots:[aggregate,distribution]` for a graph with three distinct primitives; after attempting a coincidental `source.family===kind` match, it fell back to list position or the primary aggregate, silently rendering a semantically incompatible third primitive. Swapping list order could change the selected evidence without changing graph intent.

## Post-fix attack

`tests/fm8-rfc0013-evidence-binding.test.ts` now exercises the **original three-primitive shape through the full synthesis composition path**, using an intentionally controlled graph candidate while retaining the real evidence selector, broker and multi-element runtime. On two reversed supplied snapshot orders, the unsupported third primitive must throw `EVIDENCE_BINDING_UNMAPPED_KIND` and **no** `FormaMultiElementRuntime.registerElement` call may occur. A second control composes a supported source in both orders, asserts exact `snapshotId`, `sliceId`, `FAMILY_MATCHED` status, and the same composed identity. Other RFC0013 tests cover cross-dataset/kernel source mixes, empty list, ambiguous matches, denied secondary broker and bound v2 identity.

## Evidence limits and disposition

A green exact-head CI test shows the original *software reproducer* is blocked at the tested path; a failing test is a STOP for correction, not reason to waive the case. Code inspection also confirms that the former `snapshotsList[i] ?? snapshot` fallback has been removed from `FullMonetaEngine`. No claim is made about separate researcher-facing rendering, Quest, human understanding, or every possible semantic mapping. **Independent software-only verification (10 November 2026):** A separate reviewer examined #962's actual `snapshotsList[i] ?? snapshot` fallback, #1056's strict `selectFM8CompositionEvidence` path and no-substitution broker refusal, and #1058's direct original-reproducer and order-invariance controls. #1058 exact-head CI, CodeQL and approval gate passed. Current `main@6a83340b` retains the strict source selection. **Disposition: VERIFIED_FIXED for the original positional/primary-fallback defect only.** This review used source and hosted CI evidence, not a fresh local hardware or application run. Cross-family completeness, semantic usability, physical Quest performance and all other FM8 gates remain unqualified.
