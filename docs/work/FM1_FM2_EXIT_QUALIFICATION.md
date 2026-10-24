# FM1/FM2 exit qualification through the direct loop

**Status:** HEADLESS EXIT BATTERY LANDED (#1020), desktop direct-loop lineage surface LANDED (#1059); full rendered inspector and investigator qualification remain open. **Risk tier:** high-risk posture (per #999: interaction grammar + representation-authority routing). Downgrades to verification-only if the battery passes with zero source changes.
**Depends on:** #999 plan, #1000/#1012/#1015 implementation, FM6-R6/FM7-R7 battery precedent. **Not a diary:** implementation evidence belongs in the PR.

## Goal

Prove the FM1/FM2 plan exits end-to-end through the NIL → aggregate → view-model → V4 direct-loop product path: two materially different intents yield appropriately different provenance-bearing direct decisions (or explicit no-change), and alternatives can be compared, branched, or deferred without losing provenance, with either branch replayable.

## Pre-implementation adversarial contract

- **Invariant:** exit clauses hold on the direct-loop path, not only the legacy stack; display never promotes; replay reproduces exact framing.
- **Authority/production path:** `InvestigationAggregate` direct compilation, `AtlasNilBindings` NIL verbs, `DirectLoopViewModels` getters, `EvidenceLedger`/V4 packaging. Rust/WASM stays analytical authority — tests use mock kernels headless, so no analytical-truth claims.
- **Failure modes:** battery exercises legacy stack while direct loop diverges; mocks mistaken for analytical proof; preview auto-promotes; intent replay drifts; defer drops lineage; V4 drops links; NIL semantic change needed (STOP for RFC/ADR per #999).
- **Falsifying evidence:** the battery below — every test routes NIL→aggregate; negative/refusal cases; legacy-vs-direct divergence watch via unmodified existing suites.
- **Non-goals:** VR rendering/comprehension (device lane); analytical validity from mocks; NIL semantic changes unless a gap is proven.

## Battery scope (`tests/fm1-fm2-exit-qualification-direct.test.ts`)

FM1: distinct-intent distinct-decision with intent identities in provenance; identical-intent replay identity; irrelevant-wording metamorphic identity; explicit no-change when requirements coincide.
FM2: NIL COMPARE preserves active decision; NIL PREFER branches with parent lineage + V4 capture; compare-only defer leaves decision/lineage/alternatives intact and replayable; preview non-mutating on the direct path; replay of either branch from packaged lineage.

## Exit / STOP

Exit when the battery is green with zero source changes (verification-only tranche) or with behavior fixes under this contract. STOP and escalate to RFC/ADR if a gap requires NIL semantic or authority-routing changes.

## Bounded desktop lineage surface follow-up (24 October 2026)

**Scope:** Render existing authoritative direct-loop alternative/history/compiled-budget projections in the already mounted desktop Review & Recovery rail. This is **not** full FM1/FM2 inspector/branching investigator qualification. It adds no authority, no preview/commit side-effect, no new panel, and no invented branch when the aggregate has not executed a direct-loop operation.

**Standard-risk pre-implementation adversarial contract:** `bootstrap.desktopReviewRecoveryActions` passes `AtlasCore.getDirectFeedbackLinks`, `getDirectAlternativeFeedbackBindings` and `getActiveVariantPair` to the existing `buildDirectLoopSurfaceViews` projection; `DesktopReviewRecoveryRail.refresh()` reads it. A current/changed dataset or absent direct-loop state must render "none recorded"; the old representation-review display remains separate. Exact decision IDs, critique attribution and feedback links are displayed as descriptive provenance only. Compiled budget variants must explicitly disclose that target-device performance is unverified. No nil/branch decision or analytical meaning is inferred in the view.

**Falsifiers:** jsdom DOM composition injects a source-produced direct-loop view, validates displayed alternative decision/critique/binding and budget profile, then clears the source and refreshes to prove no cached ghost branch; empty view must display explicit absent state and disable unearned commit. Real production Chromium smoke opens the existing rail and performs a normal browser analysis, proving no fake FM2 branch is minted by unrelated legacy activity.

**Residual limits:** The Chromium smoke verifies mounting and an empty-state normal journey, not a researcher generating a real direct-loop critique and then traversing or accepting a direct alternative. The populated-path test is DOM-level with read-only view-model fixture. A later bounded production/browser direct-loop action journey, real inspector bindings and human usability are still required. Physical Quest qualification is excluded.

## FM2 browser critique handoff (24 October 2026)

**Bounded implementation:** The existing desktop Review & Recovery rail now has direct-loop critique and constrained-alternative controls mounted by the production investigation-journey extension. Both actions use that journey's **same sequenced NIL executor** (`REJECT` with `directTarget` followed by `PREFER` with `directCritiqueId`) and the existing Atlas handler. No new evidence store, representation authority, second executor, or floating panel.

**Fail-closed eligibility:** Controls are disabled unless Atlas reports a real active direct compilation, its actual plan elements, governed phenomenon coverage and recorded critique IDs. They do not silently create a direct compilation from a legacy Moneta outcome or from a fixture. A rejected/stale/empty critique never creates a branch. Alternative generation is explicitly **device unverified** and does not switch the active compilation.

**Verification:** A focused jsdom integration drives both UI actions through the real NIL executor and a headless mock-kernel Atlas fixture, inspecting attribution, exact critique-to-alternative lineage and unchanged active decision. A production Playwright browser smoke verifies that ordinary sample loading/analysis still does not invent a direct compilation or enable these actions. Neither fixture is analytical/scientific evidence for Rust nor a real populated browser journey.

**Residual blocker:** The ordinary product shell does not supply a separately governed, evidence-referenced `SemanticSnapshotV1` to `AtlasCore.compileDirectEmbodiment`. Real Rust semantic presentation envelopes exist, but automatically assigning consumer receipt references or asserting claim-bearing eligibility without an authorized binding would cross the evidence trust boundary. A following tranche must implement and qualify that producer-to-direct-compilation seam with real Rust-issued identities, including stale generation/refusal and replay paths; until then the normal-shell controls correctly remain unavailable.

## FM2 producer identity and direct admission falsification (24 October 2026)

**Status: identity repair and fail-closed eligibility diagnostics implemented; direct authorization NOT landed.** The first live two-producer falsifier revealed Rust semantic envelopes reporting Cargo-package version 0.1.0 as `provenance.kernelVersion`, while the live analytical kernel and governed receipt bundle report kernel version 0.2.1. Those values are distinct sources. The five semantic producers (aggregate, distribution, density, cluster, graph) now use the same Rust-owned `data::provenance::KERNEL_VERSION` authority as `kernel_version` and the receipt issuer, rather than a crate release version. This is an identity repair, not a claim that the direct consumer is scientifically admitted. Historical envelopes retain their original identities; no retroactive rewriting or silent replay downgrade.

The existing desktop Review & Recovery rail can explicitly check the production semantic source and request the existing port-owned governed receipt capture. A typed read-only probe reports missing/refused source, missing capture, mismatch, or absent direct-consumer authorization; dataset changes discard in-flight probe results. **No result from the probe can enable critique, compile a direct representation, mint a reference, or promote a branch.** Descriptive statistics receipts cannot be repurposed as representation receipts simply because the dataset fingerprint and kernel version agree.

**Evidence:** A dedicated real-WASM test builds a distribution source from the Rust kernel against the current dataset, obtains the kernel-attested governed consumer uses, and proves identity coherence and the *cross-purpose* refusal. A jsdom control test proves the user can see the explicit reason without enabling any direct action. The normal Chromium production smoke must continue to refuse direct controls after ordinary analysis.

**Dependency remains owner-governed:** No Rust-issued direct-representation consumer/receipt binding and no authority policy/profile for that consumer currently exist; only the descriptive-statistics consumer is governed. Before the normal browser can perform a claim-bearing FM2 direct compilation, introduce and qualify a versioned producer-side source-to-receipt binding and a separately authorized consumer policy, negative/replay tests, and a positive browser journey. Neither TS-constructed receipt tuples nor a permissive fallback may close that gate.
