# Nemosyne Examples Gallery

> ⚠️ **RESEARCH PREVIEW**: These examples demonstrate what's technically possible, not production applications. All use **simulated data**—real integrations await empirical validation.

---

## Quick Start

All examples are static HTML files with **mock data generators**:

```bash
# Start a local server
npx serve examples/

# Or with Python
python -m http.server 8080

# Then navigate to
http://localhost:8080/hello-world/
```

---

## Examples Overview

### Core Examples (Working)

| Example | Description | Data | Status |
|---------|-------------|------|--------|
| **hello-world** | Basic crystal artefact | Static | ✅ Works |
| **network-galaxy** | Force-directed network | Mock topology | ⚠️ Simulated |
| **bar-chart** | Spatial bar chart | Static CSV | ✅ Works |
| **timeline-spiral** | Temporal spiral | Mock time series | ⚠️ Simulated |
| **data-tree** | File system tree | Static JSON | ✅ Works |
| **virtual-worlds** | Game mechanics demo | N/A | ⚠️ Tech demo |

### Domain Examples (Visual Prototypes)

These show **what might be possible**. They use **simulated data**, not real integrations.

| Example | Domain | Data Source | Reality |
|---------|--------|-------------|---------|
| **industrial-iot** | Manufacturing | **Mock WebSocket** | Simulated sensors |
| **financial-markets** | Finance | **Mock prices** | Random walk generator |
| **scientific-research** | Science | **Static molecule** | Sample PDB, not live |
| **medical-imaging** | Healthcare | **Sample images** | Not DICOM connected |
| **smart-cities** | Urban | **Mock sensor grid** | No real IoT |
| **education-solar** | Education | **Static orbits** | Simplified physics |

---

## What These Examples Actually Are

### Purpose
These demonstrate:
- **Technical feasibility**: "Can we render 3D data in VR?" (Yes)
- **Interaction patterns**: "How might users navigate?" (Proposed)
- **Visual concepts**: "What might this look like?" (Speculative)

### Not Demonstrated
- **Utility**: "Is this better than 2D?" (Unknown)
- **Real-world integration**: "Does this work with actual data?" (Not tested)
- **Performance at scale**: "Can it handle 10k nodes?" (Unbenchmarked)

---

## Example Details

### Industrial IoT (Simulated)

**Location:** `examples/industrial-iot/`

**What it actually does:**
- Generates random temperature/pressure values every 2 seconds
- Displays them as colored cylinders
- **Not connected to any real sensors**

**Data Model (Mock):**
```javascript
{
  sensorId: 'sensor-1',
  type: 'temperature',
  value: Math.random() * 100,  // Simulated
  threshold: 100,
  status: Math.random() > 0.8 ? 'warning' : 'normal'  // Random
}
```

**Research Question:** Would real-time sensor visualization in VR improve monitoring compared to dashboard alarms?

**Answer:** Unknown. This demo can't answer that.

---

### Financial Markets (Simulated)

**Location:** `examples/financial-markets/`

**What it actually does:**
- Generates random price movements
- Displays as 3D bars
- **Not connected to any exchange**

**Data Model (Mock):**
```javascript
{
  symbol: 'BTC-USD',
  price: previousPrice + (Math.random() - 0.5) * 100,  // Random walk
  volume: Math.floor(Math.random() * 10000),
  change: (Math.random() - 0.5) * 5
}
```

**Research Question:** Would traders make better decisions with 3D market depth visualization?

**Answer:** Unknown. This demo can't answer that.

---

### Scientific Research (Static)

**Location:** `examples/scientific-research/`

**What it actually does:**
- Displays a static molecular structure (caffeine)
- **Not fetching from RCSB PDB database**
- **Not live research data**

**Data:** Hardcoded JSON of caffeine atoms

**Research Question:** Does manipulating molecules in VR improve structural understanding?

**Answer:** Unknown. This demo can't answer that.

---

### Medical Imaging (Static)

**Location:** `examples/medical-imaging/`

**What it actually does:**
- Shows sample medical images
- **Not connected to PACS**
- **Not real patient data**

**Data:** Sample PNG images, not DICOM

**Research Question:** Would radiologists benefit from VR review of volumetric scans?

**Answer:** Unknown. This demo can't answer that.

---

### Smart Cities (Simulated)

**Location:** `examples/smart-cities/`

**What it actually does:**
- Generates mock traffic/energy data
- Updates every 3 seconds
- **Not connected to city sensors**

**Data Model (Mock):**
```javascript
{
  zoneId: 'Zone-1',
  traffic: Math.floor(Math.random() * 100),
  energy: Math.floor(Math.random() * 100),
  airQuality: Math.floor(Math.random() * 100)
}
```

**Research Question:** Would urban planners make better decisions with 3D city data?

**Answer:** Unknown. This demo can't answer that.

