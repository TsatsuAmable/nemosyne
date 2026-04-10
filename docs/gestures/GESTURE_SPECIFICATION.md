# Gesture Formalisms: Technical Specification

## Human Interaction in VR Space

**Version:** 1.0.0  
**Branch:** `gestures`  
**Date:** April 2026  
**Status:** Technical Specification

---

## 1. Executive Summary

This document defines the gesture formalism system for Nemosyne/VRIDE, establishing rigorous technical specifications for hand tracking, eye tracking, and their compositional interactions in immersive environments.

**Key Innovation:** Treat gestures as **first-class computational objects** with formal semantics, not merely input events.

---

## 2. Theoretical Framework

### 2.1 The Gesture Taxonomy

```
GESTURE (𝒢)
├── Spatial Component (𝒮)
│   ├── Position (𝒫): ℝ³
│   ├── Orientation (𝒪): SO(3)
│   ├── Velocity (𝒱): ℝ³
│   └── Acceleration (𝒜): ℝ³
├── Temporal Component (𝒯)
│   ├── Duration (Δt): ℝ⁺
│   ├── Cadence (𝒞): frequency-domain
│   └── Rhythm (ℛ): pattern recognition
├── Semiotic Component (Σ)
│   ├── Intent classifier: ℐ → [0,1]
│   ├── Confidence (γ): ℝ[0,1]
│   └── Ambiguity resolution: 𝒜
└── Physiological Component (Φ)
    ├── Fatigue index: ℱ
    ├── Comfort score: 𝒦
    └── Ergonomic load: ℰ
```

### 2.2 Gesture Classification Hierarchy

| Level | Name | Description | Latency Target |
|-------|------|-------------|----------------|
| L0 | Micro-gestures | Sub-100ms intention signals | < 16ms |
| L1 | Atomic gestures | Single-hand discrete actions | < 50ms |
| L2 | Compound gestures | Multi-hand/dual-controller | < 100ms |
| L3 | Sequential gestures | Gesture sequences as commands | < 200ms |
| L4 | Choreographic patterns | Full-body interaction phrases | < 500ms |
| L5 | Ambient gestures | Unconscious/pre-conscious signals | continuous |

---

## 3. Hand Tracking Formalism

### 3.1 The Hand State Vector

**Joint Configuration Space:** 26 DOF per hand

```typescript
interface HandState {
  // Root transform (wrist)
  wrist: {
    position: Vec3;
    rotation: Quat;
    velocity: Vec3;
    angularVelocity: Vec3;
  };
  
  // Finger joints (4 joints × 5 fingers = 20 joints)
  fingers: {
    thumb:  [JointState, JointState, JointState, JointState];
    index:  [JointState, JointState, JointState, JointState];
    middle: [JointState, JointState, JointState, JointState];
    ring:   [JointState, JointState, JointState, JointState];
    pinky:  [JointState, JointState, JointState, JointState];
  };
  
  // Derived features
  gestures: {
    pinchStrength: number;      // 0-1, thumb-index distance
    gripStrength: number;       // 0-1, curl of all fingers
    openess: number;            // 0-1, hand expansion
    pointingVector: Vec3;       // Direction of extended index
  };
  
  // Confidence & tracking
  confidence: number;           // 0-1, tracking quality
  isTracked: boolean;
  handedness: 'left' | 'right';
}

interface JointState {
  position: Vec3;
  rotation: Quat;
  curl: number;              // 0 (extended) to 1 (fully curled)
}
```

### 3.2 Atomic Hand Gestures

**Formal Definition:** An atomic gesture is a boolean predicate over HandState:

```
g ∈ AtomicGesture ⇔ P_g(handState) = true
```

| Gesture | Formal Definition | Detection Threshold | Release Threshold |
|---------|------------------|---------------------|-------------------|
| **Pinch** | ‖thumb_tip - index_tip‖ < ε_pinch | 0.02m | 0.05m |
| **Grab** | avg(finger_curl) > θ_grab | 0.7 | 0.4 |
| **Point** | index_curl < 0.3 ∧ others_curl > 0.7 | - | - |
| **Open Palm** | avg(curl) < 0.2 ∧ openness > 0.8 | - | - |
| **Fist** | avg(curl) > 0.9 | - | - |
| **OK Sign** | pinch ∧ (other_fingers_extended) | 0.02m | 0.05m |

### 3.3 Gesture Recognition Finite State Machine

