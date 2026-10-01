import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { governedConsumerPolicyV1 } from '../src/data/evidence/ConsumerPolicyRegistry.ts';

/**
 * RFC 0009 tranche 3 — the governing policy the governed loader enforces.
 *
 * `bindConsumerUsesV1`'s own contract is pinned in `tec1-consumer-policy.test.ts`,
 * and the loader's acceptance boundary in `tec1-f1-governed-replay.test.ts` and
 * `tec1-v3-package.test.ts`. What none of those can falsify is the *wiring*: this
 * build's policy governs no consumer, and while that is true the loader's refusal
 * is extensionally identical to the `envelope.uses.length > 0` branch it replaced.
 * No archive can tell the two apart, because both refuse every archive this build
 * can mint or read. So the properties that keep the seam from silently reverting
 * are asserted here, and the one that cannot be asserted behaviourally is asserted
 * against the loader's source with its weakness stated.
 */

const RUNNER = new URL('../src/session/InvestigationReplayRunner.ts', import.meta.url);

describe('the authority-owned consumer policy this build ships', () => {
  it('governs no consumer', () => {
    // Not a placeholder. A conforming use needs a producer that knows which
    // consumer consumes which receipt under which profile, and this build has
    // none — governed export refuses to write a non-empty `uses`
    // (`NemosyneSession.ts:311-317`) — so the first entry would make every
    // package this build exports unreplayable by it. Entries arrive with the
    // slice that also gives a producer the ability to mint conforming uses.
    //
    // This assertion is also the coupling that keeps `enforcement: 'none'`
    // honest: an entry landing here without reopening that union turns a true
    // attestation into a false one, and this line — together with the same
    // assertion beside the literal in `tec1-f1-governed-replay.test.ts` — is what
    // fails first.
    expect(governedConsumerPolicyV1().size).toBe(0);
  });

  it('hands out a snapshot, so no caller can add an entry to the authority', () => {
    // `Object.freeze` does not make a `Map` immutable and a `ReadonlyMap`
    // annotation is erased at runtime, so "the policy is owned here and nowhere
    // else" has to be a property of what is handed out. Without this, any module
    // could call the accessor and authorize an archive's invented consumer —
    // exactly what RFC 0009 forbids.
    const handed = governedConsumerPolicyV1() as Map<string, string>;
    handed.set('semantic-node:1', 'descriptive-summary/v1');

    expect(governedConsumerPolicyV1().size).toBe(0);
    expect(governedConsumerPolicyV1().has('semantic-node:1')).toBe(false);
  });

  it('is consulted by the loader rather than answered beside it', () => {
    // Weakest assertion in this file, deliberately, and the reason is the point
    // of the slice. While the policy governs nothing, "the loader binds against
    // the registry" and "the loader kept the hard-coded build-capability branch"
    // produce identical results for every input either can be given, so there is
    // no behavioural falsifier to write. A source guard is what is left: it
    // catches the specific regression of the seam being reverted — the loader
    // dropping the import and re-growing the removed literal — and it would not
    // catch a loader that imported the module and ignored it. The coupling
    // assertions above are what make that second case fail loudly the moment the
    // registry stops being empty.
    const source = readFileSync(RUNNER, 'utf8');

    expect(source).toContain('governedConsumerPolicyV1');
    expect(source).not.toContain('uses-not-governable-by-this-build');
  });
});
