from pathlib import Path

path = Path('docs/ROADMAP.md')
text = path.read_text()


def replace_paragraph(start_marker: str, end_marker: str, replacement: str) -> None:
    global text
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    text = text[:start] + replacement.rstrip() + '\n\n' + text[end:]

replace_paragraph(
    '**Current remote main at roadmap branch cut:**',
    '**Latest adversarial/security validation review:**',
    '''**Current remote main at roadmap branch cut:** `8d91dff` (#490 merged). #485/#486 landed RF-035B1 reference-backed history/version state and branch-point materialisation; #487 landed RF-035B2A compact authoritative row-view transfer for verified edge-free `filter`/`sort`/`slice`; #488 landed RF-035B2B reference-backed live durable result/event storage with isolated per-lineage row values and lazy schema-v2 materialisation; #489/#490 planned IWER as the simulator tier plus the USIM-A architecture-conformance and gated USIM-C collaboration packs. RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** because graph/derived Worker results, session/package materialisation, handle-only/typed state and measured whole-pipeline browser/WASM/device evidence remain. The next Stream-B scale tranche is real browser module-Worker + real-WASM transfer/heap/GC measurement, not another unmeasured memory rewrite. P1-Q is now planned as a parallel-safe engineering-quality/cadence substrate: architecture policy, Rust test-cadence benchmarking, property-testing pilots and richer failure evidence may proceed alongside the active product/review streams; mutation/fuzz/Miri/formal/network-chaos work remains targeted or scheduled unless an owning RF requires it. #478's title did **not** implement P1-U6; P1-U6 remains partial. Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support.'''
)

replace_paragraph(
    '**Reprioritised Stream-B critical path:**',
    '**Current interpretation:**',
    '''**Reprioritised Stream-B critical path:** (1) **CURRENT: RF-015/RF-029/RF-030/RF-031/RF-035/RF-051 measured whole-pipeline resource envelope**, now that #488 has landed the bounded B2B durable-state reduction; measure real browser module-Worker + real WASM transfer, heap, GC and scheduling before selecting the next optimization; (2) **P1-Q Q0-Q3 parallel-safe quality substrate** — architecture-policy pilot, cargo-nextest/sccache benchmark, bounded property-testing pilots and failure-evidence/agent-runtime diagnostics, with no product-semantic dependency and no reduction of existing proof; (3) RF-001/RF-002/RF-036 representation/evidence authority review on top of RF-045; (4) **P1-USIM + RF-050 + remaining P1-U convergence** in the parallel UI stream, using IWER for simulator-testable spatial/input/cross-layer invariants while preserving physical Quest exits; (5) RF-033 production evidence architecture and RF-052 governance truthfulness, including P1-Q Q9 exact-head promotion control; (6) physical Quest 3S U1/U8/U9 and PERF-04 qualification; (7) post-UI P1-W production wiring under RF-053 through RF-056; (8) private-preview hardening. RF-046/RF-047 remain implementation-landed/review-active foundations. Stream C continues in parallel on RF-037 through RF-043 plus RF-057/RF-058; P1-Q Q5/Q6/Q8 attach targeted fuzz/UB/WASM assurance, network fault injection and supply-chain prevention to those owning risks rather than becoming blanket PR taxes. The dependency rule remains: **preserved source data → truthful analytical evidence → reproducible identity/replay → bounded computation → faithful representation → coherent investigator UX → simulator-testable XR proof → physical XR proof → production wiring → private preview.**'''
)

replace_paragraph(
    '**Current interpretation:**',
    '**XR evidence ladder:**',
    '''**Current interpretation:** P1-A, P1-B, P1-C, P1-D, P1-E and P1-F contain material implementation advances but remain **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`. RF-044, RF-045, RF-046, RF-047 and RF-048 have implementation landed but remain review-monitored; RF-051 has landed several bounded fix-forward tranches and still depends on RF-029/RF-035 plus measured whole-pipeline evidence. RF-035A, RF-035B0, RF-035B1, RF-035B2A and #488 RF-035B2B are landed bounded reductions of avoidable main-thread/transfer/history/durable-result work, not closure of RF-035. P1-U remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**; P1-USIM and P1-Q are planned engineering/evidence enablers, not product features and not substitutes for authoritative browser/device/security/scientific evidence. P1-Q planning is complete only at roadmap level: no external quality tool is considered adopted until its bounded fitness pilot demonstrates useful defect signal, acceptable maintenance/wall-clock cost and truthful evidence semantics. Dominant risks remain measured memory/transfer/materialisation cliffs, representation/evidence authority gaps, collaboration/security authority gaps including RF-057, off-path security/privacy controls, production qualification and product/device evidence gaps. Stream A may continue only where these defects are not dependencies; Stream B fixes correctness/evidence foundations; Stream C independently hardens security/privacy-sensitive live boundaries.'''
)

anchor = '#### P1-USIM — WebXR simulator substrate and golden spatial scenarios — PLANNED ENABLER'
if anchor not in text:
    raise SystemExit('P1-USIM anchor not found')

