# Tool mappings — model groups → native config

The four groups are defined once in `model-routes.json`. Below is how to express each group
in each tool's native config. **These are reference snippets, not auto-loaded files** — copy
the one for your tool into its real config and fill in confirmed model IDs. Schemas vary by
tool version; adjust as needed. Group *keys* and the routing policy are the stable part;
model IDs are the editable part.

## Claude Code

Claude Code sub-agents take a `model:` field in their frontmatter (`.claude/agents/*.md`,
gitignored locally) and the `Agent` tool takes a `model:` override per dispatch. Map groups
to Claude's model tiers as follows (Claude model IDs from the session environment):

| Group | Claude model id (example) | When |
|---|---|---|
| `ollama-cloud` | *(your Ollama Cloud model, e.g. `glm-5.2:cloud`)* | explore / mechanical / general coding |
| `google` | `claude-opus-5` or `claude-sonnet-5` for long-context reasoning | plan / architect / review |
| `opencode-go` | *(your OpenCode Go model)* | code-implementation |
| `opencode-zen` | `claude-opus-5` for adversarial verify | verify / review |

Notes:
- Claude Code's own model id space is Claude-family (`claude-fable-5`, `claude-opus-5`,
  `claude-sonnet-5`, `claude-haiku-4-5-20251001`). The non-Claude providers above are reached
  via whatever provider bridge your Claude Code install uses (e.g. an Ollama/OpenCode
  endpoint configured in settings). If a group maps to a non-Claude provider you haven't
  bridged, fall back to the closest Claude tier per the routing table instead.
- The decision procedure in `README.md` is applied **by you (the agent or its human) before
  dispatch**; Claude Code's dispatch mechanism itself is unchanged (this routing is
  manifest-only, by design).
- **Dispatch stays unchanged:** this folder does not modify how Claude Code spawns
  sub-agents. It only standardizes *which model to pick*.

## OpenCode

OpenCode reads `opencode.json` (repo root). Schema (provider + models + a default), example:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama-cloud": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "https://your-ollama-cloud-endpoint/v1" },
      "models": { "glm-5.2:cloud": { "name": "GLM 5.2 (Ollama Cloud)" } }
    },
    "google": {
      "npm": "@ai-sdk/google",
      "models": {
        "gemini-2.5-pro":   { "name": "Gemini 2.5 Pro" },
        "gemini-2.5-flash": { "name": "Gemini 2.5 Flash" }
      }
    },
    "opencode-go":  { "options": {}, "models": { /* your Go model ids */ } },
    "opencode-zen": { "options": {}, "models": { /* your Zen model ids */ } }
  },
  "model": "ollama-cloud/glm-5.2:cloud"
}
```

- Confirm the exact provider package names + endpoint URLs for your OpenCode version.
- Set `model` (default) to your workhorse group; switch per-task per the routing table.
- Keep the **four group keys identical** to `model-routes.json` so the policy maps 1:1.

## Antigravity

Antigravity config location/schema is tool-version dependent; the stable idea is the same
four provider entries with matching keys. Sketch:

```jsonc
{
  "providers": {
    "ollama-cloud":  { "models": ["glm-5.2:cloud"], "default": true },
    "google":        { "models": ["gemini-2.5-pro", "gemini-2.5-flash"] },
    "opencode-go":   { "models": [] },
    "opencode-zen":  { "models": [] }
  },
  "routing": "see .ai/model-routing/model-routes.json"
}
```

- Replace the snippet above with your Antigravity version's real config shape.
- Point the `routing` reference at `model-routes.json` so the policy lives in one place.

## Keeping them in sync

1. **One source of truth:** `model-routes.json` (groups + routing + triggers).
2. When you confirm a real model id, update `model-routes.json` first, then mirror into each
   tool's native config via the snippets above.
3. Never rename a group key without updating all four places (manifest + 3 tool configs).
4. The routing *policy* (preferred/fallback/switch-triggers) is edited only in
   `model-routes.json` + `README.md`; tool configs carry just the provider/model mapping.