```
                    ┌─────────────┐
         ┌──────────│    IDLE     │◄────────┐
         │          └──────┬──────┘         │
         │                 │                │
    release│           trigger             │
         ▼                 ▼                │
    ┌─────────┐      ┌──────────┐          │
    │RELEASED │      │ ENGAGED  │          │
    │  (exit) │◄─────│ (active) │──────────┘
    └─────────┘ timeout └──────┬───┘
                              │
                              │ completed
                              ▼
                        ┌──────────┐
                        │COMPLETE  │
                        │ (success)│
                        └──────────┘
```

**Transitions:**
- **IDLE → ENGAGED:** Gesture predicate true for > debounce_time
- **ENGAGED → COMPLETE:** Gesture "completion" criteria met
- **ENGAGED → RELEASED:** Predicate false before completion
- **Any → IDLE:** Timeout or cancellation

### 3.4 Spatial Gesture Mapping

**The Gesture-Action Correspondence:**

```
Spatial Manipulation Gestures:

SELECT:    Pinch (brief) on object
GRAB:      Pinch (hold) on object
MOVE:      Grab + Translation
ROTATE:    Grab × Two-hand twist
SCALE:     Two-hand expand/contract
RELEASE:   Unpinch or throw velocity > threshold

Menu Gestures:
PRIMARY:   Point + pinch (select)
SECONDARY: Palm up + pinch (context menu)
BACK:      Thumb swipe left (go back)
HOME:      OK sign hold (return home)
```

### 3.5 Hand Tracking Confidence Model

**Confidence Score Calculation:**

```typescript
function calculateHandConfidence(hand: HandState): number {
  const factors = {
    // Tracking quality from headset
    trackingQuality: hand.trackingConfidence,  // 0-1
    
    // Line of sight to cameras
    visibility: visibilityScore(hand),         // 0-1
    
    // Self-occlusion (fingers covering palm)
    occlusion: 1 - occlusionScore(hand),       // 0-1
    
    // Temporal consistency
    stability: temporalStability(hand, history), // 0-1
    
    // Velocity reasonableness
    plausibility: physicsPlausibility(hand)    // 0-1
  };
  
  // Weighted harmonic mean (punishes low scores)
  return weightedHarmonicMean(factors, weights);
}

// Minimum confidence for gesture recognition
const GESTURE_CONFIDENCE_THRESHOLD = 0.6;

// Below threshold: show "hand visibility" hint to user
// Above threshold: process gestures normally
```

---

## 4. Eye Tracking Formalism (Gaze Interaction)

### 4.1 The Gaze Vector

**Optical-Kinematic Model:**

```typescript
interface GazeState {
  // Origin and direction
  origin: Vec3;           // Point between eyes (vergence center)
  direction: Vec3;        // Normalized gaze vector
  
  // Vergeance state
  convergenceDistance: number;  // Distance to vergence point (∞ for parallel)
  vergenceAngle: number;       // Angle between eye axes
  
  // Individual eye data
  leftEye: EyeData;
  rightEye: EyeData;
  
  // Derived
  fixation: FixationState;
  saccade: SaccadeState;
  
  // Confidence
  confidence: number;
  isCalibrated: boolean;
}

interface EyeData {
  origin: Vec3;
  direction: Vec3;
  openness: number;      // 0-1, eyelid openness
  pupilDilation: number; // Arbitrary units
}

interface FixationState {
  position: Vec3;        // Point of fixation in 3D space
  duration: number;        // Time fixated (ms)
  stability: number;     // Variance of gaze (lower = more stable)
  isFixating: boolean;   // Is currently in fixation vs saccade
}
```

### 4.2 Fixation Detection Algorithm

**Dispersion-Based Identification (I-DT):**

```typescript
class FixationDetector {
  private window: GazeSample[] = [];
  private readonly WINDOW_DURATION = 100; // ms
  private readonly DISPERSION_THRESHOLD = 2.0; // degrees
  
  process(sample: GazeSample): Fixation | null {
    // Add to temporal window
    this.window.push(sample);
    
    // Remove old samples
    const cutoffTime = sample.timestamp - this.WINDOW_DURATION;
    this.window = this.window.filter(s => s.timestamp > cutoffTime);
    
    // Calculate spatial dispersion
    const dispersion = this.calculateDispersion(this.window);
    
    if (dispersion < this.DISPERSION_THRESHOLD) {
      return {
        center: this.centroid(this.window),
        duration: this.windowDuration(),
        dispersion: dispersion
      };
    }
    
    return null; // Not fixating
  }
  
  private calculateDispersion(samples: GazeSample[]): number {
    // Angular dispersion using arc distance
    const directions = samples.map(s => s.direction);
    const maxAngle = maxAngularSeparation(directions);
    return maxAngle;
  }
}
```

