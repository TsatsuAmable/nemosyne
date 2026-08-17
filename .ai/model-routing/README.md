# Model routing (cross-agent)

**Audience:** coding agents (Claude Code, OpenCode, Antigravity) working on this repo.
**Purpose:** spread LLM work across providers to save tokens and avoid single-provider
usage limits (the Ollama Cloud session 429 that killed a Wave-4 sub-agent is the motivating
incident). This folder is the shared, committed source of truth for *which provider to use
when*. Each tool reads it; each tool's own dispatch is unchanged — we only standardize the
selection criteria.

> This is **manifest + decision policy only**. It does NOT change how any harness dispatches
> its agents. It gives a coding agent enough information to *pick the right provider* before
> it (or its human) hits "go", and to *switch* cleanly when one provider is down or wrong-fit.

## Files

| File | Role |
|---|---|
| `model-routes.json` | The manifest: provider groups, models, tier, cost, context window, rate limits, task-class routing table, switch triggers. **Stable routing keys = the four group names.** |
| `tool-mappings.md` | How to wire the four groups into each tool's native config (Claude Code subagent frontmatter, OpenCode `opencode.json`, Antigravity config). Adjust to your tool's schema/version. |
| `README.md` | This file — the decision procedure + rationale. |

## The four provider groups

| Group key | Provider | Tier | Rel. cost | Context | Best for |
|---|---|---|---|---|---|
| `ollama-cloud` | Ollama Cloud | general | low | ~200k | explore, mechanical, general coding |
| `google` | Google (Gemini) | reasoning | medium | ~1M | plan, architect, review, long-context |
| `opencode-go` | OpenCode Go | code | medium | tbd | code-implementation |
| `opencode-zen` | OpenCode Zen | reasoning | medium | tbd | verify, adversarial review |

Group keys are stable; the `models` arrays in `model-routes.json` are **editable placeholders**
(see the `_verify` field — confirm each provider's current catalog and replace).

## Decision procedure (what a coding agent does before dispatch)

1. **Classify the task** into one of:
   `explore | mechanical | code-implementation | review | verify | plan | architect`.
2. **Look up `routing[taskClass]`** in `model-routes.json` → `{ preferred, fallback }`.
3. **Evaluate switch-triggers** against current conditions *before* committing to `preferred`:
   - **rateLimited** — did this provider recently return 429 / a usage-limit / quota error?
     If yes, skip to `fallbackAfter` (or the next entry in the fallback chain). Do **not**
     retry the same provider immediately.
   - **capabilityMismatch** — does the task need >200k context (→ `google`), or the
     strongest reasoning (verify/adversarial/architect → `opencode-zen` / `google`), or is
     it bulk cheap work (→ `ollama-cloud`)?
   - **costBudget** — if a token budget is stated, estimate the task cost and pick the
     cheapest group that clears the capability bar. Default to `ollama-cloud` for
     high-volume mechanical/explore work; reserve `google` + `opencode-zen` for reasoning.
   - **contextLength** — if input + expected output may exceed a group's `contextWindow`,
     switch to one that fits (`google` = 1M).
4. **Override `preferred`** with the first viable group in the fallback chain if any trigger fires.
5. **Dispatch.** On mid-task failure (429 / error / timeout), fall to `fallbackAfter` and
   **resume from the last checkpoint** — do not redo from scratch.
6. **Record attribution** — note which provider ran with the result, so per-provider token
   spend is traceable. (For this repo: put the chosen group in the commit body or task note.)

## Why these defaults

- **Ollama Cloud first for bulk work.** It's the cheapest and the current session's home
  provider, so it's the path of least resistance for explore/mechanical/general-coding.
  Its weakness is the **session usage cap** (429 under heavy sub-agent fan-out) — that's
  exactly what the fallback chain absorbs.
- **Google for plan/architect/review/long-context.** Larger context window + reasoning tier,
  medium cost — the right shape for design and synthesis that doesn't fit in 200k.
- **OpenCode Go for code-implementation.** Dedicated code provider; preferred when the task
  is squarely "write this code", falls back to ollama-cloud then google.
- **OpenCode Zen for verify/adversarial-review.** Reasoning tier reserved for the
  adversarial-verify / review passes where an independent strong model is the point.

The chains are intentionally short (1–2 hops) to avoid cascading failures.

## How to use it

- **As a coding agent:** read `model-routes.json`, run the decision procedure above, pick a
  group. If your harness lets you set the model per dispatch, set it to a model from that
  group's `models` array (after you've confirmed the IDs). If not, at minimum **avoid** the
  group that just 429'd and prefer the cheapest fit.
- **As a human configuring a tool:** copy the relevant snippet from `tool-mappings.md` into
  your tool's config, filling in confirmed model IDs. The group definitions stay in sync
  across tools because they all trace back to `model-routes.json`.
- **When a provider's catalog changes:** edit `model-routes.json` (the `models` arrays +
  any cost/context/limit fields), leave the group keys and routing table alone unless the
  policy itself is changing.

## Relation to the repo

This is **not** a Nemosyne application feature — `src/` has no LLM/model-routing layer. It
is coding-agent harness configuration, kept in a committed, cross-tool folder (`.ai/`)
rather than a gitignored tool-local dir (`.agents/` and `.claude/` are both gitignored) so
all three tools can read the same definitions. `AGENTS.md` (read by OpenCode/Antigravity/
Cursor/Claude Code) and `CLAUDE.md` point here.