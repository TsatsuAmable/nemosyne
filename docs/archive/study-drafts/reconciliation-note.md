# DEPRECATED: Reconciliation Note — Gate 5 Amendment vs. Revised Execution Document

> Superseded by the canonical study governance under [docs/study](study).
>
> This legacy note is retained only for historical review. It is not used as the active source of truth.

# Reconciliation Note — Gate 5 Amendment vs. Revised Execution Document

## What needs adjustment in `Gate5_Methodology_Review_Amendment.md`

1. **Gate numbering.** The amendment was written against an unspecified "existing Project
   Control Layer." The execution document establishes a concrete sequence: Gate 0 (runtime),
   Gate 1 (security/roles), Gate 2 (analyst journey), **Gate 2.5 (research observation)**,
   Gate 3 (hardware validation), Gate 4 (technical debt/trust), **Gate 5 (experimental
   validity)**, Gate 6 (release rehearsal). The amendment's references to "Gate 5" are correct
   and don't need renumbering — but it should now explicitly cross-reference Gate 2.5 (observer
   console must exist and be reconstructable) and Gate 3 (hardware validated) as *prerequisites*
   to Gate 5 closing, since a methodologically sound protocol is meaningless if the observer
   events or VR hardware behavior it depends on aren't yet trustworthy.

2. **Artifact filename set expanded.** The amendment only specified `methodology-review.md`. The
   execution document's `research/` directory (§6) adds `study-protocol.md`,
   `literature-precedents.md`, `confound-register.md`, `data-dictionary.md`, and
   `performance-envelope.md`/`rehearsal-report.md` as siblings. Gate 5's required-artifact list
   in §17 already reflects this — the amendment's artifact requirement should be read as one item
   inside that fuller list, not a replacement for it.

3. **Reviewer checklist item 9 (precedent-fit) is now formally supported.** The execution
   document's §7 "literature-first methodology track" — record task/dataset/2D-VR similarity,
   select 1–2 primary precedents by methodological similarity rather than outcome favorability —
   gives the reviewer's precedent-fit judgment (item 9 in the amendment's checklist) an actual
   input document to evaluate against (`literature-precedents.md`). No change needed to the
   checklist itself; this just means item 9 now has a concrete artifact to check, rather than
   being an open judgment call.

4. **Exit condition wording should be adopted verbatim.** The execution document's Gate 5 exit
   condition — *"no unresolved high-severity methodological objection"* (§8) and *"no unresolved
   high-severity technical or methodological issue capable of invalidating the planned
   comparison"* (§17) — is more precise than the amendment's original "all items read Approved."
   Recommend replacing the amendment's overall-determination language with this severity-graded
   version: it allows low-severity reviewer notes to exist without blocking Gate 5, which is more
   realistic than requiring a unanimous checklist sweep.

5. **`confirmatory_export_schema` maps directly onto §12/§13.** The trial/data model (Study →
   Participant → Session → Trial → Condition → Task → Dataset → Outcome → ResearchEvent →
   ObserverEvent → AnalyticalStateSnapshot) and the `study-export/` file set in §13 are the
   concrete implementation of the schema-as-contract principle from the amendment. No conflict —
   the amendment's abstract YAML sketch should be retired in favor of pointing directly at §12–13
   as the authoritative schema definition.

6. **Two-tier revision path is compatible, one addition needed.** The amendment's pre-close /
   post-close revision distinction still holds. Add: any post-close change must also update
   `protocol-version.txt` / `dataset-version.txt` / `build-version.txt` (§13) so the release
   package (§19) stays bound to a specific reviewed version, consistent with "Gate 5 status is
   always tied to a specific document version."

## Net effect

No structural conflict. The amendment's checklist, 2D-baseline sub-check, and revision-path logic
carry over unchanged. What changes is that the amendment now nests inside the fuller Gate 5
artifact list and gate sequence the execution document defines, and its exit-condition language
should be tightened to match the severity-graded phrasing already in use there.