---

### Education Solar (Simplified)

**Location:** `examples/education-solar/`

**What it actually does:**
- Animates simplified orbits
- **Not using NASA Horizons API**
- **Not accurate orbital mechanics**

**Data:** Hardcoded orbital parameters

**Research Question:** Does embodied learning in VR improve astronomical understanding?

**Answer:** Unknown. This demo can't answer that.

---

## Performance Notes

| Example | Entities | Data Source | Desktop | Mobile VR |
|---------|----------|-------------|---------|-----------|
| Industrial IoT | 12 | Mock | Unknown | Unknown |
| Financial Markets | 15 | Mock | Unknown | Unknown |
| Scientific | 50 | Static | Unknown | Unknown |
| Medical | 5 | Static | Unknown | Unknown |
| Smart Cities | 40 | Mock | Unknown | Unknown |
| Solar | 500+ | Static | Unknown | Unknown |

**Note:** "Unknown" means we haven't benchmarked. These numbers are unvalidated.

---

## How to Use These Examples

### For Technical Exploration
1. Open in browser
2. Verify 3D rendering works
3. Test interactions
4. **Do not conclude utility** from visual appeal

### For Research Design
1. Identify research question
2. Replace simulated data with real data
3. Design controlled study
4. Compare 3D vs 2D for specific task
5. Publish results

### For Real Integration
If you want to connect to real data sources:

```javascript
// Replace this:
setInterval(() => generateMockData(), 2000);

// With this:
const ws = new WebSocket('wss://your-real-api.com/data');
ws.onmessage = (event) => updateVisualization(JSON.parse(event.data));
```

---

## Contributing Real Integrations

If you build a working integration with real data:

1. Fork the repository
2. Add your example to `examples/your-integration/`
3. Document the data source
4. Report your findings (even if negative)
5. Submit pull request

**We especially want:**
- User studies comparing 3D vs 2D
- Performance benchmarks on real hardware
- Integration attempts (successful or failed)

---

## Research Context

These examples exist to:
1. **Demonstrate technical feasibility** (can we render this?)
2. **Provoke research questions** (should we render this?)
3. **Invite collaboration** (help us find out)

They do **not** exist to:
1. Prove 3D is better
2. Showcase production features
3. Replace existing tools

**The important question:** For which tasks, if any, does this approach work?

---

## Support

- GitHub Issues: Bug reports
- GitHub Discussions: Research Q&A
- No commercial support (research project)

---

---

## Research Study Examples

### Network Galaxy — Topology Reading Study

**Location:** `examples/network-galaxy/`

**Purpose:** Empirical validation of topology comprehension in 3D vs 2D

**What it measures:**
- Time to identify network hub nodes
- Navigation patterns through 3D space
- Gaze dwell on relevant vs irrelevant nodes
- Task success rates

**Research Questions:**
1. Is 3D network visualization faster for finding central nodes?
2. Do users develop spatial memory for node positions?
3. Does scale affect comprehension (8 vs 50 vs 200 nodes)?

**How to run:**
```bash
cd examples/network-galaxy/
python3 -m http.server 8000
# Open http://localhost:8000 in browser
# Complete the 3 tasks
# Export JSON data for analysis
```

**Data collected:**
```json
{
  "sessionId": "a1b2c3d4...",
  "taskCompletions": [
    {
      "taskId": "task-1-find-hub",
      "success": true,
      "timeToComplete": 12450,
      "navigationPathLength": 45,
      "interactionsCount": 3
    }
  ],
  "navigationPath": [...],
  "interactions": [...],
  "gazeTargets": [...]
}
```

**Privacy:** No PII, hashed session IDs, stays client-side

---

## ResearchTelemetry API

All examples can integrate with the research telemetry system:

```javascript
import { ResearchTelemetry } from '../src/core/ResearchTelemetry.js';

const telemetry = new ResearchTelemetry({
  enabled: true,
  exportFormat: 'json'
});

// Attach to scene
telemetry.attachToScene(document.querySelector('a-scene'));

// Log custom events
telemetry.logTaskCompletion('find-bridge-nodes', true, 45000);

// Export for analysis
const data = telemetry.exportData();
download(data, `study-${telemetry.sessionId}.json`);
```

### Available Metrics

| Metric | Method | Research Use |
|--------|--------|--------------|
| Navigation path | `trackNavigation()` | Spatial learning analysis |
| Interaction frequency | `logInteraction()` | Exploration patterns |
| Gaze dwell time | `trackGaze()` | Attention analysis |
| Task completion | `logTaskCompletion()` | Efficacy measurement |
| Layout performance | `logLayoutEvent()` | Algorithm comparison |

See `src/core/ResearchTelemetry.md` for full API documentation.

---

*Last Updated: 2026-04-12*  
*Version: 0.2.0-research*
