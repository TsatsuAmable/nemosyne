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
- query strings or fragments, including URL-carried tokens;
- relative/non-WebSocket URLs.

Admission credentials continue to travel in-band over the WebSocket protocol rather than in URL query parameters.

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

`NEMOSYNE_OBSERVER_TOKEN` is strongly recommended so raw participant and observer credentials remain role-separated. Signed room tickets remain governed by the canonical `SignedTicket.ts` authority.

`--allow-open` / `NEMOSYNE_SIGNAL_ALLOW_OPEN=1` is accepted only with the `Development` security profile and must never be used for a preview or production deployment.

## Service surface

The standalone service exposes:

- `GET /healthz` — process liveness;
- `GET /readyz` — security-aware readiness, including authentication/origin-policy readiness;
- `WS /__signal` — collaboration signalling transport.

Any other HTTP route or WebSocket upgrade path is rejected.

The process handles `SIGTERM` and `SIGINT`, terminates active sockets, stops the heartbeat/idle-room reaper, and closes the HTTP server. Client-side initial WebSocket establishment is bounded; transient disconnects continue to use the existing exponential reconnect policy.

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

This service contract makes collaboration production-configurable and removes the dead same-origin production fallback. Repository tests exercise configuration refusal, unavailable product behavior, bounded connection attempts, and the real `/healthz` + `/readyz` HTTP runtime.

RF-054 is not `VERIFIED COMPLETE` merely because the container exists. Final closure still requires evidence from the actual deployed service URL and a clean production browser collaboration journey against that deployment.
