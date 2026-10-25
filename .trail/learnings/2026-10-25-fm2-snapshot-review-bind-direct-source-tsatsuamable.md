---
title: "FM2 snapshot review: bind direct source to request and prove real Worker compilation"
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
---

## Decided
- FM2-SNAPSHOT HEAD 86eb9bc5 passes focused real-WASM snapshot/Worker/replay tests, typecheck, lint (0 errors), docs:check, and diff hygiene, but review remains blocked.
- The direct normalizer and Atlas capture path validate dataset/kernel identity, fixed consumer/profile, source digest, and source envelope shape, but do not bind the returned Rust source to the caller's request. A temporary real-WASM Vitest probe returned a valid binding for request B from a custom port and `compileDirectDistributionEmbodiment(request A)` accepted and compiled it.
- The separate Node Worker-thread test exercises `captureDirectDistributionBinding` and replay, while the new compile assertion imports the production worker handler into the test realm with stubbed `self`; it does not prove normal Atlas compilation end-to-end over a separate Worker runtime.
## Tried and ruled out
- No repository source was edited, staged, or committed. The temporary probe/config lived under /private/tmp and was removed.
- Focused tests were run with Node 24 and normal Vitest/Vite config bundling; `--configLoader runner` was not used.
## Watch out
- Smallest fix should bind the request (including bounded histogram/ECDF controls, not only the source envelope's incomplete analytical parameters) into the kernel-issued binding or compare an authoritative request digest before snapshot normalization, then add a negative real-WASM inline and separate Worker test.
- Add a separate Worker-thread test that calls `AtlasCore.compileDirectDistributionEmbodiment`, not only capture, before claiming the documented Worker compilation path.
