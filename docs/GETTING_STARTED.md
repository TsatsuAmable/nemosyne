# Getting Started with Nemosyne

This guide walks you through running the Nemosyne Spatial Data Analysis Suite on a Meta Quest 3S and exploring your first dataset in VR.

---

## Prerequisites

- Node.js 20+
- A Meta Quest 3/3S or another WebXR-capable headset
- A local network connection between your computer and the headset
- OpenSSL, Git Bash, or .NET for generating local HTTPS certificates

---

## 1. Install

```bash
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne
npm install
```

---

## 2. Generate HTTPS certificates

WebXR requires a secure origin. The Vite dev server will use certificates in `certs/` if present.

### Git Bash (recommended on Windows)

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes
```

### macOS / Linux

```bash
mkdir certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes
```

### mkcert (smoothest option)

```bash
mkcert -install
mkcert localhost 127.0.0.1 ::1 <your-computer-ip>
# rename output files to certs/key.pem and certs/cert.pem
```

---

## 3. Start the dev server

```bash
npm run dev
```

Vite will start on `https://localhost:5173` and on your local network IP.

---

## 4. Open on the Meta Quest 3S

### Option A — Same Wi-Fi

1. Find your computer's local IP address (e.g., `192.168.1.50`).
2. Open Meta Quest Browser.
3. Navigate to `https://<your-computer-ip>:5173`.
4. Accept the self-signed certificate warning if necessary.

### Option B — ADB port forwarding

```bash
adb forward tcp:5173 tcp:5173
```

Then open `https://localhost:5173` in the Quest Browser.

---

## 5. Enter VR

1. Tap the **Enter VR** button at the bottom of the page.
2. Allow WebXR permissions if prompted.
3. You should see:
   - A pulsing DatumPlane grid beneath you.
   - A TechnoCore megasphere landmark.
   - A Draco-recommended data palace in front of you.
   - HUD panels in your field of view.

---

## 6. First interactions

| Action | How |
|---|---|
| Look around | Move your head |
| Point | Controller laser or index-finger ray |
| Select a node | Trigger click or pinch |
| Inspect values | Select a data node; a HolographicInspector slate appears |
| Open wheel menu | Pinch the menu hand (or grip button / two-hand pinch) |
| Toggle panels | Wheel menu buttons |
| Drag a panel | Point at title bar, hold trigger/pinch, move |
| Switch dataset | Wheel menu → Views → Dataset |
| Connect live data | Wheel menu → Live → Start Live |
| Trigger a metaphor | Select a node; if the dataset uses a Phase 7 metaphor, a transient spatial effect plays |
| Walk/fly through a Farcaster portal | Step into the glowing ring; the atmosphere shifts |
| Toggle 3D flight mode | Wheel menu → Views → Toggle Flight |
| Ascend / descend | Right thumbstick up/down in flight mode, or `scoopUp` / `scoopDown` gesture |
| Drop to floor | Wheel menu → Views → Drop to Floor |
| Export screenshot | Wheel menu → Panels → Export Screenshot |
| Export analysis story | Wheel menu → Panels → Export Story |
| View operation log | Wheel menu → Panels → Operation Log |
| View live telemetry | Wheel menu → Panels → Telemetry |
| View performance budget | Wheel menu → Panels → Performance |
| Open interaction coach | Wheel menu → Panels → Interaction Coach |
| Join collaboration room | Settings → NETWORK → Collaboration ON |
| Leave collaboration room | Wheel menu → Collab → Leave Room |
| View collaboration status | Wheel menu → Collab → Network Panel |
| Use desktop input fallback | Mouse/keyboard input for development, accessibility, and recovery |

### Context-aware shortcuts

These recent UI additions reduce the need to open the full wheel menu for common actions:

| Feature | What it does | How to use it |
|---|---|---|
| In-place operation handles | Small badges appear near the data palace for supported topologies | Hover/select the 🔎 (filter), 📶 (sort), or 🕒 (time slice) badge attached to an artefact |
| Live preview | Ghost markers show the result of an operation before you commit it | Hover over an operation in the wheel menu or an in-place handle; the markers clear once you apply or leave |
| Mini-overview | Top-down mini-map of the palace and your view cone | Wheel menu → Views → Overview, or Settings → Navigation → Mini Overview |
| Peer-presence HUD | Lists connected collaborators and their direction | Join a collaboration room; toggle with Wheel menu → Views → Peers, or Settings → Collaboration → Peer Presence |

