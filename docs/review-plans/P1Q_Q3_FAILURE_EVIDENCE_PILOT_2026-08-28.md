# P1-Q Q3 Failure Evidence Pipeline Pilot

**Date:** 28 August 2026  
**Baseline:** `main@eb81a8195412d8d80df293b13c9d08709d884fa9` (#500 merged)  
**Status:** PILOT ACTIVE / NON-REQUIRED

## Purpose

Q3 tests whether a failing real-browser product path can emit a compact, reproducible diagnostic bundle that materially shortens defect diagnosis without creating a new production authority or a permanent unrelated merge-time tax.

The pilot is intentionally synthetic-CI-only. Screenshot/video capture is not yet approved for private research datasets because pixels may contain user data even when structured JSON is redacted.

## Pilot boundary

The pilot runs an explicitly instrumented production build with `VITE_NEMOSYNE_DIAGNOSTICS=1`. Ordinary production builds do not install the runtime diagnostic hook.

The runtime hook is read-only and exports only bounded status/count information:

- World boot state;
- kernel readiness/version/capabilities;
- Atlas generation and dataset version;
- async Worker versus inline execution mode;
- result/ledger counts;
- dataset row/column counts and whether edges are present;
- scene object counts grouped by Three.js object type;
- rendered node/panel counts;
- Three.js renderer memory and render counters.

It deliberately does **not** expose row values, column names, dataset fingerprints, findings, annotations, provenance payloads, collaboration credentials/tickets or other user-authored content.

## Failure bundle

For an unexpected Playwright failure, the Q3 fixture retains:

- exact PR source-head SHA and workflow checkout SHA as distinct fields;
- deterministic SHA-256 over the built `dist/` file set;
- SHA-256 of `nemosyne_wasm_bg.wasm`;
- the bounded runtime diagnostic snapshot;
- browser heap/navigation timing when Chromium exposes it;
- current telemetry text;
- bounded warning/error console evidence;
- uncaught page errors;
- failed requests and HTTP >=400 responses with query/hash stripped;
- Playwright trace, failure screenshot and failure video.

Text evidence is truncated and redacts secret/token/password/cookie/API-key assignments, long token-like strings and email addresses. URL evidence strips query strings and fragments.

## Deliberate falsifier

`tests/smoke/q3-failure-evidence-probe.spec.ts` boots the real instrumented app in Chromium, waits for the first rendered-frame telemetry, proves the runtime hook exists, emits secret/query canaries and then fails an assertion deliberately.

The pilot workflow is successful only if:

1. Playwright exits non-zero because the deliberate falsifier executed;
2. `q3-failure-evidence.json` exists;
3. `trace.zip`, screenshot and video are non-empty;
4. raw secret/query canaries are absent from the JSON bundle;
5. source and checkout SHAs are both present and syntactically valid;
6. production-bundle and WASM SHA-256 values are present;
7. runtime boot/execution/scene/renderer fields are present;
8. console and HTTP-failure evidence were retained.

This distinction prevents a broken or skipped falsifier from producing a ceremonial green job.

## Cost/evidence measurements

The non-required hosted workflow records `/usr/bin/time -v` output for:

- the instrumented production build;
- the deliberate Playwright failure probe.

The artifact retains those measurements plus the verifier output. Classification must consider wall-clock/RSS and artifact size before any automatic use is adopted.

## Adoption boundary

Possible classifications:

- **ADOPT:** useful diagnosis at acceptable cost; retain failure-triggered/specially instrumented evidence collection without changing product authority.
- **TARGETED ONLY:** useful for selected browser/XR/resource investigations but too costly or too privacy-sensitive for ordinary PR failures.
- **REJECT:** insufficient diagnostic signal, unreliable reproduction, unsafe evidence retention or disproportionate cost.

Even if adopted:

- do not make screenshot/video collection available for private-data scenarios until a masking/consent policy is independently reviewed;
- do not expose normal user browser profiles, secrets or credentials to agent tooling;
- do not treat diagnostic snapshots as analytical truth;
- do not claim physical Quest evidence from headless Chromium;
- do not make the deliberate failure workflow a required merge gate.

## Follow-up if useful

Q3B should reuse the evidence substrate for the existing RF-015/RF-029/RF-035/RF-051 real module-Worker + real-WASM resource-envelope work, adding measured transfer/heap/GC/scheduling evidence while preserving the same authority and privacy boundaries.
