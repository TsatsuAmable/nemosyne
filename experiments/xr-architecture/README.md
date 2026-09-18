# Portable XR Architecture Experiment Harness

This directory is the portable entry point for the Nemosyne three-arm XR architecture experiment.

Copy `experiment.example.json` to `experiment.json`, replace runtime-bound placeholders such as the dataset fingerprint with exact evidence identity, then run `docker compose -f experiments/xr-architecture/compose.yaml up --build`.

The container is for deterministic simulator and computational workloads. Physical Quest and human UX evidence remain separate evidence classes and must not be inferred from container runs.

The manifest is configuration authority for protocol/version, architecture arms, dataset/oracle identity, replay trace, seeds, resource budget and evidence outputs. Raw observations and derived analyses stay separate. Wolfram-derived analysis must reference immutable raw evidence rather than modify it.

A portable evidence bundle retains the manifest, repository/build identity, lockfile/runtime identity, raw evidence, derived evidence, hashes and explicit incomplete/abstain states.
