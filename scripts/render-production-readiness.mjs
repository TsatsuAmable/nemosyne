#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const READINESS_PATH = 'governance/production-readiness.json';
const REPORT_PATH = 'docs/PRODUCTION_READINESS.md';

function readJson(root, repoPath) {
  return JSON.parse(readFileSync(resolve(root, repoPath), 'utf8'));
}

function cell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function evidenceLabel(obligation) {
  if (obligation.evidence?.length) return obligation.evidence.map((path) => `\`${path}\``).join(', ');
  if (obligation.expectedEvidence?.length) {
    return `expected: ${obligation.expectedEvidence.map((path) => `\`${path}\``).join(', ')}`;
  }
  return '—';
}

export function renderProductionReadiness(root = process.cwd()) {
  readJson(root, 'governance/production-capabilities.json');
  const readiness = readJson(root, READINESS_PATH);

  const lines = [
    '# Production readiness',
    '',
    '> Generated from `governance/production-capabilities.json` and `governance/production-readiness.json`.',
    '> `docs/ROADMAP.md` remains the canonical implementation-status and sequencing authority. This page makes service and verification debt discoverable without promoting repository evidence into deployment evidence.',
    '',
    '## Deployment policy',
    '',
    `- **State:** ${readiness.deploymentPolicy.state}`,
    `- **Effective:** ${readiness.deploymentPolicy.effectiveDate}`,
    `- **Blocks forward development:** ${readiness.deploymentPolicy.blocksForwardDevelopment ? 'yes' : 'no'}`,
    `- **Reason:** ${readiness.deploymentPolicy.reason}`,
    '',
    '## Service inventory',
    '',
    '| Service | Plane(s) | Target | Implementation | Deployment | Verification | Roadmap |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const service of readiness.services) {
    lines.push(
      `| ${cell(service.id)} | ${cell(service.planes.join(', '))} | ${cell(service.targetState)} | ${cell(service.implementationState)} | ${cell(service.deploymentState)} | ${cell(service.verificationState)} | ${cell(service.roadmapRefs.join(', '))} |`
    );
  }

  for (const service of readiness.services) {
    lines.push('', `### ${service.id}`, '', service.summary, '');
    if (service.sources?.length) lines.push(`**Sources:** ${service.sources.map((path) => `\`${path}\``).join(', ')}`, '');
    if (service.capabilityRefs?.length) lines.push(`**Capability refs:** ${service.capabilityRefs.map((id) => `\`${id}\``).join(', ')}`, '');
    lines.push(`**Verification obligations:** ${service.obligationRefs.map((id) => `\`${id}\``).join(', ')}`);
  }

  lines.push(
    '',
    '## Verification obligations',
    '',
    '| ID | Service | Kind | State | Evidence / expected evidence | Closure contract |',
    '| --- | --- | --- | --- | --- | --- |'
  );

  for (const obligation of readiness.verificationObligations) {
    lines.push(
      `| ${cell(obligation.id)} | ${cell(obligation.serviceRef)} | ${cell(obligation.kind)} | ${cell(obligation.state)} | ${cell(evidenceLabel(obligation))} | ${cell(obligation.closure)} |`
    );
  }

  lines.push(
    '',
    '## State semantics',
    '',
    '- `GREEN` means the listed repository evidence currently exists; CI determines whether it still passes.',
    '- `MISSING` means a required future check or artifact is deliberately named but not yet implemented.',
    '- `DEFERRED_BY_POLICY` means closure requires a production/external boundary that the owner has intentionally deferred. It is not a pass.',
    '- `NOT_REQUIRED_YET` means the service boundary is planned but deployment is not yet a selected product requirement.',
    '- Repository evidence, simulator evidence, physical-device evidence and deployed-service evidence remain distinct evidence classes.',
    ''
  );

  return `${lines.join('\n')}\n`;
}

function main() {
  const root = process.cwd();
  const rendered = renderProductionReadiness(root);
  const mode = process.argv[2] ?? '--write';

  if (mode === '--write') {
    writeFileSync(resolve(root, REPORT_PATH), rendered);
    console.log(`WROTE ${REPORT_PATH}`);
    return;
  }

  if (mode === '--check') {
    const current = readFileSync(resolve(root, REPORT_PATH), 'utf8');
    if (current !== rendered) {
      console.error('PRODUCTION READINESS REPORT STALE: run node scripts/render-production-readiness.mjs --write');
      process.exit(1);
    }
    console.log('PRODUCTION READINESS REPORT CURRENT');
    return;
  }

  throw new Error(`unsupported mode: ${mode}`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) main();
