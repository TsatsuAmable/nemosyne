# P1-QV QV2a ADB Quest Device Identity — Pre/Post Adversarial Review

**Date:** 2026-09-01  
**Base:** `main@6805c60b650e9656901053a0b0756a42f2e639f7`  
**Risk:** HIGH (evidence attribution infrastructure)  
**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

## Problem

QV2 originally required the operator to type `declaredQuestModel` and
`declaredFirmwareVersion` into `logs/validation/device.json`. That preserves the
important rule that browser code must not invent hardware facts, but it creates
an avoidable transcription failure mode exactly where governed physical evidence
needs stronger provenance.

The browser still cannot be trusted to infer Horizon OS firmware. The fix is not
to scrape or guess a marketing version from the Quest Browser. The validation
launcher already runs on the host and can query an attached developer-authorised
Quest through ADB before the session starts.

## Authority decision

For governed physical validation:

- **machine device/build identity authority:** ADB Android system properties read
  by `scripts/quest-adb-device.mjs`;
- **source identity authority:** Git HEAD/worktree logic already owned by
  `scripts/quest-validation.mjs`;
- **runtime/XR/WebGL authority:** existing browser-side `QuestTelemetry`;
- **human local metadata:** `logs/validation/device.json` remains available for a
  friendly label/investigator and legacy exploratory fallback;
- **gate adjudication:** still QV4. QV2a only decides whether physical identity is
  attributable enough for a governed run to remain eligible for later adjudication.

No second telemetry or performance authority is introduced.

## Captured fields

The launcher reads:

```text
ro.product.model
ro.product.manufacturer
ro.build.version.incremental
ro.build.display.id
ro.build.fingerprint
ro.build.version.security_patch
```

`buildIncremental` and `buildFingerprint` are retained as the exact
machine-reported build identity. QV2a deliberately does **not** invent a friendly
Horizon OS marketing version such as `vXX` when the operating system does not
expose one through the governed capture seam.

The host-visible raw ADB serial is **not persisted at all**. It exists only long
enough to select the device for the ADB `getprop` calls. The manifest therefore
does not create a stable serial-derived tracking identifier.

## Selection rules

1. Exactly one `adb devices -l` entry in state `device` is selected automatically.
2. `unauthorized` / `offline` devices are not accepted.
3. More than one authorised device fails closed unless the operator explicitly
   selects one with `NEMOSYNE_QUEST_ADB_SERIAL`.
4. Missing ADB or missing required model/build properties yields a bounded
   capture error.
5. Informal `quest` development may continue with that error recorded.
6. Governed physical modes become `INVALID_RUN` when machine identity is absent.
7. QV2a does not infer Quest generation from an undocumented model-string mapping.
   It records the machine-reported model verbatim; QV4 owns governed profile/device
   compatibility adjudication.

## Legacy/manual declaration policy

Manual `--model` and `--firmware` values remain readable to avoid destroying old
local workflows, but they are no longer sufficient for governed evidence.
Typing a plausible firmware string therefore cannot upgrade an otherwise
unattributed physical run.

The CLI's normal operator path is now:

```bash
npm run dev:quest:device -- probe
npm run dev:quest:device -- set --label "Lab Quest" --investigator "<name>"
npm run dev:quest:perf
```

The final launch automatically repeats the ADB capture, so `probe` is diagnostic,
not a trust step and not required before every run.

## Falsifiers

This tranche fails if any of the following is true:

1. a governed run can become promotion-eligible using only manually typed
   model/firmware values;
2. an unauthorised/offline device is accepted;
3. multiple authorised ADB devices are selected nondeterministically;
4. the raw ADB serial is written into the validation manifest or disposition;
5. a missing required build property is silently guessed;
6. a non-Quest Android device can satisfy the governed physical identity gate;
7. capture-time code guesses Quest generation from an undocumented model/codename mapping;
8. ordinary `npm run dev` / `npm run dev:wasm` behavior changes;
9. QV2a claims a performance or UX gate PASS merely because identity capture
   succeeded.

## Verification added

Focused tests cover:

- `adb devices -l` parsing;
- single authorised device capture;
- ADB unavailable;
- no device;
- unauthorised device;
- multiple-device fail-closed behavior;
- explicit serial selection;
- missing required build property;
- raw-serial and serial-derived identifier non-persistence;
- manual declaration unable to satisfy governed identity;
- valid machine-captured Quest 3S eligibility;
- non-Quest rejection;
- verbatim model capture without generation guessing;
- QV3 `INVALID_RUN` / pending disposition behavior with the new identity gate.

## Post-review notes

The implementation keeps the analytical and telemetry boundaries intact. The
remaining downstream task is QV4: consume the now-attributable session manifest
plus captured load-test evidence and mechanically separate report validity from
`PASS | FAIL | PARTIAL | INVALID_RUN | BLOCKED` gate disposition.
