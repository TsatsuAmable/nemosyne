import fs from 'node:fs';
import path from 'node:path';

const certDir = path.resolve(process.cwd(), 'certs');

export function loadCert(file: string): Buffer | undefined {
  const p = path.join(certDir, file);
  try {
    return fs.readFileSync(p);
  } catch {
    return undefined;
  }
}

export interface HttpsServerOptions {
  key: Buffer;
  cert: Buffer;
}

export function httpsOptions(command: 'build' | 'serve'): HttpsServerOptions | undefined {
  // The Playwright load-smoke (test/playwright-load-smoke) runs `vite preview`
  // over plain HTTP — headless Chromium needs no TLS, and CI has no certs.
  // Setting NEMOSYNE_FORCE_HTTP=1 (via Playwright's webServer.env) forces HTTP
  // even when local dev certs are present, keeping the smoke deterministic
  // across environments. Normal dev/preview is unaffected.
  if (process.env.NEMOSYNE_FORCE_HTTP === '1') return undefined;
  const key = loadCert('key.pem');
  const cert = loadCert('cert.pem');
  if (key && cert) return { key, cert };
  if (process.env.VITEST) return undefined;
  if (command === 'serve') {
    // eslint-disable-next-line no-console
    console.warn(
      `[dev/https-options] HTTPS certs not found in ${certDir}. Generate them with:\n` +
        '  mkdir certs && openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes'
    );
  }
  return undefined;
}
