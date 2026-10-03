# NemoCoder autonomous operating model

## Authority

NemoCoder is an autonomous support lane under `AGENTS.md` and `docs/ROADMAP.md`. This file governs its controller behavior but cannot override project authority.

## Hourly controller cycle

Each scheduled run performs at most one bounded forward tranche:

1. sync/read remote `main`, AGENTS, roadmap, this operating model and NemoCoder work docs;
2. inspect Mac host health, active leases/worktrees, current controller state and last durable experiment;
3. recover an interrupted safe step if one exists, otherwise select the next incomplete phase dependency;
4. acquire a NemoCoder-specific lease before mutation;
5. execute the smallest useful tranche;
6. run focused verification and any phase-specific adversarial checks;
7. persist state/artifacts;
8. create/update a focused PR when repository changes are ready;
9. never merge across a failing required gate;
10. release the lease and emit a bounded status record.

The controller must not manufacture work merely to fill an hour.

## Persistence

Runtime state lives outside the source tree in a dedicated local NemoCoder state directory and must include:

- schema version;
- current phase/level;
- incumbent model identity;
- active candidate;
- current experiment/task IDs;
- lease owner and heartbeat;
- last successful checkpoint;
- last error and retry count;
- artifact paths and hashes;
- notification timestamps.

Durable repository changes go through normal branches/PRs. Do not commit hourly heartbeat noise.

## Supervisor rules

- A process is healthy only if its progress heartbeat or artifact changes within the configured window. PID existence alone is not progress.
- Every long-running training/eval process has a wall-clock deadline and child-process cleanup.
- Three repeated failures with the same normalized cause open the circuit breaker for that action and move to diagnosis or an alternative model/backend.
- Interrupted operations resume from the last durable stage, never from an assumed in-memory state.
- One training job and one heavyweight evaluation job maximum on the 16 GB Mac unless measurements justify more.
- Stop a run when memory pressure, swap or thermal behavior threatens host usability.

## Repository isolation

- Use a dedicated branch/worktree for controller/tool implementation.
- Historical evals use disposable worktrees pinned to immutable SHAs.
- Candidate-generated patches may never be applied to canonical `main`.
- Evaluation worktrees have explicit path/tool/time limits and are deleted after artifact capture.
- NemoCoder may not edit RFL/Shadow findings to improve its own score.

## Data safety

Before any repository text enters a training artifact:

1. run credential/secret scanning;
2. strip environment values, local paths with sensitive material and connector credentials;
3. classify source/provenance;
4. deduplicate;
5. prevent holdout/eval contamination;
6. hash the admitted record and manifest.

A detected secret is a hard stop for that dataset build.

## Training backends

Backends implement a common contract:
`prepare -> train -> checkpoint -> export -> verify-load`.

Initial priorities:

1. local MLX adapter training for models that fit;
2. Transformers/TRL/PEFT-compatible backend;
3. optional external GPU backend only under authorized spend/resource policy.

Ollama implements the serving contract:
`install/import -> health -> chat/tool-call smoke -> version report`.

Fine-tuning and serving remain separate concerns.

## Model registry

Each model version records:

- stable model ID;
- base weights/model card identity;
- quantization;
- adapter/fused artifact hashes;
- training manifest hash;
- benchmark manifest hash;
- achieved curriculum level;
- permissions earned;
- serving recipe;
- promotion/rejection state.

Never overwrite an incumbent artifact in place.

## Capability permissions

Promotion of model quality does not automatically promote operational permissions.

The controller separately maps benchmark evidence to allowed assistance classes. Production implementation always remains subject to project workstream ownership and PR/review policy.

## Periodic updates

The controller maintains detailed machine-readable state locally and concise durable experiment records.

User-facing updates are emitted:
- on a phase completion;
- when an incumbent is promoted/rejected after a material training round;
- on a blocker requiring user action;
- on a material cost/resource decision;
- otherwise no more often than every six hours.

Updates report: current phase, latest measurable result, incumbent/candidate, what changed, next autonomous action and blockers. Do not dump training logs.

## Autonomy boundary

The controller may autonomously:
- build its own tooling;
- mine/sanitize permitted repository history;
- create eval tasks;
- run local models and tests;
- train local adapters;
- reject/promote model checkpoints under pre-registered gates;
- open focused PRs for its own infrastructure;
- choose a different eligible base model when evidence shows the current one is unsuitable.

It may not autonomously:
- weaken Nemosyne tests/governance to improve scores;
- consume secret eval answers into training;
- grant itself production/merge/scientific authority;
- incur unapproved new paid spend;
- expose credentials/private data;
- merge a high-risk controller change without the normal independent review.

## Initial execution order

`NC0 -> NC1 -> NC2 -> NC3 -> NC4 -> NC5 -> NC6 -> NC7 -> NC8 -> NC9 -> NC10`.

NC1 corpus collection may overlap NC0 tooling only after isolation/provenance rules exist. No training begins before NC3 and NC4 establish the evaluation baseline.
