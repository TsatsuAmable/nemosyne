from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing expected text for {label}')
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'expected one match for {label}, got {count}')
    return out


roadmap_path = Path('docs/ROADMAP.md')
roadmap = roadmap_path.read_text()

roadmap = regex_once(
    roadmap,
    r"\*\*Current remote main at roadmap branch cut:\*\*.*?\n\n\*\*Latest adversarial/security validation review:\*\*",
    """**Current remote main at roadmap branch cut:** `22ce66b` (#488 merged). #485/#486 landed RF-035B1 reference-backed history/version state and branch-point materialisation; #487 landed RF-035B2A compact authoritative row-view transfer for verified edge-free `filter`/`sort`/`slice`; #488 landed RF-035B2B reference-backed live durable result/event storage with isolated per-lineage row values and lazy schema-v2 materialisation. RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** because graph/derived Worker results, session/package materialisation, handle-only/typed state and measured whole-pipeline browser/WASM/device evidence remain. The next Stream-B scale tranche is real browser module-Worker + real-WASM transfer/heap/GC measurement, not another unmeasured memory rewrite. The bounded XR-simulator review is recorded in [`review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md`](review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md): IWER is the preferred WebXR simulator tier for simulator-testable UI/input/layout invariants, while physical Quest remains authoritative for device-dependent promotion claims. #478's title did **not** implement P1-U6; P1-U6 remains partial. Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support.

**Latest adversarial/security validation review:**""",
    'status snapshot',
)

roadmap = regex_once(
    roadmap,
    r"\*\*Reprioritised Stream-B critical path:\*\*.*?\n\n\*\*Current interpretation:\*\*",
    """**Reprioritised Stream-B critical path:** (1) **CURRENT: RF-015/RF-029/RF-030/RF-031/RF-035/RF-051 measured whole-pipeline resource envelope**, now that #488 has landed the bounded B2B durable-state reduction; measure real browser module-Worker + real WASM transfer, heap, GC and scheduling before selecting the next optimization; (2) RF-001/RF-002/RF-036 representation/evidence authority review on top of RF-045; (3) **P1-USIM + RF-050 + remaining P1-U convergence** in the parallel UI stream, using IWER for simulator-testable spatial/input invariants while preserving physical Quest exits; (4) RF-033 production evidence architecture and RF-052 governance truthfulness; (5) physical Quest 3S U1/U8/U9 and PERF-04 qualification; (6) post-UI P1-W production wiring under RF-053 through RF-056; (7) private-preview hardening. RF-046/RF-047 remain implementation-landed/review-active foundations. Stream C continues in parallel on RF-037 through RF-043 plus RF-057/RF-058; simulator use in Stream C is limited to presentation consequences after live security authority is fixed. The dependency rule remains: **preserved source data → truthful analytical evidence → reproducible identity/replay → bounded computation → faithful representation → coherent investigator UX → simulator-testable XR proof → physical XR proof → production wiring → private preview.**

**Current interpretation:**""",
    'critical path',
)

roadmap = replace_once(
    roadmap,
    "**Physical promotion blocker:** the governed Meta Quest 3S browser/performance and interaction qualification remains outstanding. Desktop/browser CI is necessary evidence but cannot qualify headset behaviour.",
    "**XR evidence ladder:** desktop/browser CI remains necessary but does not qualify XR behavior. For simulator-testable UI/input/layout invariants, use a governed IWER `desktop-simulator` tier before device promotion. Physical Meta Quest 3S remains authoritative for Quest Browser/device memory and frame pacing, optics/legibility, real tracking/haptics, fatigue/comfort and PERF-04/U9 promotion evidence.",
    'physical blocker',
)

roadmap = replace_once(
    roadmap,
    "| RF-008 | P1-U / evidence | High | `investigator-journey-e2e.test.ts` manually advances phases and uses a kernel mock. It is useful integration coverage but not evidence of a real browser/XR investigator journey or usability outcomes. | Execute P1-U9: reclassify the current test as integration evidence, add real Playwright product-path journeys, and run governed Quest 3S controller/hand task qualification with performance and interaction-failure evidence. |",
    "| RF-008 | P1-U / evidence | High | `investigator-journey-e2e.test.ts` manually advances phases and uses a kernel mock. It is useful integration coverage but not evidence of a real browser/XR investigator journey or usability outcomes. | Execute P1-U9 with an evidence ladder: real Playwright desktop product journey -> IWER immersive product-path journey for simulator-testable spatial/input invariants -> governed Quest 3S controller/hand qualification. Simulator evidence improves merge-time XR coverage but does not substitute for human usability, comfort or target-device performance evidence. |",
    'RF-008',
)

