# Adversarial Remediation Plan — 26 August 2026

This companion note records the rationale behind RF-044 through RF-052 added to `docs/ROADMAP.md`. The roadmap remains the status authority; this file exists so implementation agents have a compact handoff without needing to reconstruct the review discussion.

## Ordered fix-forward programme

1. **RF-044 graph lineage integrity — blocker.** Preserve graph edges, weights, attributes and governed metadata through Dataset cloning, Atlas state transitions, Worker registration and Rust ingestion. Prove the production `Dataset -> Atlas -> Rust -> topology/Moneta` path.
2. **RF-045 analytical signature truth — blocker.** Remove fabricated/default measured-looking facts from `SignatureBuilder`; represent evidence as measured/derived/prior/heuristic/investigator-declared/unknown and converge N-dependent facts on Rust authority. Integrate with RF-001/RF-002/RF-036.
3. **RF-048 canonical dataset identity — high.** Use one cryptographic scientific dataset fingerprint across Rust, Atlas, Worker, Moneta and `.nemosyne`; rename weak seed/cache hashes and keep them out of provenance.
4. **RF-046 semantic digest completeness — high.** Version the investigation digest projection and commit all meaning-bearing commands, result/provenance identities, evidence entities, representation decisions and investigation provenance while excluding presentation-only state deliberately.
5. **RF-047 portable non-mutating event replay — high.** Clean-room replay must reconstruct refusal/remediation ledger events and detect tampering, not merely count them as matched.
6. **RF-051 complete resource envelope — high.** Fold JS-side spread/argument limits, DatasetSpace cloning/hashing/ranges and Worker rematerialisation into RF-029/RF-035 so scale evidence covers JS + Worker + WASM.
7. **RF-049 Direct Touch semantics — high.** Reopen P1-U1 and implement explicit capture/cancel/commit/release/recover semantics with modality-equivalent product-path tests before later UI tranches depend on it.
8. **RF-050 UI substrate evidence — medium.** Reclassify the existing UIKit benchmark as synthetic evidence and collect production-renderer plus Quest legibility/draw-call/scroll/clipping/frame-pacing data under P1-U9.
9. **RF-052 governance truth — medium, parallel.** Make branch-rule names/documented approval policy match actual GitHub enforcement; preserve CI as an engineering gate without conflating it with independent review or device/scientific verification.

## Operating constraints

Each defect gets the cheapest regression that would have caught it, at the authoritative boundary. Fix-forward rather than redesign the architecture. Do not update snapshots merely to absorb changed behavior without reviewing the scientific/semantic consequence. Before each tranche PR, sync current `main`; after merge, adversarially review the merged state and update the corresponding RF row rather than declaring broad completion from green CI alone.