### 4.3 Gaze-to-Object Interaction

**Gaze Ray Casting:**

```
Gaze Selection Pipeline:
1. Cast ray from eye origin along gaze direction
2. Test intersection with interactable objects
3. Apply depth bias (closer objects preferred)
4. Apply angular bias (direct gaze vs peripheral)
5. Return target with confidence score
```

**The Gaze Confidence Score:**

```typescript
interface GazeTarget {
  object: InteractableObject;
  confidence: number;     // 0-1
  distance: number;       // meters
  angle: number;          // degrees from center
  dwellTime: number;      // ms looking at object
}

function calculateGazeConfidence(target: GazeTarget): number {
  const distanceFactor = 1 / (1 + target.distance * 0.1);
  const angleFactor = Math.cos(degToRad(target.angle));
  const dwellFactor = Math.min(target.dwellTime / 500, 1); // Saturate at 500ms
  
  return distanceFactor * angleFactor * dwellFactor * gazeConfidence;
}
```

### 4.4 Dwell-Based Selection

**Temporal Threshold:**

```
Dwell Selection Algorithm:

if (target && !currentSelection) {
  // Start dwell timer
  dwellStart = now;
  showIndicator(target);
} else if (target === currentSelection) {
  // Continue dwelling
  dwellDuration = now - dwellStart;
  updateProgressIndicator(dwellDuration / DWELL_THRESHOLD);
  
  if (dwellDuration >= DWELL_THRESHOLD) {
    select(target);
    dwellStart = null;
  }
} else {
  // Target changed, reset
  dwellStart = null;
  hideIndicator();
}

DWELL_THRESHOLD = 800ms (default)
DWELL_THRESHOLD_CONFIRM = 1200ms (for destructive actions)
```

**Visual Feedback:**
- 0-400ms: Subtle highlight
- 400-800ms: Expanding radial progress indicator
- >800ms: Selection + haptic pulse (if applicable)

---

## 5. Multimodal Fusion: Hand + Eye

### 5.1 The Eye-Hand Coordination Model

**Principle:** Eyes lead, hands follow. Gaze provides **coarse targeting**, hands provide **fine manipulation**.

```
Multimodal Interaction Patterns:

LOOK-TO-SELECT:
  Gaze → Identify target area
  Hand → Confirm with pinch
  
GAZE-STEERED POINTING:
  Gaze → High-level direction
  Hand → Fine-tune laser pointer endpoint
  
ATTENTIVE MANIPULATION:
  Gaze → Defines "working area"
  Hand → Operates within that context
  
GAZE-AWARE UI:
  Gaze → Reveals relevant controls
  Hand → Interacts with revealed controls
```

### 5.2 Attention Field Theory

**The Cone of Attention:**

```
                    Gaze Direction
                         │
                         ▼
    ╲         ╱
     ╲  15°  ╱      ← High attention (foveal)
      ╲    ╱
       ╲  ╱
        ╲╱
       ╱╲╲
      ╱  ╲╲      ← Medium attention (parafoveal)
     ╱ 30° ╲
    ╱        ╲
   ╱   60°    ╲    ← Low attention (peripheral)
  ╱            ╲
```

**Attention-Weighted Interaction:**

```typescript
interface AttentionField {
  center: Vec3;           // Gaze fixation point
  highAttentionRadius: number;   // 15° cone
  mediumAttentionRadius: number; // 30° cone
  peripheralRadius: number;      // 60° cone
}

function getInteractionMode(
  object: Interactable,
  gaze: GazeState,
  hand: HandState
): InteractionMode {
  const angularDistance = angleBetween(
    gaze.direction,
    object.position - gaze.origin
  );
  
  if (angularDistance < 15) {
    // In foveal vision: full interaction
    return 'DIRECT_MANIPULATION';
  } else if (angularDistance < 30) {
    // In parafoveal: preview/advertise
    return 'PREVIEW';
  } else {
    // In peripheral: ambient awareness only
    return 'AMBIENT';
  }
}
```

### 5.3 Eye-Hand Conflict Resolution

**When Gaze and Hand Disagree:**

