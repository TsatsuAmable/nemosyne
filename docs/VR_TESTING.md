# VR Testing Guide — ResearchTelemetry on Meta Quest

## Quick Start (Quest 3/3S/2/Pro)

### 1. Host on Local Network

On your development machine:

```bash
cd examples/network-galaxy/
python3 -m http.server 8000
# Or: npx serve -p 8000
```

### 2. Find Your IP

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows
ipconfig | findstr "IPv4"
```

### 3. Open on Quest

1. Open **Meta Browser** on Quest
2. Navigate to: `http://YOUR_IP:8000`
3. Click **Enter VR** button (bottom right)
4. Complete tasks
5. **Exit VR** to see results and export JSON

---

## What Gets Measured

| Metric | Desktop | Quest VR | Research Use |
|--------|---------|----------|--------------|
| Navigation path | Mouse/keyboard | Headset 6DOF | Spatial learning in immersive 3D |
| Task time | Click-to-complete | Trigger-to-complete | Speed comparison 2D vs 3D |
| Gaze/head direction | Mouse hover | Head vector (3S) / Eye tracking (Pro) | Attention analysis |
| Controller input | N/A | Trigger, grip, thumbstick | Interaction modality |
| Hand tracking | N/A | Pinch, grab (Quest 2/3/Pro) | Natural gesture efficacy |
| Teleportation | N/A | Thumbstick movement | Navigation comfort |

---

## Quest-Specific Features

### Controllers (All Quest Models)

```javascript
// Automatically tracked
telemetry.logInteraction('vr-laser-select', 'right-controller', {
  distance: 2.5,  // meters from controller
  target: 'node-A'
});
```

**Visual**: Purple laser lines from controllers (50m range)

### Hand Tracking (Quest 2/3/3S/Pro)

```javascript
// Pinch to select
telemetry.logInteraction('hand-tracking', 'right-hand', {
  gesture: 'pinch',
  confidence: 0.95
});
```

**Enable**: Settings → Experimental → Hand Tracking

### Headset Detection

Automatically logs:
- `vr-session-start` — When user enters immersive mode
- `controller-connected` — Which controllers are active
- `vr-exit` — When user leaves VR

---

## Input Methods Tracked

| Input | Device | Logged As |
|-------|--------|-----------|
| Mouse click | Desktop | `mouse` |
| Touchscreen | Mobile | `touch` |
| VR trigger | Quest controllers | `vr-laser` |
| Hand pinch | Quest hand tracking | `hand-tracking` |

**Analysis**: Compare completion times across input methods:

```javascript
// Query: Is hand tracking faster than controllers?
const handTimes = data.filter(t => t.inputType === 'hand-tracking').map(t => t.timeMs);
const controllerTimes = data.filter(t => t.inputType === 'vr-laser').map(t => t.timeMs);
```

---

## Exporting Data from Quest

### Option 1: In-VR (Recommended)

1. Complete all tasks
2. Press **Oculus button** → **Exit VR**
3. Back in browser, click **Export Data**
4. File saves to Quest Downloads
5. Share via:
   - Meta Browser → Downloads → Share
   - Sideload via USB
   - Email to yourself

### Option 2: Auto-Upload (Advanced)

Enable auto-export to your server:

```javascript
const telemetry = new ResearchTelemetry({
  enabled: true,
  autoExport: true,
  exportInterval: 30000, // Every 30 seconds
  exportEndpoint: 'https://your-research-server.com/collect'
});
```

---

## Testing Checklist

### Pre-Test
- [ ] Quest charged (>50%)
- [ ] Same WiFi network as development machine
- [ ] IP address confirmed accessible
- [ ] Meta Browser updated

### During Test
- [ ] Enter VR mode confirmed
- [ ] Controllers visible
- [ ] Laser pointer working
- [ ] Nodes clickable
- [ ] Timer counting
- [ ] Results panel appears

### Post-Test
- [ ] JSON exported
- [ ] File contains telemetry data
- [ ] Session ID matches
- [ ] VR mode detected in logs

---

## Troubleshooting

### Can't connect to local server

**Problem**: `http://192.168.x.x:8000` not loading

**Solutions**:
1. Check firewall: `sudo ufw allow 8000` (Linux)
2. Try `0.0.0.0` bind: `python3 -m http.server 8000 --bind 0.0.0.0`
3. Verify same network: Both devices on same WiFi
4. Use ngrok for remote access: `ngrok http 8000`

### Controllers not tracking

**Problem**: No laser lines, clicks not registering

**Solutions**:
1. Check controller batteries
2. Re-pair controllers: Settings → Controller → Pair
3. Restart Quest
4. Verify A-Frame loaded (check console)

### Hand tracking not working

**Problem**: Hands visible but can't select nodes

**Solutions**:
1. Enable in Settings → Experimental → Hand Tracking
2. Good lighting required
3. Pinch gesture: Thumb + index finger together
4. Try slower, deliberate movements

### Export not working

**Problem**: Download doesn't start

**Solutions**:
1. Must exit VR mode first (Meta Browser limitation)
2. Check storage space on Quest
3. Try manual copy: `adb pull /sdcard/Download/nemosyne-study-*.json`

---

## Research Protocol

### Controlled Study Setup

**Between-Subjects Design**:
- Group A: Desktop (n=15)
- Group B: Quest VR (n=15)
- Same tasks, same data, different modalities

**Metrics**:
- Primary: Task completion time
- Secondary: Accuracy, navigation path length
- Exploratory: Retention test after 24h

**Controls**:
- Randomize task order
- Same time of day
- Same network size (8 nodes)
- Quiet environment

### Data Validation

Check for:
- Complete navigation paths (>10 points)
- Reasonable task times (5s–120s)
- Correct VR mode detection
- No missing controller events

```javascript
// Validation script
const data = JSON.parse(fs.readFileSync('study-xxx.json'));

console.log('Session ID:', data.sessionId);
console.log('VR Mode:', data.summary.metrics.interactions.some(i => i.type === 'vr-session-start'));
console.log('Task completion:', data.summary.taskSuccessRate);
console.log('Avg task time:', data.summary.metrics.taskCompletions.reduce((a,t) => a + t.timeToComplete, 0) / data.summary.metrics.taskCompletions.length);
```

---

## Privacy on Quest

- **No PII**: No names, emails, Meta IDs
- **Hashed session**: Cannot link to Meta account
- **Local first**: Data stays on device until exported
- **Optional upload**: Only if you configure endpoint

---

## Advanced: Custom Quest Builds

For standalone Quest apps (not browser):

1. Build with **Wonderland Engine** or **Babylon Native**
2. Use same ResearchTelemetry.js
3. Replace `window` references with native APIs
4. Export to `/sdcard/Documents/`

See: `docs/quest-native-integration.md` (if available)

---

## References

- Meta Quest Developer: https://developer.oculus.com/
- A-Frame VR: https://aframe.io/docs/
- WebXR Spec: https://www.w3.org/TR/webxr/

---

*Last Updated: 2026-04-12*  
*Tested on: Quest 3, Quest 3S, Quest 2*
