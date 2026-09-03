#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputDir = resolve(root, outIndex >= 0 ? args[outIndex + 1] : '.wiki-build');
const checkOnly = args.includes('--check');
const repository = process.env.GITHUB_REPOSITORY || 'TsatsuAmable/nemosyne';
const manifestPath = resolve(root, 'docs/DOCS_MANIFEST.json');

if (!existsSync(manifestPath)) {
  throw new Error('docs/DOCS_MANIFEST.json is required to generate the wiki');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const pageByAuthority = new Map([
  ['product-research-architecture', 'Vision-and-Roadmap'],
  ['implementation-status', 'Current-Status'],
  ['engineering-agent-contract', 'Engineering-Agent-Contract'],
  ['documentation-index', 'Documentation-Index'],
  ['architecture-reference', 'Architecture'],
  ['contribution-process', 'Contributing'],
  ['security-reporting-policy', 'Security'],
  ['semantic-ownership-map', 'Ownership'],
  ['architecture-change-process', 'RFC-Process'],
  ['accepted-production-data-contract', 'Production-Data-Lifecycle-RFC'],
  ['accepted-governed-data-plane-contract', 'Governed-Data-Plane-RFC'],
  ['architecture-decisions-index', 'Architecture-Decisions'],
  ['implementation-sequencing-reference', 'Implementation-Plan'],
  ['implementation-quality-policy', 'Implementation-Quality'],
  ['security-assurance-findings', 'Security-Assurance'],
  ['ci-strategy', 'CI-Strategy'],
  ['statistical-methods', 'Statistical-Methods'],
  ['study-index', 'Study'],
]);

const activeDocuments = (manifest.documents ?? []).filter((document) => document.status !== 'historical');
const pageByPath = new Map();
for (const document of activeDocuments) {
  const page = pageByAuthority.get(document.authority);
  if (!page) {
    throw new Error(`No wiki page mapping for active authority '${document.authority}' (${document.path})`);
  }
  if (!existsSync(resolve(root, document.path))) {
    throw new Error(`Wiki source does not exist: ${document.path}`);
  }
  pageByPath.set(document.path, page);
}

function toPosix(path) {
  return path.replaceAll('\\', '/');
}

function sourceLink(path) {
  return `https://github.com/${repository}/blob/main/${encodeURI(toPosix(path))}`;
}

function rewriteInlineLinks(markdown, sourcePath) {
  return markdown.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (full, label, rawTarget) => {
    const target = rawTarget.trim();
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) return full;

    const [pathPart, fragment = ''] = target.split('#', 2);
    if (!pathPart) return full;
    const absoluteTarget = resolve(root, dirname(sourcePath), decodeURI(pathPart));
    const repositoryPath = toPosix(relative(root, absoluteTarget));
    const wikiPage = pageByPath.get(repositoryPath);
    if (wikiPage && !label.startsWith('!')) {
      return `${label}(${wikiPage}${fragment ? `#${fragment}` : ''})`;
    }

    const suffix = fragment ? `#${fragment}` : '';
    const url = `https://github.com/${repository}/blob/main/${encodeURI(repositoryPath)}${suffix}`;
    return `${label}(${url})`;
  });
}

