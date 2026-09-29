/**
 * RFC 0009 tranche 3 (F1) falsifying evidence: the surfacing layer.
 *
 * F1 makes a governed envelope reachable at all, which makes the analyst-facing
 * status line load-bearing: it is the only place a reader is told what a
 * "verified" replay actually stood on. These falsifiers pin that claim.
 */
import { describe, expect, it } from 'vitest';
import {
  replayFailureDetail,
  replayVerifiedMessage,
} from '../src/app/investigation/replayAttestationText.ts';
import { replayResultDouble } from './helpers/replayResult.ts';

describe('F1 falsifier 10: the surfacing layer cannot overclaim what was enforced', () => {
  it('states the whole claim for a legacy package and no more', () => {
    const message = replayVerifiedMessage(
      replayResultDouble({ eventsMatched: 4, evidence: { envelope: 'absent' } }),
    );

    // No envelope exists, so there is no caveat to make and inventing one would
    // train readers to ignore the caveat where it does matter.
    expect(message).toBe('Replay verified (4 events)');
  });

  it('never renders a governed envelope as a bare verified', () => {
    const message = replayVerifiedMessage(
      replayResultDouble({
        eventsMatched: 4,
        evidence: { envelope: 'present', integrity: 'verified', enforcement: 'none' },
      }),
    );

    // A reader who sees only "Replay verified" infers the investigation's
    // claims were checked against the consumers that require them. This build
    // checks none of them, and this string is the only place that is said.
    expect(message).not.toBe('Replay verified (4 events)');
    expect(message).toContain('no consumer policy enforced');
  });

  it('does not claim verification when integrity was not established', () => {
    const message = replayVerifiedMessage(
      replayResultDouble({
        eventsMatched: 4,
        evidence: { envelope: 'present', integrity: 'not-established' },
      }),
    );

    expect(message).toContain('not established');
    expect(message).not.toContain('governed evidence verified,');
  });

  it('explains a typed refusal instead of blaming corrupted bytes', () => {
    for (const code of [
      'uses-not-governable-by-this-build',
      'DATASET_MISMATCH',
      'KERNEL_MISMATCH',
    ] as const) {
      const detail = replayFailureDetail(
        replayResultDouble({
          success: false,
          evidence: {
            envelope: 'present',
            integrity: 'verified',
            enforcement: 'none',
            refusal: { code },
          },
        }),
      );

      // The loader leaves `discrepancies` empty for a typed refusal, so the old
      // `discrepancies.join('; ')` path fell through to "integrity mismatch" —
      // telling an analyst to hunt for damage the loader had already excluded.
      expect(detail).not.toBe('');
      expect(detail).not.toMatch(/integrity mismatch/i);
      expect(detail).toMatch(/not the dataset|not the kernel|cannot resolve/);
    }
  });

  it('keeps each refusal distinguishable from the others', () => {
    const claims = (
      ['uses-not-governable-by-this-build', 'DATASET_MISMATCH', 'KERNEL_MISMATCH'] as const
    ).map((code) =>
      replayFailureDetail(
        replayResultDouble({
          success: false,
          evidence: {
            envelope: 'present',
            integrity: 'verified',
            enforcement: 'none',
            refusal: { code },
          },
        }),
      ),
    );

    expect(new Set(claims).size).toBe(claims.length);
  });

  it('still reports ordinary discrepancies when there is no typed refusal', () => {
    const detail = replayFailureDetail(
      replayResultDouble({
        success: false,
        discrepancies: ['Kernel version mismatch', 'Digest mismatch'],
      }),
    );

    expect(detail).toBe('Kernel version mismatch; Digest mismatch');
  });
});
