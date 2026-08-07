#!/usr/bin/env node
/**
 * Convert linked markdown documentation into themed HTML pages.
 *
 * Usage:
 *   node docs/build-html.mjs
 *
 * The script reads docs/template.html, converts every .md file referenced by
 * docs/index.html, and writes a matching .html file next to the source. It also
 * rewrites the .md links in docs/index.html to point to the generated .html
 * files so the site stays self-contained.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_ROOT = __dirname;

const TEMPLATE_PATH = path.join(DOCS_ROOT, 'template.html');
const INDEX_PATH = path.join(DOCS_ROOT, 'index.html');
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');

function findMdFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'wiki') {
      results = results.concat(findMdFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relPath = path.relative(DOCS_ROOT, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

const uniqueMdLinks = findMdFiles(DOCS_ROOT);
const mdLinkPattern = /href="(\.{0,2}\/[^"]*\.md)"/g;

function extractFirstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Documentation';
}

function extractSubtitle(markdown) {
  const firstPara = markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n\n')
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith('#') && !p.startsWith('---'));
  if (!firstPara) return '';
  const plain = firstPara
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/`/g, '')
    .split('.')[0];
  return plain.length > 120 ? plain.slice(0, 117) + '...' : plain;
}

function mdToHtmlPath(mdHref) {
  return mdHref.replace(/\.md$/, '.html');
}

function relativeDepth(outputDir) {
  const rel = path.relative(DOCS_ROOT, outputDir);
  if (!rel) return './';
  const parts = rel.split(/[\\/]/).filter(Boolean);
  return parts.map(() => '../').join('') || './';
}

function renderPage(mdPath, outputDir) {
  const markdown = fs.readFileSync(mdPath, 'utf8');
  const heading = extractFirstHeading(markdown);
  const subtitle = extractSubtitle(markdown);


  // Remove the first H1; it is already rendered in the page header.
  const bodyMarkdown = markdown.replace(/^#\s+.+$/m, '').trim();

  const contentHtml = marked.parse(bodyMarkdown, {
    headerIds: true,
    mangle: false,
  });

  const root = relativeDepth(outputDir);
  const cssPath = root;

  const title = heading.replace(/\s*\|.*$/, '').trim();

  let html = template
    .replace(/\{\{TITLE\}\}/g, title)
    .replace(/\{\{HEADING\}\}/g, heading)
    .replace(/\{\{SUBTITLE\}\}/g, subtitle)
    .replace(/\{\{CONTENT\}\}/g, contentHtml)
    .replace(/\{\{ROOT\}\}/g, root)
    .replace(/\{\{CSS_PATH\}\}/g, cssPath);

  // Rewrite internal .md links inside generated HTML content so they point to
  // the generated .html versions.
  html = html.replace(mdLinkPattern, (match, href) => {
    if (href.startsWith('http')) return match;
    return `href="${mdToHtmlPath(href)}"`;
  });

  return html;
}

function convertFile(mdHref) {
  const mdPath = path.join(DOCS_ROOT, mdHref);
  if (!fs.existsSync(mdPath)) {
    console.warn(`[build-html] missing source: ${mdHref}`);
    return;
  }

  const outputDir = path.dirname(mdPath);
  const baseName = path.basename(mdHref, '.md') + '.html';
  const outputPath = path.join(outputDir, baseName);

  const html = renderPage(mdPath, outputDir);
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`[build-html] ${mdHref} → ${path.relative(DOCS_ROOT, outputPath)}`);
}

// Convert every linked markdown file.
for (const mdHref of uniqueMdLinks) {
  convertFile(mdHref);
}

// Update index.html so its .md links point to generated HTML pages.
let updatedIndex = indexHtml;
updatedIndex = updatedIndex.replace(mdLinkPattern, (match, href) => {
  return `href="${mdToHtmlPath(href)}"`;
});

if (updatedIndex !== indexHtml) {
  fs.writeFileSync(INDEX_PATH, updatedIndex, 'utf8');
  console.log('[build-html] updated docs/index.html links to .html');
} else {
  console.log('[build-html] no index.html link updates needed');
}