| Scenario | Gaze Target | Hand Target | Resolution |
|----------|-------------|-------------|------------|
| Distracted gaze | Object A | Object B | Hand wins (intentional) |
| Gaze leading | Object A | Near A | Gaze guides, hand confirms |
| Hand drift | Object A | Empty space | Gaze suggests alternatives |
| Rapid saccade | Object B | Object A | Wait for fixation (>200ms) |

---

## 6. Gesture Composition Algebra

### 6.1 Combinatorial Gesture Language

**The Gesture Expression Language (GEL):**

```
Atomic Gestures:
  P = Pinch
  G = Grab
  R = Release
  Pt = Point
  H = Hold

Spatial Modifiers:
  → = Move right
  ← = Move left
  ↑ = Move up
  ↓ = Move down
  ⟳ = Rotate
  ⤢ = Scale

Temporal Operators:
  ∧ = Simultaneous (AND)
  ∨ = Alternative (OR)
  seq = Sequential
  hold(n) = Hold for n seconds
  repeat(n) = Repeat n times

Example Expressions:
  
  SELECT: P ∧ dwell(0.5)
  
  MOVE: G ∧ (→ ∨ ← ∨ ↑ ∨ ↓)
  
  CLONE: G ∧ hold(1.0) → G →
  
  SCALE: Gₗ ∧ Gᵣ ∧ ⤢
  
  ORBIT: G ∧ ⟳ ∧ repeat
  
  MENU_OPEN: Pt ∧ dwell(1.0)
```

### 6.2 Gesture Parsing

**Shift-Reduce Parser for GEL:**

```typescript
class GestureParser {
  private stack: GestureToken[] = [];
  
  parse(tokens: GestureToken[]): GestureAST {
    for (const token of tokens) {
      this.stack.push(token);
      this.reduce();
    }
    
    if (this.stack.length !== 1) {
      throw new ParseError('Incomplete gesture');
    }
    
    return this.stack[0] as GestureAST;
  }
  
  private reduce(): void {
    // G ∧ G → CompoundGesture
    if (this.matches(['Gesture', 'AND', 'Gesture'])) {
      const right = this.stack.pop();
      this.stack.pop(); // remove AND
      const left = this.stack.pop();
      this.stack.push(new CompoundGesture(left, right, 'AND'));
    }
    
    // G hold(n) → HeldGesture
    if (this.matches(['Gesture', 'HOLD', 'Duration'])) {
      const duration = this.stack.pop();
      this.stack.pop(); // remove HOLD
      const gesture = this.stack.pop();
      this.stack.push(new HeldGesture(gesture, duration));
    }
    
    // ... more reductions
  }
}
```

---

## 7. Technical Implementation

### 7.1 Hand Tracking Implementation

**WebXR Hand Input API:**

```typescript
class HandTrackingManager {
  private session: XRSession;
  private hands: Map<XRHandedness, XRHand> = new Map();
  
  async initialize(session: XRSession): Promise<void> {
    this.session = session;
    
    // Request hand tracking
    session.updateTargetFrameRate(90);
    
    session.addEventListener('handtracking', (e) => {
      this.onHandTrackingChange(e);
    });
  }
  
  processFrame(frame: XRFrame): void {
    for (const hand of this.session.inputSources) {
      if (hand.hand) {
        const handState = this.processHand(hand.hand, hand.handedness);
        this.gestureRecognizer.process(handState);
      }
    }
  }
  
  private processHand(xrHand: XRHand, handedness: XRHandedness): HandState {
    const joints: JointState[] = [];
    
    // XRHandJoint order is defined by WebXR spec
    for (const joint of Object.values(XRHandJoint)) {
      const jointSpace = xrHand.get(joint);
      const pose = this.session.getPose(jointSpace, this.referenceSpace);
      
      joints.push({
        position: pose.transform.position,
        rotation: pose.transform.orientation,
        radius: jointSpace.radius || 0.01
      });
    }
    
    return this.computeHandState(joints, handedness);
  }
}
```

### 7.2 Eye Tracking Implementation

**WebXR Eye Tracking (Optional Extension):**

