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
- **WASM is optional at runtime.** `vite.config.js` rollupOptions.external `/wasm/pkg/nemosyne_wasm.js`
  so `npm run build` succeeds even when `wasm/pkg/` is absent. `World.ts` reads
  `RuntimeBridge.capabilities()` at startup and routes to Rust or JS fallbacks by capability flag.
  Never assume WASM is present.
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
