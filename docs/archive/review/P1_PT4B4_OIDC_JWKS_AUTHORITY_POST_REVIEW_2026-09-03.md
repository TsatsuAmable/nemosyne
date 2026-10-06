# P1-PT4B4 OIDC Metadata and JWKS Authority Post-Implementation Review

**Date:** 3 September 2026  
**Base:** `main@cfaa9ff8329038c1f8110445983c53b7a4b18d94`  
**Programme:** P1-PT4B

## Reviewed implementation

PT4B4 adds `OidcJwksAuthority`, the bounded asynchronous network authority behind PT4B3's synchronous token verifier. It derives the OIDC discovery URL only from the configured HTTPS issuer, requires an exact issuer echo, accepts only an HTTPS credential-free/fragment-free `jwks_uri`, refuses redirects, bounds discovery and JWKS bodies to 256 KiB and each request to at most five seconds, and caches successful JWKS state for at most one hour.

An unknown `kid` receives one forced refresh after the current cache lookup. If the key remains absent, the authority refuses resolution. Expired cache state is never returned when refresh fails.

JWKS admission is closed to a maximum of 64 unique-key entries and accepts only public signing material compatible with the RFC 0004 algorithm family: RSA verification keys, P-256 EC verification keys and Ed25519 OKP verification keys. Declared `use`, `key_ops` and `alg` values must be compatible when present.

## Adversarial fix-forward

The implementation review found a material private-key filtering defect before PR. Testing only JWK `d` is not sufficient for RSA keys because CRT/private fields such as `p`, `q`, `dp`, `dq`, `qi` and `oth` can also expose private material. JWKS admission now rejects all known private JWK fields and rejects non-signing or unsupported key metadata before caching.

The review also preserves an intentional architecture seam: network refresh remains asynchronous and explicit. `DataPlaneAccessTokenAuthority` is not made secretly asynchronous. The forthcoming HTTP adapter must resolve/refresh the key through `OidcJwksAuthority` before calling the synchronous verifier.

## Residual boundaries

PT4B4 does not implement the browser PKCE flow, public data-service listener, origin/CORS enforcement, request concurrency/rate limits, consent routes or ingestion. It also does not claim network-layer IP-range/egress policy; deployment should restrict outbound egress independently of this application-level HTTPS/discovery authority.

## Disposition

**ADOPT only after exact-head fast tests, typecheck/lint, architecture checks, CodeQL and promotion gates pass. PT4B remains ACTIVE.**
