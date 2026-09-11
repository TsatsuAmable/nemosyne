# Free-compute and promotional-runway operations

Issue: #709  
Status: implementation runway

## Provider policy

The default inference route is **non-paid only**. A paid route must be separately and explicitly enabled by the caller and deployment policy. Exhausted free capacity is an operational failure, not permission to spend.

Data classes are conservative:

- `public`: may be routed to an approved external provider.
- `internal`: external routing requires an explicitly approved provider policy; initial Cloudflare metadata does not permit it.
- `sensitive`: local-only until an explicit privacy review says otherwise.
- `prohibited-external`: local-only by definition.

Provider model metadata records verification date and source because free-plan availability is mutable.

## Day-91 / Day-366 survival rule

A promotional service may be useful only when at least one of the following is true:

1. the workload can fall back to local execution;
2. another free provider can satisfy the same provider-neutral contract;
3. the capability is optional and can fail closed without disabling core Nemosyne;
4. a bounded paid budget has been explicitly approved before the promotion ends.

Core investigation semantics, Rust/WASM analysis, locally loaded datasets, deterministic replay and local/private-preview operation must not require promotional cloud capacity.

## Quota and expiry ledger

For every activated provider record: provider/account identity, service/model, billing class, remaining quota, reset cadence, expiry, paid-overage behavior, privacy suitability, fallback policy, activation date/workload, and human-gated actions.

Alerts should trigger before 50%, 80% and 95% consumption and at 30/14/7/1 days before expiry. Missing quota/expiry telemetry must fail toward non-use.

## Activation queue

### Cloudflare Workers AI

Ready before human gate: provider-neutral policy, free-only metadata, public-data-only initial policy, no-paid-fallback tests, quota ledger. Human gate: account/OAuth/ToS and secret creation as required. First live workload: public synthetic Nemosyne benchmark prompts, measuring quality, latency, failures and neuron consumption.

### Kiro startup credits

Do **before AWS Activate** if truthful eligibility is established. Human/legal facts still needed: eligible startup/company status, stage/domain identity, AWS account/ToS and any payment/identity verification.

### AWS Activate Founders

Prepare after the Kiro decision. Current public criteria include self-funded startup status, functioning company website, programme age limits, and Activate-credit eligibility.

### Google for Startups

Apply only after truthfully resolving startup status, working MVP/business model, company age, prior Google credits and plans to seek venture funding.

## Trial discipline

No short-lived trial starts until the exact workload, daily consumption, duration, retained artefacts, exit path, and maximum post-credit spend are written down.
