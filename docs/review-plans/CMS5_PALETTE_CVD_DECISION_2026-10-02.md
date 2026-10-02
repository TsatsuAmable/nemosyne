# CMS-5 palette/CVD value extraction decision — 2026-10-02

**Sprint:** CMS-5 — palette/CVD value extraction (`docs/ROADMAP.md` "Claude parallel maintenance sprints"). Research/review first; no implementation in this task.
**Specimen:** `origin/main@87502f7d` on branch `review/cms5-palette-cvd-extraction`.
**Deliverable class:** written KEEP/ABSORB/DELETE decision with reachability and test evidence.
**Scope note:** `docs/review-plans/CMS7_LEGACY_TEST_RENT_CENSUS_2026-10-02.md` (§S10/S6) does not exist at this base (it lands with #891), so its ColorPaletteEngine classification could not be re-read here. The registry classification and the PROTECT-pending-CMS-5 status were instead verified directly against `governance/production-capabilities.json` (`development-only`, "Standalone palette experiment not consumed by the production encoding or UI token paths", with `forbiddenPublicExports` on `src/data/index.ts`) and against `tests/color-palette-colord.test.ts`, which exists and has no other consumer.

## Verdict

**ABSORB-then-DELETE (bounded).** `ColorPaletteEngine` is not kept and never becomes a colour authority.

1. **ABSORB exactly one capability — the WCAG contrast-ratio computation** — into the canonical colour token authority `src/vr/ui-system/tokens.ts`, re-implemented as a small dependency-free WCAG 2.x relative-luminance helper, with contrast-pair assertions added to the existing `tests/ui-system/token-convergence.test.ts`. This is the one algorithm in the engine with no canonical counterpart and genuine accessibility value today (see "Contrast is the gap" below).
2. **DELETE everything else**: `src/data/ColorPaletteEngine.ts`, `tests/color-palette-colord.test.ts`, and the now-unused `colord` dependency (plus the `color-palette-engine` entry in `governance/production-capabilities.json`). Absorb-and-delete matches the standing instruction already in `docs/roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md` (FM3-PERCEPT row): "extract any valuable perceptual/accessibility tests or algorithms into the canonical encoding/representation path or delete it" — this decision names exactly which is which.
3. **Not absorbed, deliberately:** the CVD *simulation* matrices and both palette *generators*. The simulation is scientifically unvalidated as implemented (see "Algorithm-quality findings"), and the generators are weaker duplicates of canonical behaviour that is already pinned by tests.

## Explicit authority-boundary statement

The canonical path remains the only colour authority. Today that authority is, by surface:

- `src/vr/ui-system/tokens.ts` — UI colour tokens, declared canonical by the B-V1 work and pinned by `tests/ui-system/token-convergence.test.ts` (`describe('B-V1 canonical token authority')`).
- `src/data/Encodings.ts` — dataset-value-to-colour channel mapping (`categoricalColor`, `numericColor`), zero-dependency, consumed in production by `src/vr/artifacts/ChartPlane.ts` and the five `src/moneta/embodiment/` semantic embodiment builders.
- `src/utils/Accessibility.ts` — CVD-mode colour substitution at runtime (`remapColor` + `COLORBLIND_PALETTE`, hue-family classification).

The bounded absorption lands the contrast helper *inside* `src/vr/ui-system/tokens.ts` (or, if a maintainer prefers, as a sibling file imported by it — the tokens module itself stays the single authority surface). It must not be a new `src/color/*` module, and `colord` must not be introduced into the canonical path: canonical colour values are literal curated tokens with pinned tests, and no parsing/derivation library is needed for WCAG math.

## Reachability evidence (importer greps at `87502f7d`)

| Probe | Result |
| --- | --- |
| Repo-wide content search for `ColorPaletteEngine` (all text file types, `node_modules`/`.git` excluded) | Only: the module itself, `tests/color-palette-colord.test.ts`, the registry entry, and three docs (`docs/ROADMAP.md` CMS-5/FM3 rows, `docs/roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md`, `docs/review-plans/P1_W2_PRODUCTION_DISCOVERABILITY_2026-09-03.md`). No production importer of any kind. |
| `src/data/index.ts` exports `ColorPaletteEngine` / `CVDMode` / `PaletteColor` | Absent (grep exit 1). Matches the registry's `forbiddenPublicExports` guard. |
| Repo-wide search for the four public statics (`generateCategoricalPalette`, `generateSequentialRamp`, `isReadable`, `simulateCVD`) | Only the module and its own test. Zero call sites. |
| Repo-wide search for `colord` (src, wasm, tests) | Only `ColorPaletteEngine.ts`, its test, and the `package.json` dependency (`colord@^2.10.0`). The dependency exists solely for this module and is removable with it. |
| Search for WCAG/relative-luminance math (`0.2126`, `0.7152`, `0.0722`, `contrastRatio`, `relativeLuminance`, `WCAG`) across `src/` and `wasm/src/` | The only hits are `ColorPaletteEngine.ts` itself. **No production code computes contrast.** All other `contrast` hits are literal naming: `panelBgHighContrast` token aliases in `src/vr/palette.ts`, `HIGH_CONTRAST_THEME` / `getTheme(highContrast)` in `src/vr/ui-system/theme.ts`, and the `highContrast` settings flag threaded through `src/vr/World.ts` and the panels. |
| Colour math in WASM | `wasm/src/data/encodings.rs` deliberately carries no colour at all (header: "spatial x/y/z channel assignment is a renderer concern"). The apparent grep hits for "lab" in the WASM tree are `label`/`collaboration` substrings, not CIELAB. |
| Test lanes | `tests/color-palette-colord.test.ts` is not in `FAST_NODE_TESTS` (`tests/config/test-groups.ts`); it runs in the jsdom-integration lane by exclusion. `tests/encodings.test.ts` likewise; `tests/accessibility.test.ts` is fast-lane. Deletion therefore touches only the integration lane. |

## Capability comparison

| Capability | `ColorPaletteEngine` | Canonical counterpart | Assessment |
| --- | --- | --- | --- |
| WCAG contrast ratio (relative luminance) | `isReadable()` via colord a11y plugin; also per-colour `contrastOnWhite` / `contrastOnDark` fields (anchored on `#ffffff` and `#0f172a`) | **None.** No production code computes contrast; "high contrast" in `src/vr/ui-system/theme.ts` and the `panelBgHighContrast` aliases are curated constants whose contrast property is asserted by nothing, anywhere. | **ABSORB** — the only capability with no canonical duplicate and real value (see below). |
| CVD simulation (what a protan/deutan/tritan viewer actually sees) | `simulateCVD()`: simplified Viénot-family matrices for three dichromacies + BT.601-grayscale achromatopsia | None as *simulation*; canonical capability is *mitigation*: `Encodings.ts` swaps to a curated Okabe-Ito set (`0x0072b2, 0xe69f00, 0x009e73, 0xf0e442, 0x56b4e9, 0xd55e00, 0xcc79a7, 0x000000`), `Accessibility.ts` remaps by hue family. | **DELETE.** Different semantics from the canonical mitigation (simulation is a diagnostic; the canonical design substitutes safe colours by construction), and the implementation carries two defects (next section). Its test pins no algorithm. Re-derive at FM3-PERCEPT if wanted, per the capability plan. |
| Categorical palette generation | Even-hue HSL wheel distribution | `Encodings.ts` `categoricalColor`: curated Okabe-Ito colourblind-safe set, pinned by `tests/encodings.test.ts` exact-value assertions | **DELETE.** Even-hue distribution is not colourblind-safe — it places red/green pairs where dichromat confusion is maximal; the engine computes contrast values per colour but never enforces any threshold, so it does not even guarantee readability of its own output. Strictly weaker than canonical and untested for the property its name claims. |
| Sequential ramp | Linear interpolation in sRGB between two anchors + contrast metadata | `Encodings.ts` `numericColor`: the *same* linear-sRGB interpolation algorithm, production-consumed (ChartPlane, embodiment builders), endpoints pinned by `tests/data.test.ts` | **DELETE.** Behavioural duplicate of an existing canonical function; absorption would be moving the identical math and creating no new property. |
| isDark / luminance boolean | colord `isDark()` | No direct counterpart; canonical "dark" handling is the fixed dark theme design | **DELETE.** No consumer, no canonical need. |

## Algorithm-quality findings (why absorb-and-delete rather than keep)

1. **The CVD simulation is applied in the wrong colour space.** `simulateCVD` takes `colord(hex).toRgb()` — gamma-encoded sRGB — divides by 255 and applies the projection matrices directly, with no sRGB→linear transfer function. The Viénot 1999 derivation these simplified matrices are cited from is defined on linearised RGB. Applied to gamma values the projection is systematically wrong in magnitude, especially for mid/light colours. The module header advertises "Brettel-Vienot-Mollon" semantics it does not actually implement.
2. **Achromatopsia is internally inconsistent with the module's own contrast function.** It greyscales with ITU-R BT.601 luma coefficients (0.299/0.587/0.114) over gamma-encoded values, while `isReadable` (colord a11y) uses the WCAG relative-luminance coefficients (0.2126/0.7152/0.0722). The same module thus carries two different, both approximately-luminance, answers.
3. **`contrastOnDark` is anchored out of band.** The engine measures contrast against `#0f172a`, which is not a canonical token (canonical surface base is `0x0b1119` / `#0b1119`). This is exactly the drift of a parallel colour vocabulary the registry's "no second colour authority" discipline exists to prevent.
4. **`contrast` is computed but never enforced.** `PaletteColor.contrastOnWhite`/`contrastOnDark` are produced and then asserted only as `> 1` (the test's weakest assertion). No palette the engine emits is checked to meet any WCAG threshold, so the accessibility framing is aspirational in the code as it stands.

## Test-by-test disposition (`tests/color-palette-colord.test.ts`)

| Test | What it actually pins | Verdict after absorption |
| --- | --- | --- |
| "generates N distinct categorical colors with valid hex and 24-bit integers" | Length 5, hex format, `threeInt > 0`, `isDark` is boolean, `contrastOnWhite > 1`. **Despite the name, it never asserts distinctness** — all six hue steps could collide under any dichromat and pass. | Dies with the engine. Nothing of value; the canonical categorical test pins the property that matters (exact colourblind-safe values). |
| "generates smooth sequential color ramps" | Endpoints only (`ramp[0]`, `ramp[9]`); "smooth" asserted nowhere. | Dies. Equivalent endpoint behaviour is not asserted for `numericColor` either; if anything, the follow-up PR may add an `numericColor` endpoint assertion to `tests/data.test.ts`, but that is canonical-path work, not CMS-5 scope. |
| "evaluates WCAG AA readability contrast ratios accurately" | Three pairs: black-on-white true, white-on-white false, `#38bdf8` on `#0f172a` true. The two monochrome pairs pin that the implementation discriminates at all; the third is the only pair with non-trivial values, and nothing pins behaviour near the 4.5:1 / 3:1 boundaries. Weak, but the only executable contrast semantics in the repository. | Replaced by stronger assertions at the canonical authority: the absorption test pins luminance/contrast behaviour with boundary cases near the thresholds and applies it to the real token pairs (below), so the surviving invariant is strictly stronger than what dies. |
| "simulates Color Vision Deficiencies (CVD)" | Output `!=` `#ff0000` for three dichromacy modes, and hex format for achromatopsia ("matches a regex"). Any non-identity matrix of any sign passes. **Projections are pinned to zero places.** | Dies, with replacement "none" — canonical accessibility is mitigation-by-construction (Okabe-Ito swap, hue-family remap), both already pinned by `tests/encodings.test.ts` and fast-lane `tests/accessibility.test.ts`. A CVD *simulation* is a diagnostic no production path consumes; pinless matrices are not evidence, they are decoration. |

## Absorption plan (follow-up PR; mechanical, non-colliding)

1. In `src/vr/ui-system/tokens.ts`, add ~15 dependency-free lines: an sRGB relative-luminance function (`0.2126/0.7152/0.0722` over the linearised channels) and a contrast-ratio function `((L1 + 0.05) / (L2 + 0.05))`, plus a numeric-hex unpack reusing the existing `toCssHex` shape. No `colord`.
2. In `tests/ui-system/token-convergence.test.ts`, add assertions that (a) the two token pairs the UI actually renders — `text.primary` on `surface.base` / `surface.raised` — and the `HIGH_CONTRAST_THEME` pairs clear the WCAG AA ratios used by the engine (4.5 normal / 3.0 large), and (b) boundary cases near those ratios pin the math (e.g. the ratio of two chosen greys lands within a stated tolerance of 4.5 and 3.0). This converts the unverified "high contrast" claim into executable evidence at the canonical authority — the material accessibility improvement CMS-5 was hunting for.
3. Delete `src/data/ColorPaletteEngine.ts`, `tests/color-palette-colord.test.ts`, remove `colord` and its referenced plugins from `package.json` dependencies (no other importers — verified above), and remove the `color-palette-engine` entry from `governance/production-capabilities.json`. Do not edit `docs/ROADMAP.md` rows in the same PR.

**Why this absorption does not create a second colour authority:** the helper computes a property *of* the canonical tokens, lives in the canonical tokens module, and is pinned in the canonical tokens test. It authorises no palette generation, no derivation of new colours, no dependency library — it is a measurement function over values the token set already owns.

## Deletion plan — what dies and what survives

Dies:

- `generateCategoricalPalette`, `generateSequentialRamp`, `simulateCVD`, `isReadable`, `isDark` and the `PaletteColor`/`CVDMode` types. All have zero non-test call sites; no production behaviour depends on any of them.
- The executable WCAG contrast capability *temporarily* — replaced in the same PR by the canonical helper, which is strictly stronger (applies to real token pairs with boundary pins).
- CVD simulation, intentionally unreplaced. Replacement-invariant-or-none: **none**, because canonical CVD semantics are mitigation-by-construction (colour substitution), not simulation, and every substitution invariant lives on in `tests/encodings.test.ts` (Okabe-Ito exact values) and fast-lane `tests/accessibility.test.ts` (hue-family remap, highContrast/theme wiring). Any future CVD-simulation need is the FM3-PERCEPT row of the capability plan, which should be derived afresh from the published linear-RGB matrices with pinned expectations — not resurrected from a file whose simulation runs in gamma space and whose tests pin nothing.

Survives regardless:

- Colourblind-safe categorical encoding (Okabe-Ito) — `src/data/Encodings.ts` + `tests/encodings.test.ts`.
- Runtime CVD colour substitution — `src/utils/Accessibility.ts` + `tests/accessibility.test.ts` + `src/vr/World.ts` settings wiring.
- Curated colour tokens and the token-authority guard — `src/vr/ui-system/tokens.ts`, `src/vr/ui-system/theme.ts` + `tests/ui-system/token-convergence.test.ts`, `src/vr/palette.ts` alias.

## What evidence would change this decision

- Any new content grep hit for `ColorPaletteEngine` or its four statics outside docs — a production consumer appearing would re-open KEEP pending re-evaluation of that consumer's needs.
- FM3-PERCEPT becoming active (composed multi-structure representations needing *distinctness-under-CVD* evidence, not just safe-by-construction palettes) — at that point a linearised, validation-pinned simulation is re-derived inside the canonical path; the deleted file is a cautionary example, not a starting point.
- A decision to make `colord` a canonical dependency for colour parsing (e.g. if token values start being authored in CSS `oklch()` and need parsing) — then contrast math could be delegated to the library consistently; today the canonical path is literal tokens, and pulling a library in behind a single `isReadable` call is the "hidden authority" this sprint was told to avoid.

## Honest unknowns

- `colord` is not installed in this worktree (`node_modules` absent), so the a11y plugin's exact contrast formula was not re-read from source here. The engine's `contrast()` values are whatever colord's a11y plugin computes; the absorption plan re-derives WCAG 2.x math explicitly rather than trusting the library, so the follow-up PR should pin its own formula against known ratios (e.g. black/white = 21) rather than against the deleted engine's output.
- The CMS-7 census §S10/S6 text is quoted second-hand from the sprint definition, not read at this base; re-read it when #891 lands to confirm the PROTECT classification is lifted consistently with this decision.