roadmap = replace_once(
    roadmap,
    "| RF-033 | CI evidence architecture | Medium | `playwright-smoke` depended on the monolithic correctness job, suppressing independent browser signal. | **IMPLEMENTATION ADVANCED:** #437/#438/#443 split proof tracks, shard Vitest coverage with merged global thresholds and remove duplicate coverage while retaining strict `Node 24` fan-in. Remaining: measure feedback/runner impact, keep product-path evidence independent, and integrate RF-050/RF-052 so green CI cannot be interpreted as stronger evidence than the tests/gates actually provide. |",
    "| RF-033 | CI evidence architecture | Medium | `playwright-smoke` depended on the monolithic correctness job, suppressing independent browser signal. | **IMPLEMENTATION ADVANCED:** #437/#438/#443 split proof tracks, shard Vitest coverage with merged global thresholds and remove duplicate coverage while retaining strict `Node 24` fan-in. Remaining: measure feedback/runner impact, keep product-path evidence independent, integrate RF-050/RF-052, and add an independent IWER simulator lane only after USIM scenarios are stable enough that emulator/tooling churn does not block unrelated work. Green CI must never imply physical Quest verification. |",
    'RF-033',
)

roadmap = replace_once(
    roadmap,
    "| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixed Worker input registration and output identity, but repeated mutation transport/materialisation and durable row snapshots remained browser-scale cliffs. | **IMPLEMENTATION PARTIAL / REVIEW ACTIVE:** #480/#481 RF-035A keeps same-generation mutation outputs Worker-resident and removes the redundant JS → Worker registration snapshot; #483 RF-035B0 removes the controller's second result parse; #485/#486 RF-035B1 makes derived history/version navigation reference-backed and fixes branch-point materialisation; #487 RF-035B2A replaces full Worker → JS row-value transfer with authoritative row-ID views for verified edge-free `filter`/`sort`/`slice` results. Current: RF-035B2B makes those verified results reference-backed in live durable result/event storage while preserving schema-v2 materialisation. Remaining after B2B: graph/derived output transfer, session/package materialisation, handle-only/typed state and real browser/WASM transfer/heap/GC/device measurements under RF-015/RF-029/RF-051. |",
    "| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixed Worker input registration and output identity, but repeated mutation transport/materialisation and durable row snapshots remained browser-scale cliffs. | **IMPLEMENTATION PARTIAL / REVIEW ACTIVE:** #480/#481 RF-035A keeps same-generation mutation outputs Worker-resident; #483 RF-035B0 removes the controller's second result parse; #485/#486 RF-035B1 makes derived history/version navigation reference-backed and fixes branch-point materialisation; #487 RF-035B2A replaces full Worker → JS row-value transfer with authoritative row-ID views for verified edge-free `filter`/`sort`/`slice`; #488 RF-035B2B makes those verified results reference-backed in live durable result/event storage while preserving lazy schema-v2 materialisation. Remaining: graph/derived output transfer, session/package materialisation, handle-only/typed state and real browser/WASM transfer/heap/GC/device measurements under RF-015/RF-029/RF-051. |",
    'RF-035',
)

roadmap = replace_once(
    roadmap,
    "| RF-049 | P1-U1 / Direct Touch correctness & modality parity | High | The first #444 Direct Touch substrate lacked the governed explicit commit/release/recovery lifecycle and complete capture/modality semantics. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #465:** the explicit `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER` state model, non-drag panel capture and reference modality/capture adversaries landed. Preserve #465's code-level exit evidence; remaining broader P1-U1/U9 work includes centralized priority/panel-scene guarantees, feedback and physical Quest controller/hand qualification before product verification. |",
    "| RF-049 | P1-U1 / Direct Touch correctness & modality parity | High | The first #444 Direct Touch substrate lacked the governed explicit commit/release/recovery lifecycle and complete capture/modality semantics. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #465:** the explicit `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER` state model, non-drag panel capture and reference modality/capture adversaries landed. Preserve #465's code-level evidence; add IWER near/far/capture/cancel/tracking-loss adversaries through the real WebXR/InputRouter path as an intermediate simulator gate. Remaining broader U1/U9 work still includes centralized priority/panel-scene guarantees, feedback and physical Quest controller/hand qualification before product verification. |",
    'RF-049',
)

