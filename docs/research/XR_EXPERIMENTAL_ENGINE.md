# XR Experimental Engine

**Status:** bootstrap tranche, 2026-09-10

The XR Experimental Engine extends the existing IWER-backed USIM harness into a vendor-diverse, fault-injectable experimental substrate. It is not a substitute for physical XR qualification. Its job is to move inexpensive falsification earlier so scarce headset and human-attention time is spent only on surviving candidates.

## Evidence ladder

- **S0** pure/unit simulation: mathematical and semantic invariants.
- **S1** browser/WebXR simulation: API, lifecycle, interaction and fault behaviour.
- **S2** device-profile simulation: declared refresh/input/runtime characteristics, not physical performance.
- **S3** calibrated surrogate: synthetic host constraints calibrated against physical runs.
- **S4** physical device: runtime, frame pacing, thermal, tracking and device behaviour.
- **S5** human/device study: usability, comfort, discoverability and perceptual meaning.

A lower tier may falsify a candidate. It may not promote a claim that requires a higher tier.

## First implemented seam

`dev/xr-lab/ExperimentalProfiles.ts` introduces orthogonal envelopes for:

1. device/runtime families;
2. fault conditions;
3. dataset/source-vs-semantic scale;
4. repeatable experiment-matrix expansion.

Initial device envelopes include Quest 2/3/Pro-class IWER profiles, generic WebXR, a deliberately constrained standalone profile, and a transient-pointer contract profile for gaze/pinch-style runtimes. The latter remains an S1 contract until exercised in Safari/visionOS.

Budget scales are experiment controls, never claims about the corresponding physical headset.

## Next execution tranches

1. Wire matrix cells into the existing `SimulatorScenarioRunner` and `XREvaluationEpisode` evidence schema.
2. Add seeded pose/input fault injection and frame/worker delay injection.
3. Add canonical action recording/replay across profiles.
4. Add Playwright browser matrix execution.
5. Add known-property dataset oracles for Moneta representation experiments.
6. Add multi-objective candidate comparison and Pareto-front preservation.
7. Add physical-device calibration import without allowing S0-S3 evidence to masquerade as S4/S5.

## Full Moneta use

The engine should eventually evaluate representation policies under hard validity constraints and soft multi-objective fitness. Statistical/measurement validity, provenance integrity and semantic identity are hard constraints. Performance, legibility, latency, resource cost, stability and later human preference are separate objective dimensions rather than one scalar score.

## Moneta benchmark corpus bootstrap

`dev/xr-lab/MonetaBenchmarkCorpus.ts` separates benchmark evidence by oracle strength instead of pretending there is one objectively correct visualization. The bootstrap registry includes exact seeded synthetic statistical/manifold families, LFR planted graph communities, labeled NAB time-series anomalies, VAST task/solution benchmarks, and human-derived Draco/VizML preference evidence.

This separation is important: a machine oracle can establish that a representation preserved a planted cluster, neighborhood or anomaly, but not that a human investigator will perceive it readily or that the representation is the most useful one for open-ended discovery. Those claims remain S5/human-study questions.
