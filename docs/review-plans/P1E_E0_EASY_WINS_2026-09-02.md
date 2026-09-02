# P1-E E0 — Easy Wins & Ratchets Review Contract

**Date:** 2 September 2026  
**Base:** `main@14b98b5de13b494d926e04b2f7c0caefb07df59e`  
**Branch:** `chore/evolutionary-improvement-cadence`  
**Risk:** medium overall; RF-041 supply-chain/CSP changes are production-path security work

## Intent

Apply a small set of findings from the 2 September deep project review where the desired state is clear and does not require physical Quest evidence:

1. remove unnecessary remote Three.js runtime trust;
2. align current product-facing terminology and feature claims with the Moneta/Rust/WASM architecture;
3. turn architecture-policy checking from a path-scoped pilot into an every-PR check;
4. establish one-way hygiene ratchets instead of launching a broad legacy cleanup;
5. establish a rolling evolutionary improvement programme for the period before physical Quest evidence arrives.

## Invariants

### RF-041 runtime trust

- the production app must resolve Three.js from the bundled dependency graph rather than an external import map;
- production CSP must not allow an external script origin merely for Three.js;
- removing the import map must not introduce a fallback CDN or alter analytical authority;
- the production build and Chromium smoke path must still boot the application.

### Terminology and public truth

- investigator-visible copy should use Moneta/current investigation language rather than retired Draco branding;
- compatibility IDs or re-export paths may retain historical names where renaming them would broaden the change;
- `FEATURES.md` must distinguish shipped architecture from pending physical qualification and avoid volatile hard-coded test counts.

### Architecture policy

- the existing `npm run architecture:check` policy remains unchanged in substance;
- the workflow should run for every PR to `main`, not only a selected path list;
- this change must not claim GitHub ruleset enforcement that the repository plan/API does not provide.

### Type-safety ratchet

- production `src/` remains free of `@ts-nocheck`;
- the existing legacy-test baseline may stay temporarily but must never increase;
- future removal of a legacy opt-out must not require updating the baseline upward or rewriting the guard.

## Pre-implementation adversarial review

Potential failure modes considered:

- **Hidden browser dependency on import maps:** a direct browser path might bypass Vite and depend on the remote map. Counter-evidence required: normal production build plus Chromium production smoke on the changed head.
- **CSP over-tightening:** bundled workers or assets might require an origin accidentally removed with `unpkg`. Counter-evidence required: production smoke and build remain green.
- **Compatibility-name breakage:** changing scene target IDs could break guided-tour resolution. Mitigation: retain `draco-palace` target IDs in E0 and change only visible copy.
- **Architecture workflow noise:** running the policy on docs-only PRs adds install cost. Existing Q0 timing review found the policy itself cheap relative to installation; the benefit is an unambiguous always-present PR signal. Reassess later if measured CI cost becomes material.
- **Brittle hygiene test:** a test that embeds the exact forbidden directive could count itself. Mitigation: construct the marker at runtime and count files, not source occurrences.
- **Roadmap fork:** the new improvement cadence could become a second status authority. Mitigation: the programme explicitly states that `docs/ROADMAP.md` remains canonical and that P1-E cannot close physical/security/product gates by itself.

## Falsifiers / acceptance evidence

The tranche is rejected or fixed forward if any of the following occurs:

- production build fails after import-map removal;
- Chromium production smoke cannot boot or load Three.js;
- generated production HTML/CSP still references `unpkg.com`;
- a new `@ts-nocheck` appears in production `src/` or the legacy test-file count exceeds the frozen baseline of 170;
- onboarding visible copy contains retired Draco branding;
- architecture policy does not run on a normal PR that changes only documentation;
- docs imply physical Quest qualification, empirical Moneta validation or private-preview readiness that has not been evidenced.

## Verification commands / hosted evidence

Required before promotion:

```text
npm run typecheck
npm run lint
npm run docs:check
npm run architecture:check
npx vitest run tests/project-hygiene-ratchets.test.ts
npm run build
npm run test:smoke
```

Ordinary exact-head CI, CodeQL, approval/promotion evidence and the architecture-policy workflow remain the final hosted checks. Physical Quest evidence is intentionally not part of this tranche and must not be inferred from its success.

## Post-implementation review checklist

After implementation, independently verify:

- no other shipped HTML/CSP/runtime path references `unpkg.com` for Three.js;
- the bundle contains Three.js through normal Vite dependency resolution;
- no compatibility ID was renamed merely to improve terminology;
- the new hygiene test cannot be satisfied by deleting meaningful tests or hiding directives outside the scanned paths;
- the P1-E programme does not automatically pull new representation families or P2 work forward;
- current main/PR evidence is used for promotion rather than this plan's base SHA.

**Disposition:** pending exact-head CI and post-implementation review.
