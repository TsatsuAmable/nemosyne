/**
 * RFC 0009: presentation of a governed replay outcome.
 *
 * Three analyst surfaces used to derive their status line from `success` and
 * `discrepancies` alone. That cannot distinguish a legacy package from a V3
 * package whose evidence envelope was verified, and cannot distinguish a
 * build-capability refusal from archive corruption. Centralised here so the
 * surfaces cannot drift into claiming different things about the same run.
 *
 * The third of those surfaces is why this file exists in the shape it does.
 * `InvestigationContinuityController` already imported the real
 * `ReplayVerificationResult` type, so widening it made the compiler check that
 * surface and it *still* ignored `evidence`: a type can force a producer to
 * populate a field, never a consumer to read one. Type-widening is not the
 * enforcement mechanism for this property — mounting the surface is.
 */
import type {
  ReplayEvidenceRefusalCode,
  ReplayVerificationResult,
} from '../../session/InvestigationReplayRunner.ts';

/**
 * What a typed refusal actually claims.
 *
 * These are deliberately *not* worded as corruption. A refusal with no
 * discrepancy text previously fell through to "integrity mismatch", which would
 * send an analyst looking for damaged bytes that the loader had already ruled
 * out — in the `uses` case, after verifying the envelope's integrity outright.
 *
 * Each string has to be true for *every* loader status mapped to its code, which
 * is what makes the consumer-policy pair worded as broadly as they are. Two codes
 * cover five binder outcomes, and a string that names one outcome's cause is
 * false for the others: `CONSUMER_POLICY_REFUSED` covers a profile-identity
 * disagreement, a required profile this build cannot mint, and evidence that does
 * not resolve — and the first of those never evaluates the receipt at all, so a
 * claim about the *evidence* would send an analyst to amend data when the profile
 * id is what disagrees. Naming the cause is the refusal's job at the code level;
 * naming the disagreement is this string's.
 */
const REFUSAL_CLAIM: Record<ReplayEvidenceRefusalCode, string> = {
  CONSUMER_NOT_GOVERNED:
    'the package and this build’s governing policy cannot resolve to the same governed ' +
    'consumer set, so replay refuses it rather than open it without that policy',
  CONSUMER_POLICY_REFUSED:
    'the package records a use of a consumer this build governs, but one that does not ' +
    'satisfy this build’s policy, so replay refuses it rather than open it on weaker terms',
  DATASET_MISMATCH:
    'the reconstructed dataset is not the dataset the governed evidence commits to',
  KERNEL_MISMATCH:
    'the replay kernel is not the kernel the governed evidence commits to',
  INVESTIGATION_DIGEST_MISMATCH:
    'the restored investigation is not the investigation the governed evidence commits to',
};

/**
 * The reason text for a failed replay: the typed refusal, then any discrepancy
 * the loader recorded alongside it.
 *
 * The refusal is preferred because it is the *classification* the loader
 * reached, and the generic "integrity mismatch" wording it used to fall through
 * to would send an analyst looking for damaged bytes that the loader had already
 * ruled out. The discrepancy text is appended rather than dropped because for a
 * reconstruction disagreement it carries the two concrete values that disagree —
 * the declared identity and the reconstructed one — which is what an analyst
 * actually needs in order to tell which side is wrong.
 *
 * Only the consumer-policy refusals leave `discrepancies` empty; they are
 * limits or disagreements of *this build's policy* with nothing in the archive to
 * compare against, and they are the refusals that must not be conflated with
 * malformed input.
 *
 * A verified envelope with *no* refusal is also a real shape — a damaged dataset
 * or command-log entry fails with `integrity: 'verified'` and a discrepancy — so
 * the absence of a refusal is not treated as the absence of a reason.
 */
export function replayFailureDetail(result: ReplayVerificationResult): string {
  const refusal =
    result.evidence.envelope === 'present' && result.evidence.integrity === 'verified'
      ? result.evidence.refusal?.code
      : undefined;
  const detail = result.discrepancies.join('; ');
  if (refusal === undefined) return detail;
  const claim = REFUSAL_CLAIM[refusal];
  return detail === '' ? claim : `${claim} (${detail})`;
}

/**
 * The status line for a successful replay.
 *
 * A legacy package carries no governed envelope, so "verified" is the whole
 * claim and a caveat would be noise. A present, verified envelope reports what
 * the run actually enforced against the persisted uses: since the registry's
 * first entry landed (RFC 0009 tranche 3 slice 2), a verifying run binds the
 * uses under the authority-owned consumer policy and says so; an authority that
 * still governs no consumer would report that nothing was enforced. Reading the
 * attestation's `enforcement` axis here — rather than deriving the wording from
 * the registry — is what keeps this string and the loader from ever disagreeing
 * about the same run.
 *
 * "Put the package under the policy" and "no consumer policy enforced" remain
 * two different claims and both remain reachable: the policy decides what the
 * uses must satisfy, and a run only enforces requirements the policy actually
 * attaches to a consumer.
 */
export function replayVerifiedMessage(result: ReplayVerificationResult): string {
  const base = `Replay verified (${result.eventsMatched} events)`;
  if (result.evidence.envelope === 'absent') return base;
  if (result.evidence.integrity !== 'verified') {
    return `${base} · governed evidence integrity not established`;
  }
  return result.evidence.enforcement === 'consumer-policy'
    ? `${base} · governed evidence verified under the consumer policy`
    : `${base} · governed evidence verified, no consumer policy enforced`;
}
