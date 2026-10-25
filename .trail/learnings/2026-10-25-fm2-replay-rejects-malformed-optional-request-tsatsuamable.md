---
title: FM2 replay rejects malformed optional request fields
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
---

## Decided
Persisted replay carriers must reject every present optional request field whose value is not a string; absent fields remain absent and validated strings remain exact.

## Tried and ruled out
Silently dropping malformed optional fields was unsafe because a digest-consistent mutated carrier could replay the original request and report VERIFIED.

## Watch out
Keep malformed-request regressions on the real replay entry point with the real WASM bridge; parser-only tests do not prove refusal happens before fresh Rust replay.
