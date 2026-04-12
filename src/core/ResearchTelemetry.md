# ResearchTelemetry

Privacy-preserving telemetry system for empirical validation of Nemosyne visualizations.

## Purpose

Collects interaction data to answer research questions:
- Does 3D navigation improve data comprehension?
- Which layout algorithms are most effective?
- What interaction patterns predict task success?
- How does spatial organization affect recall?

## Privacy

- **No PII**: No names, emails, or identifying information
- **Hashed session IDs**: Cannot track individuals across sessions
- **Client-side by default**: Data stays in browser
- **Opt-in**: Must be explicitly enabled
- **Transparent**: Users can see exactly what's collected

## Quick Start

```javascript
import { ResearchTelemetry } from 'nemosyne';

// Initialize telemetry
const telemetry = new ResearchTelemetry({
  enabled: true,
  exportFormat: 'json',
  autoExport: false
});

// Attach to A-Frame scene
telemetry.attachToScene(document.querySelector('a-scene'));

// Log task completions for studies
telemetry.logTaskCompletion('find-cluster-bridge', true, 45000);

// Export data for analysis
const data = telemetry.exportData();
console.log(data);
```

## Data Collected

### Navigation Path
- Position in 3D space over time
- Rotation/head orientation
- Velocity of movement

### Interactions
- Click events on elements
- Hover duration
- Selection patterns
- Drag/drop operations

### Gaze Analysis
- Time spent looking at specific elements
- Fixation detection (800ms threshold)
- Revisit patterns

### Layout Metrics
- Time to render each layout
- Layout switches by user
- Performance scores

### Task Completion
- Task ID and success/failure
- Time to complete
- Error count
- Navigation path length at completion

## API Reference

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable/disable telemetry |
| `exportFormat` | string | 'json' | 'json' or 'csv' |
| `autoExport` | boolean | false | Auto-export at intervals |
| `exportInterval` | number | 30000 | Export interval in ms |

### Methods

#### `trackNavigation(camera)`
Records camera position and rotation. Called automatically when attached to scene.

#### `logInteraction(type, targetId, details)`
Log user interactions:
```javascript
telemetry.logInteraction('click', 'node-42', { 
  button: 'left', 
  modifier: 'shift' 
});
```

#### `trackGaze(elementId, duration)`
Track gaze dwell time on elements.

#### `logTaskCompletion(taskId, success, timeToComplete, errors)`
Log study task outcomes:
```javascript
telemetry.logTaskCompletion(
  'find-bridge-nodes',  // task ID
  true,                  // success
  45000,                 // time in ms
  ['clicked-wrong-node'] // errors
);
```

#### `exportData(format)`
Export all collected data:
```javascript
// JSON (default)
const jsonData = telemetry.exportData('json');

// CSV
const csvData = telemetry.exportData('csv');
```

#### `clear()`
Clear all collected data (start fresh).

### Events

Telemetry emits events you can listen for:

```javascript
window.addEventListener('nemosyne-telemetry-interaction', (e) => {
  console.log('User interaction:', e.detail);
});

window.addEventListener('nemosyne-telemetry-task-complete', (e) => {
  console.log('Task completed:', e.detail);
});
```

## Research Study Integration

### Example: Layout Comparison Study

```javascript
const telemetry = new ResearchTelemetry({ enabled: true });

// Participant completes tasks with different layouts
async function runStudy(layoutType, data) {
  // Set up visualization
  const scene = createVisualization(layoutType, data);
  telemetry.attachToScene(scene);
  
  // Task: Find the connection between two clusters
  const startTime = Date.now();
  await waitForTaskCompletion(); // Your task logic
  const completionTime = Date.now() - startTime;
  
  // Log completion
  const success = checkAnswer();
  telemetry.logTaskCompletion(
    `find-connection-${layoutType}`,
    success,
    completionTime
  );
  
  // Get results
  return telemetry.exportData();
}

// Compare layouts
const gridResults = await runStudy('grid', testData);
const forceResults = await runStudy('force', testData);
const treeResults = await runStudy('tree', testData);

// Analyze: Which layout produced fastest completion?
```

### Data Analysis

Export JSON structure:
```json
{
  "sessionId": "a1b2c3d4...",
  "exportTime": 1712934000000,
  "sessionDuration": 120000,
  "summary": {
    "totalInteractions": 45,
    "uniqueElementsInteracted": 12,
    "totalNavigationPoints": 230,
    "averageVelocity": 2.3,
    "mostViewedElements": [...],
    "taskSuccessRate": 0.85
  },
  "metrics": {
    "navigationPath": [...],
    "interactions": [...],
    "gazeTargets": [...],
    "taskCompletions": [...]
  }
}
```

## Integration with DataNativeEngine

```javascript
const engine = new DataNativeEngine({
  telemetry: true
});

// Telemetry automatically tracks:
// - Layout choices made by auto-detection
// - User overrides of automatic layouts
// - Gesture interactions
// - Data transformation times
```

## Security Considerations

- **Never send raw telemetry to untrusted servers**
- **Hash or anonymize any identifying data**
- **Inform users what data is collected**
- **Allow opt-out**

## License

MIT — Same as Nemosyne

---

**For Research Use**: This tool is for academic/research purposes to validate whether 3D VR data visualization provides measurable benefits. Results may be negative—that's valuable science too.
