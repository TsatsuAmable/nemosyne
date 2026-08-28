# Q3B pre-run falsification expectations

Recorded before the first hosted Q3B resource-envelope execution.

The pilot is considered structurally valid only if every configured row count demonstrates, through the real browser module Worker and real Worker-local WASM instance:

- one Worker registration sample;
- one Worker operation sample;
- `sort` returning the existing compact `row-view` result;
- `anomaly` returning the existing full `dataset` result;
- exactly one authoritative Atlas dataset-version transition per operation;
- non-null Worker-local WASM memory capacity;
- exact source-head, workflow-checkout, production-bundle and WASM identities.

No expected ratio, latency, heap delta, WASM-growth value, or winner is pinned before measurement. A result that shows the full-result path is not materially worse is valid evidence and must not be reinterpreted to fit the RF-035 hypothesis.

Hosted Chromium measurements do not qualify physical Quest behaviour. CDP forced-GC measurements cover the inspected main-page target, not Worker GC pause time. JSON UTF-8 sizes are stable representation-size proxies, not exact structured-clone wire-byte counts.
