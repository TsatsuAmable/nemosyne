# Human Interaction Patterns in VR

## A Study of Embodied Interaction Design

**Version:** 1.0.0  
**Branch:** `gestures`  
**Date:** April 2026

---

## 1. The Physiology of VR Interaction

### 1.1 The Reach Envelope

**Anthropometric Bounds (95th Percentile Adult):**

```
Standing Reach Envelope:
                      ╭────────────╮
                    ╱              ╲
                  ╱    COMFORT      ╲
                ╱       ZONE         ╲
              ╱       (0.5-0.8m)       ╲
            ╱                            ╲
          ╱      STRETCH                  ╲
         │        ZONE                      │
        │        (0.8-1.2m)                 │
        │                                    │
       │                                      │
      │        MAX REACH                      │
     │         (>1.2m)                        │
    │                                            │
   │                                              │
  └───────────────────┬────────────────────────────┘
                      │
                   Shoulder
                   (pivot point)

Lateral (arm-span) envelope:
  Total span: ~1.7m
  Comfortable lateral motion: ~0.6m each side
  Fine manipulation zone: ~0.3m radius
```

**Implications for VR Design:**
- Place interactive elements in the 0.5-0.8m "comfort zone"
- Require deliberate stretch movement for secondary actions
- Support seated mode with adjusted reach envelope

### 1.2 Fatigue Curves

**The Gorilla Arm Effect:**

```
Fatigue Score Over Time:

100 │
    │                        ╭────
 80 │     ╭───╮            ╭─╯
    │    ╱   ╲          ╭─╯
 60 │   ╱     ╲        ╭╯     ← With breaks
    │  ╱       ╲______╱
 40 │_╱                     ╭────
    │     ╭───╮            ╭─╯
 20 │    ╱   ╲          ╭─╯     ← Continuous use
    │___╱     ╲________╱
  0 └──────────────────────────►
    0    5    10   15   20   25   30 (minutes)

    ═══ Fatigue onset: 5-7 minutes
    ═══ Significant degradation: 15 minutes
    ═══ Recommendation: Break every 5-7 minutes, 
        support rest positions
```

---

## 2. Cognitive Load in VR

### 2.1 The Working Memory Limit

**Miller's Law in Spatial Context:**

```
Working Memory Capacity: 7 ± 2 items

But in VR, this reduces due to:
- Spatial navigation demands
- Novel input modalities
- Sensory overload

Effective VR working memory: 4 ± 1 items
```

**Design Implications:**
- Limit active tools to 4 visible at once
- Group related controls spatially
- Provide persistent visual anchors

### 2.2 The Attention Tunnel

**Foveal vs Peripheral Attention:**

```
Visual Field in VR:

                    ┌──────────┐
                   ╱  4° cone  ╲
                  ╱  FOVEAL     ╲
                 ╱   100% attn   ╲
                ╱───────────────────╲
               ╱                     ╲
              ╱    PARAFOVEAL (15°)   ╲
             ╱      40% processing     ╲
            ╱─────────────────────────────╲
           ╱                                ╲
          ╱      PERIPHERAL (60-90°)       ╲
          │        10% processing           │
          │                                 │
          └─────────────────────────────────┘

Design strategy:
- Critical info: Foveal
- Context/status: Parafoveal  
- Ambient awareness: Peripheral
```

---

## 3. Gesture Semantics

### 3.1 The Gesture Vocabulary

**Universal Human Gestures (cross-cultural):**

| Gesture | Meaning | VR Application |
|---------|---------|----------------|
| **Point** | Indication/selection | Laser pointer, target designation |
| **Open Palm** | Showing/offering | Menu invocation, "here" |
| **Closed Fist** | Grabbing/aggression | Grab, clench-to-activate |
| **Thumbs Up** | Approval | Confirmation, "yes" |
| **Wave** | Attention/greeting | Summon, "hello" |
| **Circle (OK)** | Agreement/connection | Completion, link two things |
| **Swipe** | Dismissal/cancel | "no", undo, back |

**Cultural Variations to Avoid:**
- Thumbs down (offensive in some cultures)
- Beckoning gesture (different meanings)
- Single finger point (rude in some contexts)

### 3.2 Metaphor Consistency

**The Direct Manipulation Metaphor:**

```
Physical World          VR Mapping
─────────────────────────────────────
Pick up object    →    Pinch + move
Place object      →    Release pin
Push object       →    Direct contact
Pull object       →    Hand on surface, move
Rotate object     →    Two-hand twist
Scale object      →    Two-hand expand
Throw object      →    Release with velocity
```

**The Magic Metaphor (superpowers):**

