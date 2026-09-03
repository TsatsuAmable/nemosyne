# P1-PT4B4 OIDC Metadata and JWKS Authority Pre-Implementation Review

**Date:** 3 September 2026  
**Base:** `main@cfaa9ff8329038c1f8110445983c53b7a4b18d94`  
**Programme:** P1-PT4B  
**Risk:** high

## Invariant

A data-plane signing key is usable only when it came from the configured issuer's bounded HTTPS discovery document and a fresh bounded JWKS fetch. Network failure, malformed metadata, issuer mismatch, unsafe JWKS location, oversized bodies, timeout, stale cache, duplicate key identity or an unknown `kid` after the one permitted refresh all fail closed.

## Bounded tranche

PT4B4 implements the network key-resolution authority behind PT4B3. It does not yet expose a public HTTP listener or route authenticated requests.

The authority must:

- fetch only `https://<configured issuer>/.well-known/openid-configuration` derived from the exact configured issuer;
- require discovery `issuer` to equal the configured issuer exactly;
- require an absolute HTTPS `jwks_uri` with no credentials or fragment;
- bound each metadata/JWKS response to 256 KiB and five seconds;
- reject redirects so a trusted issuer URL cannot silently delegate discovery to an unreviewed host;
- accept only a JSON JWKS object with a bounded key count, unique non-empty `kid` values and public signing keys;
- cache successfully fetched key sets for no more than one hour;
- perform at most one forced refresh for an unknown `kid` during a resolution attempt;
- refuse stale or unavailable key material rather than falling back to an old cache;
- return only a key whose `kid`, declared `alg` (when present) and key type are compatible with the requested `RS256 | ES256 | EdDSA` algorithm.

## Interface strategy

PT4B3 intentionally kept signature verification synchronous. PT4B4 therefore exposes an asynchronous `resolveForVerification()` operation that owns discovery/fetch/cache/unknown-kid refresh and returns one public JWK. A tiny synchronous cache resolver remains available only after an explicit freshness check. The later HTTP adapter must call the asynchronous authority before invoking PT4B3 verification; there is no implicit network I/O inside a synchronous verifier.

## Falsifiers

- HTTP issuer configuration is refused.
- discovery issuer mismatch is refused.
- redirect responses are refused.
- non-HTTPS, credential-bearing or fragment-bearing JWKS URI is refused.
- metadata or JWKS over 256 KiB is refused before parsing.
- an aborted/failed fetch refuses resolution.
- malformed JSON/JWKS or duplicate `kid` values are refused.
- private key material is refused.
- key type/curve/algorithm confusion is refused.
- cache is reused while fresh but not after one hour.
- unknown `kid` causes exactly one forced refresh, then refuses if still absent.
- a stale cache cannot be used when refresh fails.

## Non-goals

No browser PKCE flow, CORS/origin handling, access-token storage, public endpoint routing, consent HTTP schemas, ingestion, event persistence, export or erasure is claimed here.
