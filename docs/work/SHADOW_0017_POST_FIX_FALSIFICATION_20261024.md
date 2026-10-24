# SHADOW-0017 post-fix falsification

**Scope:** independent-path *test evidence* over the merged FM8 patch at `main@323080714062949a70ee9a7cca656fb04dce9531`, not self-certification of the SHADOW finding. Original finding remains `CANDIDATE` in `governance/shadow/findings.jsonl` until the governed independent verifier signs the record. No duplicate finding or parallel roadmap authority.

## Original failure (4 October 2026)

`FullMonetaEngine.synthesizeOrAdapt` once accepted `snapshots:[aggregate,distribution]` for a graph with three distinct primitives; after attempting a coincidental `source.family===kind` match, it fell back to list position or the primary aggregate, silently rendering a semantically incompatible third primitive. Swapping list order could change the selected evidence without changing graph intent.

## Post-fix attack

`tests/fm8-rfc0013-evidence-binding.test.ts` now exercises the **original three-primitive shape through the full synthesis composition path**, using an intentionally controlled graph candidate while retaining the real evidence selector, broker and multi-element runtime. On two reversed supplied snapshot orders, the unsupported third primitive must throw `EVIDENCE_BINDING_UNMAPPED_KIND` and **no** `FormaMultiElementRuntime.registerElement` call may occur. A second control composes a supported source in both orders, asserts exact `snapshotId`, `sliceId`, `FAMILY_MATCHED` status, and the same composed identity. Other RFC0013 tests cover cross-dataset/kernel source mixes, empty list, ambiguous matches, denied secondary broker and bound v2 identity.

## Evidence limits and disposition

A green exact-head CI test shows the original *software reproducer* is blocked at the tested path; a failing test is a STOP for correction, not reason to waive the case. Code inspection also confirms that the former `snapshotsList[i] ?? snapshot` fallback has been removed from `FullMonetaEngine`. No claim is made about separate researcher-facing rendering, Quest, human understanding, or every possible semantic mapping. **Formal SHADOW-0017 transition remains the independent validator's responsibility**, after reviewing this falsification against its original claim and the exact merged commit. Do not edit the original record as a side effect of implementing a test.
