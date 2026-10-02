import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { governedConsumerPolicyV1 } from '../src/data/evidence/ConsumerPolicyRegistry.ts';
import {
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
} from '../src/data/evidence/GovernedConsumerAttestation.ts';

/**
 * RFC 0009 tranche 3 — the governing policy the governed loader enforces, plus
 * the source-level guards the policy's consumers cannot test behaviourally.
 *
 * `bindConsumerUsesV1`'s own contract is pinned in `tec1-consumer-policy.test.ts`,
 * and the loader's acceptance boundary in `tec1-f1-governed-replay.test.ts` and
 * `tec1-v3-package.test.ts`. Since slice 2, the shipped registry governs one
 * consumer, so the loader's refusal is no longer extensionally identical to the
 * `envelope.uses.length > 0` branch it replaced — that equivalence held only
 * while the registry was empty, and slice 1's form of this file pinned exactly
 * that emptiness. Widening those assertions is what slice 2 owed them; the
 * surviving invariants (snapshot hand-out, the loader consulting the registry)
 * are unchanged.
 */

const RUNNER = new URL('../src/session/InvestigationReplayRunner.ts', import.meta.url);
const SESSION = new URL('../src/session/NemosyneSession.ts', import.meta.url);

describe('the authority-owned consumer policy this build ships', () => {
  it('governs exactly the descriptive-statistics consumer under the descriptive profile', () => {
    // First entry, landed with the RFC 0009 slice-2 producer. The consumer id is
    // the kernel-issued identity the governed attestation mints (its TS mirror is
    // pinned against the kernel in the wasm lane), and the profile is the
    // authority-owned one the composition mints uses under. Widened honestly
    // from its slice-1 form, which asserted the registry was empty while no
    // producer existed; that producer now exists, so the emptiness assertion's
    // premise is gone and its surviving intent — the registry is not caller-
    // extensible and governs nothing by accident — is what remains.
    const policy = governedConsumerPolicyV1();
    expect(policy.size).toBe(1);
    expect(
      policy.get(DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1),
    ).toBe('descriptive-summary/v1');
  });

  it('hands out a snapshot, so no caller can add an entry to the authority', () => {
    // `Object.freeze` does not make a `Map` immutable and a `ReadonlyMap`
    // annotation is erased at runtime, so "the policy is owned here and nowhere
    // else" has to be a property of what is handed out. Without this, any module
    // could call the accessor and authorize an archive's invented consumer —
    // exactly what RFC 0009 forbids.
    const handed = governedConsumerPolicyV1() as Map<string, string>;
    handed.set('semantic-node:1', 'descriptive-summary/v1');

    expect(governedConsumerPolicyV1().size).toBe(1);
    expect(governedConsumerPolicyV1().has('semantic-node:1')).toBe(false);
  });

  it('is consulted by the loader rather than answered beside it', () => {
    // A source guard, and the weakest kind: it would not catch a loader that
    // imported the module and ignored it. It is not standing in for a missing
    // behavioural falsifier — that lives in
    // `tec1-consumer-policy-loader-decision.test.ts`, which substitutes the
    // registry and shows the loader's decision flipping with the policy alone.
    // What this catches is the regression that substitution cannot: the seam
    // reverted outright — the loader dropping the import and re-growing the
    // removed literal.
    const source = readFileSync(RUNNER, 'utf8');

    expect(source).toContain('governedConsumerPolicyV1');
    expect(source).not.toContain('uses-not-governable-by-this-build');
  });

  it('refuses at export a use no governed path authored', () => {
    // RFC 0009 tranche 3 slice 2's producer-side counterpart of the loader seam:
    // the session lifts its slice-1 refusal (`uses.length !== 0`) and replaces it
    // with the same policy test the loader applies, so export refuses an envelope
    // it is about to write that its own replay loader would refuse. This guard
    // pins that the replacement reads the living registry inside the session —
    // not a literal, not a re-derived allowlist — so a registry change is
    // honoured by the producer, not only by the loader.
    const source = readFileSync(SESSION, 'utf8');

    expect(source).toContain('governedConsumerPolicyV1()');
    expect(source).not.toContain('uses.length !== 0');
  });
});