```typescript
class EyeTrackingManager {
  private gazeHistory: GazeSample[] = [];
  private fixationDetector: FixationDetector;
  
  processFrame(frame: XRFrame): GazeState | null {
    const viewer = frame.session.getViewerPose(this.referenceSpace);
    
    // Check if eye tracking data available
    if (!viewer) return null;
    
    // Get each eye's data
    const leftEye = this.getEyeData(viewer, 'left');
    const rightEye = this.getEyeData(viewer, 'right');
    
    if (!leftEye && !rightEye) return null;
    
    // Compute combined gaze
    const gaze = this.computeGaze(leftEye, rightEye);
    
    // Add to history for fixation detection
    this.gazeHistory.push({
      timestamp: performance.now(),
      ...gaze
    });
    
    // Trim history
    const cutoff = performance.now() - 1000;
    this.gazeHistory = this.gazeHistory.filter(s => s.timestamp > cutoff);
    
    // Detect fixations
    gaze.fixation = this.fixationDetector.process(this.gazeHistory);
    
    return gaze;
  }
  
  private computeGaze(left: EyeData | null, right: EyeData | null): GazeState {
    if (left && right) {
      // Binocular gaze: vergence point
      const origin = lerp(left.origin, right.origin, 0.5);
      const convergence = this.calculateConvergence(left, right);
      
      return {
        origin,
        direction: convergence.direction,
        convergenceDistance: convergence.distance,
        vergenceAngle: convergence.angle,
        leftEye: left,
        rightEye: right
      };
    } else if (left) {
      // Monocular fallback
      return {
        origin: left.origin,
        direction: left.direction,
        convergenceDistance: Infinity,
        leftEye: left,
        rightEye: null
      };
    } else if (right) {
      return {
        origin: right.origin,
        direction: right.direction,
        convergenceDistance: Infinity,
        leftEye: null,
        rightEye: right
      };
    }
    
    throw new Error('No eye data available');
  }
}
```

### 7.3 Performance Requirements

| Metric | Target | Critical |
|--------|--------|----------|
| Hand tracking latency | < 11ms (1 frame @ 90Hz) | < 33ms |
| Eye tracking latency | < 11ms | < 20ms |
| Gesture recognition latency | < 16ms | < 50ms |
| Fusion processing | < 5ms | < 10ms |
| Total pipeline | < 20ms | < 50ms |

---

## 8. Ergonomics and Accessibility

### 8.1 The Gorilla Arm Problem

**Definition:** Arm fatigue from holding hands at interaction height.

**Mitigations:**
- **Rest surfaces:** Encourage forearm/elbow support
- **Low-energy alternatives:** Dwell-gaze instead of hand gestures
- **Gesture compression:** Compound actions in single movements
- **Adaptive UI:** Moves to user's comfortable range

### 8.2 Accessibility Modes

| Mode | Adaptation | Use Case |
|------|-----------|----------|
| **Gaze-only** | Dwell selection, no hand required | Hand tremors, paralysis |
| **Voice-hybrid** | "Select that" + gaze | Limited hand mobility |
| **Controller fallback** | Physical buttons, haptic feedback | Low confidence hand tracking |
| **Seated mode** | Adjusted height, reach constraints | Wheelchair users, fatigue |
| **High-contrast** | Large targets, audio feedback | Low vision |

---

## 9. Appendix: Gesture Library Reference

### 9.1 Standard Gestures (Quest/Universal)

| Gesture | Input | Action | Context |
|---------|-------|--------|---------|
| Select | A button / Pinch | Primary action | Universal |
| Back | B button / Palm-swipe | Navigate back | Universal |
| Menu | Menu button / Palm-up | Open menu | Universal |
| Grab | Grip + Hold | Grab object | In scene |
| Teleport | Thumbstick forward | Move player | Locomotion |
| Turn | Thumbstick left/right | Rotate view | Locomotion |
| Scale | Two-hand expand | Resize | Object selected |

### 9.2 Platform-Specific Gestures

**Quest Hand Tracking:**
- Pinch-to-click (thumb + index)
- Point-and-release (for UI)

**Quest Pro with Eye Tracking:**
- Gaze + pinch (faster selection)
- Foveated rendering enabled

**Apple Vision Pro:**
- Pinch (thumb + index primary)
- Direct-touch (finger-tip on virtual surfaces)
- Eye-driven focus

---

## 10. References

- **WebXR Hand Input Module:** https://immersive-web.github.io/webxr-hand-input/
- **Eye Tracking in VR:** Jacob & Karn (2003), "Eye Tracking in Human-Computer Interaction"
- **Fitts' Law in VR:** Bowman et al. (2012), "3D User Interfaces"
- **Gesture Recognition:** Wobbrock et al. (2007), "Gestures without Libraries"

---

*"The hand is the window on to the mind."* — Immanuel Kant

