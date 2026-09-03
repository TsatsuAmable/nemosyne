# P1-PT4B3 Data-Plane Authentication Post-Implementation Review

**Date:** 3 September 2026  
**Base:** `main@0948d162cdcf1e62397a92dd5bc6b32efcae3329`  
**Programme:** P1-PT4B

## Reviewed implementation

PT4B3 adds `DataPlaneAccessTokenAuthority`, a strict post-TLS bearer-token authority for the RFC 0004 data plane, plus durable local credential-session revocation state in the PT4 governance SQLite store.

The implementation accepts only compact signed access tokens with `typ=at+jwt`, one configured HTTPS issuer, one exact audience, a configured subset of `RS256 | ES256 | EdDSA`, a non-empty `kid`, bounded `iss/sub/jti/scope`, integer `iat/exp`, a lifetime no greater than five minutes, at most 60 seconds configured clock skew, a closed set of data-plane scopes and the exact required endpoint scope. Public verification keys are supplied through a resolver interface; private JWK material, HMAC/`none`, unknown keys and invalid signatures fail closed.

Credential-session revocation is represented by an HMAC-derived handle over length-framed issuer/subject/token-ID values. The database therefore does not need to retain raw issuer, subject, token ID or bearer-token text. A locally revoked session remains refused after authority reopen while the JWT would otherwise remain valid.

## Adversarial fix-forward

The review found two parser/verification hardening gaps and fixed them before PR:

1. base64url segments are now round-tripped and rejected when they are non-canonical rather than relying on Node's permissive decoder;
2. key/algorithm mismatches or crypto verification exceptions are converted into a bounded invalid-signature refusal rather than escaping the authentication boundary.

## Deliberate boundary

This tranche does not pretend that an injected key resolver is production JWKS discovery. RFC 0004's HTTPS issuer metadata lookup, 256 KiB/five-second bounds, one-hour cache and one refresh on unknown `kid` remain the next transport/auth integration tranche. Likewise, public HTTP resource limits, CORS/origin policy, PKCE browser flow and endpoint routing are not claimed here.

The credential-session table is an additive PT4 schema object in the existing single governance database. Before PT4 is declared complete, the consolidated migration/version authority must explicitly own every PT4 table so independent service components cannot evolve SQLite schema ad hoc.

## Disposition

**ADOPT only after exact-head typecheck, lint, focused fast tests, architecture checks, CodeQL and ordinary promotion gates are green. PT4B remains ACTIVE.**