roadmap = replace_once(
    roadmap,
    "| RF-050 | P1-U0 / UI substrate evidence | Medium | The UIKit benchmark used to justify P1-U0 adoption is a synthetic desktop/jsdom/WebGL-style loop. It measures init time, JS heap delta, scene objects, update timing and disposal counters but does not measure the roadmap-claimed Quest-relevant text legibility, draw calls, clipping, real scroll interaction, headset frame pacing or sustained GC behavior. | Reclassify current benchmark as synthetic engineering evidence, not Quest/device evidence. Keep UIKit adoption provisional if otherwise architecturally sound, but measure the missing UX-05 properties in the real production bundle and representative panels, then on Quest 3S under U9. Freeze dependency choice only when measured draw calls/frame pacing/legibility/scroll/clipping/disposal evidence is recorded. |",
    "| RF-050 | P1-U0 / UI substrate evidence | Medium | The UIKit benchmark used to justify P1-U0 adoption is a synthetic desktop/jsdom/WebGL-style loop. It measures init time, JS heap delta, scene objects, update timing and disposal counters but does not measure the roadmap-claimed Quest-relevant text legibility, draw calls, clipping, real scroll interaction, headset frame pacing or sustained GC behavior. | Reclassify the current benchmark as synthetic engineering evidence. Add real WebXR simulator evidence for clipping, scroll, panel reference-frame behavior, target acquisition and interaction recovery using representative production panels. Preserve Quest 3S as the authority for device draw calls/frame pacing/GC, through-lens legibility and sustained behavior under U9. Freeze the substrate only when synthetic + browser + simulator + physical evidence are explicitly distinguished and sufficient for the claim. |",
    'RF-050',
)

usim = """
#### P1-USIM — WebXR simulator substrate and golden spatial scenarios — PLANNED ENABLER

Purpose: make simulator-testable XR behavior repeatable during ordinary UI development without turning physical Quest testing into a per-PR bottleneck or introducing a second semantic/input authority. Governing review: [`review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md`](review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md).

Tool decision: **IWER is the preferred WebXR simulator** because it drives the browser WebXR surface Nemosyne actually ships. Meta XR Simulator remains an optional OpenXR/compositor comparison adapter; do not introduce Unity/Unreal/native wrapping merely for verification.

**USIM-0 — simulator adapter and evidence boundary**

- [ ] add a dev/test-only IWER adapter; prove no simulator/dev-UI dependency is reachable from the production bundle;
- [ ] route simulated controller/hand/head input through the real WebXR -> InputRouter path, never directly to NIL/Atlas or component callbacks;
- [ ] map the useful `WebXR6DoFPoseRig` presets into scenario fixtures rather than maintaining a separate mock WebXR runtime;
- [ ] retain `SpatialErgonomicsLinter` as the measurement layer and connect simulator runs to bounded `XREvaluationEpisode` evidence (`environment.mode = desktop-simulator`);
- [ ] fail unsupported simulator capabilities explicitly rather than fabricating success.

**USIM-1 — reference interaction scenarios**

- [ ] RF-049 near-touch -> commit -> retreat -> ray plus cross-target capture/cancel/tracking-loss recovery;
- [ ] panel grab/pin/follow/scroll/reference-frame transition;
- [ ] contextual-task-surface anchoring/occlusion/scene-input exclusion;
- [ ] TechnoCore inspect/alternative/remediation preview/commit/cancel.

**USIM-2 — world-semantic scenarios, implemented with owning U-tranches**

- [ ] U6 IceVault freeze/restore/compare and portal preview/travel/return without hidden analytical mutation;
- [ ] U7 Memory Palace observation -> hypothesis/test/finding -> branch/return with spatial-context continuity;
- [ ] U8 seated/standing, handedness, large-text/high-contrast/reduced-motion, reach/FOV/occlusion adversaries.

**Exit gate:** one production control is activated via simulated controller and one supported hand path through the real input router; deterministic scenarios emit reproducible measured evidence; disabling simulation restores ordinary browser/native-WebXR behavior; production builds contain no simulator dependency path; simulator limitations are recorded; physical U1/U8/U9/PERF-04 gates remain open.

"""
roadmap = replace_once(
    roadmap,
    "#### P1-U0 — UI design-system contract and substrate decision — IMPLEMENTATION PARTIAL / REVIEW ACTIVE",
    usim + "#### P1-U0 — UI design-system contract and substrate decision — IMPLEMENTATION PARTIAL / REVIEW ACTIVE",
    'P1-USIM insert',
)

roadmap = replace_once(
    roadmap,
    "- [ ] obtain physical Quest controller/hand evidence under U9 before verification.",
    "- [ ] add an IWER simulator run for near/far transition, capture/cancel/recovery and modality parity through the production WebXR/InputRouter path;\n- [ ] obtain physical Quest controller/hand evidence under U9 before verification.",
    'U1 simulator bullet',
)

roadmap = replace_once(
    roadmap,
    "- [ ] add Playwright journeys through the real desktop UI for load -> orient -> inspect -> challenge/falsify -> compare -> record -> Memory Palace -> replay/export, including recovery/cancel paths;\n- [ ] run the same core tasks on Quest 3S-class hardware with controllers and hands where supported; capture semantic parity, task failure/accidental activation, discoverability and recovery evidence;",
    "- [ ] add Playwright journeys through the real desktop UI for load -> orient -> inspect -> challenge/falsify -> compare -> record -> Memory Palace -> replay/export, including recovery/cancel paths;\n- [ ] run the simulator-testable spatial/input portions of the same journey under IWER using the P1-USIM adapter, deterministic poses and bounded `XREvaluationEpisode` evidence;\n- [ ] run the same core tasks on Quest 3S-class hardware with controllers and hands where supported; capture semantic parity, task failure/accidental activation, discoverability and recovery evidence;",
    'U9 evidence ladder',
)

