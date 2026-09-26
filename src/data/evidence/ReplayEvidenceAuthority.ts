/**
 * TEC1 governed replay resolver (RFC 0007 "Persistence and replay";
 * ADR-0007 consequence 9).
 *
 * RFC 0007 requires that replay pin dataset fingerprint, kernel version and
 * receipt identity, that a serialized receipt bundle never recreate a live
 * resolver capability merely by being parsed, and that a governed replay
 * loader verify the persisted evidence integrity and exact identity before
 * minting a replay resolver. Historical evidence must resolve under the
 * contract that governed it when it was issued — never silently under
 * today's kernel, dataset or requirement policy.
 *
 * This module is that replay authority. It deliberately reuses the one
 * existing evidence contract — `parseEvidenceReceiptBundleV1` for closed
 * structural integrity validation, the module-private requirement-profile
 * registry for governance, and `evaluateEvidenceReceiptAgainstProfileV1`
 * for policy evaluation — rather than inventing a parallel framework. The
 * mint below is the only way to obtain this capability, it fails closed on
 * malformed persisted evidence, and minted capabilities are identity-branded
 * so `isGovernedReplayEvidenceReceiptAuthorityV1` can reject fabricated
 * look-alikes at untyped boundaries.
 */
import {
  evidenceRequirementProfileByIdV1,
  evaluateEvidenceReceiptAgainstProfileV1,
  type EvidenceReceiptResolutionV1,
} from './EvidenceRequirementProfile.ts';
import { parseEvidenceReceiptBundleV1, type EvidenceReceiptV1 } from './EvidenceReceipt.ts';

/**
 * The identity of the replay run that wants to consume persisted evidence:
 * the dataset fingerprint and kernel version the replay context presents.
 * The persisted bundle carries its own issuing identity; resolution
 * compares the two and refuses on any disagreement.
 */
export interface GovernedReplayEvidenceContextV1 {
  readonly datasetFingerprint: string;
  readonly kernelVersion: string;
}

/**
 * Replay-resolution capability over one persisted evidence bundle. Unlike
 * the live resolver, it exposes no ungoverned `resolve` lookup: every
 * resolution names the requirement-profile identity that governs it, so a
 * historical receipt can never be consumed without an explicit, resolvable
 * governing contract. Inspecting the parsed bundle directly remains
 * possible because it is evidence data, not a capability.
 */
export interface GovernedReplayEvidenceReceiptAuthorityV1 {
  /** Issuing identity of the persisted bundle: the governing contract. */
  readonly governingDatasetFingerprint: string;
  readonly governingKernelVersion: string;
  /** Identity of the replay run the authority was minted against. */
  readonly replayDatasetFingerprint: string;
  readonly replayKernelVersion: string;
  readonly receiptIds: readonly string[];
  /**
   * Resolve one persisted receipt under an explicit requirement-profile
   * identity. The check order is fixed so refusals are deterministic:
   * governing dataset identity, then kernel identity, then profile-identity
   * resolution, then receipt existence and profile evaluation. An identity
   * the closed registry does not mint produces
   * `UNKNOWN_REQUIREMENT_PROFILE` — never a fallback to a current default
   * profile, which would silently re-judge historical evidence under
   * today's policy.
   */
  resolveAgainst(profileId: string, receiptId: string): EvidenceReceiptResolutionV1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Identity registry of minted replay authorities. Membership is checked by
 * object identity, exactly like the requirement-profile registry: a
 * structurally identical look-alike crossing an untyped boundary is not a
 * capability. Consumers receiving a replay authority from elsewhere can
 * authenticate it with `isGovernedReplayEvidenceReceiptAuthorityV1` before
 * trusting its resolutions.
 */
const mintedReplayAuthorities = new WeakSet<object>();

/**
 * Runtime guard for replay-authority ownership. Returns true only for
 * capabilities actually minted by `governedReplayEvidenceReceiptAuthority`;
 * a fabricated `{ resolveAgainst: ... }` look-alike fails it.
 */
export function isGovernedReplayEvidenceReceiptAuthorityV1(
  value: unknown,
): value is GovernedReplayEvidenceReceiptAuthorityV1 {
  return isRecord(value) && mintedReplayAuthorities.has(value);
}

/**
 * Render a caller-supplied identity argument as a bounded string for typed
 * refusals. Typed refusal fields are declared `string`; embedding a raw
 * caller object, symbol or BigInt would leak untrusted structure into
 * telemetry, and a value whose coercion throws must still produce the
 * typed refusal rather than propagating a caller exception.
 */
function callerIdentity(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return String(value);
  } catch {
    return '[unstringifiable]';
  }
}

