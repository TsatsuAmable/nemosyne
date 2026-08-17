# AGENTS.md

Compact ramp-up notes for OpenCode/agent sessions. The authoritative deep-dive is
`CLAUDE.md` (architecture, conventions) and `docs/ROADMAP.md` §Current Status
(live project state — read its top block first on pickup). This file only captures
things an agent would otherwise guess wrong.

## Commands (exact)

```bash
npm install
npm run wasm:dev          # build Rust/WASM dev crate -> wasm/pkg/ (required for dev:full WASM work)
npm run wasm              # release WASM build
npm run dev               # Vite dev server ONLY (no wasm-pack; WASM optional, lazy-loaded at runtime)
npm run dev:wasm          # wasm-pack dev build + Vite dev server
npm run build             # Vite production bundle -> dist/ (WASM externalized; succeeds without wasm/pkg)
npm test                  # Vitest JS-only (does NOT touch Rust; wasm/ is excluded in vitest.config.js)
npm run test:all          # cargo test --manifest-path wasm/Cargo.toml && vitest run
npm run test:coverage     # Vitest with v8 coverage (CI uses this; thresholds: 70/70/65/55)
npm run typecheck         # tsc --noEmit  (REQUIRED gate; CI fails on this)
npm run lint              # ESLint (blocking gate; src no-explicit-any is an error)
npx vitest run tests/foo.test.js   # single JS test file
cargo test --manifest-path wasm/Cargo.toml   # Rust unit tests only
npm run test:e2e:tier1    # E2E tier 1 (feature coverage); tier2/tier3/tier4 likewise
npm run test:smoke        # Playwright load smoke (builds dist/ + headless Chromium; informational, NON-blocking)
```

## Required command order

CI gate order (from `.github/workflows/ci.yml`): `typecheck -> lint -> test:coverage -> build`.
Run all four before claiming a task done. `lint` and `typecheck` are both blocking.

## Critical gotchas

- **JS-only `npm test` skips Rust.** `vitest.config.js` excludes `wasm/`, `.claude/`, `tests/smoke`.
  Rust tests live under `wasm/src` and run via `cargo test` / `npm run test:all`.
- **`tests/smoke` is Playwright, not Vitest.** Excluded from `vitest run`; use `npm run test:smoke`.
  Requires `npx playwright install --with-deps chromium` first. Real-WebGL headless smoke against
  the production build over plain HTTP (`NEMOSYNE_FORCE_HTTP=1`).
- **WebXR needs HTTPS in local dev.** Self-signed certs in `certs/` (gitignored) or dev server refuses
  to serve TLS. Generate: `mkdir certs && openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem
  -out certs/cert.pem -subj "/CN=localhost" -nodes`. Without certs, `npm run dev` still boots over HTTP
  (warns) — fine for non-VR desktop fallback, useless for Quest.
- **three.js is CDN-loaded via import map, NOT bundled.** `index.html` maps `three` ->
  `https://unpkg.com/three@0.168.0/build/three.module.js`. The npm `three@0.168.0` dep is for type
  resolution and WASM-side tests only. Pin matches `tsconfig.json` `paths`. Do not "fix" by importing
  from `node_modules` paths unless you change the import map too.
- **WASM is optional for the BUILD, mandatory for analytics at runtime.** `vite.config.js`
  rollupOptions.external `/wasm/pkg/nemosyne_wasm.js` so `npm run build` succeeds even when
  `wasm/pkg/` is absent. At runtime `World.ts` requires the kernel: if it's missing/unready, World
  surfaces a hard "analytical kernel unavailable" state (VRConsole error) — there is **no JS
  analytical fallback** and capability flags are telemetry-only (never used to route). Never
  reintroduce a JS analytical path or an `if (caps & …)` routing branch. (Rust/WASM commitment
  sprint; see `docs/ROADMAP.md` §Current Status.)