function rewriteLinks(markdown, sourcePath) {
  const lines = markdown.split('\n');
  let fence = null;
  return lines
    .map((line) => {
      const match = line.match(/^\s*(`{3,}|~{3,})/);
      if (match) {
        const marker = match[1];
        if (fence === null) {
          fence = { char: marker[0], length: marker.length };
        } else if (marker[0] === fence.char && marker.length >= fence.length) {
          fence = null;
        }
        return line;
      }
      return fence === null ? rewriteInlineLinks(line, sourcePath) : line;
    })
    .join('\n');
}

function renderDocument(document) {
  const source = readFileSync(resolve(root, document.path), 'utf8').trimEnd();
  const notice = [
    '> **Generated reference.** This page is published automatically from the version-controlled repository.',
    `> Canonical source: [\`${document.path}\`](${sourceLink(document.path)}). Do not edit this wiki page directly.`,
    '',
  ].join('\n');
  return `${notice}${rewriteLinks(source, document.path)}\n`;
}

function walkTypescript(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkTypescript(path));
    else if (entry.isFile() && extname(entry.name) === '.ts' && !entry.name.endsWith('.d.ts')) files.push(path);
  }
  return files;
}

function exportedSymbols(source) {
  const patterns = [
    /export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /export\s+interface\s+([A-Za-z_$][\w$]*)/g,
    /export\s+type\s+([A-Za-z_$][\w$]*)/g,
    /export\s+enum\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+const\s+([A-Za-z_$][\w$]*)/g,
  ];
  const names = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function renderCodebaseIndex() {
  const rows = [];
  for (const absolutePath of walkTypescript(resolve(root, 'src')).sort()) {
    const repositoryPath = toPosix(relative(root, absolutePath));
    const symbols = exportedSymbols(readFileSync(absolutePath, 'utf8'));
    if (symbols.length === 0) continue;
    const moduleLink = `[\`${repositoryPath}\`](${sourceLink(repositoryPath)})`;
    rows.push(`| ${moduleLink} | ${symbols.map((symbol) => `\`${symbol}\``).join(', ')} |`);
  }

  return [
    '# Codebase index',
    '',
    '> **Generated reference.** This index is rebuilt from exported TypeScript symbols under `src/` whenever the wiki workflow runs.',
    '> Source code and executable configuration remain authoritative.',
    '',
    '| Module | Exported symbols |',
    '| --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function write(path, content) {
  writeFileSync(resolve(outputDir, path), content, 'utf8');
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const document of activeDocuments) {
  write(`${pageByPath.get(document.path)}.md`, renderDocument(document));
}
write('Codebase-Index.md', renderCodebaseIndex());

const canonical = activeDocuments.filter((document) => document.status === 'canonical');
const active = activeDocuments.filter((document) => document.status === 'active');
const home = [
  '# Nemosyne wiki',
  '',
  'This wiki is a **generated navigation and reference surface** for the Nemosyne repository. It is not an independent source of truth.',
  '',
  'The source repository owns all canonical content. Wiki pages are rebuilt after relevant changes land on `main`, preventing the historical wiki from silently drifting behind the implementation.',
  '',
  '## Canonical authorities',
  '',
  ...canonical.map((document) => `- [${document.authority}](${pageByPath.get(document.path)})`),
  '',
  '## Current engineering reference',
  '',
  ...active.map((document) => `- [${document.authority}](${pageByPath.get(document.path)})`),
  '',
  '## Generated code reference',
  '',
  '- [Codebase index](Codebase-Index)',
  '',
  `Repository: https://github.com/${repository}`,
  '',
].join('\n');
write('Home.md', home);

const sidebar = [
  '**Nemosyne**',
  '',
  '- [Home](Home)',
  '- [Current status](Current-Status)',
  '- [Vision & roadmap](Vision-and-Roadmap)',
  '- [Architecture](Architecture)',
  '- [Codebase index](Codebase-Index)',
  '- [Documentation index](Documentation-Index)',
  '- [Statistical methods](Statistical-Methods)',
  '- [Study](Study)',
  '- [Security](Security)',
  '',
  '_Generated from `main`._',
  '',
].join('\n');
write('_Sidebar.md', sidebar);

const generatedFiles = readdirSync(outputDir).sort();
if (generatedFiles.length !== activeDocuments.length + 3) {
  throw new Error(`Expected ${activeDocuments.length + 3} generated wiki files, found ${generatedFiles.length}`);
}

if (checkOnly) {
  console.log(`WIKI GENERATION CHECK PASSED (${generatedFiles.length} pages)`);
} else {
  console.log(`Generated ${generatedFiles.length} wiki pages in ${relative(root, outputDir) || '.'}`);
}
