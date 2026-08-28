# P1-Q Q3 Failure Evidence Pipeline Pilot

**Date:** 28 August 2026  
**Baseline:** `main@eb81a8195412d8d80df293b13c9d08709d884fa9` (#500 merged)  
**Status:** PILOT COMPLETE / ADOPT SUBSTRATE / TARGETED EXECUTION / FINAL PR REVIEW ACTIVE

## Purpose

Q3 evaluates whether a failing real-browser product path can emit reproducible diagnostic evidence that materially shortens defect diagnosis without creating a new production authority or a permanent unrelated merge-time tax.

## Final classification

**ADOPT SUBSTRATE / TARGETED EXECUTION.**

Retain the instrumented runtime snapshot and Playwright failure-evidence collector as reusable engineering infrastructure. Do **not** run the standalone Q3 pilot automatically on every PR. Its duplicate production/WASM build and browser provisioning dominate cost, while the useful failure probe itself is only single-digit seconds.

The rich Playwright artifacts are **TARGETED ONLY / SYNTHETIC OR EXPLICITLY CONSENTED**. Trace, screenshot and video are raw evidence surfaces, not sanitized artifacts. The structured JSON summary performs bounded redaction, but arbitrary console/page-error text must also not be assumed private-data-safe without a stronger field-level policy.

The pilot workflow is therefore retired to `workflow_dispatch` after measurement. Q3B should reuse the substrate inside existing/prebuilt resource/XR evidence lanes rather than create another default PR tax.

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

## Failure evidence bundle

For an unexpected Playwright failure, the Q3 fixture can retain:

- exact source-head SHA and workflow checkout SHA as distinct fields;
- deterministic SHA-256 over the built `dist/` file set;
- SHA-256 of `nemosyne_wasm_bg.wasm`;
- the bounded runtime diagnostic snapshot;
- browser heap/navigation timing when Chromium exposes it;
- current telemetry text;
- bounded warning/error console evidence;
- uncaught page errors;
- failed requests and HTTP >=400 responses with query/hash stripped in the JSON summary;
- Playwright trace, failure screenshot and failure video in explicitly rich-evidence runs.

The JSON collector truncates text and redacts secret/token/password/authorization/cookie/API-key assignments, long token-like strings and email addresses. URL fields strip query strings and fragments.

These transformations are defense-in-depth for controlled CI evidence, **not a guarantee that arbitrary application text is free of private research data**.

## Deliberate falsifier and harness review

`tests/smoke/q3-failure-evidence-probe.spec.ts` boots the real instrumented app in Chromium, waits for first-render telemetry and the runtime diagnostic hook, emits a secret canary, performs a deterministic Playwright-aborted request carrying a query canary, and finally fails a known assertion deliberately.

The verifier requires the deliberate failure plus non-empty JSON/trace/screenshot/video, source/build identities, runtime fields, a specifically observed-and-redacted console canary, and a specifically observed request-failure canary with its query stripped from the JSON summary.

Two earlier hosted attempts are explicitly **not promotion evidence**:

1. the first probe checked the runtime hook too early and failed before the intended canaries/assertion;
2. the second probe assumed a missing Vite-preview path would return HTTP >=400, but the SPA fallback returned 200.

Both harness defects were fixed rather than weakening the verifier. The final successful falsifier fails only at the intended `q3-probe-actual` versus `q3-probe-expected` assertion.

## Successful hosted evidence

Promotion-grade pilot head: `a90cc0fe28bc20e5effe35f3ec537cb242a54c80`  
Workflow run: `33178904735`  
Result: **success**, where success means the deliberate Playwright test failed and the verifier proved the required evidence existed.

Measured hosted Ubuntu 24.04 / Node 24 evidence:

- instrumented `npm run build`: **68.23 s wall**, max RSS **691,764 KB**;
- Chromium/dependency installation step: approximately **23 s** wall from hosted step timestamps;
- deliberate Playwright probe + collector: **8.56 s wall**, max RSS **204,772 KB**;
- compressed retained artifact: **3,996,990 bytes**;
- trace: **3,133,075 bytes**;
- screenshot: **216,686 bytes**;
- video: **646,528 bytes**.

The structured evidence correctly recorded:

- source head `a90cc0fe28bc20e5effe35f3ec537cb242a54c80`;
- synthetic workflow checkout `928fc271bf6144afcf1431ff0d1c2fd89992399a` as a distinct value;
- production-bundle SHA-256 `ed6a97c0aa7cfdaa6b9a3c9670d6144deb6455da3b39374fa13cf8d0ab558128`;
- WASM SHA-256 `9168072d80eaf91fc8750945cf855182a1309f1b15bc15598121496d1204cc59`;
- boot state `READY`, Rust kernel `0.2.0`, Atlas generation/dataset version `1/1`, execution mode `worker`;
- 12 rows / 5 columns for the synthetic sample without exposing values or column names;
- scene/render counts including 519 scene objects and Three.js renderer counters;
- Chromium heap/navigation timing;
- the secret canary only as `Q3 probe secret=[REDACTED]` in structured console evidence;
- the query-canary request only as `http://localhost:4173/__q3-evidence-probe` with `net::ERR_FAILED` in structured request-failure evidence.

## Raw-artifact privacy finding

Adversarial inspection of the same successful artifact found both raw canaries inside `trace.zip`:

- the query value appeared in the trace network request URL/query string;
- the secret value appeared in raw console trace records;
- both literal canaries also appeared in Playwright source snapshots captured by the trace.

This is expected behavior for a forensic trace and is exactly why the rich artifact cannot be labelled sanitized. Redacting the companion JSON does not sanitize the trace, screenshot or video.

Required boundary:

- rich trace/video/screenshot evidence is synthetic, test-data-only or explicitly consented/controlled;
- private research datasets require a separately reviewed masking/retention/consent policy before rich artifacts are enabled;
- normal user browser profiles, credentials and collaboration secrets must never be exposed to agent/debug tooling;
- structured JSON from scenarios containing private data requires a stricter content policy than the current generic console/page-text redactor before it can be described as private-data-safe.

## Cost decision

The useful probe itself is inexpensive relative to Nemosyne's existing browser work, but the standalone workflow duplicates roughly a minute of WASM/production build and provisions Chromium again. That is not an acceptable default PR tax.

Consequently:

- **ADOPT** the runtime diagnostic snapshot and failure collector for explicitly instrumented evidence jobs;
- **TARGETED ONLY** for rich Playwright trace/video/screenshot collection;
- **REJECT** the standalone automatic PR workflow as the recurring integration model;
- retain the pilot workflow as manual-only reference/falsification infrastructure.

## Evidence boundaries

Q3 evidence does not:

- make the diagnostic snapshot an analytical authority;
- prove physical Quest behavior or comfort;
- prove privacy merely because selected JSON fields are redacted;
- replace exact-head CI/CodeQL/review requirements;
- justify exposing an instrumented diagnostic hook in ordinary production builds.

## Next: Q3B resource observatory

Reuse this substrate for the active RF-015/RF-029/RF-035/RF-051 real module-Worker + real-WASM resource-envelope work. Q3B should consume an already-built instrumented artifact where possible and add measured stages for:

`dataset ingest -> Worker transfer -> Rust/WASM authority -> operation -> result transfer -> durable state -> render`

Capture transfer sizes/times, browser heap and GC signals available from the controlled runner, Worker generation/runtime state, renderer state and exact bundle/WASM identities. Keep raw rich artifacts opt-in and preserve the same privacy/authority boundaries.

## Governance follow-up

The umbrella `P1Q_ENGINEERING_QUALITY_CADENCE_2026-08-28.md` header still says `IMPLEMENTATION NOT STARTED` even though Q0-Q3 have now produced implementation evidence. Reconcile that stale umbrella status in a bounded governance update rather than silently treating the old header as current truth.