HUD panels are free-floating: drag a panel by its title bar to move it independently in front of you. Panel positions and visibility are saved with the session, so your layout is restored after a reload.

---

## 7. Analysis templates

If you prefer to start with a complete scenario instead of a raw dataset, use the **Templates** category in the constellation wheel menu. Each template loads a curated sample dataset, applies a matching atmosphere theme, and starts the guided tour.

| Template | Scenario |
|---|---|
| Factory Floor Monitoring | IoT temperature and vibration stream with time-slice anomaly exploration |
| Fraud Investigation | Transaction graph with suspicious-amount anomaly highlighting |
| Sales Performance Review | Sales table for sorting and regional aggregation |
| Organizational Cost Audit | Radial org chart for level aggregation and budget outlier inspection |
| Market Session Replay | OHLCV candle series for replaying a trading session through time slices |
| Geospatial Benchmark | Lat/lon city data rendered as room-scale bars |

Templates are the fastest way for a new analyst to see how the gesture and operation vocabulary maps to a real analysis workflow.

---

## 8. Try a live stream

The dev server includes a demo WebSocket endpoint at `/__demo-stream`. In VR:

1. Open the wheel menu.
2. Choose **VR Menu**.
3. Tap **Connect Live Stream** or **Demo Stream**.
4. Watch the palace update with streaming rows.

Curated public sources (Coinbase, Kraken, Binance, USGS earthquakes, OpenSky aircraft) are also available; some may require an internet connection and may be rate-limited.

---

## 9. Bring your own data

The Nemosyne loader panel (top-right in the 2D view, or use the wheel menu) accepts **CSV** and **JSON** files. JSON must be an array of objects. CSV files are parsed with automatic delimiter detection and quoted-field support. Dangerous prototype keys are rejected from imported headers.

### CSV format tips

- The first row must be a header with column names.
- Commas, semicolons, tabs, and pipes are auto-detected as delimiters.
- Fields containing commas or line breaks should be wrapped in double quotes.
- Use `""` inside a quoted field to represent a literal double quote.
- Example:
  ```csv
  sensorId,temperature,time
  S1,22.5,2026-07-28T00:00:00
  S2,19.8,2026-07-28T01:00:00
  ```

### Topology auto-detection

Nemosyne guesses the best palace topology from your column names and types:

| If your CSV has... | Inferred topology |
|---|---|
| `source`/`target`, `from`/`to`, `src`/`dst` | **GRAPH** |
| `parent`/`child` or `level` columns | **HIERARCHY** |
| `lat`/`lon`, `latitude`/`longitude`, or `x`/`y` | **GEO** |
| `u`/`v`/`w` or `vx`/`vy`/`vz` | **VECTOR_FIELD** |
| a date/time column + numeric column | **TIME_SERIES** |
| none of the above | **TABULAR** |

You can override the inferred topology with the dropdown in the loader panel.

### Troubleshooting imports

- **"No columns" / "No rows"** — the file is empty or lacks a header row.
- **"All columns parsed as text"** — check for stray quotes or a mismatched delimiter.
- **"Row length mismatch"** — some rows have more or fewer columns than the header; often caused by unescaped commas inside values.

Excel and Parquet support are planned as plugin importers; CSV is the canonical first-class format today.

---

## 10. Saving your session

Nemosyne auto-saves your session to the browser's IndexedDB every few seconds when the dataset, camera, settings, theme, or tour state changes. The autosave is restored automatically when you reopen the app.

You can also save and restore manually from the wheel menu:

- **Panels → Save Session** — writes a manual snapshot.
- **Panels → Load Last Session** — restores the latest autosave.
- **Panels → New Session** — clears the autosave so the next launch starts fresh.

Saved state includes:

- The loaded dataset and any applied data operations.
- Camera position and orientation.
- Analysis history (undo/redo stack).
- Settings, theme, and guided-tour progress.

Live stream connections are not persisted; a restored session keeps the last buffered dataset.

Key settings and the most recent analysis story are also saved to a cross-platform `shared-settings` record, so settings used through the desktop input fallback are restored when you later enter VR.

---

## 11. Export and provenance

Nemosyne can export what you see and how you reached it.

