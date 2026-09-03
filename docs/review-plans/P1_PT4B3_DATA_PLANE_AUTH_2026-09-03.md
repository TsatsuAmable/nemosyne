# P1-PT4B3 Data-Plane Authentication Pre-Implementation Review

**Date:** 3 September 2026  
**Base:** `main@0948d162cdcf1e62397a92dd5bc6b32efcae3329`  
**Programme:** P1-PT4B  
**Risk:** high

## Invariant

A bearer credential becomes an authenticated data-plane principal only after strict verification of the accepted RFC 0004 access-token profile. Authentication must precede governed request parsing. Token presence, a decodable JWT, an ID token, or a valid signature alone is insufficient.

## Bounded tranche

PT4B3 implements the post-TLS access-token authority and durable local credential-session revocation state. It deliberately does not add the public HTTP listener, OIDC browser flow, network JWKS discovery, consent routes, ingestion routes or event storage.

The verifier must fail closed on malformed compact JWTs; any token whose `typ` is not `at+jwt`; algorithms outside the configured `RS256 | ES256 | EdDSA` subset; missing/non-string `kid`; issuer/audience mismatch; missing or oversized `sub`/`jti`/`scope`; missing/non-numeric `iat`/`exp`; lifetime above five minutes; tokens outside the allowed skew; unapproved extra audiences; absent required scopes; unknown keys; invalid signatures; and locally revoked credential sessions.

## Authority boundary

The verifier receives an already-configured exact HTTPS issuer, one audience, an allowed asymmetric algorithm set and a key resolver. The resolver is an interface so network metadata/JWKS retrieval can be implemented and attacked separately in the following transport tranche. No HMAC algorithm and no token-carried key material is accepted.

Credential-session revocation is durable in the same governance SQLite database created by PT4B2. The row key is `(iss, sub, jti)` represented through a keyed deletion-safe handle rather than raw identity fields. Raw bearer tokens are never persisted.

## Falsifiers

- ID-token-style `typ` is refused even with a valid signature.
- `none`, HS256 and configured-but-wrong algorithms are refused before key use.
- an additional audience is refused.
- a token above the five-minute lifetime is refused.
- expiry/not-before semantics remain bounded by <=60 seconds configured skew.
- missing required scope is refused and one scope does not imply another.
- unknown `kid` and invalid signature are refused.
- local revocation survives authority reopen and refuses an otherwise valid unexpired token.
- the SQLite file contains neither raw token text nor raw issuer/subject values used by the test principal.

## Non-goals

No claim is made yet for OIDC Authorization Code + PKCE, provider metadata/JWKS HTTP fetch/caching, CORS/origin enforcement, public listener resource bounds, consent endpoint authentication, or governed-event ingestion. Those require subsequent PT4B tranches.
