# P1-INFRA free-compute provisioning — pre-implementation adversarial contract

**Issue:** #709  
**Status:** active first tranche  
**Date:** 2026-09-11

## Invariant

Temporary free/promotional capacity may accelerate Nemosyne but must never become architectural authority, scientific authority, a privacy bypass, or an implicit billing commitment.

## Authority / production path

The provider-neutral routing policy selects an inference execution venue only. Rust/WASM remains analytical authority; Moneta remains representation authority; provider output cannot become scientific ground truth merely because it was returned successfully.

## Primary failure modes

1. quota exhaustion silently routes into paid billing;
2. a free provider receives private/sensitive investigation context without an explicit data-handling decision;
3. an expiring promotional provider becomes a hard runtime dependency;
4. provider-specific model identifiers leak into domain semantics;
5. stale free-tier metadata causes repeated failures or accidental paid-plan assumptions;
6. promotional credits expire and production becomes financially non-viable;
7. short-lived trials are activated before a bounded workload exists.

## Falsifying evidence

The tranche fails if tests can make a paid provider eligible without explicit opt-in, route a disallowed data class externally, select exhausted/expired capacity, or require a particular cloud vendor for core investigation semantics.

## Non-goals / dependencies

- no account creation or ToS acceptance in this tranche;
- no secret/token storage;
- no Cloudflare network call until credentials are deliberately provisioned;
- no Kiro/AWS/Google application submission without truthful eligibility and human-gated declarations;
- no claim that free models are scientifically suitable before benchmark evidence exists.

## Current external facts, verified 2026-09-11

- Cloudflare Workers AI Free allocation: 10,000 Neurons/day, resets daily; over-free usage requires Workers Paid.
- Several resource-intensive models require Workers Paid, while Cloudflare lists GLM-4.7 Flash, Gemma 4 26B A4B IT and Nemotron 3 120B A12B as examples remaining on Workers Free.
- Kiro startup credits require an early-stage through Series A startup, AWS Account ID, and matching company-domain email. Active AWS Activate participation makes the separate Kiro startup offer ineligible; Kiro-first then Activate remains the safe order.
- AWS Activate Founders is for self-funded startups and currently starts with $1,000, with some participants qualifying for up to $5,000.
- Google for Startups Start tier requires a technology startup with a working MVP, clear business model, plans to seek venture funding, and other programme conditions. Eligibility must be decided from truthful company facts, not reverse-engineered claims.
