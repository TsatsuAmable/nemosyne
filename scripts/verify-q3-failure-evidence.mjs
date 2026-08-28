import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root = resolve('test-results');
const secretCanary = 'q3-secret-canary-20260828';
const queryCanary = 'q3-query-canary-20260828';
const networkCanaryPath = '/__q3-evidence-probe';

function filesBelow(path) {
  if (!existsSync(path)) return [];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...filesBelow(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

function fail(message) {
  console.error(`[Q3 verifier] ${message}`);
  process.exit(1);
}

const files = filesBelow(root);
const evidencePath = files.find((path) => basename(path) === 'q3-failure-evidence.json');
if (!evidencePath) fail('q3-failure-evidence.json was not retained');

const tracePath = files.find((path) => basename(path) === 'trace.zip');
const screenshotPath = files.find((path) => /\.png$/i.test(path));
const videoPath = files.find((path) => /\.webm$/i.test(path));
if (!tracePath || statSync(tracePath).size === 0) fail('non-empty Playwright trace.zip was not retained');
if (!screenshotPath || statSync(screenshotPath).size === 0) fail('failure screenshot was not retained');
if (!videoPath || statSync(videoPath).size === 0) fail('failure video was not retained');

const raw = readFileSync(evidencePath, 'utf8');
if (raw.includes(secretCanary)) fail('secret canary leaked into JSON evidence');
if (raw.includes(queryCanary)) fail('URL query canary leaked into JSON evidence');

const evidence = JSON.parse(raw);
if (evidence.schemaVersion !== 1) fail('unexpected evidence schema version');
if (evidence.classification !== 'synthetic-ci-only') fail('evidence must remain scoped to synthetic CI');
if (evidence.test?.status !== 'failed') fail('probe failure status was not captured');
if (evidence.test?.expectedStatus !== 'passed') fail('probe expected status was not captured');
if (!/^[0-9a-f]{40}$/.test(evidence.source?.sourceHeadSha ?? '')) {
  fail('exact source-head SHA missing from bundle');
}
if (!/^[0-9a-f]{40}$/.test(evidence.source?.workflowCheckoutSha ?? '')) {
  fail('workflow checkout SHA missing from bundle');
}
if (!/^[0-9a-f]{64}$/.test(evidence.artifacts?.productionBundleSha256 ?? '')) {
  fail('production bundle SHA-256 missing from bundle');
}
if (!/^[0-9a-f]{64}$/.test(evidence.artifacts?.wasmSha256 ?? '')) {
  fail('WASM SHA-256 missing from bundle');
}
if (evidence.browser?.runtime?.schemaVersion !== 1) fail('runtime diagnostic snapshot missing');
if (!evidence.browser?.runtime?.bootState) fail('runtime boot state missing');
if (!['worker', 'inline', 'none'].includes(evidence.browser?.runtime?.atlas?.executionMode)) {
  fail('runtime analytical execution mode missing');
}
if (!Number.isFinite(evidence.browser?.runtime?.scene?.objectCount)) {
  fail('scene object count missing');
}
if (!Number.isFinite(evidence.browser?.runtime?.renderer?.render?.calls)) {
  fail('renderer call count missing');
}
if (!Array.isArray(evidence.consoleMessages) || evidence.consoleMessages.length === 0) {
  fail('sanitized console evidence missing');
}
const redactedCanary = evidence.consoleMessages.find(
  (message) => message.type === 'error' && message.text.includes('Q3 probe secret=[REDACTED]')
);
if (!redactedCanary) fail('secret canary was not observed and redacted in console evidence');

if (!Array.isArray(evidence.requestFailures) || evidence.requestFailures.length === 0) {
  fail('sanitized request-failure evidence missing');
}
const networkCanary = evidence.requestFailures.find(
  (entry) => entry.method === 'GET' && entry.url.endsWith(networkCanaryPath)
);
if (!networkCanary) fail('query canary request was not observed as sanitized request-failure evidence');
if (networkCanary.url.includes('?') || networkCanary.url.includes('#')) {
  fail('sanitized network canary retained a query string or fragment');
}
if (!networkCanary.errorText) fail('network canary failure reason was not retained');

console.log(
  JSON.stringify(
    {
      evidencePath,
      traceBytes: statSync(tracePath).size,
      screenshotBytes: statSync(screenshotPath).size,
      videoBytes: statSync(videoPath).size,
      sourceHeadSha: evidence.source.sourceHeadSha,
      workflowCheckoutSha: evidence.source.workflowCheckoutSha,
      productionBundleSha256: evidence.artifacts.productionBundleSha256,
      wasmSha256: evidence.artifacts.wasmSha256,
      runtime: evidence.browser.runtime,
      consoleEvidenceCount: evidence.consoleMessages.length,
      requestFailureCount: evidence.requestFailures.length,
      httpErrorCount: evidence.httpErrors.length,
      canariesVerified: true,
    },
    null,
    2
  )
);