- **Cross-Origin headers are set in dev.** `vite.config.js` emits `COOP: same-origin` /
  `COEP: require-corp`. Adding cross-origin assets (CDN fonts, images) may require CORP headers or
  they will be blocked under COEP.
- **Demo + signalling endpoints mount on the Vite dev/preview server** at `/__demo-stream`, `/__signal`,
  `/__remote-logs`, `/__loadtest-results` (serve-mode only; not in the production bundle). Production
  signalling: `node src/network/SignallingServer.mjs --port=8080 [--token=SHARED_SECRET]`.
  `NEMOSYNE_SIGNAL_TOKEN` gates `/__signal` in dev when set.

## Repo layout facts that aren't obvious from filenames

- App entry: `src/main.ts` bootstraps `src/vr/World.ts`. `index.html` is the Vite entry.
- **TypeScript-first**: all source under `src/` is `.ts`. Only config (`vite.config.js`,
  `vitest.config.js`, `eslint.config.js`, `vite-wasm-pack-plugin.js`), `tests/setup.js`, and `.test.js`/`.spec.ts`
  files are JS/TS-mixed. Don't add new `.js` source under `src/`.
- **Rust crate is `wasm/`** (`crate-type = cdylib`, `wasm32-unknown-unknown`, stable toolchain via
  `rust-toolchain.toml`). JS bridge: `src/wasm/` (`RuntimeBridge.ts`, `CommandApplier.ts`). ABI is
  `(ptr, len)` + integer handles only — see `.claude/plan.md` for the full ABI/command-buffer spec.
- **`tests/e2e/` is a four-tier opaque-box suite** (tier1 feature coverage -> tier4 real-world).
  Shared mocks live in `tests/e2e/harness/` (WebGL, WebXR, fixtures, memory profiler). Run tiers via
  `npm run test:e2e:tierN`. See `TEST_INFRA.md` for the matrix.
- Tests run in jsdom with a hand-rolled WebGL/Canvas2D mock in `tests/setup.js` (replaces
  `HTMLCanvasElement.prototype.getContext`). three.js initializes against this mock — no real GPU.
  `vitest.config.js` pins `pool: 'forks'`, `maxWorkers: 2` — keep it or the WebGL mock flakes under load.

## Style/convention enforcement

- ESLint `src/**/*.ts`: `@typescript-eslint/no-explicit-any` is an **error** (not warning). `no-console`
  warns (allowed: `console.warn`, `console.error`). `import/no-cycle` is an error.
- ESLint `tests/**/*.ts`: `no-explicit-any` downgraded to **warn** (test-only). Don't ratchet these to errors.
- ESLint `tests/**/*.ts`: `vitest/no-focused-tests` is an error (no `it.only`/`describe.only` in JS suites).
- Prettier: single quotes, trailing comma `es5`, printWidth 100, LF. `.editorconfig` matches (2-space, LF, trim trailing ws except in `.md`).
- No code comments unless explicitly requested (repo convention).
- Don't commit `wasm/pkg/`, `dist/`, `target/`, `certs/`, `logs/`, or `.claude/` — all gitignored.

## Project state discipline

- `docs/ROADMAP.md` §**Current Status** (top of file) is the single source of truth for branch, working-tree state,
  last gate result, next task, and blockers. **Read it first on pickup; refresh it before stopping**.
- **Doc split is three-layer and NOT interchangeable**: product/engineering state -> `docs/ROADMAP.md`;
  study protocol + operational reproducibility -> `docs/study/`. Never treat roadmap docs and study docs
  as the same source of truth.
- The roadmap distinguishes "component built" (✅ class+tests exist) from "wired into runtime" (🔙 instantiated
  in production). Several components are built-only — do not assume a completed roadmap phase means it runs.
- Phase 21 (Rust/WASM migration) is gated by capability flags enabled phase-by-phase. Never enable
  `COMMAND_BUFFER` before `SCENE_RUST`. Migration plan + ABI standards live in `.claude/plan.md`.

## Token-efficient workflow (standard practice)

Apply to any agent working on this repo — solo or multi-agent. Keep context and tool spend low
without losing correctness.

