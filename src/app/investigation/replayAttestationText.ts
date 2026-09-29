/**
 * RFC 0009: presentation of a governed replay outcome.
 *
 * Both analyst surfaces used to derive their status line from `success` and
 * `discrepancies` alone. That cannot distinguish a legacy package from a V3
 * package whose evidence envelope was verified, and cannot distinguish a
 * build-capability refusal from archive corruption. Centralised here so the two
 * surfaces cannot drift into claiming different things about the same run.
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
 */
const REFUSAL_CLAIM: Record<ReplayEvidenceRefusalCode, string> = {
  'uses-not-governable-by-this-build':
    'the package requires consumer uses this build cannot resolve, so replay refuses it ' +
    'rather than open it without its governing policy',
  DATASET_MISMATCH:
    'the reconstructed dataset is not the dataset the governed evidence commits to',
  KERNEL_MISMATCH:
    'the replay kernel is not the kernel the governed evidence commits to',
};

/**
 * The reason text for a failed replay, preferring the typed refusal over the
 * discrepancy list. A typed refusal is a statement about this build or about
 * identity agreement, and it is the only detail a refusal carries — the loader
 * deliberately leaves `discrepancies` empty so the two cannot be conflated.
 */
export function replayFailureDetail(result: ReplayVerificationResult): string {
  const refusal =
    result.evidence.envelope === 'present' && result.evidence.integrity === 'verified'
      ? result.evidence.refusal?.code
      : undefined;
  if (refusal !== undefined) return REFUSAL_CLAIM[refusal];
  return result.discrepancies.join('; ');
}

/**
 * The status line for a successful replay.
 *
 * A legacy package carries no governed envelope, so "verified" is the whole
 * claim and a caveat would be noise. A present envelope means the governed
 * evidence commitment was checked — but this build enforces no consumer policy
 * over it (RFC 0009 tranche 3 owns that). Saying only "verified" there would let
 * a reader infer that the investigation's claims were checked against the
 * consumers that require them; they were not, and until that changes this line
 * is the only place an analyst is told so.
 */
export function replayVerifiedMessage(result: ReplayVerificationResult): string {
  const base = `Replay verified (${result.eventsMatched} events)`;
  if (result.evidence.envelope === 'absent') return base;
  return result.evidence.integrity === 'verified'
    ? `${base} · governed evidence verified, no consumer policy enforced`
    : `${base} · governed evidence integrity not established`;
}
