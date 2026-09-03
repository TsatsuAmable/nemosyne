import { describe, expect, it } from 'vitest';
import { sanitizeUxTraceTerminalText } from '../dev/ux-trace-server.ts';

describe('UX trace terminal sanitization', () => {
  it('neutralizes C0, ESC, DEL and C1 controls without altering ordinary text', () => {
    const injected = 'safe\u001b[2J\u0000\u0007\u007f\u0085tail';
    const sanitized = sanitizeUxTraceTerminalText(injected);

    expect(sanitized).toBe('safe\\u001b[2J\\u0000\\u0007\\u007f\\u0085tail');
    expect(sanitized).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
  });

  it('stringifies non-string trace values before sanitizing', () => {
    expect(sanitizeUxTraceTerminalText(42)).toBe('42');
    expect(sanitizeUxTraceTerminalText(null)).toBe('');
  });
});
