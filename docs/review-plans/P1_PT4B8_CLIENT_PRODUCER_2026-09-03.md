# P1 PT4B8 Browser PKCE + Governed Producer Pre-Implementation Review — 2026-09-03

## Scope

Complete the first-family browser-to-service path authorized by accepted RFC 0004 without promoting browser state into collection authority.

## Invariant

A successful post-commit `OPERATION_APPLIED` may produce only the closed `{operation}` governed payload. Capture is optional and asynchronous. The browser must first hold an in-memory OIDC access token, obtain a one-use server capture authorization, bind the exact returned receipt/pseudonym/event/producer/stream/sequence coordinates, pass client structural admission, enter only a bounded non-persistent queue, and reach the already-authenticated NDJSON ingestion endpoint. The server independently pins reviewed build/deployment/UI references and an allowed platform-runtime version before consent/replay/storage authority.

## Authority / production path

`src/main.ts` -> configured browser client -> `WorldTopics.OPERATION_APPLIED` -> closed `projectProductOperationAppliedV1()` -> capture-authorization HTTP endpoint -> governed envelope -> bounded memory queue -> `/v1/governed-events/batches` -> runtime-pinned ingestion -> existing transactional consent/capture/replay store.

## Primary failure modes

- rich source event fields leak into analytics;
- startup/display consent is mistaken for capture authority;
- ID tokens, implicit flow, client secret or persistent bearer credentials enter the data plane;
- PKCE state/verifier survives beyond the callback or a mismatched state is accepted;
- capture response coordinates are not bound to the pre-generated request;
- queue overflow creates a permanent stream gap;
- revocation leaves queued work admissible;
- retry logic retries governance/identity conflicts instead of only network/429/503/storage failures;
- client-supplied build/deployment/UI references are accepted without independent server pins;
- absent/partial product-data configuration accidentally enables collection.

## Falsifying evidence

Focused fast tests must prove PKCE S256 and no client secret, bearer/refresh tokens absent from Storage, state mismatch refusal, rich event projection exclusion, capture-response binding, bounded queue retry/reset behavior, server runtime mismatch refusal before consent/storage authority, and complete-or-absent browser configuration. Exact-head typecheck/lint, architecture, production build/coverage, Chromium smoke, CodeQL, Q8/Q9, UV0 and approval remain required.

## Non-goals

This tranche does not add a polished sign-in/consent settings UI, make product analytics mandatory, persist the optional queue, broaden the event family, claim platform attestation, add multi-node storage, or complete physical XR qualification. Authorization initiation is exposed through a narrow application event for the product UI to invoke.
