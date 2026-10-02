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

/**
 * Every refusal code the loader can produce. The exhaustive guarantee is the
 * `Record<ReplayEvidenceRefusalCode, string>` that `REFUSAL_CLAIM` is declared
 * as — adding a code there without wording it is a compile error — so this list
 * only has to stay in step with it, and these cases are what notice when it
 * doesn't.
 */
const ALL_REFUSAL_CODES = [
  'CONSUMER_NOT_GOVERNED',
  'CONSUMER_POLICY_REFUSED',
  'DATASET_MISMATCH',
  'KERNEL_MISMATCH',
  'INVESTIGATION_DIGEST_MISMATCH',
] as const;

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
    // claims were checked against the consumers that require them. This run
    // enforced none, and this string is the only place that is said.
    expect(message).not.toBe('Replay verified (4 events)');
    expect(message).toContain('no consumer policy enforced');
  });

  it('reports when the run actually applied the consumer policy', () => {
    // Widened alongside the enforcement union (RFC 0009 tranche 3 slice 2):
    // since the registry governs a consumer, a verifying run binds the persisted
    // uses and this surface must say so — the slice-1 wording ("no consumer
    // policy enforced") would now be the overclaim on the happy path rather
    // than the honest caveat on the empty-policy one, and both must stay worded
    // apart so a reader can never read the policy-applied run as checked-nothing.
    const message = replayVerifiedMessage(
      replayResultDouble({
        eventsMatched: 4,
        evidence: { envelope: 'present', integrity: 'verified', enforcement: 'consumer-policy' },
      }),
    );

    expect(message).toContain('governed evidence verified under the consumer policy');
    expect(message).not.toContain('no consumer policy enforced');
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
    for (const code of ALL_REFUSAL_CODES) {
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

      // The loader leaves `discrepancies` empty for both consumer-policy
      // refusals, so the old `discrepancies.join('; ')` path fell through to
      // "integrity mismatch" — telling an analyst to hunt for damage the loader
      // had already excluded. The enumerated framings are the specific
      // explanations a refusal is allowed to give, and the consumer-policy pair
      // states its own reason rather than borrowing one of the three mismatch
      // clauses: what they report is a limit or disagreement of *this build's
      // policy*, not a disagreement with the replay the archive was checked
      // against. The allowlist is deliberately a list of framings rather than of
      // codes — each code may word its claim however stays true for every loader
      // status it covers, and this asserts only that it is explained as something
      // other than damage.
      expect(detail).not.toBe('');
      expect(detail).not.toMatch(/integrity mismatch/i);
      expect(detail).toMatch(
        /not the dataset|not the kernel|not the investigation|cannot resolve|does not satisfy this build/,
      );
    }
  });

  it('keeps each refusal distinguishable from the others', () => {
    const claims = ALL_REFUSAL_CODES.map((code) =>
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

  it('keeps the corroborating discrepancy alongside the refusal claim', () => {
    // The composition is the point of the fix and is asserted *with* a
    // discrepancy present: every other case in this file supplies an empty
    // `discrepancies`, so all of them would still pass if the append were
    // reverted to `return claim`.
    const detail = replayFailureDetail(
      replayResultDouble({
        success: false,
        discrepancies: [
          "Dataset fingerprint mismatch: package manifest has 'aaa', dataset computed 'bbb'",
        ],
        evidence: {
          envelope: 'present',
          integrity: 'verified',
          enforcement: 'none',
          refusal: { code: 'DATASET_MISMATCH' },
        },
      }),
    );

    expect(detail).toBe(
      'the reconstructed dataset is not the dataset the governed evidence commits to ' +
        "(Dataset fingerprint mismatch: package manifest has 'aaa', dataset computed 'bbb')",
    );
  });

  it('reports a damaged payload as a discrepancy, not as an unverified envelope', () => {
    // A verified envelope with no refusal is a real shape: the evidence entry
    // checked out and a *later* entry did not parse. The reason has to survive
    // — treating "no refusal" as "no reason" would render an empty string.
    const detail = replayFailureDetail(
      replayResultDouble({
        success: false,
        discrepancies: ['Failed to parse command log: Unexpected token'],
        evidence: { envelope: 'present', integrity: 'verified', enforcement: 'none' },
      }),
    );

    expect(detail).toBe('Failed to parse command log: Unexpected token');
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
