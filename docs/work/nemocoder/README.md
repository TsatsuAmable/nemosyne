# NemoCoder autonomous specialist-model apprenticeship

## Purpose

Build and continuously improve a local coding model that is measurably useful for Nemosyne engineering while preserving Nemosyne's existing authority, evidence, security and workstream boundaries.

NemoCoder is a support capability, not a new project authority. It may earn broader task permissions only through hidden evaluation and explicit promotion gates.

## Base machine and model strategy

- Controller, evaluation host and default inference host: the Mac lane.
- Current observed Mac baseline: Apple M1 Pro, 16 GB unified memory, Ollama installed.
- First inference candidate: quantized `gpt-oss-20b` served locally.
- Fine-tuning is performed by a training backend, not by Ollama itself. Ollama is primarily the serving/runtime interface.
- First local fine-tuning candidates should fit 16 GB comfortably. Gemma 4 small variants and other compact coding-capable open models are eligible.
- If a model cannot be trained locally within the resource envelope, the controller may benchmark alternatives or prepare an external training job. It must not incur new paid spend without an existing approved budget/policy.
- Model choice is evidence-driven. No model family is privileged after baseline measurement.

## Non-negotiable separation

Training/evaluation never grants a candidate model direct authority over current production `main`.

Historical tasks execute in disposable worktrees at the relevant historical commit. Synthetic tasks execute in sandboxes. A promoted NemoCoder may later assist a governed implementation agent, but ordinary Nemosyne PR, review, exact-head CI and merge rules still apply.

Secret benchmark material must never enter training data, prompts used to generate training examples, retrieval corpora visible during an eval, or model-selection diagnostics.

## Phases

### NC0 — bootstrap and resource preflight

Build the controller skeleton, inspect host resources, verify Ollama, Git, Python/uv, MLX/Transformers compatibility, disk headroom and model-serving interfaces.

Exit: reproducible preflight report and machine-readable host capability record.

### NC1 — provenance-aware corpus mining

Mine Git history, PR metadata, tests, CI outcomes, RFL findings, Shadow findings, ADR/RFC material and roadmap-linked work into candidate learning records.

Every record carries repository, base SHA, solution SHA/PR, affected paths, task family, provenance and leakage classification.

Exit: versioned raw corpus plus secret/licence/provenance scrub report.

### NC2 — task reconstruction

Convert historical work into executable tasks without exposing the historical patch to the model. Reconstruct the repository at the pre-change parent, derive the task statement, identify authoritative tests and add hidden falsifiers where needed.

Exit: at least 50 reproducible historical tasks spanning multiple task families.

### NC3 — frozen evaluation harness

Create public development evals plus a frozen secret holdout. Graders combine compilation, typecheck, tests, mutation/falsifier results, diff boundaries, authority checks, security/trust-boundary checks and structured abstention.

Exit: deterministic benchmark runner, tamper-evident manifest and baseline score schema.

### NC4 — untouched-model baselines

Benchmark `gpt-oss-20b` through Ollama first, then at least one smaller trainable local candidate. Measure correctness, task completion, tool reliability, latency, memory, regression by task family and abstention quality.

Exit: capability curve by model and curriculum level. No fine-tuning before this phase completes.

### NC5 — local training pipeline

Implement LoRA/QLoRA-style adapter training through an interchangeable backend. Prefer MLX-compatible local training on the Mac when feasible; support Transformers/TRL/PEFT-compatible external execution as an optional backend.

Persist model/base identity, dataset hash, trainer configuration, seed where meaningful, adapter hash and environment metadata.

Exit: one end-to-end smoke fine-tune that can be evaluated and served locally.

### NC6 — progressive curriculum

Train from narrow, mechanical Nemosyne tasks toward harder autonomous work. Instruction scaffolding is deliberately reduced as capability rises.

Promotion is earned on hidden tasks. Failure causes targeted data augmentation or regression to a lower level, not prompt inflation.

Exit: automated level selection, unlock and regression logic.

### NC7 — closed improvement loop

Automate:
`select weakness -> assemble clean training slice -> train candidate -> hidden eval -> compare incumbent -> promote/reject -> diagnose -> repeat`.

A rejected candidate is retained as experiment evidence but is never served as the incumbent.

Exit: unattended multi-round execution with circuit breakers and reproducible results.

### NC8 — Nemosyne coding interface

Expose the incumbent through a stable local API, initially Ollama/OpenAI-compatible where practical, plus a small CLI/agent adapter for OpenCode/Hermes-style use.

The interface reports model version and capability level and supports explicit `ABSTAIN`/escalation.

Exit: a governed agent can request bounded NemoCoder help without special manual setup.

### NC9 — earned autonomy

Grant permissions by demonstrated capability:
read-only archaeology -> tests/falsifiers -> isolated bug repair -> bounded multi-file changes -> CI diagnosis -> review assistance -> bounded tranche proposals.

Security/scientific authority, roadmap authority, evidence acceptance and merge authority remain outside NemoCoder unless separately governed later.

Exit: machine-readable capability registry maps demonstrated eval evidence to permitted task classes.

### NC10 — continuous apprenticeship

Continuously mine newly merged work after quarantine, add genuinely new task families, preserve old replay suites, detect catastrophic forgetting, re-baseline new base models and rotate the incumbent only when promotion gates pass.

Exit: sustainable autonomous maintenance rather than a one-off fine-tune.

## Tooling deliverables

The lane must build, not assume, these components:

1. corpus/provenance miner;
2. secret and leakage scrubber;
3. historical-task rebuilder;
4. disposable worktree/sandbox executor;
5. grader registry and hidden-falsifier runner;
6. curriculum/difficulty classifier;
7. trainer backend abstraction;
8. model and experiment registry;
9. promotion/regression gate;
10. Ollama serving adapter;
11. coding-agent/CLI bridge;
12. supervisor with lease, heartbeat, timeout, crash recovery and budget/resource limits;
13. periodic progress reporter;
14. reproducible export bundle containing dataset/model/eval hashes.

## Stop and escalation conditions

The autonomous lane stops or escalates rather than improvising when:

- secret holdout contamination is suspected;
- credentials/private data appear in a candidate dataset;
- current production files would be mutated by an evaluation task;
- required evidence cannot be made executable;
- repeated training rounds regress without a bounded diagnosis;
- disk/memory/thermal/resource limits make the selected model unsafe to continue;
- external paid compute would exceed authorized policy;
- a proposed capability would cross Nemosyne analytical, scientific, security, governance or merge authority.

## Success criterion

The project succeeds when a locally served incumbent can complete a useful fraction of bounded Nemosyne tasks at materially lower marginal cost while its competence is demonstrated by hidden executable evidence rather than self-report.
