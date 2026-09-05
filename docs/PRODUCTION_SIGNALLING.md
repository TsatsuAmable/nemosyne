# Production collaboration signalling

Nemosyne collaboration has two deliberately different signalling paths:

- **Development:** Vite mounts `/__signal` locally. `CollaborationCoordinator` may derive that same-origin endpoint only when `import.meta.env.DEV === true`.
- **Production:** the browser requires an explicit `VITE_NEMOSYNE_SIGNALLING_URL`. There is no same-origin production fallback.

If a production build does not configure the endpoint, collaboration remains visibly unavailable and no `NetworkManager` is created.

## Browser configuration

Build the production web application with a secure WebSocket endpoint:

```bash
VITE_NEMOSYNE_SIGNALLING_URL=wss://signal.example.org/__signal npm run build
```

Production browser configuration rejects:

- `ws:` endpoints;
- credentials embedded in the URL;
- query strings or fragments on the signalling-service URL, including URL-carried tokens;
- relative/non-WebSocket URLs.

Admission credentials travel in-band over the WebSocket protocol rather than in the signalling URL query string.

## Private-preview signed invites

The production browser does not contain the signalling HMAC secret. An operator creates a short-lived, one-use room invite outside the browser bundle:

```bash
NEMOSYNE_SIGNAL_TOKEN=<signalling-hmac-secret> \
npm run collaboration:invite -- \
  --base-url=https://nemosyne.world/ \
  --room=preview-room \
  --ttl-seconds=900
```

The command emits an HTTPS Nemosyne URL whose **fragment** contains the canonical signed ticket and its scoped room. URL fragments are not sent in the HTTP request, keeping the ticket out of ordinary origin/reverse-proxy request logs. Treat the complete invite URL as a bearer credential until the ticket is consumed or expires.

On browser boot Nemosyne:

1. reads the ticket and room from the fragment;
2. immediately removes the invite keys from the visible URL with `history.replaceState`;
3. stages the credential in `sessionStorage` only;
4. uses the invite-scoped room as the collaboration room unless an explicit room is supplied by the caller;
5. sends the signed ticket in-band after the WebSocket transport opens;
6. reports collaboration connected only after the standalone service acknowledges that the canonical admission authority accepted the ticket;
7. removes the staged ticket after successful admission.

Invalid or incomplete replacement invites clear any older staged collaboration credential instead of silently falling back to it. Invite issuance currently produces **participant** tickets only. Observer invitation UX is deliberately not claimed by this tranche.

Canonical tickets are one-use. If a connection that used a signed invite is lost, `SignallingChannel` will not replay the consumed ticket. A future renewal authority may supply a fresh ticket through the existing reconnect callback; until then, reconnect after a consumed private-preview invite fails closed and requires a fresh invite. Ordinary development/shared-secret transports retain their existing retry behavior.

## Standalone service

The repository owns one runnable signalling-service entrypoint:

```bash
npm run start:signalling
```

The standalone executable defaults to the **Production** security profile. A missing authentication secret or allowed-origin policy therefore makes startup fail closed instead of silently selecting a weaker profile.

Required production configuration:

```bash
NEMOSYNE_SIGNAL_PROFILE=Production
NEMOSYNE_SIGNAL_HOST=0.0.0.0
NEMOSYNE_SIGNAL_PORT=8787
NEMOSYNE_SIGNAL_TOKEN=<participant-or-ticket-secret>
NEMOSYNE_OBSERVER_TOKEN=<observer-secret>
NEMOSYNE_ALLOWED_ORIGINS=https://nemosyne.world
npm run start:signalling
```

`NEMOSYNE_OBSERVER_TOKEN` is strongly recommended so raw participant and observer credentials remain role-separated. Signed room tickets remain governed by the canonical server-only `SignedTicket.ts` authority. The operator invite command imports that authority through `src/network/server.ts`; browser-reachable `src` modules do not import Node crypto/ticket-signing code.

`--allow-open` / `NEMOSYNE_SIGNAL_ALLOW_OPEN=1` is accepted only with the `Development` security profile and must never be used for a preview or production deployment.

## Service surface

The standalone service exposes:

- `GET /healthz` — process liveness;
- `GET /readyz` — security-aware readiness, including authentication/origin-policy readiness;
- `WS /__signal` — collaboration signalling transport.

Any other HTTP route or WebSocket upgrade path is rejected.

The process handles `SIGTERM` and `SIGINT`, terminates active sockets, stops the heartbeat/idle-room reaper, and closes the HTTP server. Initial connection/admission is bounded. A signed-ticket admission rejection or missing renewal ticket is terminal for that automatic connection generation so an invalid/replayed credential cannot hammer the authentication throttle.

## Container deployment

`deploy/signalling/Dockerfile` is the canonical repository container contract. Build it from the repository root:

```bash
docker build -f deploy/signalling/Dockerfile -t nemosyne-signalling .
```

The container listens internally on port `8787` and uses `/readyz` for its health check. Terminate TLS at the platform/reverse proxy and expose the browser-facing endpoint as `wss://.../__signal`.

The static Netlify deployment does **not** provide this WebSocket service. The signalling container must be deployed on infrastructure that supports long-lived WebSocket upgrades.

## Replay-protection deployment boundary

The canonical signed-ticket replay guard is registry-instance local. A single signalling replica can therefore enforce one-use nonces correctly. A multi-replica deployment **must add a shared atomic nonce store** before it may claim replay protection across replicas. Sharing only the HMAC secret is insufficient.

Until that shared nonce authority exists, deploy the private-preview signalling service as a single active replica (or use platform routing that guarantees a ticket cannot be admitted by multiple independent registries).

## Evidence and RF-054 scope

Repository evidence now exercises more than health checks:

- production endpoint configuration refusal and visible unavailability when unconfigured;
- signed invite issuance through the canonical HMAC authority and fragment-only browser consumption;
- bounded connection/admission and fail-closed signed-ticket reconnect semantics;
- real `/healthz` and `/readyz` responses from an ephemeral Production service;
- two real `ws` clients admitted with independent one-use signed tickets through `WS /__signal`;
- server-authoritative peer identity during direct signalling relay;
- second-use rejection of a consumed ticket with close code `4001`.

This establishes a runnable, configuration-backed repository production path. RF-054 is still not `VERIFIED COMPLETE` merely because the container and tests exist. Final closure requires evidence from the actually deployed `wss://` service URL and a clean production browser collaboration journey against that deployment.
