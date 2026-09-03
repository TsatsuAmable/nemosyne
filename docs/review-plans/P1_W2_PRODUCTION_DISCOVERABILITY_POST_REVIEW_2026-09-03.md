# P1-W2 production discoverability — post-implementation adversarial review

**Branch:** `fix/p1w-production-discoverability`  
**Base:** `main@87614c20dfdca09537090f9e123213da24262a77`

## Review questions

- Can a development-only subsystem still masquerade as production merely because it is exported from a production barrel?
- Can a production capability pass the new registry without a runtime entry point, discoverable runtime marker, and an evidence path?
- Did quarantine accidentally delete or redirect an authoritative production implementation?
- Did the tranche claim deployed collaboration/live-stream services that do not yet exist?
- Are legacy fixtures retained only where direct tests still require them?

## Findings

1. The removed barrel symbols are dormant, superseded, or prototype surfaces; the live analytical, collaboration, persistence and encoding authorities use different paths.
2. Study and multimodal-perception code remain explicit development/research exceptions rather than being falsely certified by the generic architectural barrel test.
3. Collaboration client composition and live-ingest composition remain `experimental-production`; RF-054 service deployment is deliberately not closed by this tranche.
4. The registry is stronger than the previous import-existence check but is not treated as end-to-end proof. It establishes a minimum mechanical contract; RF-056 still owns clean-artifact journey verification.

## Disposition

**ADOPT pending exact-head CI.** No review finding justifies weakening the production-discoverability invariant. Any CI regression caused by an intentional legacy direct import should be fixed at that direct consumer rather than restoring the misleading production barrel.