describe('governed consumer identity provenance guards', () => {
  it('derives no consumerId from a column or claim name anywhere in src', () => {
    // RFC 0009 requirement: consumer identity is kernel-issued, never invented
    // at a call site. `descriptive:x` and friends are *receipt* ids the kernel
    // already mints from column names; only the kernel (wasm/src) turns claim
    // ids into consumer ids, and the TS side must only reference the pinned
    // constant or a parsed attestation field. This guard fails the moment a
    // producer path concatenates, templates or derives a `consumerId` locally
    // instead of copying one from kernel-issued bytes or the authority constant.
    const files = [
      '../src/atlas/MonetaEvidenceAuthority.ts',
      '../src/atlas/ports/InlineAnalyticalPort.ts',
      '../src/atlas/ports/analytical.worker.ts',
      '../src/atlas/adapters/AnalyticalKernelPort.ts',
      '../src/data/evidence/GovernedConsumerAttestation.ts',
      '../src/data/evidence/ConsumerPolicyRegistry.ts',
      '../src/session/NemosyneSession.ts',
      '../src/session/InvestigationReplayRunner.ts',
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      // No template literal or string concatenation ever *produces* a
      // consumerId: a `consumerId:` target may only be a local name (parsed
      // attestation field, policy map entry, use record) or a plain local
      // variable, never a value assembled from column/claim names. Interpolated
      // or concatenated strings are exactly how a column name would leak into
      // consumer identity, so either pattern here is a refusal-worthy drift.
      const suspicious =
        /consumerId\s*[:=]\s*`/.test(source) ||
        /consumerId\s*[:=]\s*(['"])[^'"]*\1\s*\+/.test(source);
      expect(
        suspicious,
        `${file} derives a consumerId locally; consumer identity is kernel-issued only`,
      ).toBe(false);
    }
  });

  it('keeps the producer reads on the governance allowlist', () => {
    // The ast-grep rule `no-module-global-evidence-producer-read.yml` governs
    // where a module-global producer route may be read. Instead of restating the
    // rule's allowlist (which would drift from it), this guard pins the rule
    // still names its three production readers, so removing a file from the
    // allowlist — or adding a fourth route — is a deliberate, reviewed edit that
    // this line observes, not a quiet one.
    const rule = readFileSync(
      new URL(
        '../tools/architecture-policy/rules/no-module-global-evidence-producer-read.yml',
        import.meta.url,
      ),
      'utf8',
    );
    for (const reader of [
      'src/atlas/MonetaEvidenceAuthority.ts',
      'src/atlas/ports/InlineAnalyticalPort.ts',
      'src/atlas/ports/analytical.worker.ts',
    ]) {
      expect(rule).toContain(reader);
    }
  });

  it('leaves the empty-uses literal off every governed producer path', () => {
    // `uses: []` in TS source minted a serialized assertion-shape; the producer
    // must always mint the uses from the kernel attestation. Grep the governed
    // envelope producer paths in code (comments stripped, where the rule itself
    // may be *documented*): the only permitted literal empties are on legacy
    // parse/compat surfaces, which never write V3.
    const files = [
      '../src/atlas/MonetaEvidenceAuthority.ts',
      '../src/atlas/ports/InlineAnalyticalPort.ts',
      '../src/atlas/ports/analytical.worker.ts',
      '../src/atlas/AtlasCore.ts',
    ];
    const stripComments = (source: string) =>
      source
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');
    for (const file of files) {
      const source = stripComments(readFileSync(new URL(file, import.meta.url), 'utf8'));
      expect(
        /uses\s*:\s*\[\]/.test(source),
        `${file} writes a literal empty uses array; governed uses must be minted from the kernel attestation`,
      ).toBe(false);
    }
  });
});