p1q = '''#### P1-Q — Engineering Quality & Cadence substrate — PLANNED ENABLER

Purpose: add high-leverage engineering tools that catch defect classes missed by ordinary example tests and make failures cheaper to diagnose, without creating a permanent merge-time tax on unrelated work. Governing plan: [`review-plans/P1Q_ENGINEERING_QUALITY_CADENCE_2026-08-28.md`](review-plans/P1Q_ENGINEERING_QUALITY_CADENCE_2026-08-28.md).

Programme rules:

- P1-Q is a substrate for Streams A/B/C, not a fourth product stream or a new semantic authority;
- measure defect signal, wall-clock cost and maintenance burden before making a pilot a required PR gate;
- expensive mutation/fuzz/Miri/formal/network-chaos campaigns are targeted or scheduled unless an owning RF justifies required execution;
- every discovered defect becomes a deterministic regression at the owning layer;
- a tool proves only the invariant it actually exercises; mutation/fuzz/model/simulator success may not inflate correctness, security, scale or device claims;
- exact-head promotion evidence is revoked by any candidate-head movement.

**Q0 — architecture policy engine — immediate / parallel-safe**

- [ ] evaluate `dependency-cruiser` plus `ast-grep` against current architecture and classify every initial violation;
- [ ] encode durable authority/dependency rules: no presentation -> analytical-internal imports, no new JS analytical fallback, no ungoverned scale-sensitive `dataset.rows` traversal, governed Worker construction, durable-ID/randomness rules, service-endpoint ownership and InputRouter/Atlas command boundaries;
- [ ] add focused positive/negative fixtures and measure PR cost before promoting the checks to required status.

**Q1 — Rust cadence benchmark — immediate / parallel-safe**

- [ ] benchmark `cargo-nextest` against current `cargo test` under cold/warm CI-like conditions and adopt it only as an equivalent replacement if semantics agree and wall time/diagnostics improve;
- [ ] run a bounded `sccache` experiment for cacheable Rust compilation units; retain only measured end-to-end benefit and do not assume final `cdylib` linking is cacheable.

**Q2 — property-testing pilots — immediate / parallel-safe**

- [ ] pilot `fast-check` and `proptest` on canonical identity, graph lineage, history branch/restore, schema-v2 materialisation, digest presentation-independence, row-view fingerprint parity and cross-language canonical projection invariants;
- [ ] keep generators bounded; preserve failing seeds/shrunk cases as deterministic regressions.

**Q3 — failure evidence / agent runtime observatory — immediate / parallel-safe**

- [ ] make failing browser/IWER product-path jobs retain a reproducible evidence bundle: Playwright trace, screenshot/video, console/page errors, relevant network failures, scene snapshot, simulator scenario/profile, Worker/runtime state and exact source/bundle/WASM identity;
- [ ] evaluate isolated Chrome DevTools Protocol/MCP-style agent diagnostics for console/network/performance/heap inspection without exposing normal user browser profiles or secrets.

**Q4 — mutation testing — targeted/scheduled**

- [ ] pilot `cargo-mutants` on small high-authority Rust modules; evaluate a TypeScript mutation tool only if a bounded pilot produces useful non-noisy signal;
- [ ] do not run repository-wide mutation testing on every PR; convert meaningful surviving mutants into stronger deterministic/property tests.

**Q5 — fuzz / UB / WASM artifact assurance — targeted/scheduled**

- [ ] attach `cargo-fuzz`, Miri-compatible subsets and Bytecode Alliance `wasm-tools` validation/inspection to RF-043/RF-053 hostile-boundary campaigns;
- [ ] minimize discovered failures and retain deterministic regressions; do not translate campaign success into absence-of-bugs claims.

**Q6 — deterministic network fault injection — gated**

- [ ] after RF-037/RF-038/RF-057 and a contract-faithful/deployed service path exist, evaluate Toxiproxy or equivalent for latency/jitter, stalls, partitions, service disappearance and reconnect storms;
- [ ] use real multi-browser/IWER clients where useful, but keep security/correctness authority in the signalling/WebRTC/session implementation.

**Q7 — small-state formal models — targeted**

- [ ] evaluate TLA+/Apalache only for high-risk interleaving state machines: Worker generation/supersession/residency, collaboration replay/reconnect ownership, dataset-version/history branching and, if still necessary, Direct Touch capture arbitration;
- [ ] map model invariants/counterexamples back to production tests or runtime assertions; bounded model success is not implementation proof.

**Q8 — supply-chain prevention — low-cost candidate gate**

- [ ] evaluate GitHub Dependency Review and `cargo-deny` for newly introduced vulnerable dependencies, Rust advisories/licences/bans/source policy;
- [ ] keep Dependabot as the update mechanism unless a measured need justifies replacement.

**Q9 — exact-head promotion controller — governance priority**

- [ ] define one promotion authority that requires the exact current SHA to have required checks green, no unresolved material threads, required adversarial/post-review evidence and truthful roadmap/status state;
- [ ] revoke promotion on any head movement; coordinate terminology/behavior with RF-052 so automation never implies an approval that did not occur.

**P1-Q exit gate:** every adopted tool has a measured fitness decision (`ADOPT`, `TARGETED ONLY`, or `REJECT`) with owning RF/stream, evidence semantics and CI cadence recorded. No expensive assurance tool becomes a universal required check without demonstrated value and bounded cost.

'''

text = text.replace(anchor, p1q + anchor, 1)

path.write_text(text)
print('P1-Q roadmap plan applied')