- **Compact context at every commit boundary.** Once a task is committed and the gate is green,
  drop stale implementation detail from working context before the next task; carry forward only
  durable facts (governing rules, plan, last commit sha, next task). A green commit is a clean
  forget-point.
- **Don't re-read files you just edited.** Edit/Write tools confirm success and track file state;
  re-reading to "verify" wastes context.
- **Review diffs, not whole files.** `git diff --stat` for the overview, then read only the
  suspicious hunks. Full-file reads only when the file is unfamiliar.
- **Grep-verify instead of re-read.** A targeted grep contract ("`grep -rn 'if (caps &' src/` ==
  0") beats a 2000-token read. Record the contract next to the finding so re-verification is a
  one-liner next cycle.
- **Tail tool output.** `npm test 2>&1 | tail -20`, `git log --oneline -5` — not full streams.
- **Skip gate layers the change didn't touch, mid-iteration.** If a change didn't touch `wasm/`,
  the `cargo test` result carries forward; re-run only the affected layers while iterating. (The
  full gate order in "Required command order" still must pass before claiming a task done.)
- **Brief precisely, then review the diff.** When delegating to a sub-agent, give a file-by-file
  spec upfront; review only the resulting diff, not the agent's intermediate reads. A tight brief
  that prevents a wrong implementation saves the rework.
- **Resume a dead sub-agent, don't relaunch.** If a sub-agent hits a limit/error, resume it
  (keeping its context) rather than spawning fresh — avoids re-reading the substrate.
- **Persist substrate maps, don't re-derive them.** Load-bearing codebase facts (fingerprint
  algorithms, kernel-call paths, facade wiring, ABI) belong in docs/memory, not re-discovered each
  task.
- **Put the audit log in the commit body.** Porting-rule mappings, deviations, and gate results
  live in git history — no extra doc to maintain or load into context.
- **Batch per-task doc/memory edits to one pass at commit time.** Don't update docs incrementally
  mid-task.
- **Ask sub-agents for structured reports** — "exact gate results + file-by-file one-line summary +
  honest deviations" — not narratives.

## Multi-agent team workflow (`.agents/`)

Full definitions: `.agents/agents.md` (working model) and `.agents/team.json` (machine-readable config,
role roster, capabilities). Note: `.agents/` is gitignored — local-only config. Key rules:

- **Two execution modes.** `one_off` for small bounded work (one coder + one adversarial reviewer,
  diff-scoped, no milestone gate). `orchestrated` for milestones: architect defines scope/handoff ->
  coder implements -> reviewer checks correctness/risk -> auditor independently re-runs validation.
- **Default pipeline is lean**: architect -> coder -> reviewer -> auditor. Specialist reviewers are
  engaged ONLY when their domain risk is material:
  - `graphics_reviewer` — render lifecycle, disposal, instancing, frame-time (WebGL/three.js changes)
  - `architecture_reviewer` — layer boundaries, state ownership, TS/three.js <-> WASM boundary
  - `security_reviewer` — parsers, buffers, network boundaries, malformed input, prototype pollution
  - `statistician` / `product_manager` / `documentation_curator` — study design, roadmap fit, doc hygiene
- **Budget/context discipline**: reserve >= 30% of budget for the final verification gate; if remaining
  budget drops below 25% before the gate, stop exploring and checkpoint. Reviewers/auditors work from
  `git diff` + compact handoff, NOT full-tree re-reads. Checkpoint after milestones (verdict, exact
  commands run, pass/fail, next steps) instead of restarting from scratch.
- **Integrity rules (hard)**: no fake pass results, no fabricated validation output, no weakened
  assertions, no implementations that bypass real logic to satisfy a test. The auditor must re-run the
  validation path independently and report fresh evidence — never claim completion without it.
- **Anti-patterns**: full-tree reads by every agent, multi-reviewer fan-out on small tasks, re-reading
  the repo after a checkpoint, claiming completion without fresh validation output.
