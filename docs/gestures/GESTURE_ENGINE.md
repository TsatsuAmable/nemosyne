# Gesture Recognition Engine

## Implementation Guide for Real-Time Hand/Eye Gesture Processing

**Version:** 1.0.0  
**Branch:** `gestures`  
**Status:** Implementation Specification

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  GESTURE RECOGNITION ENGINE                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ Input Layer  │──►│ Preprocessor │──►│ Detection    │  │
│  │ (WebXR/API)  │   │ (Filtering)  │   │ Layer        │  │
│  └──────────────┘   └──────────────┘   └──────┬───────┘  │
│                                              │           │
│  ┌──────────────┐   ┌──────────────┐  ┌─────▼────────┐   │
│  │ Action       │◄──│ Semantic     │◄─│ Recognition  │   │
│  │ Dispatcher   │   │ Parser (GEL) │  │ Layer        │   │
│  └──────────────┘   └──────────────┘  └────────────┘   │
│                                                             │
│  [Feedback Loop ───────────────────────────────────────────] │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. The Gesture Pipeline

### 2.1 Stage 1: Input Acquisition

**Frequency:** 90Hz (synchronized with WebXR frame loop)

```typescript
class InputAcquisitionLayer {
  private sources: InputSource[] = [];
  private sampleRate: number = 90;
  
  registerSource(source: InputSource): void {
    this.sources.push(source);
  }
  
  acquire(frame: XRFrame): RawInputFrame {
    return {
      timestamp: performance.now(),
      hands: this.sources
        .filter(s => s.type === 'hand')
        .map(s => s.read(frame)),
      eyes: this.sources
        .filter(s => s.type === 'eye')
        .map(s => s.read(frame)),
      controllers: this.sources
        .filter(s => s.type === 'controller')
        .map(s => s.read(frame)),
      head: this.readHeadPose(frame)
    };
  }
}
```

### 2.2 Stage 2: Signal Preprocessing

**Kalman Filtering for Hand Joints:**

```typescript
class JointFilter {
  private state: KalmanState;
  private processNoise: number = 0.01;
  private measurementNoise: number = 0.1;
  
  predict(): Vec3 {
    // Predict next state
    this.state.position = this.state.position.add(
      this.state.velocity.scale(this.dt)
    );
    
    // Update covariance
    this.state.covariance = this.state.covariance.add(this.processNoise);
    
    return this.state.position;
  }
  
  update(measurement: Vec3): Vec3 {
    // Kalman gain
    const K = this.state.covariance / 
      (this.state.covariance + this.measurementNoise);
    
    // Update estimate
    this.state.position = this.state.position.add(
      measurement.subtract(this.state.position).scale(K)
    );
    
    // Update covariance
    this.state.covariance = (1 - K) * this.state.covariance;
    
    return this.state.position;
  }
}
```

**Exponential Moving Average for Stability:**

```typescript
function smooth(newValue: number, oldValue: number, alpha: number): number {
  return alpha * newValue + (1 - alpha) * oldValue;
}

// Alpha tuning:
// - High (0.8): Responsive but jittery
// - Medium (0.5): Balanced (default)
// - Low (0.2): Smooth but laggy
const DEFAULT_ALPHA = 0.5;
```

### 2.3 Stage 3: Feature Extraction

**Geometric Features:**

```typescript
interface GestureFeatures {
  // Distances
  thumbIndexDistance: number;
  handSpan: number;           // Wrist to middle fingertip
  palmCurvature: number;      // Convex hull area
  
  // Angles
  fingerCurl: number[];        // 5 fingers, 0-1 curl
  splayAngle: number;         // Spread of fingers
  wristRotation: number;       // Relative to forearm
  
  // Velocities
  handVelocity: Vec3;
  fingerVelocities: Vec3[];
  gestureSpeed: number;       // Magnitude of movement
  
  // Derived
  pinchStrength: number;      // 0-1
  gripStrength: number;       // 0-1
  openness: number;          // 0-1
}

function extractFeatures(hand: HandState): GestureFeatures {
  return {
    thumbIndexDistance: distance(
      hand.fingers.thumb[3].position,
      hand.fingers.index[3].position
    ),
    handSpan: distance(
      hand.wrist.position,
      hand.fingers.middle[3].position
    ),
    palmCurvature: estimatePalmCurvature(hand),
    fingerCurl: hand.fingers.map(f => calculateCurl(f)),
    pinchStrength: calculatePinch(hand),
    // ... etc
  };
}
```

### 2.4 Stage 4: Detection Layer