function parseReplayContext(value: unknown): GovernedReplayEvidenceContextV1 {
  if (!isRecord(value)) {
    throw new Error('[ReplayEvidenceAuthority] replay context must be an object');
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || keys.some((key) => key !== 'datasetFingerprint' && key !== 'kernelVersion')) {
    throw new Error(
      "[ReplayEvidenceAuthority] replay context must have exactly 'datasetFingerprint' and 'kernelVersion'",
    );
  }
  for (const key of ['datasetFingerprint', 'kernelVersion'] as const) {
    if (typeof value[key] !== 'string' || (value[key] as string).length === 0) {
      throw new Error(`[ReplayEvidenceAuthority] replay context '${key}' must be a non-empty string`);
    }
  }
  // Snapshot into frozen primitives: the minted capability stays bound to
  // the identity observed at minting, exactly like the live resolver. A
  // caller who later mutates (or proxied) the context object cannot make
  // the capability re-read a different identity, and the exposed metadata
  // cannot diverge from what resolution actually enforces.
  return Object.freeze({
    datasetFingerprint: value.datasetFingerprint as string,
    kernelVersion: value.kernelVersion as string,
  });
}

/**
 * Mint the governed replay resolver for one persisted evidence bundle.
 *
 * Structural integrity is verified before minting: a malformed, duplicate,
 * provenance-inconsistent or future-versioned bundle cannot mint at all.
 * The replay context must be explicit and well-formed — an unidentifiable
 * replay context cannot govern anything. Identity *disagreement* between
 * the persisted bundle and the replay context is deliberately a typed
 * resolution refusal (`DATASET_MISMATCH` / `KERNEL_MISMATCH`) rather than
 * a mint failure, so replay can record the governed refusal and fail
 * closed at the dependent operation instead of crashing or substituting a
 * newer claim.
 */
export function governedReplayEvidenceReceiptAuthority(
  bundlePayload: unknown,
  replayContext: GovernedReplayEvidenceContextV1,
): GovernedReplayEvidenceReceiptAuthorityV1 {
  const context = parseReplayContext(replayContext);
  const bundle = parseEvidenceReceiptBundleV1(bundlePayload);

  const byId = new Map(bundle.receipts.map((receipt) => [receipt.receiptId, receipt] as const));
  const receiptIds = Object.freeze([...byId.keys()]);

  const authority: GovernedReplayEvidenceReceiptAuthorityV1 = {
    governingDatasetFingerprint: bundle.datasetFingerprint,
    governingKernelVersion: bundle.kernelVersion,
    replayDatasetFingerprint: context.datasetFingerprint,
    replayKernelVersion: context.kernelVersion,
    receiptIds,
    resolveAgainst(profileId: string, receiptId: string): EvidenceReceiptResolutionV1 {
      // Refusal fields are typed strings; never embed raw caller values.
      const requestedProfileId = callerIdentity(profileId);
      const requestedReceiptId = callerIdentity(receiptId);
      // Governing identity first, mirroring the live resolver's identity-
      // first ordering: a bundle that does not govern this replay context
      // cannot resolve anything, under any profile.
      if (bundle.datasetFingerprint !== context.datasetFingerprint) {
        return Object.freeze({
          status: 'DATASET_MISMATCH',
          receiptId: requestedReceiptId,
          expectedDatasetFingerprint: bundle.datasetFingerprint,
          observedDatasetFingerprint: context.datasetFingerprint,
        });
      }
      if (bundle.kernelVersion !== context.kernelVersion) {
        return Object.freeze({
          status: 'KERNEL_MISMATCH',
          receiptId: requestedReceiptId,
          expectedKernelVersion: bundle.kernelVersion,
          observedKernelVersion: context.kernelVersion,
        });
      }
      // Profile governance: the identity must resolve in the closed
      // registry. Anything else — retired, tampered, misspelled, or a
      // caller hoping today's default applies — fails closed here.
      const profile = evidenceRequirementProfileByIdV1(requestedProfileId);
      if (!profile) {
        return Object.freeze({
          status: 'UNKNOWN_REQUIREMENT_PROFILE',
          receiptId: requestedReceiptId,
          profileId: requestedProfileId,
        });
      }
      const receipt: EvidenceReceiptV1 | null =
        requestedReceiptId.length > 0 ? (byId.get(requestedReceiptId) ?? null) : null;
      // Single evaluation authority: existence, assumptions and axes are
      // judged by the same evaluator the live resolver uses.
      return evaluateEvidenceReceiptAgainstProfileV1(profile, requestedReceiptId, receipt);
    },
  };
  mintedReplayAuthorities.add(authority);
  return Object.freeze(authority);
}
