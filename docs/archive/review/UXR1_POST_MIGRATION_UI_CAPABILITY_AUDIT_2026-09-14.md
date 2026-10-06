# UXR1 post-migration UI capability reachability audit

**Date:** 2026-09-14  
**Scope:** pre-UXR1 UI at commit 109370a0 versus post-UXR1 main after #743  
**Trigger:** physical Quest observation that the generic panel launcher still appeared as an arc in analyst space after the UIKit migration.

## Conclusion

The migration did not remove the legacy VRMenu's analytical capabilities. Filter, sort, aggregate, k-means cluster, hierarchy, density clustering, anomaly detection, time slicing and reset remain directly reachable from the Analyse wheel. Compare remains reachable through the selected-object contextual task / inspector path and dispatches the same analysis authority.

Portals, live connect/disconnect and session operations also remain present on the semantic wheel.

Two reachability gaps were found before retiring the generic launcher from the analyst path:

1. **Data Sources** was hidden at boot, so its curated-source, built-in-sample and governed-library capabilities were reachable only through the generic launcher.
2. **Vault** had production methods and contextual archive flows, but lacked a stable first-class semantic-wheel entry for deliberate user opening.

This tranche closes both gaps before removing the launcher from normal interaction.
## Legacy capability mapping

| Pre-UXR1 VRMenu capability | Post-UXR1 authority/surface | Disposition |
|---|---|---|
| load built-in dataset | DataSourcePanel.loadSample -> existing onLoadDataset | preserved; direct DATA wheel access added |
| curated live source selection | DataSourcePanel.selectLiveSource -> connectLiveSource callback | preserved; direct DATA wheel access added |
| approved dataset library | xrDatasetLibraryBridge through DataSourcePanel | preserved; direct DATA wheel access added |
| connect/disconnect live stream | DATA wheel live-stream | preserved |
| portals | VIEW wheel portals | preserved |
| filter | ANALYSE wheel -> canonical analysis intent | preserved |
| sort | ANALYSE wheel -> canonical analysis intent | preserved |
| aggregate | ANALYSE wheel -> canonical analysis intent | preserved |
| k-means cluster | ANALYSE wheel -> canonical analysis intent | preserved |
| hierarchical cluster | ANALYSE wheel -> canonical analysis intent | preserved |
| density cluster | ANALYSE wheel -> canonical analysis intent | preserved |
| anomaly | ANALYSE wheel -> canonical analysis intent | preserved |
| time slice | ANALYSE wheel -> canonical analysis intent | preserved |
| compare | selected-object ContextualTaskSurface / inspector -> _dispatchAnalysis('compare') | preserved, now contextual rather than generic |
| reset | ANALYSE wheel -> canonical reset intent | preserved |

## Panel reachability after launcher retirement

Normal analyst interaction uses the hand wheel and contextual surfaces. The physical controller-grip / two-hand-pinch system gesture now opens the hand wheel rather than the panel arc.
Panels with durable analyst value have explicit semantic access:

- Data Sources: DATA -> Data Sources
- Vault: STUDY -> Vault
- Guidance: STUDY -> Guidance
- Timeline: STUDY -> Timeline Strip
- Coach: STUDY -> Coach
- Settings, logs, console, performance and telemetry: SYSTEM
- Network: COLLABORATE

The generic launcher remains temporarily available only under SUPERUSER -> Panel Launcher as a diagnostic escape hatch while physical human validation continues. It is no longer a normal system gesture, desktop paired toggle, or ordinary SYSTEM menu item.

## Evidence / falsifiability

Automated verification must fail if:

- ordinary analyst categories expose launcher;
- the system gesture opens PanelManager launcher instead of the hand wheel;
- Data Sources or Vault lose their explicit semantic-wheel entry;
- legacy analysis operations disappear from the Analyse category;
- the Dev Lab fallback is removed before a replacement reachability audit confirms no unique diagnostic panel becomes stranded.

## Physical-evidence interpretation

The Quest observation is evidence of a real presentation/reachability defect, not proof of the launcher's internal reference frame. The code parents the launcher group under the analyst anchor, but the launcher itself is a static Three.js arc with an empty update hook. The remediation is therefore to remove it from the normal analyst path rather than overrule the user's spatial experience with implementation intent.

## Migrated panel API audit

A second pass compared the public method surface of the pre-UXR1 panels at 109370a0 with the post-#743 implementations. Excluding rendering-substrate methods (renderContent and handleContentClick), lifecycle methods, and private helpers, no public panel capability disappeared across NetworkPanel, TelemetryPanel, PerformancePanel, VaultPanel, OperationLogPanel, GestureConfidenceHUD, Moneta/Draco explainer and diagnostic panels, VRConsole, ChartPlanePanel, NarrativeStrip, InteractionCoach, InvestigationContinuityPanel, InvestigationJourneyPanel, LoadTestPanel, RecommendationPanel, or ValidationOperatorPanel.

The methods that disappeared are canvas/UV implementation details, not user capabilities. Several replacements expose stronger semantic APIs instead, such as seekTo, dispatchAction, getRenderedSummary, explicit vault actions, and semantic remediation/validation dispatch.

This means the material reachability defects found by the audit are the Data Sources and Vault entry points, not hidden analytical engines or panel commands.