**Threshold-Based Detectors:**

```typescript
class ThresholdDetector {
  private thresholds: Map<string, Threshold> = new Map();
  
  addThreshold(name: string, config: ThresholdConfig): void {
    this.thresholds.set(name, {
      activate: config.activate,
      deactivate: config.deactivate || config.activate * 1.5,
      debounceMs: config.debounceMs || 50,
      state: 'INACTIVE',
      lastActivation: 0
    });
  }
  
  process(features: GestureFeatures): DetectedGestures {
    const detected: DetectedGestures = {};
    const now = performance.now();
    
    for (const [name, threshold] of this.thresholds) {
      const value = this.getValue(features, name);
      
      switch (threshold.state) {
        case 'INACTIVE':
          if (value <= threshold.activate) {
            threshold.state = 'ACTIVE';
            threshold.lastActivation = now;
            detected[name] = { active: true, timestamp: now };
          }
          break;
          
        case 'ACTIVE':
          if (value >= threshold.deactivate) {
            threshold.state = 'INACTIVE';
            detected[name] = { active: false, timestamp: now };
          }
          break;
      }
    }
    
    return detected;
  }
}
```

**Machine Learning Detectors (Optional):**

```typescript
class MLGestureDetector {
  private model: ONNXRuntimeSession;
  private inputBuffer: Float32Array;
  
  async loadModel(modelPath: string): Promise<void> {
    this.model = await ort.InferenceSession.create(modelPath);
  }
  
  predict(features: GestureFeatures): GesturePrediction {
    // Normalize and encode features
    const input = this.encodeFeatures(features);
    
    // Run inference
    const output = this.model.run({ input: input });
    
    // Decode predictions
    return {
      gesture: this.decodeClass(output.class),
      confidence: output.confidence,
      keypoints: output.keypoints
    };
  }
  
  private encodeFeatures(f: GestureFeatures): Float32Array {
    // Flatten to model input format
    return new Float32Array([
      f.thumbIndexDistance,
      f.handSpan,
      ...f.fingerCurl,
      f.pinchStrength,
      f.gripStrength,
      // ... etc
    ]);
  }
}
```

### 2.5 Stage 5: Recognition Layer

**HMM for Sequential Gestures:**

```typescript
class GestureHMM {
  // States: IDLE → GESTURE_START → GESTURE_HOLD → GESTURE_END
  private transitionMatrix: number[][];
  private emissionProbabilities: Map<string, number>;
  private currentState: string = 'IDLE';
  private stateHistory: string[] = [];
  
  transition(detected: DetectedGestures): GestureState {
    const possible = this.getPossibleTransitions(this.currentState);
    const bestTransition = this.findBestTransition(detected, possible);
    
    if (bestTransition.probability > STATE_CHANGE_THRESHOLD) {
      this.currentState = bestTransition.to;
      this.stateHistory.push(this.currentState);
      
      if (this.currentState === 'GESTURE_END') {
        return this.recognizeGesture(this.stateHistory);
      }
    }
    
    return { state: this.currentState, progress: bestTransition.probability };
  }
  
  private recognizeGesture(history: string[]): RecognizedGesture {
    // Viterbi decoding on history
    // Return best matching gesture
  }
}
```

---

## 3. Gesture Templates

### 3.1 Template Matching

**Procrustes Analysis for Hand Shape:**

```typescript
class TemplateMatcher {
  private templates: GestureTemplate[] = [];
  
  addTemplate(template: GestureTemplate): void {
    // Normalize template
    template.normalized = this.normalize(template.joints);
    this.templates.push(template);
  }
  
  match(query: HandState): MatchResult {
    const normalizedQuery = this.normalize(query.joints);
    
    let bestScore = -Infinity;
    let bestMatch: GestureTemplate | null = null;
    
    for (const template of this.templates) {
      const score = this.procrustesDistance(
        normalizedQuery,
        template.normalized
      );
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }
    
    return {
      template: bestMatch,
      score: bestScore,
      confidence: this.scoreToConfidence(bestScore),
      isMatch: bestScore > TEMPLATE_MATCH_THRESHOLD
    };
  }
  
  private procrustesDistance(a: Vec3[], b: Vec3[]): number {
    // 1. Translate to centroid
    // 2. Scale to unit size
    // 3. Rotate to optimal alignment
    // 4. Return sum of squared distances
  }
}
```

### 3.2 Dynamic Time Warping for Trajectories

