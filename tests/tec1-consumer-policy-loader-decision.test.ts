/**
 * RFC 0009 tranche 3 slice 1+2 — the loader's decision is a function of the policy.
 *
 * The loader refuses what the *substituted* policy refuses: this file replaces the
 * registry wholesale, so every binder outcome below is reachable in a way it is
 * not against the shipped registry (which governs exactly one consumer, the
 * descriptive-statistics one slice 2 added). The two are distinguished by the
 * *policy*, not by the archive, so substituting it is what makes the decision
 * procedure observable independently of what the shipped registry happens to
 * govern today.
 *
 * Every assertion here is therefore about the loader's decision procedure. None of
 * them claims anything about what the shipped registry governs — that is pinned
 * against the real module elsewhere — and none of them is evidence that a
 * conforming use can be minted or replayed in production; that is the
 * production-path falsifier's job.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { governedPayload, runner, type PersistedUse } from './helpers/f1GovernedArchive.ts';

/**
 * Substituted for the authority, and mutable per case. The accessor still hands
 * out a copy, so the loader under test cannot reach the map this file edits.
 */
const policy = vi.hoisted(() => ({ entries: new Map<string, string>() }));

vi.mock('../src/data/evidence/ConsumerPolicyRegistry.ts', () => ({
  governedConsumerPolicyV1: () => new Map(policy.entries),
}));

const REQUIRED_PROFILE = DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId;

beforeEach(() => {
  policy.entries.clear();
});

function use(overrides: Partial<PersistedUse> = {}): PersistedUse {
  return {
    consumerId: 'governed:consumer',
    receiptId: 'absent-receipt',
    requirementProfileId: REQUIRED_PROFILE,
    ...overrides,
  };
}

async function refusalCodeFor(uses: readonly PersistedUse[]): Promise<string | undefined> {
  const { evidence } = await runner().replayPayload(governedPayload({ uses }));
  return 'refusal' in evidence ? evidence.refusal?.code : undefined;
}

describe('F1 wiring: the loader refuses what the policy refuses, not what the envelope looks like', () => {
  it('flips on a byte-identical empty-uses archive when only the policy changes', async () => {
    // The distinguisher, and the reason the wiring is falsifiable after all. This
    // is one payload object replayed twice, so the archive is identical across the
    // two runs; the only difference is the registry. Its `uses` array is empty —
    // empty *deliberately* now that the shipped producer mints a conforming use
    // by default, because the distinguisher the slice-1 form measured was a
    // zero-use archive; a minted use would make the empty-policy arm refuse as
    // UNKNOWN_CONSUMER (a different binder outcome) and weaken the point that
    // the wired branch refuses an archive with nothing to bind when the policy
    // names a consumer the archive never addresses (`MISSING_USE`). A loader
    // that imported the registry and ignored it behaves like the first run.
    const payload = governedPayload({ uses: [] });

    const withoutPolicy = await runner().replayPayload(payload);
    // The fixture identity is deliberately unreproducible, so with nothing to
    // refuse at the policy step the run proceeds to step 3 and refuses there. That
    // the refusal is a reconstruction mismatch rather than a policy code *is* the
    // first half of the claim.
    expect(withoutPolicy.evidence).toMatchObject({ refusal: { code: 'DATASET_MISMATCH' } });
    expect(withoutPolicy.discrepancies).not.toEqual([]);

    policy.entries.set('unmentioned:consumer', REQUIRED_PROFILE);
    const withPolicy = await runner().replayPayload(payload);

    expect(withPolicy.evidence).toMatchObject({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'none',
      refusal: { code: 'CONSUMER_NOT_GOVERNED' },
    });
    // A policy refusal leaves nothing to compare, and it is reached before the
    // reconstruction the first run failed in — so the archive never got that far.
    expect(withPolicy.discrepancies).toEqual([]);
  });

  /**
   * Every arm of the binder's refusal set, driven through the loader. These are
   * unreachable against the shipped registry, so this is the only place the
   * classification map is exercised at all: without them, three of its four
   * entries and the bound-but-unresolved branch would be dead code that no test
   * could tell from a wrong mapping.
   */
  const ARMS: ReadonlyArray<{
    name: string;
    governed: ReadonlyArray<readonly [string, string]>;
    uses: readonly PersistedUse[];
    expected: 'CONSUMER_NOT_GOVERNED' | 'CONSUMER_POLICY_REFUSED';
  }> = [
    {
      name: 'a consumer the policy does not govern',
      governed: [['governed:consumer', REQUIRED_PROFILE]],
      uses: [use({ consumerId: 'other:consumer' })],
      expected: 'CONSUMER_NOT_GOVERNED',
    },
    {
      name: 'a governed consumer the archive never names',
      governed: [['unmentioned:consumer', REQUIRED_PROFILE]],
      uses: [],
      expected: 'CONSUMER_NOT_GOVERNED',
    },
    {
      name: 'a governed consumer recorded under a different profile',
      governed: [['governed:consumer', REQUIRED_PROFILE]],
      uses: [use({ requirementProfileId: 'some-other-profile/v1' })],
      expected: 'CONSUMER_POLICY_REFUSED',
    },
    {
      name: 'a governed consumer whose required profile this build cannot mint',
      governed: [['governed:consumer', 'never-minted/v1']],
      uses: [use({ requirementProfileId: 'never-minted/v1' })],
      expected: 'CONSUMER_POLICY_REFUSED',
    },
    {
      name: 'a governed consumer whose receipt is not in the envelope',
      governed: [['governed:consumer', REQUIRED_PROFILE]],
      uses: [use()],
      // The binder returns BOUND here — the identities agree — and the refusal
      // comes from the unresolved receipt it reports alongside. Reaching
      // CONSUMER_POLICY_REFUSED at all is the assertion that the loader refuses
      // bound-but-unresolved uses rather than opening an archive whose required
      // evidence does not resolve.
      expected: 'CONSUMER_POLICY_REFUSED',
    },
  ];

  it.each(ARMS)('refuses $name with $expected', async ({ governed, uses, expected }) => {
    for (const [consumerId, profileId] of governed) {
      policy.entries.set(consumerId, profileId);
    }

    expect(await refusalCodeFor(uses)).toBe(expected);
  });
});
