# Game & Immersive-UI Inspiration for Nemosyne

Nemosyne's production-polish phase deliberately borrows patterns that have already been proven in VR games and immersive analytics research. This document catalogues the patterns adopted and where they appear in the codebase.

---

## Adopted Patterns

### 1. Cockpit-style diegetic panels (Elite Dangerous, No Man's Sky)

**What it is:** Important information is rendered on screens that live inside the 3D world, arranged around the user like a vehicle cockpit, rather than as a flat HUD locked to the camera.

**Why it works:**
- Preserves stereoscopic depth cues, which helps users judge distance and scale.
- Reduces simulator sickness because the UI is attached to the stable camera rig rather than drifting against the world.
- Lets panels remain readable while the user looks at the data palace in front of them.

**Where in Nemosyne:** `src/vr/ui/DashboardManager.ts` with `layoutMode: 'semicircle'` places chart and diagnostic panels on a curved shell in front of the analyst.

### 2. Constellation / circular muscle-memory layout (Google VR Constellation Menu, Starblood Arena)

**What it is:** UI items are placed at fixed angles around a central point. Users learn that "category X is always at 10 o'clock" and can select without reading labels every time.

**Why it works:** Spatial memory is faster than visual search in VR; the regular radial structure also maps well to the field of view of a headset.

**Where in Nemosyne:**
- `src/vr/ui/HandWheelMenu.ts` arranges categories on an inner ring and actions on an outer ring.
- The semicircle dashboard arranges snap zones in fixed angular columns so users learn where each chart category lives.

### 3. Snap-to-zone dragging (Half-Life: Alyx gravity gloves, No Man's Sky inventory)

**What it is:** While the user is holding an object, faint target zones appear; on release the object is gently pulled into the nearest valid zone.

**Why it works:** Direct free-space placement is imprecise in VR. Snap zones remove the need for micro-adjustments and keep the workspace tidy.

**Where in Nemosyne:** `DashboardManager` shows wireframe snap zones during drag, highlights the nearest zone, and snaps the panel to it on release.

### 4. Off-screen carousel scrolling (Echo VR, console menu paging)

**What it is:** A 1D list or grid with more items than fit in view; the user swipes or presses a direction to roll hidden items into view while the visible items roll out.

**Why it works:** Limited field of view means only a handful of panels can be comfortably visible at once. A carousel keeps the rest within one gesture, rather than scattering them around the user.

**Where in Nemosyne:** `DashboardManager.scrollBySlots()` rotates the semicircle carousel by one angular column. The wheel menu exposes **Scroll Left / Right**, and off-screen panels are hidden until scrolled back into view.

### 5. Peripheral readability through billboard orientation

**What it is:** Every panel or label is rotated so it faces the viewer, even when it sits at the side of the workspace.

**Why it works:** Text at a glancing angle is hard to read in stereo; billboard orientation maximizes legibility without forcing the user to move.

**Where in Nemosyne:** Semicircle snap zones set `rotation.y = -angle` so each panel's normal points back toward the analyst.

### 6. Contextual gaze tooltips (common in modern VR toolkits)

**What it is:** Labels appear only when the user looks at an object for a short dwell time, rather than cluttering the scene with permanent labels.

**Why it works:** Reduces visual noise and keeps dense datasets readable.

**Where in Nemosyne:** `src/vr/ui/TooltipManager.ts`.

### 7. Gravity-glove / hand-attached inspector (Half-Life: Alyx, Dead and Buried)

**What it is:** Inspectable information appears near the active hand and follows it smoothly, always facing the head.

**Why it works:** The user already has the data in hand; no additional teleport or menu navigation is required.

**Where in Nemosyne:** `src/vr/artifacts/HolographicInspector.js` replaces the flat data card with a hand-following diegetic slate.

### 8. Two-handed gesture commands (Astro Bot Rescue Mission, *Astro's Playroom*)

**What it is:** Combinations of both hands — distance changes, shared vertical lifts, forward pushes, or opposing twists — are interpreted as verbs.

**Why it works:** Two-hand gestures are harder to perform accidentally than one-hand motions and map naturally to physical metaphors: *pull together* to filter, *push away* to reset, *scoop up* to reveal a lens, *twist* to turn time backwards/forwards.

**Where in Nemosyne:** `src/vr/interactions/HandGestureRecognizer.ts` classifies two-hand and dominant-hand gestures; `src/vr/World.ts` maps them to analysis commands, perspective switches, and undo/redo.

### 9. Time-travel undo / redo (Braid, Photoshop history)

**What it is:** Every data operation is stored on a stack and can be rewound or replayed without rebuilding the entire workspace manually.

**Why it works:** Analysts experiment freely when they know a gesture or keyboard shortcut can instantly revert a transform.

**Where in Nemosyne:** `src/data/AnalysisHistory.js` records deep-cloned dataset snapshots; `World.undoAnalysis()` / `World.redoAnalysis()` restore them, and `DesktopControls` adds `Ctrl+Z` / `Ctrl+Y` shortcuts.

### 10. In-world settings slate (Half-Life: Alyx wrist menu, No Man's Sky quick menu)

**What it is:** A small panel that lives in the world (or near the hand) lets users toggle comfort and feedback options without leaving immersion.

**Why it works:** Audio/haptic/visual preferences vary by user and environment; a persistent, movable settings panel makes the app accessible in quiet rooms or shared spaces.

**Where in Nemosyne:** `src/vr/ui/SettingsPanel.ts` toggles the statistical-lens components, feedback channels, and gesture recognition. Settings persist to `localStorage`.

---

## Sources

- Archiact — *Uncharted Territory: 3 Diegetic UI in VR Games* https://www.archiact.com/post/uncharted-territory-3-diegetic-ui-in-vr-games
- Inkspot — *Elite Dangerous: Designing a Diegetic Interface for Complex In-Game Systems* https://cargocollective.com/inkspot/Elite-Dangerous-Designing-a-Diegetic-Interface-for-Complex-In-Game
- The Design Lab — *Immersive Design: UI That Lives in the World* https://thedesignlab.blog/2026/02/16/immersive-design-ui-that-lives-in-the-world/
- Google VR — *Constellation Menu* https://developers.google.com/vr/elements/constellation-menu
- Amped UX — *Starblood Arena Circular HUD* https://www.amped-ux.com/starblood-arena.html
- arXiv — *3D Gestural Radar Chart* https://ar5iv.labs.arxiv.org/html/2303.07995
- IEEE TVCG — *DashSpace: WebXR Collaborative Analytics* https://doi.org/10.1109/tvcg.2025.3537679
- Tableau — *Exploring Spatial Computing and Immersive Analytics on Vision Pro* https://www.tableau.com/blog/exploring-spatial-computing-and-immersive-analytics-vision-pro
- arXiv — *RécitKit: Immersive Data Narratives* https://arxiv.org/html/2508.18670v1

---

## Future Borrowings

Patterns identified but not yet implemented:

- **Teleport arc preview + named anchors** (Robo Recall, Budget Cuts) for comfortable long-distance movement.
- **Haptic confirmation on snap** so dropping a panel into a zone has a tangible feel.
- **Edge tick / arrow decals** that appear when hidden carousel slots exist, similar to horizontal scrollbar affordances in 2D UIs.