```
Physical World          VR Enhancement
────────────────────────────────────────
Teleport          →    Point + confirm
Distant grab      →    Laser + pinch
Multi-select      →    Volumetric brush
Undo              →    Time reversal
Duplicate         →    Clone gesture
Search            →    Voice + spatial results
```

**Recommendation:** Establish metaphor family per application mode (direct vs magic) and maintain consistency.

---

## 4. Social Interaction in VR

### 4.1 Proxemics

**Spatial Relationships (Hall's Zones):**

```
Distance (m)    Zone           Interaction Type
─────────────────────────────────────────────────
0 - 0.45        Intimate       Personal manipulation
0.45 - 1.2      Personal       Collaboration, conversation
1.2 - 3.6       Social         Presentation, overview
3.6+            Public         Ambient, broadcast

VR adaptations:
- Intimate zone: Self-interaction, tool manipulation
- Personal zone: 1:1 collaboration, detailed work
- Social zone: Group presentations, reviews
- Public zone: Large data landscape, navigation
```

### 4.2 Avatar Representation

**Fidelity Spectrum:**

```
Abstraction Level:

High ──► Photorealistic
  │      - Full face tracking
  │      - Eye contact
  │      - Micro-expressions
  │      - Uncanny valley risk
  │
  ├──► Stylized
  │      - Expressive avatars
  │      - Emphasis on gesture
  │      - Reduced complexity
  │
  ├──► Abstract
  │      - Floating hands
  │      - Minimal avatars
  │      - Focus on action over appearance
  │
Low ──► Symbolic
       - Color/shape only
       - No embodiment
       - Minimal distraction

Recommendation for VRIDE: Abstract to Stylized
- Show hands + forearms (tool visibility)
- Head cursor for gaze direction
- Voice spatialization essential
```

### 4.3 Co-Presence Guidelines

**Rules for Multi-User Interaction:**

1. **Spatial Audio is Mandatory**
   - Voice volume ∝ 1/distance²
   - Directional audio (HRTF)
   - Proximity chat by default

2. **Visual Presence Indicators**
   - Avatar hands always visible (if tracked)
   - Gaze cursor or head direction
   - Activity state (idle, typing, presenting)

3. **Collision Avoidance**
   - Ghost mode for "passing through"
   - Personal space bubble
   - Hand overlap indication

4. **Turn-Taking Mechanisms**
   - Visual "talking stick" indicator
   - Gaze-based attention direction
   - Explicit ownership of objects

---

## 5. Interaction States

### 5.1 The Interaction State Machine

```
┌────────────┐
│   IDLE     │◄──────────────────────────┐
└─────┬──────┘                            │
      │ gaze at interactive                │
      ▼                                   │
┌────────────┐                            │
│  HOVER     │─── dwell ─────► preview   │
│  (aware)   │                            │
└─────┬──────┘                            │
      │ gesture intention                  │
      ▼                                   │
┌────────────┐     intent canceled        │
│  ENGAGED   │────────────────────────────┤
│ (active)   │                            │
└─────┬──────┘                            │
      │ complete/fail                      │
      ▼                                   │
┌────────────┐                            │
│  RESULT    │────────────────────────────┘
│  (confirm) │
└────────────┘

Timing:
- Hover → Engaged: < 50ms (feel responsive)
- Engaged → Result: varies by gesture
- All states: Haptic feedback at transition
```

### 5.2 Modal Interactions

**Mode Confusion Prevention:**

```typescript
interface ModalSystem {
  // Explicit mode indicators
  currentMode: 'NAVIGATE' | 'SELECT' | 'MANIPULATE' | 'MENU';
  
  // Visual state
  cursorAppearance: CursorType;
  handVisuals: HandVisual;
  contextPanel: ContextPanel | null;
  
  // Transition rules
  transitions: {
    from: Mode;
    to: Mode;
    trigger: GestureEvent;
    confirmation: boolean;  // Require explicit confirm?
  }[];
}

// Mode indication strategies:
// 1. Cursor shape (pointer, grab, resize, etc)
// 2. Hand avatar (open, closed, tool-held)
// 3. Color coding (green=select, blue=navigate, red=warning)
// 4. Context panel (show current mode name)
```

---

## 6. Error Prevention and Recovery

### 6.1 Gesture Disambiguation

**When Gestures Are Ambiguous:**

```
Scenario: User makes "pinch" motion

Possible Interpretations:
├─ Select (brief pinch)
├─ Grab (hold pinch)
├─ Zoom (two-hand pinch)
├─ Menu (palm-up pinch)
└─ Delete (pinch + throw)

Resolution Strategy:
1. **Temporal disambiguation**: Wait 200ms for full gesture
2. **Spatial disambiguation**: Check hand position/context
3. **Machine learning**: Predict based on history
4. **Explicit confirmation**: Show "did you mean?" prompt
5. **Progressive commitment**: Low-cost trial action
```

### 6.2 Undo Architecture

**Gesture-Specific Undo:**

```typescript
interface UndoEntry {
  timestamp: number;
  action: string;
  undo: () => void;
  redo: () => void;
  gesture: GestureRecord;  // Can replay/reverse
}

class GestureUndoStack {
  private stack: UndoEntry[] = [];
  private pointer: number = -1;
  
  push(entry: UndoEntry): void {
    // Remove redos after new action
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(entry);
    this.pointer++;
    
    // Limit stack size
    if (this.stack.length > 50) {
      this.stack.shift();
      this.pointer--;
    }
  }
  
  undo(): void {
    if (this.pointer >= 0) {
      this.stack[this.pointer].undo();
      this.pointer--;
    }
  }
  
  // Gestural undo: "thumb swipe left"
  onUndoGesture(): void {
    this.undo();
    this.hapticFeedback('undo');
  }
}
```

---

## 7. Accessibility in VR

### 7.1 Motor Ability Considerations

| Condition | Adaptation | Implementation |
|-----------|-----------|----------------|
| Tremor | Smoothing filter | Exponential moving average, α=0.2 |
| Limited range | Virtual arm extension | Laser pointer with "distant grab" |
| Single-handed | Mirror mode | Ambidextrous UI, one-hand gestures |
| Paralysis | Gaze-only mode | Dwell selection, head gestures |
| No hand tracking | Controller fallback | Button mappings, joystick |

### 7.2 Sensory Considerations

| Condition | Adaptation | Implementation |
|-----------|-----------|----------------|
| Low vision | Scale + contrast | 2x scale, high-contrast mode |
| Color blind | Pattern + texture | Shape coding, not just color |
| Hearing loss | Visual + haptic | Captioning, vibration alerts |
| Vestibular sensitivity | Comfort mode | Reduced motion, snap turns |
| Photosensitivity | No flicker | >60Hz minimum, no strobe |

---

## 8. Performance Guidelines

### 8.1 Latency Budgets

```
Total Interaction Pipeline:

Input acquisition:        2-4ms
  └─ Sensor polling
  └─ Data transfer

Signal processing:          3-5ms
  └─ Filtering
  └─ Feature extraction

Gesture recognition:        2-4ms
  └─ State machine
  └─ Pattern matching

Application response:       2-4ms
  └─ Visual update
  └─ Haptic trigger

Total latency:              9-17ms
Frame budget @ 90Hz:       11.1ms
Safety margin:              -6 to +2ms

Critical: Must stay <20ms total
Recommendation: Target <15ms for 90fps
```

### 8.2 Frame Rate Requirements

| Content Type | Minimum FPS | Notes |
|--------------|-------------|-------|
| Static UI | 60 | OK for menus |
| Hand tracking | 90 | Below feels laggy |
| Fast gestures | 120+ | Sports/high speed |
| Driving/flight | 90-120 | Motion intensive |
| Social VR | 90 | Eye contact sensitive |

---

## 9. Cultural Considerations

### 9.1 Gesture Localization

**High-Risk Gestures to Avoid:**
| Gesture | Problem Cultures | Alternative |
|---------|-----------------|-------------|
| Thumbs up | Greece, Middle East | Checkmark ✓ |
| OK sign | Brazil, France | Touch tips (pinch) |
| Beckon | Japan, Philippines | Open palm wave |
| V-sign (palm in) | UK, Ireland | V-sign (palm out) |
| Point with finger | Many | Open hand point |

### 9.2 Interaction Norms

| Culture | Preference |
|---------|-----------|
| High-context (Japan) | More implicit, subtle cues |
| Low-context (US) | Explicit, direct feedback |
| Individualistic | Personal space larger |
| Collectivist | Collaborative tools prioritized |

---

## 10. Best Practices Summary

### DO
- ✅ Keep interactions within 0.8m reach
- ✅ Provide haptic feedback for all actions
- ✅ Support both hands for bimanual tasks
- ✅ Give visual confirmation of gestures
- ✅ Include undo for destructive actions
- ✅ Offer seated mode for long sessions
- ✅ Provide controller fallback

### DON'T
- ❌ Require static arm positions >5 seconds
- ❌ Map different meanings to similar gestures
- ❌ Depend on color alone for critical info
- ❌ Require precise timing (avoid rhythm games)
- ❌ Block user view with UI elements
- ❌ Force locomotion on sensitive users

---

*"Good VR interaction feels like magic. Great VR interaction feels like physics."*