- **Panels → Export Screenshot** — captures the current renderer output as a PNG and downloads it.
- **Panels → Export Story** — downloads a JSON analysis story with the dataset name, topology, applied operations, camera position, active theme, and timestamps. Use it for lab notebooks, issue reports, or reproducible workflows.
- **Panels → Operation Log** — opens a read-only panel that lists recent operations newest-first, including their effect on row count.

These exports are initiated from the hand wheel menu and respect the same user-gesture rules as browser downloads, so they work inside the Quest Browser when triggered by a controller click or hand pinch.

---

## 12. Telemetry and observability (opt-in)

Nemosyne can collect lightweight session metrics locally to help you understand performance and usage. Telemetry is **disabled by default** and never transmitted automatically.

To opt in:

1. Open the **Settings** panel from the wheel menu.
2. Toggle **Telemetry Opt-in** to ON.
3. Open **Panels → Telemetry** to see live metrics.

Tracked metrics include:

- Session duration and loaded dataset.
- Frame timing, dropped-frame count, and FPS estimate.
- Counts of applied operations and recognized gestures.
- Error, warning, and unhandled-rejection counts.

Telemetry data is included in exported analysis stories and is cleared when you start a new session. You can disable it at any time in Settings; all in-memory counters stop immediately.

---

## 13. Accessibility options

Nemosyne includes several settings to make the workspace more usable:

1. Open **Settings** from the wheel menu.
2. Adjust under **ACCESSIBILITY**:

| Setting | Effect |
|---|---|
| High Contrast | White-on-black UI chrome and thicker borders. |
| Text Scale | Increase or decrease text size on all panels (0.75× to 2×). |
| Colorblind | Remap accent colors for deuteranopia, protanopia, or tritanopia. |
| Dwell Select | Hover over a panel button or scene object for ~1.2 s to activate it; useful if pinching or pressing a trigger is difficult. |

Accessibility settings persist to localStorage and are restored on launch.

---

## 14. Performance profiling and budgets

Nemosyne monitors runtime performance so you can find bottlenecks before they ruin a VR session, especially on the Quest Browser.

1. Enable **Settings → Telemetry Opt-in** to collect frame timing, gestures, and operations.
2. Open **Panels → Performance** to see:
   - Live telemetry summary (frame time, dropped frames, FPS estimate).
   - Current performance budgets.
   - Recent budget violations (frame time, draw calls, triangles, points, interactables, updatables, panels).
3. Toggle **Settings → Strict Budget** to enforce a tighter 75 fps frame-time target (13.33 ms) and a lower dropped-frame tolerance, useful when profiling on standalone headsets.

Budget checks run once per second inside the engine tick. Violations are printed to the browser console and listed in the Performance panel. Use them to decide when to enable LOD, reduce panel count, or simplify the palace.

---

## 15. Interaction coach and gesture vocabulary

Nemosyne teaches its input vocabulary by showing a running commentary of what you do and how the system interpreted it. Open **Panels → Interaction Coach** from the wheel menu to see:

- The action the system just performed.
- The hand gesture that triggered it (if any).
- The Meta Quest controller equivalent for that gesture.
- The outcome (e.g. row count after a filter).

This is useful for learning gesture navigation and for confirming that a subtle hand motion was recognized correctly.

### Hand gestures

| Gesture | How to perform it | Result |
|---|---|---|
| Pinch Together | Pinch both index fingers, move hands toward each other | Filter |
| Pinch Apart | Pinch both index fingers, move hands apart | Aggregate |
| Swipe Right | Open palm, swipe right | Next dataset |
| Swipe Left | Open palm, swipe left | Previous dataset |
| Slice Up | Open palm, slice upward | Sort |
| Slice Down | Open palm, slice downward | Time slice |
| Scoop Up | Both palms up, lift hands | Ascend (flight mode) or toggle statistical lens |
| Scoop Down | Both palms down, lower hands | Descend (flight mode) |
| Push Forward | Both palms forward, push away | Reset transforms |
| Rotate Clockwise | Cupped hands twist clockwise | Redo |
| Rotate Counter-Clockwise | Cupped hands twist counter-clockwise | Undo |
| OK Sign | Dominant hand pinch, other hand open | Toggle settings panel |
| Both Pinched | Pinch both index fingers at the same time | Toggle launcher ring |

### Controller equivalents

When using Meta Quest controllers, the same intents are available without hand tracking:

