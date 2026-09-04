# P1-W2 production discoverability — post-implementation adversarial review

**Branch:** `fix/p1w-production-discoverability`  
**Base:** `main@87614c20dfdca09537090f9e123213da24262a77`

## Review questions

- Can a development-only subsystem still masquerade as production merely because it is exported from a production barrel?
- Can a production capability pass the new registry without a runtime entry point, discoverable runtime marker, and an evidence path?
- Can a newly added top-level `src/` domain escape classification entirely?
- Did quarantine accidentally delete or redirect an authoritative production implementation?
- Did the tranche claim deployed collaboration/live-stream/governance services that do not yet exist?
- Are legacy fixtures retained only where direct tests still require them?

## Findings

1. The removed barrel symbols are dormant, superseded, or prototype surfaces; the live analytical, collaboration, persistence and encoding authorities use different paths.
2. Diff review found one legacy `tests/serializers.test.ts` consumer still importing the quarantined hand-rolled FlatBuffers functions through `src/data/serializers/index.ts`. The test now imports `FlatBuffersSerializer.ts` directly; repository search confirms the other FlatBuffers tests already use direct prototype imports. The production barrel remains clean.
3. An exhaustive top-level `src/` tree audit found domains omitted by the first registry draft: `events`, `governance`, `governance-service`, `interaction`, `investigation`, `judgement`, `observability`, `performance`, `persistence`, `security` and `validation`. The registry now covers production roots through their actual runtime capabilities and mechanically fails if a future top-level source domain is neither production-covered nor explicitly excepted.
4. `src/persistence` is genuinely production-wired from `src/main.ts`; `src/security/CryptoHash.ts` is a production foundation consumed by data identity, Atlas, governance, collaboration and investigation; `src/events` is the canonical World event authority; and `src/investigation`/`src/interaction` belong to the live investigation/Moneta product paths rather than new independent authorities.
5. Study, learned-fitness/judgement, performance benchmarking and validation infrastructure remain explicit development/research exceptions. `src/draco` remains compatibility-only. Dormant multimodal perception and the Rust scene command buffer remain explicit DEV-only capabilities rather than false product claims.
6. `RemoteDebugStreamer` is confirmed DEV-gated by `import.meta.env.DEV` in `src/main.ts`. It has therefore been removed from the production observability barrel and recorded as a direct-import DEV-only capability.
7. The browser product-analytics client is production-composed and fail-closed when configuration is absent. However, `src/governance-service` currently has a PostgreSQL/OIDC composition described as canonical production server composition but no runnable repository service entrypoint or deployed-service evidence. It is therefore a temporary explicit non-production root exception, not a shipped server claim. P1-W service wiring must promote it deliberately rather than inheriting the label from its constructor comments.
8. Collaboration client composition and live-ingest composition remain `experimental-production`; RF-054 signalling/demo-stream service deployment is deliberately not closed by this tranche.
9. Evidence entries were tightened so configuration/harness scaffolding alone cannot satisfy the inventory: application runtime points to the production smoke spec, collaboration points to the multi-browser recovery spec, and product analytics includes the browser PKCE/producer evidence.
10. The registry remains a minimum mechanical reachability contract, not a substitute for RF-056 clean-artifact journey verification or physical/device qualification.

## Disposition

**ADOPT pending exact-head CI.** No review finding justifies weakening the production-discoverability invariant. Any CI regression caused by an intentional legacy direct import should be fixed at that direct consumer rather than restoring a misleading production barrel. The next P1-W service tranche must address the explicit deployment exceptions rather than converting them into permanent exemptions.
