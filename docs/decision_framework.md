# Nemosyne Decision Framework

> The product manager's guide for prioritization and validation. **v1 seed** — the
> `nemosyne_product_manager` agent owns this file and should refine it as the project learns.

## Core thesis
Spatial and embodied interaction should help people **discover, understand, remember, and
communicate** relationships in complex data that are hard to perceive in conventional 2D.
Nemosyne is a research-driven spatial analytics platform, not an impressive VR visualization
system or a collection of interaction metaphors.

## The analytical loop
**Find → Understand → Prove → Share.** Prioritize work that strengthens the weakest rung.
Current read: *Find* is strong; *Understand* is developing; *Prove* and *Share* are weak.

## Capability ladder (never confuse rungs)
implemented → tested → usable → useful → demonstrated advantage over a credible 2D baseline.
"Implemented" is not "useful." Roadmap status must reflect the true rung, not the aspirational
one.

## Task-first ordering
1. Identify the analytical problem. 2. Define the user outcome. 3. Select the spatial
representation + interaction model. 4. Determine the minimum technology required.
Draco, spatial form, gestures, memory-palace, and VR are hypotheses/instruments, not ends.

## The five questions (every initiative must answer)
- Who is this for?
- What task are they trying to accomplish?
- Why does Nemosyne improve that task?
- What evidence would prove it?
- What happens if conventional 2D is better?

## Stop / defer criteria
Block or defer any item that lacks a clear user problem, a measurable outcome, or a validation
path. Prefer small, testable increments over speculative expansion. An item can be
well-engineered and still not belong on the near-term roadmap.

## Where spatial/VR wins vs 2D vs hybrid
- **Spatial wins:** discovery, clustering, multi-dimensional layout, spatial memory, embodied
  exploration, communicating structure to others.
- **2D wins:** reading exact values, large tables, precise side-by-side comparison.
- **Hybrid wins:** use space for discovery, conventional representations for precision —
  spatial → inspect → 2D detail card / table / chart.

## Evidence hierarchy (strongest → weakest)
1. In-headset user study vs a credible 2D baseline (task time, error, recall, communication).
2. Heuristic / expert evaluation against a fixed rubric.
3. Telemetry on real sessions (e.g. `analysis_time` vs `navigation_time`, frustration signal).
4. Code-verified capability (feature exists, is wired, is tested).
5. Claim / rationale without verification.

## Exit criteria (per sprint)
Every sprint ships with: (a) what user outcome improved, (b) how it was verified (evidence
rung), (c) whether to proceed, pivot, or stop.

## Scope guard
Protect Nemosyne from becoming "merely an impressive VR visualization system." Every major
initiative must tie to the core thesis and the analytical loop. Generalize only after evidence
supports it; pursue a credible first validated use case first.