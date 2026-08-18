// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadDataUrl, downloadText } from '../src/utils/Download.ts';

describe('downloadDataUrl', () => {
  let clickedAnchors: HTMLAnchorElement[];

  beforeEach(() => {
    clickedAnchors = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();
      this.dispatchEvent(event);
    });
    // Capture clicks on anchors created by the helper.
    document.addEventListener(
      'click',
      (e: Event) => {
        const target = e.target as HTMLAnchorElement;
        if (target.tagName === 'A' && target.download) {
          clickedAnchors.push(target);
        }
      },
      true
    );
  });

  afterEach(() => {
    clickedAnchors = [];
    vi.restoreAllMocks();
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
    // @ts-expect-error simulating non-DOM environment
    globalThis.document = undefined;
    try {
      await expect(downloadDataUrl('data:,x', 'x.txt')).rejects.toThrow(/DOM environment/);
    } finally {
      globalThis.document = originalDocument;
    }
  });
});

describe('downloadText', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();
      this.dispatchEvent(event);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob and triggers a download', async () => {
    let capturedHref = '';
    let capturedDownload = '';

    document.addEventListener(
      'click',
      (e: Event) => {
        const target = e.target as HTMLAnchorElement;
        if (target.tagName === 'A') {
          capturedHref = target.href;
          capturedDownload = target.download;
        }
      },
      true
    );

    await downloadText('{"a":1}', 'story.json', 'application/json');

    expect(capturedDownload).toBe('story.json');
    expect(capturedHref).toContain('blob:');
  });
});
