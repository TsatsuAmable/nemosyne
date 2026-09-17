# UXR3 Boundedness and Policy-Calibration Adversary

**Date:** 17 September 2026  
**Integration base:** `main@2034c671a436de5478d254057ac3d5f1c691482d`  
**Status:** research finding / implementation falsifier specification

## Finding

The current UXR3 `SemanticMaterialisationGovernor` tranche on PR #763 establishes useful **cardinality** bounds (`maxResident`, `maxQueued`, `maxMaterialisationsPerTick`), but a cardinality bound is not yet a general **resource bound**.

The governor is generic over `T` and stores `Map<string, T>`. Nothing in the governor contract constrains the retained size/cost of one `T`. Therefore a policy such as `maxResident: 64` can still retain an arbitrarily large payload if a caller materialises a large array, object graph, texture-bearing object, or other unbounded value.

This does not invalidate the current `SemanticDetailTransition` integration: that caller constructs a deliberately bounded descriptor containing observation IDs and counts, with observation retrieval already page-limited. It does invalidate any stronger claim that the generic governor alone proves a bounded semantic working-set footprint.

## Minimal falsifier

Instantiate `SemanticMaterialisationGovernor<Uint8Array>` with `maxResident: 1`, request one 1 GiB value, tick once, and observe:

- `resident === 1`;
- all governor cardinality invariants pass;
- retained payload is nevertheless approximately 1 GiB.

The test need not actually allocate 1 GiB. A synthetic `estimatedCost` or deliberately oversized bounded-array fixture can establish the semantic counterexample without stressing CI.

## Required distinction

Track at least three independent limits:

1. **cardinality bound** — number of resident/queued semantic materialisations;
2. **work bound** — materialisations or cleanup operations permitted per tick;
3. **payload/cost bound** — declared or validated retained cost of resident materialisations.

Passing one axis must not certify the others.

## Recommended V1 correction

Do not attempt browser-byte precision. Add an adapter-owned, observable cost contract:

```ts
interface SemanticMaterialisationAdapter<T> {
  validate(value: unknown): value is T;
  estimateCost(value: T): number | null;
}
```

The policy may then include a named `maxEstimatedResidentCost` only where the estimator has defined units and provenance. If cost cannot be meaningfully estimated, expose `null` and limit the claim to cardinality/work boundedness. Do not silently translate object count into memory safety.

For the current semantic-detail descriptor, a stronger and simpler protocol is available: validate exact schema and cap `observationIds.length` at the governed page limit. That creates a claim-specific payload bound without pretending it is a byte-level memory measurement.

## Adversarial tests

1. One resident value with oversized declared cost cannot be described as resource-bounded merely because `resident === 1`.
2. A semantic-detail descriptor exceeding the governed observation-ID limit is refused.
3. A descriptor containing `Dataset`, source-row arrays, Three.js objects, typed GPU/transfer buffers, or an outgoing `MonetaDataInput` is refused by its family adapter.
4. Unknown/unavailable cost remains `null`, not zero.
5. Cost telemetry distinguishes estimated from measured values.
6. Repeated replacement keeps cardinality, work, and any claim-specific payload bound independently within policy.
7. Physical Quest memory stability remains a separate device-evidence claim.

## Cross-domain research implication for Moneta

A useful parallel appears in recent post-selection calibration work: calibration of individual candidates does not necessarily calibrate the **deployed selection policy**, because search changes the distribution of released outputs. The analogous Moneta rule is already compatible with the claim-bound evidence architecture: if Moneta adaptively searches, filters, reranks, or stops across representations, calibration evidence should target the complete deployed policy/output distribution, not merely each candidate before selection.

This is a research lead, not yet a production rule. It should become a falsifier for PT9 before learned representation selection is promoted.

Recent compositional research on structural zeros likewise reinforces the standing measurement-semantics rule: zero values may represent structural absence rather than a generic numerical nuisance, so a log-ratio label alone cannot certify admissibility. Zero semantics must be part of the claim/protocol.

## Finding / hypothesis / speculation

**Finding:** PR #763 proves bounded semantic-materialisation cardinality and work scheduling, but the generic governor does not by itself prove bounded retained payload or physical memory.

**Hypothesis:** family-specific schema validation plus independently governed cardinality/work/cost axes will close the software boundedness claim without requiring unreliable browser memory measurement.

**Speculation:** later adaptive residency may benefit from semantic-value-per-cost scheduling, but such a utility function should not be introduced before cost observability and ownership correctness are established.

## Recommended sequencing

1. Keep #763's current claim narrow: bounded cardinality/backpressure/presentation integration.
2. Add descriptor/schema payload falsifiers before generalising the governor to additional semantic families.
3. Add estimated-cost support only where a family can define honest units.
4. Preserve Quest 10/30/60-minute evidence as the physical-memory/performance gate.
5. Add a PT9 research task for selection-aware calibration of the complete learned Moneta policy.
