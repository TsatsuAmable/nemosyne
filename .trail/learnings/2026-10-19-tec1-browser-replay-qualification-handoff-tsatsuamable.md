---
title: TEC1 browser replay qualification handoff
author: Tsatsuamable
date: 2026-10-19
branch: test/tec1-browser-replay-qualification
---

## Decided
- TEC/FM0 was advanced with a narrow browser qualification contract on test/tec1-browser-replay-qualification.
- The real Playwright journey now covers V2 export/reopen/tamper/kernel refusal and V3 Rust-issued governed consumer-policy verification plus missing-use refusal.
## Tried and ruled out
- A fast-suite run inside the default sandbox falsely appeared red because signalling tests could not bind 127.0.0.1; the same 516-test suite passed with host networking.
## Watch out
- This evidence qualifies the browser production path but does not close TEC1/FM0 overall; calibration, broader consumer qualification and downstream evidence-reference obligations remain open.
