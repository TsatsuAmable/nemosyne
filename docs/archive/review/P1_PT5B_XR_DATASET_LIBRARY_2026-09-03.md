# P1-PT5B post-implementation adversarial review — XR dataset library

**Date:** 3 September 2026  
**Base:** `main@8777a218d160f7d55c29fbb267c7d14776362d7e`  
**Disposition:** ADOPT, subject to exact-head promotion gates.

## Reviewed claim

The production XR launcher can open the human-facing **Data & Tools** surface, refresh and browse the approved `nemosyne-data` catalogue, select a supported dataset size, and open it through the same governed `FileLoader -> Atlas -> Rust` path used outside XR. The existing in-headset column-correction surface now uses product language such as **Number**, **Category**, **Date & time**, and **Apply column types**.

This is a software-path XR parity claim. It is not physical-headset qualification evidence and does not claim the complete PT5 investigation journey.

## Adversarial attacks and outcomes

### 1. Second analytical/data-loading authority

**Attack:** determine whether XR introduced a separate fetch/parser/topology path.  
**Outcome:** PASS. `XRDatasetLibraryBridge` is presentation-only. `FileLoaderUI` remains the provider, `NemosyneDataCatalogClient` remains the governed catalogue/integrity authority, and bytes still enter through Atlas/Rust parsing.

### 2. Non-governed datasets becoming loadable

**Attack:** mix a retired entry into the catalogue.  
**Outcome:** PASS. `listXRDatasets()` projects only `governanceState === "governed"`; direct open also rechecks governance before artifact access. A falsifier covers retired-entry exclusion.

### 3. Catalogue/Rust semantic drift

**Attack:** return an integrity-accepted artifact whose catalogue row count disagrees with the Rust-parsed dataset.  
**Outcome:** PASS after fix-forward. Publication is refused before `onLoad`; the refusal has a dedicated falsifier.

### 4. Async refusal reported as XR success

**Attack:** make artifact loading fail.  
**Outcome:** PASS after fix-forward. The public loader method rejects so the XR surface renders `Could not open dataset`; the desktop DOM wrapper consumes that already-rendered refusal so it cannot become an unhandled promise rejection. Both paths are tested.

### 5. Catalogue-driven XR resource growth

**Attack:** project a large future catalogue with many tiers into the headset menu.  
**Outcome:** PASS after fix-forward. The presentation bridge bounds the XR projection to 24 datasets and at most four tiers per dataset. A hostile-size fixture proves the cap.

### 6. Friendly labels changing analytical semantics

**Attack:** replace internal enum names in presentation while verifying the underlying `ColumnTypeValue` values remain unchanged.  
**Outcome:** PASS. Schema controls map `Number`, `Category`, and `Date & time` back to the existing numeric/categorical/temporal values. Loader preview tests now assert human terms and explicitly reject leaked `CATEGORICAL` presentation text.

### 7. Stale qualification fixtures hiding governed-contract breakage

**Attack:** run the existing remote-loader suite.  
**Outcome:** FOUND AND FIXED. The fixture still modeled obsolete schema 1.0 and omitted governance/measurement metadata. It was upgraded to the canonical 2.2 governed shape rather than weakening product filtering.

## Navigation boundary

The dataset library is reachable in ordinary XR through the production panel launcher because `VRMenu` is a registered panel and its launcher identity derives from its now-human-facing `DATA & TOOLS` title. Promoting an explicit **Browse datasets** shortcut into the primary hand-wheel DATA category remains a useful navigation refinement for a later PT5 UX tranche; it is not required to make the current path independent of desktop UI.

The column-correction surface remains an in-headset expert/reference surface. Its language is now ordinary product language, but broader progressive-disclosure placement can continue under PT5 UX refinement.

## Claim boundary / residuals

PT5B does **not** claim:

- arbitrary local-file chooser support on every XR browser/runtime;
- physical Quest/other headset qualification evidence;
- completion of Notice -> Question -> Hypothesis -> Investigation -> Understanding -> Validation -> Discovery;
- perfect discovery ergonomics for every panel from the primary hand wheel;
- replacement of Rust/WASM analytical authority or Moneta semantics.

Within the bounded governed-catalogue browse/open and in-headset column-review claim, no material defect remains intentionally open.
