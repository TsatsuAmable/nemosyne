# RF-UV B3 fix-forward — baseline evidence hardening

Date: 29 August 2026
Base: `03816016de6012a14d4fafc4867112704302a80d` (#539 merged)
Scope: independent-review fix-forward for B3 only; no B4/B5 product treatment

## Pre-implementation adversarial review

### Invariant

B3 must remain a trustworthy *before-state*. Its evidence tooling must not expand the ordinary production capability surface, its screenshots must exist and be attributable to the exact tested source, and its inventory must not claim completeness by comparing one hand-maintained list with another.

### Findings that falsified the merged B3 claim

1. **Production instrumentation exposure.** `src/app/uv0TestHandle.ts` was statically imported by `bootstrap.ts`; a normal production build therefore contained a query-addressable `window.__NEMOSYNE_UV0__` handle capable of invoking private World selection/Inspect behavior. Exact `?nemosyne-uv0=1` reduced accidental exposure but did not make the feature test-only.
2. **Evidence provenance was wrong by construction.** `run-inventory.json` hardcoded `baseSha: 81ec16b` even when a later source/merge commit was actually tested.
3. **Screenshots were optional despite being the canonical visual baseline.** Capture exceptions were swallowed and the Chromium smoke job did not retain the resulting PNG/manifest directory as a workflow artifact.
4. **Inventory completeness was self-referential.** The test pinned a hand-maintained id list to the inventory but did not independently compare the inventory with runtime/source construction. Source review identified `SettingsPanel` as an eagerly constructed surface that needed an explicit disposition. The first instrumented hardening run then falsified the stronger source-only inference that eager construction meant it was visible at fresh boot: runtime snapshot evidence reported `settingsPanelVisible=false` on both attempts.

### Bounded remediation

- Compile-gate UV0 instrumentation behind `VITE_NEMOSYNE_UV0_EVIDENCE=1` and dynamically import the helper only inside that branch.
- Prove the ordinary production `dist/` contains neither `__NEMOSYNE_UV0__` nor `nemosyne-uv0`.
- Add a dedicated instrumented UV0 evidence job rather than instrumenting the ordinary production artifact.
- Require all five screenshots to exist and have non-zero size; retain PNGs + manifest as a workflow artifact.
- Record `testedSourceSha` from `${{ github.event.pull_request.head.sha || github.sha }}` and the CI merge SHA separately.
- Track `settings-panel` explicitly in the audit, but record runtime truth (`visibleAtBoot=false`) rather than constructor inference.
- Source-audit eager `WorldUIManager` constructor assignments so every surface/controller has either a baseline id or an explicit exclusion reason.
- Narrow the inventory claim to a bounded baseline, not an exhaustive catalogue of every hidden/developer panel.

## Post-implementation adversarial review

### Production path attacked

Two paths are now deliberately separate:

1. **ordinary production:** `npm run build` with no UV0 build flag → negative marker scan → normal production smoke;
2. **UV0 evidence:** explicit instrumented build → positive marker scan → single UV0 Playwright spec → five state assertions → five non-empty screenshots → schema-v2 manifest → retained workflow artifact.

### Falsifiers added

- ordinary production build fails if UV0 marker/query strings survive into `dist/`;
- instrumented build fails if the runtime handle marker is absent;
- UV0 evidence test is skipped outside the dedicated evidence job;
- every screenshot is mandatory and non-empty;
- manifest records exact tested source SHA rather than the historical B3 base;
- S1 measures `SettingsPanel` visibility and requires the inventory to agree with runtime truth;
- fast inventory test parses `WorldUIManager` constructor assignments and fails if a new eager object lacks an explicit inventory/exclusion disposition.

### Adversarial correction during CI

The first exact-head UV0 evidence run failed at S1 because the source-derived hypothesis `SettingsPanel visible at boot` was false. The runtime snapshot returned `false` twice, including the retry. The fix-forward therefore changed the inventory to `visibleAtBoot=false` and retained the surface only as an explicitly audited eager object. This is a desirable falsification: constructor structure is evidence of existence, not visibility.

### Residual risks / nonclaims

- The source audit is intentionally bounded to eager `WorldUIManager` construction. It does not prove exhaustive visibility across every scene composer, lazy panel or future subsystem.
- Pixel equality is not a gate; screenshots are durable before-state evidence, not a renderer-specific golden-image contract.
- The instrumented bundle is evidence-only and must never be promoted/deployed as the ordinary product artifact.
- This fix-forward changes no visible treatment. `SettingsPanel` remains runtime-hidden at fresh boot.
- No B4/B5 shell/contextual-locus implementation is included.

### Disposition

**TARGETED FIX-FORWARD REQUIRED.** The merged B3 baseline was useful but its original production-isolation, provenance, screenshot-durability and completeness claims were too strong. This patch narrows the claims, records a runtime falsification that corrected the review itself, and adds falsifiers at the seams that failed independent review.