| Hand gesture | Controller equivalent |
|---|---|
| Pinch Together | Hold both triggers and move controllers toward each other |
| Pinch Apart | Hold both triggers and move controllers apart |
| Swipe Right | Right thumbstick flick right |
| Swipe Left | Right thumbstick flick left |
| Slice Up | Right thumbstick flick up |
| Slice Down | Right thumbstick flick down |
| Scoop Up | Hold both triggers and raise both controllers |
| Scoop Down | Hold both triggers and lower both controllers |
| Push Forward | Hold both triggers and push controllers forward |
| Rotate Clockwise | Right B button |
| Rotate Counter-Clockwise | Right A button |
| OK Sign | Left Y button |
| Both Pinched | Press both grip buttons together |

Disable hand gestures in **Settings → GESTURES → Hand Gestures** if you want to rely entirely on controllers, or disable the coach by toggling **Panels → Interaction Coach** again.

---

## 16. Multi-user collaboration (experimental)

Nemosyne can join a shared room over WebRTC so multiple analysts can inhabit the same memory palace. Data is local-only in this first networking release: each peer sees their own dataset, while camera pose and room presence are shared. Peers have explicit `participant` or `observer` roles; observers may monitor shared state but cannot broadcast dataset mutations.

### Signalling server

During local development, the Vite dev server already hosts a signalling endpoint at `/__signal`, so no extra process is needed.

For production or a separate deployment, run the standalone Node server:

```bash
node src/network/SignallingServer.mjs --port=8080
```

and point the app at the same host/port (e.g. route `wss://your-host/__signal` to the server behind your TLS terminator).

### Shared-secret token (optional, recommended for non-local use)

By default any client that knows the room ID can join. For a private demo you can
gate joins behind a shared secret so the server rejects clients that do not supply
it. This is **not strong authentication** — room ID + token together form a shared
secret anyone in the room can read — but it keeps casual snoopers out.

Set tokens on the standalone server (dual-token mode for strict role separation):

```bash
node src/network/SignallingServer.mjs --port=8080 --token=PARTICIPANT_SECRET --observer-token=OBSERVER_SECRET
# or via environment:
# NEMOSYNE_SIGNAL_TOKEN=PARTICIPANT_SECRET NEMOSYNE_OBSERVER_TOKEN=OBSERVER_SECRET node src/network/SignallingServer.mjs --port=8080
```

For the dev-server plugin, set `NEMOSYNE_SIGNAL_TOKEN` (and optionally `NEMOSYNE_OBSERVER_TOKEN`) in the environment before
`npm run dev`. When tokens are configured, a join without a matching token is rejected (close code 4001). Setting both tokens
guarantees that observers cannot self-elevate to participant roles. A second client claiming a peer ID already live in the
room is also rejected (close code 4002) rather than silently taking it over.

On the client, store the same token once in the browser before joining:

```js
localStorage.setItem('nemosyne.collabToken', 'SHARED_SECRET');
```

(NetworkManager reads it automatically; it is never logged.) When no token is
configured, joins work without one, exactly as before.

### Join a room in VR

1. Open **Settings** from the wheel menu.
2. Under **NETWORK**, choose a **Room** (default, team-a, team-b, demo).
3. Toggle **Collaboration** ON.
4. Open **Collab → Network Panel** to see the room ID, connection state, and peer list.

### Collaboration wheel menu

- **Collab → Join Room** — connects to the selected room.
- **Collab → Leave Room** — disconnects and clears peers.
- **Collab → Network Panel** — toggles the room status panel.

### Shared data

While connected, your camera position, rotation, and current dataset name are broadcast to peers through an RTCDataChannel. Sprint 10B.2 will add shared dataset state and synchronized operations.

---

## 17. Run tests

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

---

## 18. Next steps

- Read [`docs/Nemosyne_Definitive_Vision_and_Roadmap.md`](Nemosyne_Definitive_Vision_and_Roadmap.md) for the
  current governing spec (target architecture, principles, Gate 0–7 model); archived vision
  essays are historical only.
- Read [`docs/ARTEFACTS.md`](ARTEFACTS.md) to learn the artefact taxonomy.
- Read [`docs/INTERACTIONS.md`](INTERACTIONS.md) to learn the gesture vocabulary.
- Read [`ARCHITECTURE.md`](ARCHITECTURE.md) to see how this project maps data to three.js / WebXR space.
- Tweak the Draco soft-constraint weights in the diagnostic HUD and watch the layout re-solve.
