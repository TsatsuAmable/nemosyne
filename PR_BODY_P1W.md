## Summary

Implements the first RF-055/P1-W2 production-discoverability reconciliation tranche from `main@87614c2`.

- adds a machine-readable capability inventory requiring runtime entrypoints, discovery markers and product-path evidence for every non-development capability;
- adds a fast-lane invariant test so barrel availability can no longer masquerade as production wiring;
- removes misleading production exports for dormant/superseded command-buffer, collaboration-state, shared-annotation, shareable-URL, palette and fake-FlatBuffers prototypes;
- explicitly classifies the small development/research exception set;
- preserves direct-import legacy fixtures where tests still need them;
- does not falsely close RF-054: deployed signalling/demo-stream service qualification remains the next P1-W service tranche.

## Adversarial review

Pre/post review challenged accidental removal of live authorities, declaration-only evidence, and accidental closure of service-deployment gaps. No live authority depends on the removed exports. Collaboration/live-ingest remain experimental-production client paths, with service deployment still open.

## Required evidence

Exact-head CI, architecture policy, CodeQL, production build/smoke, and review-thread cleanliness must be green before merge.
