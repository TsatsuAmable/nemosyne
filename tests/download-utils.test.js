// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { downloadDataUrl, downloadText } from '../src/utils/Download.js';

describe('downloadDataUrl', () => {
  let clickedAnchors;

  beforeEach(() => {
    clickedAnchors = [];
    // Capture clicks on anchors created by the helper.
    document.addEventListener(
      'click',
      (e) => {
        if (e.target.tagName === 'A' && e.target.download) {
          clickedAnchors.push(e.target);
        }
      },
      true
    );
  });

  afterEach(() => {
    clickedAnchors = [];
  });

  it('creates an anchor with href and download attributes', async () => {
    await downloadDataUrl('data:image/png;base64,abc', 'screenshot.png');

    expect(clickedAnchors.length).toBe(1);
    expect(clickedAnchors[0].href).toContain('data:image/png;base64,abc');
    expect(clickedAnchors[0].download).toBe('screenshot.png');
  });

  it('removes the anchor after clicking', async () => {
    const before = document.body.children.length;
    await downloadDataUrl('data:text/plain;base64,eHl6', 'file.txt');
    const after = document.body.children.length;

    expect(after).toBe(before);
  });

  it('rejects outside a DOM environment', async () => {
    const originalDocument = globalThis.document;
    globalThis.document = undefined;
    try {
      await expect(downloadDataUrl('data:,x', 'x.txt')).rejects.toThrow(/DOM environment/);
    } finally {
      globalThis.document = originalDocument;
    }
  });
});

describe('downloadText', () => {
  it('creates a blob and triggers a download', async () => {
    let capturedHref;
    let capturedDownload;

    document.addEventListener(
      'click',
      (e) => {
        if (e.target.tagName === 'A') {
          capturedHref = e.target.href;
          capturedDownload = e.target.download;
        }
      },
      true
    );

    await downloadText('{"a":1}', 'story.json', 'application/json');

    expect(capturedDownload).toBe('story.json');
    expect(capturedHref).toContain('blob:');
  });
});