roadmap = replace_once(
    roadmap,
    "- [ ] obtain physical Quest controller/hand evidence under U9 before product verification.",
    "- [ ] obtain IWER simulator evidence for the RF-049 near/far/capture/cancel/recover adversary matrix through the real WebXR/InputRouter path;\n- [ ] obtain physical Quest controller/hand evidence under U9 before product verification.",
    'AR7 simulator evidence',
)

roadmap = replace_once(
    roadmap,
    "5. **AR-7 RF-049** has a code-level repair in #465; remaining P1-U1/U9 device/evidence work and **AR-8 RF-050** belong to the parallel UI convergence stream.",
    "5. **P1-USIM + AR-7 RF-049 + AR-8 RF-050** belong to the parallel UI convergence/evidence stream: IWER supplies the intermediate simulator tier for applicable spatial/input invariants; physical Quest remains the promotion authority for device-dependent evidence.",
    'cross-tranche simulator sequencing',
)

roadmap_path.write_text(roadmap)

harness_path = Path('docs/AI_XR_AGENT_HARNESS_SPEC.md')
harness = harness_path.read_text()

harness = replace_once(
    harness,
    "No Meta-specific tool is required. Meta XR Operator is one optional external-driver candidate and comparative reference, not a required runtime dependency. Its native OpenXR API-layer design does not directly fit a hosted application running inside Meta Quest Browser. The Nemosyne-native harness is therefore the canonical path. At implementation time, available standards-based browser automation, WebXR test APIs, simulator drivers and vendor tools must be evaluated against the internal adapter contract; a bounded external-driver experiment may add controller, viewer-pose or compositor coverage where the browser/runtime combination supports it.",
    "No Meta-specific product framework is required. For the Operator Plane, the bounded simulator review selects **IWER** as the preferred browser/WebXR driver candidate because it exercises the runtime surface Nemosyne actually ships; it remains a dev/test dependency behind the Nemosyne adapter contract, not a semantic authority or production dependency. Meta XR Simulator and Meta XR Operator remain optional comparative external-driver candidates for later OpenXR/compositor/device qualification where they can drive the actual browser/runtime path without a native wrapper. The Nemosyne-native semantic registry, evidence recorder, capability guard and authority boundaries remain canonical.",
    'harness executive simulator decision',
)

harness = regex_once(
    harness,
    r"External-driver selection is deliberately deferred\..*?Brand or engine integration alone is not a selection criterion\.",
    """External-driver selection is now bounded by the 28 August simulator review. For browser/WebXR operator embodiment, prefer IWER behind this adapter contract; do not build a second synthetic WebXR runtime first. Keep Meta XR Simulator/Operator as optional later comparison adapters when they can add OpenXR/compositor/device evidence without changing the product architecture.

Candidates are judged on real WebXR compatibility, controller/viewer/hand control used by Nemosyne, capture fidelity, deterministic automation, Quest relevance, maintenance status, licensing, platform support, CI operability and production-bundle isolation. Brand or engine integration alone is not a selection criterion.""",
    'external driver selection',
)

harness = replace_once(
    harness,
    "### Phase 2 — Operator embodiment and evidence\n\nDeliver:\n",
    "### Phase 2 — Operator embodiment and evidence\n\nDeliver:\n\n- IWER-backed WebXR simulator adapter as the preferred browser driver, dev/test only;\n",
    'harness phase 2',
)

harness = replace_once(
    harness,
    "- external-driver discovery and selection record;",
    "- cross-runtime comparison record for the selected IWER browser driver and any optional Meta XR Simulator/OpenXR adapter justified by remaining evidence gaps;",
    'harness phase 6',
)

harness_path.write_text(harness)

quality_path = Path('docs/STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md')
quality = quality_path.read_text()
quality = replace_once(
    quality,
    "- For UX completion, integration tests that manually call each subsystem are not usability evidence. Drive the real product controls/path in Playwright and validate on target hardware when the claim is device-dependent.",
    "- For UX completion, integration tests that manually call each subsystem are not usability evidence. Drive the real product controls/path in Playwright. For WebXR interaction/layout/reference-frame claims that a simulator can exercise, add the governed IWER simulator tier through the real WebXR/InputRouter path; validate on target hardware when the claim is device-dependent. Simulator success must never be reported as physical Quest qualification.",
    'Stream A simulator evidence rule',
)
quality_path.write_text(quality)

print('patched simulator stream plan')