```typescript
class DTWGestureRecognizer {
  recognize(trajectory: Vec3[], template: Vec3[]): number {
    const n = trajectory.length;
    const m = template.length;
    const dtw: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(Infinity));
    
    dtw[0][0] = 0;
    
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = distance(trajectory[i - 1], template[j - 1]);
        dtw[i][j] = cost + Math.min(
          dtw[i - 1][j],     // insertion
          dtw[i][j - 1],     // deletion
          dtw[i - 1][j - 1]  // match
        );
      }
    }
    
    return dtw[n][m];
  }
}
```

---

## 4. Multi-Hand Coordination

### 4.1 Two-Hand Gestures

**Bimanual Gesture Recognition:**

```typescript
interface BimanualGesture {
  symmetry: 'symmetric' | 'asymmetric' | 'complementary';
  phase: 'in-phase' | 'anti-phase' | 'independent';
  dominance: 'left' | 'right' | 'equal';
}

function analyzeBimanualGesture(
  left: HandState,
  right: HandState
): BimanualGesture {
  // Calculate symmetry score
  const symmetryScore = 1 - procrustesDistance(
    normalize(mirror(left.joints)),
    normalize(right.joints)
  );
  
  // Calculate phase relationship
  const phaseCorr = crossCorrelation(
    left.trajectory,
    right.trajectory
  );
  
  return {
    symmetry: classifySymmetry(symmetryScore),
    phase: classifyPhase(phaseCorr),
    dominance: left.activity > right.activity ? 'left' : 'right'
  };
}
```

---

## 5. Performance Optimization

### 5.1 Spatial Indexing for Ray Casting

```typescript
class SpatialHash {
  private cellSize: number = 0.5; // meters
  private grid: Map<string, Interactable[]> = new Map();
  
  insert(obj: Interactable): void {
    const cell = this.getCell(obj.position);
    const key = `${cell.x},${cell.y},${cell.z}`;
    
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)?.push(obj);
  }
  
  queryRay(ray: Ray, maxDistance: number): Intersection[] {
    const results: Intersection[] = [];
    const cells = this.traverseRayCells(ray, maxDistance);
    
    for (const cell of cells) {
      const key = `${cell.x},${cell.y},${cell.z}`;
      const objects = this.grid.get(key) || [];
      
      for (const obj of objects) {
        const hit = this.rayIntersect(ray, obj);
        if (hit) results.push(hit);
      }
    }
    
    return results.sort((a, b) => a.distance - b.distance);
  }
}
```

### 5.2 LOD for Interaction Targets

```typescript
function getInteractionLOD(
  object: Interactable,
  hand: HandState
): InteractionLevel {
  const distance = hand.position.distanceTo(object.position);
  
  if (distance < 0.5) {
    return {
      geometry: 'FULL',
      collisions: 'MESH',
      haptics: 'HIGH',
      audio: '3D_SPATIAL'
    };
  } else if (distance < 2.0) {
    return {
      geometry: 'SIMPLIFIED',
      collisions: 'BBOX',
      haptics: 'MEDIUM',
      audio: 'AMBIENT'
    };
  } else {
    return {
      geometry: 'PROXY',
      collisions: 'SPHERE',
      haptics: 'NONE',
      audio: 'NONE'
    };
  }
}
```

---

## 6. Implementation Examples

### 6.1 The Pinch Detector

```typescript
class PinchDetector extends GestureDetector {
  private threshold: number = 0.02; // meters
  private lastPinchState: boolean = false;
  private pinchStartTime: number = 0;
  private PRESS_DURATION = 800; // ms for long press
  
  detect(hand: HandState): GestureEvent | null {
    const distance = this.getThumbIndexDistance(hand);
    const isPinched = distance < this.threshold;
    const now = performance.now();
    
    if (isPinched && !this.lastPinchState) {
      // Pinch started
      this.pinchStartTime = now;
      this.lastPinchState = true;
      
      return {
        type: 'PINCH_START',
        hand: hand.handedness,
        position: this.getPinchPoint(hand),
        timestamp: now
      };
    }
    
    if (isPinched && this.lastPinchState) {
      // Pinch held
      const duration = now - this.pinchStartTime;
      
      if (duration > this.PRESS_DURATION) {
        return {
          type: 'PINCH_LONG_PRESS',
          hand: hand.handedness,
          position: this.getPinchPoint(hand),
          duration: duration,
          timestamp: now
        };
      }
      
      return {
        type: 'PINCH_HOLD',
        hand: hand.handedness,
        position: this.getPinchPoint(hand),
        duration: duration,
        timestamp: now
      };
    }
    
    if (!isPinched && this.lastPinchState) {
      // Pinch released
      const duration = now - this.pinchStartTime;
      this.lastPinchState = false;
      
      return {
        type: duration < 200 ? 'PINCH_CLICK' : 'PINCH_RELEASE',
        hand: hand.handedness,
        position: this.getPinchPoint(hand),
        duration: duration,
        timestamp: now
      };
    }
    
    return null;
  }
}
```

