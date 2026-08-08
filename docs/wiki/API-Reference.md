# Nemosyne API Reference

Comprehensive programmatic API documentation for Nemosyne 2.0 WebXR core modules.

---

## 1. `World` (`src/vr/World.ts`)

The central coordinator managing the three.js scene, WebXR session, data elements, UI panels, and input routing.

```typescript
import { World } from 'nemosyne';

const world = new World({
  container: document.body,
  enableVR: true,
  theme: 'cyberpunk',
});

// Load a dataset into 3D VR space
await world.loadDataset(dataset);
```

### Key Methods
- `loadDataset(dataset: Dataset)`: Synthesizes 3D memory palace layout for the dataset.
- `undoAnalysis()` / `redoAnalysis()`: Steps backward/forward through analysis history.
- `setTheme(themeName: string)`: Updates environmental fog, lighting, and atmosphere presets.

---

## 2. `GestureClassifierModel` (`src/ai/GestureClassifierModel.ts`)

AI gesture classifier and biomechanical auto-calibration model featuring an ONNX Runtime Web bridge.

```typescript
import { GestureClassifierModel } from 'nemosyne';

const classifier = new GestureClassifierModel(0.12, 0.045);
await classifier.initONNXBridge();

// Record 60Hz joint sample
classifier.recordSample('left', positionVector, isPinched);

// Classify dual-hand gesture
const result = classifier.classifyGesture('left', 'right');
console.log(result.gestureName, result.confidence, result.calibration);
```

---

## 3. `SpatialAudioSynthesizer` (`src/vr/audio/SpatialAudioSynthesizer.ts`)

Web Audio API `PannerNode` HRTF 3D spatial audio synthesizer.

```typescript
import { SpatialAudioSynthesizer } from 'nemosyne';

const synth = new SpatialAudioSynthesizer({ masterVolume: 0.2, panningModel: 'HRTF' });

// Update audio listener orientation from VR camera
synth.updateListenerTransform(camera);

// Play spatial 3D chime at world vector
synth.playSpatialChime(positionVector, 880, 0.12);
```

---

## 4. `NetworkManager` (`src/network/NetworkManager.ts`)

WebRTC P2P `RTCDataChannel` manager for multi-analyst spatial collaboration.

```typescript
import { NetworkManager } from 'nemosyne';

const net = new NetworkManager({ peerName: 'Analyst-1' });
await net.connect('room-alpha');

// Broadcast 60Hz telemetry record
net.broadcastUserTelemetry({ activeColumn: 'revenue', sentimentScore: 0.85 });
```

---

## 5. `UserCloudAvatar` (`src/vr/artifacts/UserCloudAvatar.ts`)

Dynamic 3D instanced particle cloud representing peer analysts based on their interaction telemetry.

```typescript
import { UserCloudAvatar } from 'nemosyne';

const avatar = new UserCloudAvatar(userMetadataDataset);
scene.add(avatar);

// Per-frame update
avatar.updateTelemetry(peerHeadVector, performance.now());
```

---

## 6. `RepresentationCarousel` (`src/vr/ui/RepresentationCarousel.ts`)

3D VR candidate representation carousel featuring diegetic soft-constraint weight sliders.

```typescript
import { RepresentationCarousel } from 'nemosyne';

const carousel = new RepresentationCarousel({
  onWeightChange: (candidateId, weights) => {
    // Feed weight adjustments to DracoWorldModel
    worldModel.ingestManualTuning(weights);
  },
});
```
