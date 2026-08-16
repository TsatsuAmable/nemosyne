\# Nemosyne — Roadmap to Stable Release  
\> **Historical planning document.** `docs/ROADMAP.md` and `docs/study/` are authoritative.
\#\#\# (MVP feature set \+ NFRs \+ UX sufficient to make the core hypothesis seamlessly testable)

\*\*Revision note:\*\* this version incorporates a definitional correction to what "Stable"  
means for a research instrument. The original cut of this roadmap treated all  
collaboration as post-MVP, on the logic that Nemosyne's usefulness should be validated  
solo before multiplayer is worth building. That logic still holds for \*\*collaborative  
analysis\*\* (multiple analysts jointly manipulating one space) — but it was too broad,  
because it also swept up \*\*observational collaboration\*\* (a researcher entering a  
participant's session to watch, record, and minimally direct a study trial), which isn't  
a product feature at all — it's part of the experimental apparatus the flagship study  
needs to run. A study with no way for a researcher to see what the participant is doing  
beyond a telemetry log loses the qualitative/behavioral evidence stream entirely, which  
the earlier scoping under-weighted. That distinction is threaded through the gates below.

\*\*Revision 2 note:\*\* this pass adds the piece the prior revision was still missing —  
Gate 2.5 (observation) tells you what happened in \*one\* session; nothing previously in  
this roadmap made \*many\* sessions add up to a defensible experiment. Added: Gate 5  
(Experimental Validity & Study Harness — trial data model, counterbalancing, outcome  
capture, an explicit canonical 2D control, an experimental confound register, and a data-  
governance layer covering consent/minimization/pseudonymization/retention, all confirmed  
via direct code search to not exist anywhere in the codebase today) and Gate 6 (Stable  
Release Candidate — a freeze/rehearsal gate, not new work). Also tightened: Gate 0's exit  
criterion (now auditable against a concrete defect list rather than an unprovable  
absolute), Gate 2's exit criteria (now an observable checklist), and a Gate 4 item that  
had gone stale against Gate 2.5's own reclamation of previously-dead-code classes.

\*\*Grounding:\*\* every item below was independently verified against the codebase across  
multiple review passes (build/typecheck/lint/test re-runs, direct source inspection with  
file:line citations, and — where noted — cross-checked against the project's own  
\`docs/ROADMAP.md\`, which I independently found to be accurate wherever spot-checked). One  
item below (the orphaned \`WebGLRenderer\`) was re-verified in this pass specifically, down  
to confirming it's constructed unconditionally in the main \`World.ts\` path and never  
disposed.

\*\*Framing.\*\* "Stable release" here is defined narrowly and deliberately: not feature-  
complete, not scaled, not collaboration-ready — the smallest, most honest version of  
Nemosyne capable of running one real study (2D vs. VR-3D on a defined task)
without the \*infrastructure itself\* being a confound. A crash, a security hole, a UI bug  
that silently excludes colorblind participants, or a wheel menu that double-fires under  
observation are not just quality issues here — they invalidate any data collected on top  
of them. That reframes prioritization: fix what would corrupt the experiment before  
building anything the experiment doesn't need.

\*\*Revision 3 note (final addition per this round of review):\*\* adds the core hypothesis  
statement, a data dictionary requirement, event sequencing for cross-stream correlation,  
a frozen experiment package for Gate 6, and a Release Evidence Matrix — the five items  
this round's review asked for, plus the smaller tightenings it flagged alongside them  
(deterministic reproduction fixtures in Gate 0, a semantic-vs-structural comprehension  
check in Gate 2's exit criteria, experience-quality measures in Gate 3, and a validated-  
instrument caveat on Gate 5's workload measure). Per that review's own recommendation,  
this is intended as the last structural revision — the next step is execution, not more  
roadmap.

\---

\#\# Core Hypothesis & Research Questions  
\*Added so the roadmap is self-contained rather than referring to "the core hypothesis"  
without ever stating it.\*

\*\*Core hypothesis:\*\* for defined analytical tasks involving relationships and  
multidimensional structure, spatial representation and embodied interaction can improve  
human discovery and understanding compared with conventional 2D representation, without  
unacceptable costs in precision, workload, navigation, or comfort.

\*\*Research questions this roadmap exists to make answerable:\*\*  
\- RQ1: Where does spatial representation help?  
\- RQ2: Where does it hurt?  
\- RQ3: What interaction costs does it introduce?  
\- RQ4: Does spatial context improve recall?  
\- RQ5: Which representation characteristics predict benefit?

Every gate below should be read against one question: does this reduce the risk that the  
eventual answer to RQ1–RQ5 is contaminated by something other than the variable being  
studied? Gates 0/1 protect against infrastructure contamination; Gate 2 protects against  
"the task was too hard to attempt" contamination; Gate 2.5 and Gate 5 protect against  
protocol/measurement contamination; Gate 3 protects against "the hardware couldn't  
actually run it" contamination; Gate 4 protects against future readers trusting claims  
that don't match what shipped; Gate 6 is the check that all of the above actually held on  
a full rehearsal, not just in isolation.

\---

\#\# Release Evidence Matrix & Status Vocabulary  
\*Moved here from its prior position after Gate 6, on the logic that this is the roadmap's  
operational definition of "done" — every gate below should be read against it rather than  
each gate inventing its own notion of complete.\*

\*\*Canonical status vocabulary\*\* (formalizing the evidence hierarchy already present in  
the project's own \`docs/ROADMAP.md\`, applied consistently rather than left to individual  
sections): 🟢 Implemented → 🔵 Automated-tested → 🟡 Human-validated → 🟠 Demonstrated  
useful → 🔴 Demonstrated superior. This roadmap uses it as follows — note the deliberate  
asymmetry in the last row:

| Capability area | Minimum required level for Stable |  
|---|---|  
| Runtime integrity (Gate 0\) | 🔵 Automated-tested |  
| Participant UX / analyst journey (Gate 2\) | 🟡 Human-validated |  
| Observer mode (Gate 2.5) | 🟡 Human-validated |  
| Hardware performance (Gate 3\) | 🟡 Human-validated, hardware-specific |  
| Canonical 2D control (Gate 5\) | 🟡 Human-validated |  
| Study harness (Gate 5/6) | 🟡 Rehearsal-validated (Gate 6's full dry run) |  
| \*\*Core research hypothesis itself\*\* | \*\*Not required for release\*\* |

That last row is the point of this table: \*\*Stable is defined as what makes the  
hypothesis testable, not as proof the hypothesis is true.\*\* Nothing in this roadmap  
requires Nemosyne to already be demonstrated superior to 2D before shipping Stable — that  
result, whichever direction it goes, is what the first study is for.

\*\*Capability-level tracking\*\* (kept current as gates close — the single place to check  
"is Nemosyne actually ready" without re-reading every gate's prose):

| Capability | Code | Automated test | Human-validated | Hardware | Gate | Study impact if missing |  
|---|---|---|---|---|---|---|  
| Wheel (dominant-hand, no double-fire) | 🟢 | 🔲 | 🔲 | 🔲 | Gate 0/2 | High — corrupts interaction-error counts |  
| Compare operation | 🔲 | 🔲 | 🔲 | 🔲 | Gate 2 | Critical — flagship task depends on it |  
| Colorblind-safe data encoding | 🔲 | 🔲 | 🔲 | 🔲 | Gate 2 | Critical — silent participant-subgroup confound |  
| Observer console (Passive/Prompt/Assisted) | 🟢 (reclaimed) | 🔲 | 🔲 | 🔲 | Gate 2.5 | Critical — no qualitative evidence stream without it |  
| Canonical 2D control | 🔲 | 🔲 | 🔲 | N/A | Gate 5 | Critical — weakens the entire comparison's claim |  
| Session/trial recording \+ event sequencing | 🔲 | 🔲 | 🔲 | 🔲 | Gate 2.5/5 | Critical — un-triangulable evidence |  
| Load-test data on real Quest hardware | 🟢 (harness only) | 🔲 | 🔲 | 🔲 | Gate 3 | High — every UI comfort/perf decision is unvalidated without it |

🟢 marks genuine existing capability, code-verified directly against the repository, not  
aspiration; 🔲 marks everything this roadmap treats as a blocking Stable-release item.

\---

\#\# Gate 0 — Runtime & Resource Integrity  
\*Theme: Architecture \+ Tech Debt. Exit criterion: no known P0/P1 lifecycle, crash,  
corruption, or resource-leak paths remain within the supported Stable Release workflows,  
and adversarial/error-path tests cover the identified failure classes. (Sharper than "the  
app doesn't leak under any input a participant could produce" — that's the right intent  
but isn't literally provable; this version is auditable against a concrete defect list.)\*

| Item | Evidence | Why it blocks the study |  
|---|---|---|  
| \*\*Orphaned second \`WebGLRenderer\`.\*\* \`SceneGraphController.ts:47\` constructs a full second \`THREE.WebGLRenderer\` unconditionally; \`World.ts:206\` instantiates the controller and never calls its \`dispose()\`. Two live GPU contexts on Quest hardware is not cosmetic — it's a resource leak in the most resource-constrained deployment target. | Verified directly this session | GPU exhaustion mid-session would look like "Nemosyne is slow/unstable," confounding any performance or comfort measurement in the study |  
| \*\*Material/texture leak on repeated Draco synthesis.\*\* Roadmap-flagged, consistent with the general pattern of no-dispose paths found elsewhere in the graphics layer. | \`docs/ROADMAP.md\` §22.9, consistent with independently-verified renderer leak above | A study session that involves swapping representations repeatedly (exactly what "Find the Fraud" requires) would accumulate leaked GPU memory over the session length |  
| \*\*Stale \`DataView\` after \`wasm.memory.grow()\`.\*\* Cross-validated by three independent reviewer passes per the roadmap; a growable-memory read that goes stale silently returns wrong data rather than erroring. | \`docs/ROADMAP.md\` §22.8 | Silent data corruption is the worst failure mode for a data-analysis research tool specifically — wrong numbers with no error is worse than a crash |  
| \*\*WASM \`leaves()\` unbounded recursion → stack-overflow trap.\*\* Reachable via the standard \`data\_operation\` ABI on a degenerate merge-history chain. | \`wasm/src/data/operations.rs:453-464\`, roadmap-verified | An unusual but plausible participant interaction pattern (many undo/redo cycles) shouldn't be able to hard-crash the WASM instance mid-study |

\*\*Build. No design decisions required — these are defects.\*\* Each of the four items above  
should ship with a minimal reproduction fixture or a deterministic regression test, not  
just a fix — "we believe this is resolved" is weaker than "here is the test that fails  
before the fix and passes after," and a research instrument specifically needs to be able  
to answer "can we reproduce the failure on demand" if something looks wrong mid-study.

\---

\#\# Gate 1 — Security & Role Integrity  
\*Theme: Security. Renamed from "Security Baseline for Any Multi-Party Testing" — that  
conditional framing is now obsolete, since Gate 2.5 makes observational research part of  
Stable and every study session is multi-party by definition. Exit criterion: identity,  
role boundaries, and the participant/observer distinction are enforced by the system, not  
assumed.\*

| Item | Evidence | Severity |  
|---|---|---|  
| \*\*Signalling \`from\` spoofing.\*\* \`SignallingServerCore.ts\`: \`message.from ?? peerId\` lets a client override the authenticated identity in relayed messages. | Verified verbatim this session | P1 — any multi-peer or remote-observer study condition needs real identity integrity |  
| \*\*No per-peer rate limiting on the signalling server.\*\* A flood peer can exhaust a room. | Roadmap §22.8 | P2, but relevant if any study session is remotely proctored |  
| \*\*CSV missing the \`\_\_proto\_\_\`/\`constructor\`/\`prototype\` filter that JSON has.\*\* \`Parsers.ts:50\` filters JSON columns; the CSV path has no equivalent filter anywhere in the file. | Verified directly this session — confirmed worse than "inconsistent," CSV has none at all | P2 — a malicious or malformed study dataset file could pollute \`Object.prototype\` |  
| \*\*Vite dev-server signalling silently broken.\*\* \`request.url \!== '/\_\_signal'\` bails before query-param parsing runs, so local dev multiplayer never connects. | Verified verbatim this session | Dev-only, but blocks the team from locally testing any collaborative study condition before it ships |

\*\*Build the P1/P2 items if any study condition is multi-party; the dev-only item should  
be fixed regardless since it currently blocks the team's own ability to test collaboration  
locally.\*\*

\*\*Revised scope, given Gate 2.5 below: this gate is no longer conditional.\*\* Once  
observational collaboration (researcher-as-observer) is promoted into the Stable release,  
every study session involves at least two parties (participant \+ observer) by definition.  
The identity-spoofing and rate-limiting items move from "build if multi-party" to  
"build, full stop" — a study protocol depends on the researcher's view of the session  
being trustworthy, and \`message.from ?? peerId\` currently means nothing stops a session  
from being spoofed by a third party mid-trial. One addition specific to observation:

\- 🔲 \*\*No role/permission model exists at the network layer.\*\* Confirmed by direct  
  inspection: \`NetworkManager.ts\`/\`Room.ts\` have no concept of role at all — every peer  
  is currently symmetric. This is the actual blocker for observer mode, not a missing  
  UI: the wire protocol needs an explicit \`role: 'participant' | 'observer'\` distinction  
  before anything else in Gate 2.5 can safely ship, because without it an "observer"  
  session is really just a second, unrestricted participant with no code-level barrier  
  stopping it from manipulating the analytical state mid-trial.  
\- ⚪ \*\*A third \`operator\` role is not being added.\*\* Considered and deliberately deferred:  
  the two-role model (participant, observer) covers the study as currently scoped, and a  
  separate infrastructure-operator role should only be built if a real need for someone  
  distinct from the researcher/observer actually shows up — not pre-built for theoretical  
  completeness.

\---

\#\# Gate 2 — The One Analyst Journey (MVP feature set)  
\*Theme: UI/UX \+ Architecture. Exit criterion: a first-time participant can complete one  
defined task (the "Find the Fraud" scenario) start to finish without needing anything  
outside this list. This is deliberately narrower than the full feature set — the MVP  
question is "what does the flagship task need," not "what has been built."\*

\*\*Navigation (reworked from the prior synthesis, re-scoped here for the study specifically):\*\*  
\- 🔲 Dominant-hand wheel-menu binding \+ pinch double-toggle fix (prerequisite for  
  everything else in this gate — an input layer that double-fires or binds to the wrong  
  hand will read as "the participant made an error" in study data when it was the tool)  
\- 🔲 Lens dock: consolidate the six existing hidden-by-default panels into one tabbed  
  surface, so a participant isn't left guessing which of eight toggles surfaces what  
\- 🔲 Wheel content scoped to the task: Explore / Inspect / Compare / Annotate only —  
  not the full six-category taxonomy, which the task doesn't need and which adds  
  interaction-cost variance the study doesn't want to measure by accident  
\- 🔲 Minimal Observatory (dataset load \+ one saved view) — collaboration entry  
  explicitly excluded from MVP scope

\*\*Missing core capability:\*\*  
\- ✅ \*\*First-class Compare operation.\*\* Implemented in `7649446` as a dedicated
  (verified: \`DatasetOperations.ts\` has diff-adjacent ops but no unified compare-selected-  
  vs-baseline capability). This is not a nice-to-have — "Find the Fraud" and most  
  plausible study tasks are fundamentally comparison tasks (selected vs. population,  
  anomaly vs. baseline). Without it, the flagship study can't be run as designed.  
\- 🔲 \*\*Draco explainability surface ("Why this view?").\*\* The recommender  
  (\`ConstraintEngine.ts\`) already computes scored, weighted rationale internally — it's  
  not exposed to the user. For a study measuring trust/comprehension of an AI  
  recommendation, this needs to be visible, not just logged to the diagnostic HUD.

\*\*Accessibility (promoted from "nice to have" to MVP because it's a validity issue, not  
just a UX issue):\*\*  
\- ✅ \*\*Colorblind data encoding.\*\* Implemented in `7649446`;
  `categoricalColor()` uses a dedicated colorblind-safe palette when the mode is active. If the study recruits a
  representative sample and doesn't screen for color vision, this isn't just an  
  accessibility gap — it's a confound that would silently degrade a subset of  
  participants' task performance for reasons unrelated to the variable being studied.  
  The implementation uses a dedicated colorblind-safe categorical palette (Okabe–Ito), not just wiring the
  existing 4-role \`remapColor()\` into a 6+-category use case (confirmed that would still  
  collapse same-hue-family categories).  
\- 🔲 Text legibility pass (frosted panel backing, minimum contrast) — same logic: illegible  
  text is a confound for a comprehension-measuring study, not just a polish item.

\*\*Explicitly NOT in this gate (deferred, not because they're bad ideas but because the  
flagship task doesn't need them):\*\* full context-sensitive wheel states beyond the task's  
four actions, the "Inquiry Wheel" semantic reframe, menu memory, TDA/persistence-diagram  
lenses (already correctly made on-demand/hidden per Sprint 22.2 — keep it that way for  
MVP), voice interaction, multi-peer collaboration.

\*\*Gate 2 exit criteria (observable, not aspirational):\*\* a first-time participant, with  
only the in-tool onboarding (guided tour / JIT gesture hints — no researcher instruction  
beyond consent and task framing), can: begin the session unassisted; identify the target  
representation/artifact for the task; inspect it; compare it against a baseline/population  
using the new Compare operation; capture the finding (annotation/export); recover from at  
least one induced error state (e.g. a bad selection, an accidental delete) without the  
session becoming unrecoverable; resume a previously saved session; and, where the task  
depends on it, correctly distinguish a semantic spatial encoding (position that represents  
a data variable) from a purely structural/layout relationship (position that's just where  
the layout algorithm put something) — this last one matters specifically because the  
project's own research notes already flag that a participant seeing a cluster doesn't  
necessarily understand what "cluster" means, and a study measuring comprehension needs to  
know whether false spatial inference is happening, not just whether the participant found  
the right node. This list is  
deliberately binary/checklist rather than a numeric threshold — the pilot run is what  
should generate the first real success-rate/time targets, not a number invented before  
any data exists.

\*\*Operational note (execution-level, not a scope change):\*\* run this gate's dry run with  
two perspectives at once, not one — a naive participant completing the task, and the  
researcher attempting to observe/score that same run via Gate 2.5's console. A workflow  
that a participant can complete but a researcher can't reliably score is not actually  
done; the two dry runs are cheap to combine once the basic flow exists and catch this  
class of gap early rather than at Gate 6\.

\---

\#\# Gate 2.5 — Research Observation (promoted from Parked → Stable)  
\*Theme: Architecture \+ Security \+ UI. Exit criterion: a researcher can join a running  
participant session as a non-participating observer, see what the participant sees and  
does, mark timestamped qualitative observations, and — only in explicitly permitted  
protocol states — issue predefined prompts. Not collaborative editing; a distinct,  
asymmetric role.\*

\*\*Why this belongs in Stable, not Parked:\*\* the original scoping treated "collaboration"  
as one thing and deferred all of it. That was wrong for this specific sub-case. Without  
observation, the flagship study is reduced to whatever automated telemetry captures — a  
dwell-time number with no way to know whether it means careful reading or confused  
circling. The roadmap's own \`UXFrustrationAnalyzer\` already makes exactly this point  
about telemetry alone being ambiguous without human judgment; observation is the missing  
half of that argument, not a separate feature request.

\*\*What already exists and can be repurposed, verified this session (zero call sites,  
i.e. dead but real code, not vaporware):\*\*  
\- 🔲 \*\*\`AsymmetricDesktopCompanion\`\*\* — confirmed built, confirmed never instantiated  
  anywhere in \`src/\`. Its existing feature set (view-follow camera sync, bookmark  
  quick-jump, peer-presence display, spectator text comments) is, structurally, most of  
  what an observer console needs already. This substantially de-risks Gate 2.5: it is a  
  wiring-and-extension task, not a from-scratch build.  
\- 🔲 \*\*\`PeerAvatarManager\` / \`CollaborativeStateSync\`\*\* — also confirmed built, zero call  
  sites. Relevant to observer mode only for the participant's avatar/pose visibility  
  piece (so the researcher can see head/hand movement, not just a camera feed);  
  full bidirectional collaborative-analysis semantics remain out of scope.

\*\*What's genuinely new (not a rewiring of existing dead code):\*\*  
\- 🔲 \*\*Explicit participant/observer role model at the network layer\*\* (see Gate 1  
  addition above) — the actual architectural prerequisite.  
\- 🔲 \*\*Protocol-state machine: Passive / Prompt / Assisted.\*\* Every trial records which  
  mode was active. Passive \= observer cannot act on the session at all beyond viewing;  
  Prompt \= observer can trigger a small set of predefined prompt strings/events, nothing  
  freeform; Assisted \= observer may intervene per protocol. This needs to be enforced in  
  code (the observer's client literally cannot send manipulation events while in Passive  
  mode), not just a researcher instruction to "please don't touch anything" — the whole  
  point is that the system, not the honor system, guarantees the participant's data isn't  
  contaminated by unrecorded intervention.  
\- 🔲 \*\*Minimal researcher console.\*\* Session/participant ID, elapsed time, current  
  dataset/representation/selection/task-state readout, a small fixed set of observation  
  tags (confusion / hesitation / discovery / navigation-difficulty / gesture-difficulty /  
  verbal-query) plus a free-text timestamped note field, and trial controls (mark, pause,  
  resume, reset). Explicitly not required to be polished — "reliable and low-distraction"  
  is the bar, not production UI quality, since this is a researcher-facing tool, not a  
  participant-facing one and isn't part of the MVP feature set participants experience.  
\- 🔲 \*\*Session recording schema\*\*: participant ID, condition, task, timestamp, event type,  
  observation tag/note, and the analytical state snapshot at that moment — structured so  
  it can be joined against the automated telemetry stream after the fact (the  
  triangulation the study design depends on: quantitative time-on-task \+ behavioral  
  telemetry \+ qualitative observation, correlated by timestamp).  
\- 🔲 \*\*Event sequencing / clock correlation.\*\* Wall-clock timestamps alone aren't reliable  
  enough once observer notes, participant telemetry, and network-relayed events are being  
  correlated across potentially-varying latency — "researcher observed X at time T" needs  
  to actually line up with "participant state was X at time T." Every event this gate  
  produces should carry \`sessionId\`, \`trialId\`, a monotonic per-session sequence number,  
  both client and server timestamps. This is a small, mechanical addition on top of the  
  recording schema above, not a new subsystem — but it's the difference between "these  
  logs happened around the same time" and "these logs can be reliably joined."  
\- 🔲 \*\*Every observer action is its own logged event, not just the protocol-state label.\*\*  
  Not merely recording that a trial ran in Prompt mode — record \`observer.entered\`,  
  \`observer.prompted\`, \`observer.paused\`, \`observer.resumed\`, \`observer.marked\`,  
  \`observer.reset\`, \`observer.assisted\` as discrete, timestamped events. This is what makes  
  the intervention history reconstructable after the fact (did the researcher prompt once  
  or five times? when, relative to the participant's own actions?) rather than a single  
  opaque mode label covering the whole trial.

\*\*Explicitly still NOT in Gate 2.5 (remains Parked, per the original collaborative-  
analysis reasoning, which still holds for this half):\*\* two analysts jointly manipulating  
one dataset, shared editable annotations, multi-user co-navigation, voice chat, avatar  
social expression, conflict resolution for simultaneous edits. The distinction that  
matters: an observer has \*read visibility plus a narrow, code-enforced action allowlist\*;  
a collaborator has \*general write access to shared state\*. Only the former is required to  
run the study.

\---

\#\# Gate 3 — Non-Functional Requirements: Hardware Validation  
\*Theme: NFRs. Exit criterion: the performance and comfort claims embedded in every other  
gate above are backed by real measurement, not mocked-GL unit tests. This is the single  
largest standing gap identified across this entire review series.\*

\*\*Operational note: this is continuous qualification feeding UX, not a validation step  
that waits for Gate 2 to be finished.\*\* Take the first real Quest measurement as soon as  
the flagship task is minimally runnable, not after the analyst journey is declared  
polished — hardware may reveal the dashboard is too close, text is too small, the wheel  
interaction is tiring, or tracking degrades during the exact task workflow, and those  
findings are far cheaper to act on before the UX is considered settled than after. The  
formal exit gate below still applies; the point is not to defer contact with hardware  
until then.

\- 🔲 \*\*Run the load-test harness on real Quest hardware.\*\* The harness itself  
  (\`LoadTestPanel\`, staircase driver, frame-time/dropped-rate/JS-heap collection) is built  
  and unit-tested, but \`logs/loadtest-results.jsonl\` does not exist — it has never  
  actually been run on a headset. This blocks a real go/no-go on the WASM command-buffer  
  question, and blocks knowing whether the flagship study's target dataset size will even  
  run acceptably.  
\- 🔲 \*\*Real-GL smoke coverage exists but is explicitly non-blocking and doesn't touch  
  \`navigator.xr\`.\*\* The Playwright smoke test (verified this session) is a legitimate step  
  up from fully-mocked WebGL, but it's headless Chromium, not a headset — it cannot answer  
  "does hand tracking work," "is text readable at arm's length in-headset," or "does the  
  comfort vignette actually reduce reported discomfort." None of these have been measured.  
\- 🔲 \*\*Formalize as a hardware-validation matrix\*\*, per the roadmap's own research section:  
  device × {startup, hand tracking, controller, target dataset size, comfort, text  
  readability, reduced motion} with firmware/browser version recorded per cell — not ad  
  hoc spot-checks.  
\- 🔲 \*\*Extend the matrix beyond raw performance to experience quality\*\*: task-interruption  
  rate, tracking-loss rate, time-to-recovery from tracking loss, self-reported discomfort,  
  observer-rated confusion (feeds from Gate 2.5's tags), and text readability at actual  
  in-headset viewing distance. FPS/dropped-frames/heap alone can look fine while the  
  actual experience doesn't — these measures are what would actually explain a bad study  
  result on the hardware axis rather than just confirming frame budget was met.

\*\*This gate has no code-fix component — it's a data-collection exit criterion that gates  
whether Gate 2's UI decisions (panel distance, text scale, comfort vignette) can be  
trusted as-shipped or need revision once real data exists.\*\*

\---

\#\# Gate 4 — Tech-Debt Cleanup That Affects Trustworthiness of Results  
\*Theme: Tech Debt. Exit criterion: the documentation and dead-code surface area  
accurately reflects what's shipping in the stable release, so nobody (including the team)  
mistakes aspirational capability for tested capability.\*

\- 🔲 \*\*Correct the stale roadmap claim.\*\* \`docs/ROADMAP.md:201\` still checks off  
  "colorblind-safe palettes" as complete under the historical Phase 10 record, directly  
  contradicted by the accurately-tracked open gap 450 lines later in the same document.  
  Fix before the stable release, not after — an internally contradictory source-of-truth  
  document is itself a tech-debt item.  
\- 🔲 \*\*Reconcile the four-tier vs. two-tier instancing spec drift.\*\* \`CLAUDE.md\` documents  
  four discrete LOD bands; the actual code implements two plus an adaptive scale factor.  
  Per the roadmap's own recommended default: correct the spec to match reality unless  
  Gate 3's load-test data shows the middle band actually matters. Cheap, and removes a  
  documentation claim that overstates the system's sophistication to anyone auditing it  
  (including future study reviewers/reproducers).  
\- 🔲 \*\*Decide the fate of remaining built-but-never-wired classes.\*\* \`BinaryPoseSerializer\`  
  and any collaborative-analysis-only pieces of \`CollaborativeStateSync\` not claimed by  
  Gate 2.5 (see below) remain zero-call-site dead code as of this review and should be  
  explicitly marked out-of-scope/deferred in code comments or removed from the build for  
  the Stable cut, not left as ambiguous "is this shipping or not" surface area.  
  \*\*Correction from the prior revision of this roadmap:\*\* \`AsymmetricDesktopCompanion\`,  
  \`PeerAvatarManager\`, and the pose-sync portion of \`CollaborativeStateSync\` are no longer  
  in this "undecided" bucket — Gate 2.5 explicitly claims them as the observer-console  
  scaffold, so they're deferred-then-reclaimed, not deferred-then-deleted. This item exists  
  specifically so that reclamation is recorded in one place rather than left implicit.

\---

\#\# Gate 5 — Experimental Validity & Study Harness  
\*Theme: NFRs \+ Data Governance. Exit criterion: the flagship study can be run,  
repeated, and defended methodologically — not just "the software works," but "the  
resulting numbers mean what they claim to mean." Confirmed by direct code search: no  
trial, condition, counterbalancing, or consent concept exists anywhere in the codebase  
today (the one hit for "consent" is an unrelated telemetry opt-in toggle used during load  
tests). This gate is genuinely greenfield, unlike Gate 2.5 — there is no dead code to  
reclaim here.\*

\*\*Why this is a separate gate from Gate 2.5, not a subset of it:\*\* Gate 2.5 gives a  
researcher eyes on one session. Gate 5 is what makes many sessions, run under different  
conditions by different participants, add up to a comparison that means anything.  
Conflating them was the gap in the prior revision — Gate 2.5 answers "can I watch a  
trial," Gate 5 answers "do fifty trials constitute an experiment."

\- 🔲 \*\*Study/trial data model.\*\* Explicit \`participantId\` (pseudonymous, e.g. \`P014\`, not  
  a real identifier — see governance below), \`trialId\`, \`condition\` (2D / VR-3D),
  VR-3D), \`taskId\`, \`protocolVersion\`. None of this exists today; it needs to be added as  
  a first-class layer above the existing per-session save format in  
  \`WorldSessionController\`, not folded into it.  
\- 🔲 \*\*Condition counterbalancing.\*\* If every participant runs 2D → VR in
  the same order, practice effects confound the result indistinguishably from a real  
  spatial-representation effect. Needs an assignment mechanism (e.g. Latin square across  
  participants), recorded per trial so order can be checked as a covariate later.  
\- 🔲 \*\*Explicit trial-state machine\*\*: started / paused / resumed / completed / failed /  
  reset, each timestamped. Without this, "the participant restarted" and "the session  
  crashed" are indistinguishable after the fact — exactly the ambiguity that makes a  
  result "scientifically squishy" rather than defensible.  
\- 🔲 \*\*Outcome capture\*\*: answer, correctness (against a scored ground truth per task),  
  completion time, confidence rating, and a workload measure. \*\*Use a validated instrument  
  (e.g. the standard NASA-TLX protocol) or an explicitly-documented custom short-form  
  instrument, clearly labeled as custom\*\* — don't casually modify a validated instrument  
  and still call it by that name, since that would make results non-comparable to  
  published literature under a false pretense. The roadmap doesn't need to prescribe which  
  option yet, but the choice needs to be made and stated, not left ambiguous. This is new  
  UI, but small — a handful of end-of-trial prompts, not a feature.  
\- 🔲 \*\*Triangulation join key.\*\* Gate 2.5's recording schema already timestamps  
  observations; Gate 5 needs the automated telemetry stream, the trial/outcome data above,  
  and the observer log to share one join key (\`trialId\` \+ timestamp) so they can be  
  correlated after the fact without manual reconciliation.  
\- 🔲 \*\*Canonical 2D control, as its own implementation milestone — not an afterthought.\*\*  
  The 2D condition needs the \*same\* dataset, task wording, scoring rubric, and analytical  
  semantics as the VR condition, built and versioned alongside it, not
  assembled ad hoc when the study is about to run. Without this, the comparison is  
  "Nemosyne vs. some other tool," not "Nemosyne vs. 2D" — a materially weaker claim.  
\- 🔲 \*\*Experimental confound register.\*\* A living document (separate from, but  
  cross-referenced by, this roadmap) tracking known non-technical confounds and how each  
  is controlled or intentionally left as a variable: representation-explanation parity  
  (does the VR participant get more onboarding than the 2D participant?), input-training  
  parity, researcher-intervention asymmetry (tracked automatically via Gate 2.5's  
  Passive/Prompt/Assisted state — this is the one confound Gate 2.5 already instruments),  
  practice/repeated-dataset effects, interface novelty (treated explicitly as a variable  
  to measure, not a defect to eliminate).

\*\*Data governance layer (new — not previously in this roadmap):\*\*  
\- 🔲 \*\*Data dictionary.\*\* For every captured field, not just the storage schema: source  
  (e.g. XR camera pose vs. derived from task events), meaning, unit, sampling rate,  
  whether it's raw or derived, retention class, and whether it's disclosed to the  
  participant. E.g. \`headYaw\` — source: XR camera pose, unit: radians, sampling: per  
  frame, derived: no, retention: ephemeral; versus \`navigationTime\` — source: derived from  
  task events, unit: ms, sampling: per trial, derived: yes, retention: study dataset. This  
  is a small addition on top of the schema work above but pays for itself the moment  
  analysis starts — without it, "what does this column actually mean" becomes a research  
  question of its own.  
\- 🔲 \*\*Consent.\*\* What is recorded (telemetry, pose/gaze data, observer notes, any session  
  recording) and why, disclosed to the participant before the trial starts — this is a  
  protocol/paperwork requirement with a system-design consequence: the software needs a  
  documented, inspectable list of exactly what it captures, not a vague "we log stuff."  
\- 🔲 \*\*Data minimization.\*\* Decide per data stream whether raw trajectories or only  
  derived measures (e.g. dwell time, not full gaze-ray history) are actually needed —  
  driven by the study design in this gate, not collected by default because the telemetry  
  system happens to be capable of it.  
\- 🔲 \*\*Pseudonymization.\*\* Participant IDs, not names, inside any exported dataset —  
  applies to the \`participantId\` field above and to Gate 2.5's session recording schema.  
\- 🔲 \*\*Retention and deletion.\*\* How long recordings/observations are kept, and a real  
  "export and delete this participant's complete session" path — not just a database  
  row deletion, since Gate 2.5's data spans telemetry, observer notes, and analytical  
  state snapshots that need to be deleted together.  
\- 🔲 \*\*Observer visibility to the participant.\*\* The participant should have a clear,  
  in-session indication that they are being observed/recorded (not just a consent form  
  signed beforehand) — a small addition to Gate 2.5's participant-side UI, not a new  
  subsystem.

\---

\#\# Gate 6 — Stable Release Candidate  
\*Theme: Process. A freeze gate, not a feature phase — the point where the roadmap ends  
and the study begins. Exit criteria are checks against everything above, not new work.\*

\*\*No new features admitted here.\*\* The gate consists of running one full rehearsal of  
the actual study machinery end to end, on each target condition, on a genuinely fresh  
environment — not merely a "clean install" in the sense of a fresh app build, since a  
browser can still carry over IndexedDB contents, cached assets, or local storage from  
prior sessions, and session persistence is itself part of the study workflow being  
rehearsed:  
\- Fresh environment (new browser profile, empty IndexedDB, empty local storage, fresh  
  build artifact, defined network conditions) → fresh participant → researcher observer  
  joins → full trial (start, task, Compare, capture finding, an induced-error recovery,  
  session save) → resume from saved session → export the trial record → delete-participant  
  path exercised → repeat on 2D, repeat on Quest hardware.

\*\*Frozen experiment package.\*\* The rehearsal above is only reproducible if the protocol  
itself is versioned and frozen alongside the software, not assembled from whatever  
documents happen to exist when the study starts. Extends the prior revision's file list  
with two additions: \`analysis-plan.md\` (primary/secondary outcomes, exclusion rules,  
missing-data treatment, planned condition comparisons and qualitative coding, decided  
\*before\* data collection so the study can't become a fishing expedition across RQ1–RQ5  
after the fact) and \`data-dictionary.md\` (Gate 5 already requires this content — it  
belongs physically inside the frozen package, not only in the code/docs tree, so the  
study is reproducible from protocol through analysis in one place):  
\`\`\`  
experiment/  
├── protocol.md  
├── analysis-plan.md  
├── data-dictionary.md  
├── tasks.json  
├── datasets/  
├── scoring.json  
├── condition-order.json  
├── consent.md  
├── observer-guide.md  
└── version.json  
\`\`\`  
Tag the exact Nemosyne commit/build against this package. Without it, "we ran the Stable  
release" doesn't actually specify what was run. A real skeleton of this package, with  
starter content for each file grounded in this roadmap's own decisions, exists as a  
companion deliverable alongside this document.

\*\*Exit only when:\*\* no open P0/P1 defects from Gates 0–1, each with its deterministic  
reproduction fixture in place; the Gate 2 checklist criteria pass unassisted; the Gate 2.5  
protocol-state enforcement holds under an adversarial attempt to act while Passive; Gate  
3's hardware matrix has at least one clean pass per target device, including the  
experience-quality measures, not just raw performance; Gate 4's documentation matches  
what's actually shipping (no stale claims like the Sprint 10A.5 discrepancy this roadmap  
already caught once); Gate 5's telemetry/observer/outcome streams join correctly on a real  
trial's data via the event-sequencing fields, not just synthetic test data, and the data  
dictionary is complete for every field the frozen package actually captures; and the  
release artifact is tagged against the frozen experiment package above. This is the  
roadmap's actual finish line — every gate before it exists to make this rehearsal boring  
rather than eventful.

\*\*Known Limitations (Stable Release does not claim):\*\* production analytics readiness;  
multi-analyst collaborative editing; clinical or domain-expert-grade validity; superiority  
over 2D (that's the open question the study exists to answer, not an assumed result);  
general-purpose visualization recommendation beyond the datasets/tasks in the frozen  
experiment package; Quest performance beyond the specific tested envelope in Gate 3's  
matrix. This list ships as part of the release artifact specifically so the first study's  
results aren't later over-read as validating capabilities that were never actually tested.

\*\*Release record binding.\*\* Every trial result must be reconstructable from a single  
composite reference, not a loose label like "VR condition":  
\`{Nemosyne build/commit} \+ {experiment package version} \+ {protocol version} \+ {dataset  
version} \+ {task version}\` — e.g. \`nemosyne@abc123 \+ experiment@0.3 \+ task@Fraud-01 \+  
dataset@F-2026-08-11\`. \`protocolVersion\` already exists in Gate 5's trial data model;  
this extends it to the full chain so a result can be traced back to exactly what ran,  
not just which condition it was.

\---

\#\# Explicitly Out of Scope for "Stable Release" (Parked)

Per the same logic used to scope Gate 2 — these are real, some are good ideas, none are  
needed to make the core hypothesis testable, and building them now would be exactly the  
"implementation running ahead of validation" pattern already identified as the project's  
central risk:

\- \*\*Collaborative analysis specifically\*\* (as distinct from observational collaboration,  
  now in Gate 2.5): embodied presence wiring for multi-analyst co-manipulation, shared  
  editable annotations, moderation/kick for peer-to-peer sessions, reconnection state for  
  a disconnected co-analyst. Correctly gated behind solo-mode validation succeeding  
  first — this is the part of the original "defer all collaboration" reasoning that still  
  holds; it was only over-broad in also deferring the observer role.  
\- Voice/NLQ expansion beyond its current implemented state  
\- TDA as a core (not on-demand/optional) capability  
\- SQL/Parquet/warehouse connectors  
\- Rust/WASM migration beyond the Gate 0 defect fixes — no architectural acceleration  
  without a measured bottleneck from Gate 3's data  
\- The "Inquiry Wheel" semantic reframe, full six-category wheel taxonomy, menu memory —  
  all genuinely interesting, all belong in the \*research\* backlog as study variables  
  (metaphor-comprehension study), not the stable-release feature set

\---

\#\# Sequencing Rationale (why this order, not another)

\`\`\`  
Gate 0 (Runtime) ──→ Gate 1 (Security) ──→ Gate 2 (Analyst UX) ──→ Gate 2.5 (Observation)  
                                                                          │  
                                                        ┌─────────────────┴─────────────────┐  
                                                        ↓                                     ↓  
                                              Gate 3 (Hardware & Perf)              Gate 5 (Study Harness)  
                                                        └─────────────────┬─────────────────┘  
                                                                          ↓  
                                                                  Gate 4 (Trust/Tech-Debt)  
                                                                          ↓  
                                                                  Gate 6 (Release Candidate)  
                                                                          ↓  
                                                                    FIRST REAL STUDY  
\`\`\`

Gate 0 and Gate 1 come first because they're validity-threatening at the infrastructure  
level — a leaked GPU context or a data-corrupting stale DataView doesn't produce a bad  
UX, it produces \*wrong study data that looks like good data\*. Gate 2 is scoped to exactly  
one task's needs rather than the full feature backlog, because the stated goal is  
testability, not completeness — every item added beyond what "Find the Fraud" requires is  
schedule risk with no corresponding validity benefit. Gate 2.5 depends on Gate 2 (there  
must be a session worth observing) and gates entry into the two tracks that follow.

\*\*Gates 3 and 5 run in parallel, not sequentially\*\* — this is a correction from the  
prior revision, which listed Gate 3 as a standalone step. Hardware/performance validation  
and study-harness construction don't depend on each other and benefit from running  
concurrently: hardware observations should feed back into UX refinement while the team  
can still change the UX, and the study harness (trial state, outcome capture, 2D control)  
needs to exist before \*any\* condition can be piloted, VR or otherwise — there's no reason  
to gate one behind the other. Gate 2.5 sits upstream of both because a researcher watching  
a hardware-validation session produces better diagnostic data than logs alone, and because  
Gate 5's observer-log triangulation depends on Gate 2.5's recording schema already  
existing. Gate 4 moves to \*after\* Gates 3 and 5 in this revision (previously positioned  
right after Gate 3\) because tech-debt/documentation cleanup should reflect the system as  
it actually ships once the harness and hardware work are done, not freeze documentation  
prematurely and then have Gates 3/5 invalidate it. Gate 6 is last by definition — it's a  
freeze and rehearsal gate, not build work, and exists specifically so the first real study  
session is the boring, well-rehearsed one rather than the first time all the pieces run  
together.