### 6.2 The Grab Manipulator

```typescript
class GrabManipulator {
  private grabbedObject: Interactable | null = null;
  private grabOffset: Transform = new Transform();
  private handAtGrab: HandState | null = null;
  
  onPinchStart(event: PinchEvent): void {
    // Ray cast from pinch point
    const hit = this.raycast(event.position, event.direction);
    
    if (hit?.isGrabbable) {
      this.grabbedObject = hit.object;
      this.handAtGrab = event.hand;
      
      // Calculate offset (maintain relative pose)
      this.grabOffset = hit.object.transform
        .inverse()
        .multiply(event.hand.transform);
      
      // Haptic feedback
      this.hapticPulse(event.hand, 0.5, 100);
      
      // Visual feedback
      hit.object.material.highlight = true;
    }
  }
  
  onPinchHold(event: PinchEvent): void {
    if (!this.grabbedObject || !this.handAtGrab) return;
    
    // Update object transform
    const newTransform = event.hand.transform
      .multiply(this.grabOffset);
    
    this.grabbedObject.transform = newTransform;
    
    // Apply constraints (if any)
    this.applyConstraints(this.grabbedObject);
  }
  
  onPinchRelease(event: PinchEvent): void {
    if (!this.grabbedObject) return;
    
    // Check for throw
    if (event.velocity.magnitude > THROW_VELOCITY_THRESHOLD) {
      this.applyPhysicsThrow(this.grabbedObject, event.velocity);
    }
    
    // Clear highlight
    this.grabbedObject.material.highlight = false;
    
    this.grabbedObject = null;
    this.handAtGrab = null;
  }
}
```

---

## 7. Debugging and Visualization

### 7.1 Development Dashboard

```typescript
class GestureDebugger {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  renderDebugView(hand: HandState, gestures: DetectedGestures): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw hand skeleton
    this.drawHandSkeleton(hand);
    
    // Draw detected gestures
    let y = 20;
    for (const [name, gesture] of Object.entries(gestures)) {
      this.drawGestureIndicator(name, gesture, y);
      y += 30;
    }
    
    // Draw confidence heatmap
    this.drawConfidenceHeatmap(hand);
    
    // Draw trajectory trail
    this.drawTrajectory(hand.history);
  }
  
  private drawHandSkeleton(hand: HandState): void {
    // Project 3D joints to 2D canvas
    for (const finger of hand.fingers) {
      for (let i = 0; i < finger.length - 1; i++) {
        const start = this.project(finger[i].position);
        const end = this.project(finger[i + 1].position);
        this.drawLine(start, end, 'cyan');
      }
    }
  }
}
```

---

## 8. Testing and Validation

### 8.1 Gesture Accuracy Metrics

```typescript
interface GestureMetrics {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  
  // Derived
  precision: number;     // TP / (TP + FP)
  recall: number;        // TP / (TP + FN)
  f1Score: number;       // 2 * (precision * recall) / (precision + recall)
  
  // Timing
  latency: number;       // ms from gesture to detection
  jitter: number;        // variance in detection time
}

function evaluateGestureDetection(
  detections: GestureDetection[],
  groundTruth: GestureAnnotation[]
): GestureMetrics {
  // Compare detected vs labeled gestures
  // Return accuracy metrics
}
```

---

## 9. Integration with Nemosyne

### 9.1 Component Architecture

```typescript
// nemosyne-gesture-component.js
AFRAME.registerComponent('nemosyne-gesture-interactable', {
  schema: {
    grabbable: { type: 'boolean', default: true },
    scalable: { type: 'boolean', default: true },
    rotatable: { type: 'boolean', default: true },
    hoverEffect: { type: 'string', default: 'glow' }
  },
  
  init() {
    this.gestureSystem = this.el.sceneEl.systems['gesture'];
    this.gestureSystem.registerInteractable(this.el, this.data);
  },
  
  onGesture(event) {
    switch (event.type) {
      case 'hover-enter':
        this.onHoverEnter(event);
        break;
      case 'grab':
        this.onGrab(event);
        break;
      case 'scale':
        this.onScale(event);
        break;
    }
  }
});
```

---

*"The medium is the message, and the gesture is the medium of VR."*

