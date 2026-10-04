# QCA4a Spatial Glyph Hygiene

**Status:** Approved design, pre-implementation  
**Date:** 4 October 2026  
**Integration target:** `main@6d62b677033ca0c82f17b5688941b7443abd824a`  
**Canonical roadmap:** `docs/ROADMAP.md`  
**Programme:** `docs/work/quest-compute/QCA4_WEBXR_RENDERING.md`

## Purpose

The governed QCA0 Quest capture exposed a measurement contaminant in the real
spatial UI path. The bundled UIKit Inter atlas has no glyph for U+00B7
MIDDLE DOT, while Nemosyne's VR panels use that character as a decorative
separator. UIKit warns once per attempted glyph layout. The development-only
remote console then serializes and sends every warning to the Vite host.

The observed local log contains 29,545 identical missing-glyph warnings and is
2.58 MB. This does not explain the 32K-100K rendering collapse, but it can
materially perturb the sensitive 1K/8K comparison and must be removed before a
small performance delta is trusted.

## Scope

In scope:

- replace U+00B7 in text rendered by `src/vr/**` with the supported ASCII
  separator `|`;
- preserve wording, ordering, values, state, interaction and semantic meaning;
- test the live QCA operator and load-test summary formatters;
- run the same custody-governed QCA0 profile on Quest 3S as the controlled
  before/after experiment.

Out of scope:

- changing desktop copy outside `src/vr/**`;
- suppressing console warnings, patching UIKit, or disabling diagnostic
  transport;
- changing QCA0 workload, thresholds, evidence semantics or custody;
- connecting the current prefix-based `applyLODScale` implementation;
- claiming that warning removal fixes the large-N rendering collapse.

## High-risk pre-implementation adversarial contract

**Invariant:** the spatial UI must present the same investigator-visible facts
and actions without requesting an unsupported glyph, and the governed rerun
must differ from QCA0 only by the separator substitution and unavoidable device
variance.

**Authority and production path:** UIKit remains the spatial-text renderer;
`ValidationOperatorPanel` and `LoadTestPanel` remain the live governed capture
surfaces; `LoadTestDriver -> World.loadDataset -> RepresentationSurface`
remains the measured product path. The validation launcher, sink and custody
bundle remain the evidence authority.

**Primary failure modes:** only the hot panels are changed while another
per-frame VR surface retains U+00B7; copy or values change with the separator;
console warnings are hidden rather than prevented; desktop and governed
evidence semantics drift; the post-change run is compared across a different
profile/device/build state; natural device variance is misreported as a proven
performance gain; a broad font or UI refactor introduces new layout cost.

**Falsifying evidence:** tests exercise real operator/load-test summary output
and fail while U+00B7 remains; a bounded source audit finds no U+00B7 under
`src/vr`; focused spatial UI and QCA tests pass; typecheck/build pass; and an
exact-head Quest 3S QCA0 rerun records the same profile, representation and
cardinalities with no missing-middle-dot warning storm.

**Non-goals/dependencies:** QCA4a is measurement hygiene and one rendering fast
win, not QCA4 completion. QCA2 stage attribution and semantic LOD remain later
tranches. The existing `applyLODScale` prefix truncation is not adopted because
it can make an arbitrary row prefix visible and thereby change semantic access.

## Design

Use a direct literal substitution from ` · ` to ` | ` in spatial VR source.
This is intentionally smaller than adding a custom font atlas, a Text wrapper,
or warning suppression:

- a custom atlas adds download, decode, texture and maintenance cost to a
  performance experiment;
- a wrapper would migrate every UIKit Text construction site and broaden the
  regression surface;
- warning suppression would conceal the defect while retaining glyph lookup
  and layout work.

The substitution applies to all known `src/vr/**` occurrences so hidden or
currently inactive spatial panels cannot reintroduce the same warning when
their state changes during a capture. Existing punctuation and investigator
data remain otherwise untouched.

## Adoption and interpretation

The code change is retained when automated verification passes and the device
run shows no missing-middle-dot warning storm or spatial-copy regression. Frame
statistics are reported as observations with the original QCA0 results beside
them. A small improvement supports cleaning the measurement lane; no
improvement is also useful because it narrows the large-N root cause toward
geometry, fill and main-thread construction. QCA4a does not revise PERF-04 or
PERF-05 promotion status.
