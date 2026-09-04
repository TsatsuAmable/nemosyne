import { afterEach, describe, expect, it } from 'vitest';
import {
  createSignallingService,
  readSignallingServiceConfig,
} from '../src/network/SignallingServer.mjs';

type Service = ReturnType<typeof createSignallingService>;

const services: Service[] = [];

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.stop()));
});

describe('P1-W1 production signalling service runtime', () => {
  it('defaults the standalone service to fail-closed Production', () => {
    const config = readSignallingServiceConfig([], {});
    expect(config.securityProfile).toBe('Production');
    expect(config.allowOpen).toBe(false);
    expect(() => createSignallingService(config)).toThrow(/unsafe signalling configuration/u);
  });

  it('rejects open mode outside the Development profile', () => {
    expect(() =>
      readSignallingServiceConfig(['--allow-open', '--profile=Production'], {})
    ).toThrow(/permitted only with the Development profile/u);
  });

  it('serves liveness and security-aware readiness on the real HTTP runtime', async () => {
    const config = readSignallingServiceConfig([], {
      NEMOSYNE_SIGNAL_PROFILE: 'Production',
      NEMOSYNE_SIGNAL_HOST: '127.0.0.1',
      NEMOSYNE_SIGNAL_PORT: '0',
      NEMOSYNE_SIGNAL_TOKEN: 'participant-secret',
      NEMOSYNE_OBSERVER_TOKEN: 'observer-secret',
      NEMOSYNE_ALLOWED_ORIGINS: 'https://nemosyne.example',
    });
    const service = createSignallingService(config);
    services.push(service);
    const address = await service.start();
    expect(address && typeof address === 'object').toBe(true);
    const port = (address as { port: number }).port;

    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({
      status: 'ready',
      profile: 'Production',
      originEnforcement: true,
      authenticationConfigured: true,
    });

    const missing = await fetch(`http://127.0.0.1:${port}/not-a-service-route`);
    expect(missing.status).toBe(404);
  });
});
