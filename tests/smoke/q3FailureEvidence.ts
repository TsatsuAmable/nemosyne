import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  test as base,
  expect,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

const MAX_MESSAGES = 50;
const MAX_TEXT = 1_000;

function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

function sanitizeText(raw: string): string {
  let value = raw;
  value = value.replace(/https?:\/\/[^\s"'<>]+/g, (url) => sanitizeUrl(url));
  value = value.replace(
    /\b(token|secret|password|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
    '$1=[REDACTED]'
  );
  value = value.replace(/[A-Za-z0-9+/_=-]{40,}/g, '[REDACTED_TOKEN]');
  value = value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
  return value.length <= MAX_TEXT ? value : `${value.slice(0, MAX_TEXT)}…[truncated]`;
}

function sha256File(path: string): string | null {
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function sha256Directory(root: string): string | null {
  const files = listFiles(root).sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
  if (files.length === 0) return null;
  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(relative(root, file));
    digest.update('\0');
    digest.update(sha256File(file) ?? '');
    digest.update('\n');
  }
  return digest.digest('hex');
}

interface NetworkFailure {
  method: string;
  resourceType: string;
  url: string;
  errorText: string | null;
}

interface HttpError {
  method: string;
  status: number;
  url: string;
}

interface ConsoleEvidence {
  type: string;
  text: string;
}

function pushBounded<T>(items: T[], value: T): void {
  if (items.length < MAX_MESSAGES) items.push(value);
}

async function browserSnapshot(page: Page): Promise<unknown> {
  return page
    .evaluate(() => {
      const extendedPerformance = performance as Performance & {
        memory?: {
          jsHeapSizeLimit: number;
          totalJSHeapSize: number;
          usedJSHeapSize: number;
        };
      };
      const navigation = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      return {
        telemetry: document.getElementById('telemetry')?.textContent ?? null,
        performance: {
          nowMs: performance.now(),
          memory: extendedPerformance.memory
            ? {
                jsHeapSizeLimit: extendedPerformance.memory.jsHeapSizeLimit,
                totalJSHeapSize: extendedPerformance.memory.totalJSHeapSize,
                usedJSHeapSize: extendedPerformance.memory.usedJSHeapSize,
              }
            : null,
          navigation: navigation
            ? {
                domInteractive: navigation.domInteractive,
                domComplete: navigation.domComplete,
                loadEventEnd: navigation.loadEventEnd,
                transferSize: navigation.transferSize,
                decodedBodySize: navigation.decodedBodySize,
              }
            : null,
        },
        runtime: window.__NEMOSYNE_DIAGNOSTICS__?.() ?? null,
      };
    })
    .catch((error: unknown) => ({ snapshotError: sanitizeText(String(error)) }));
}

export const test = base.extend<{ q3FailureEvidence: void }>({
  q3FailureEvidence: [
    async ({ page }, use, testInfo) => {
      const consoleMessages: ConsoleEvidence[] = [];
      const pageErrors: string[] = [];
      const requestFailures: NetworkFailure[] = [];
      const httpErrors: HttpError[] = [];

      const onConsole = (message: ConsoleMessage) => {
        if (message.type() !== 'error' && message.type() !== 'warning') return;
        pushBounded(consoleMessages, { type: message.type(), text: sanitizeText(message.text()) });
      };
      const onPageError = (error: Error) => pushBounded(pageErrors, sanitizeText(error.stack ?? error.message));
      const onRequestFailed = (request: Request) =>
        pushBounded(requestFailures, {
          method: request.method(),
          resourceType: request.resourceType(),
          url: sanitizeUrl(request.url()),
          errorText: request.failure()?.errorText ? sanitizeText(request.failure()!.errorText) : null,
        });
      const onResponse = (response: Response) => {
        if (response.status() < 400) return;
        pushBounded(httpErrors, {
          method: response.request().method(),
          status: response.status(),
          url: sanitizeUrl(response.url()),
        });
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      page.on('requestfailed', onRequestFailed);
      page.on('response', onResponse);

      await use();

      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);

      if (testInfo.status === testInfo.expectedStatus) return;

      const bundle = {
        schemaVersion: 1,
        classification: 'synthetic-ci-only',
        test: {
          title: testInfo.title,
          project: testInfo.project.name,
          retry: testInfo.retry,
          status: testInfo.status,
          expectedStatus: testInfo.expectedStatus,
          durationMs: testInfo.duration,
        },
        source: {
          sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
          workflowCheckoutSha: process.env.GITHUB_SHA ?? null,
        },
        artifacts: {
          productionBundleSha256: sha256Directory(resolve('dist')),
          wasmSha256: sha256File(resolve('dist/wasm/pkg/nemosyne_wasm_bg.wasm')),
        },
        browser: await browserSnapshot(page),
        consoleMessages,
        pageErrors,
        requestFailures,
        httpErrors,
      };

      const evidencePath = testInfo.outputPath('q3-failure-evidence.json');
      writeFileSync(evidencePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
      await testInfo.attach('q3-failure-evidence', {
        path: evidencePath,
        contentType: 'application/json',
      });
    },
    { auto: true },
  ],
});

export { expect };
