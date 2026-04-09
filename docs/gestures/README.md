# Gestures Branch Documentation

## Human Interaction in VR Space

This branch contains the technical specifications and implementation guides for gesture recognition, hand tracking, eye tracking, and embodied interaction patterns in Nemosyne/VRIDE.

---

## Documents

### 📄 GESTURE_SPECIFICATION.md
**Core Formalism**
- Gesture taxonomy and classification hierarchy
- Hand state vector (26 DOF per hand)
- Eye tracking vector and fixation detection
- Multimodal fusion (hand + eye)
- Gesture composition algebra (GEL)
- Technical implementation for WebXR

**For:** System architects, UX designers, developers implementing gesture recognition

---

### 🔧 GESTURE_ENGINE.md
**Implementation Guide**
- Signal preprocessing (Kalman filtering)
- Feature extraction pipeline
- Recognition algorithms (HMM, template matching)
- Two-hand coordination
- Performance optimization
- Integration with Nemosyne components

**For:** Engineers implementing the gesture recognition system

---

### 👤 HUMAN_INTERACTION_PATTERNS.md
**UX Research & Design**
- Physiology of VR interaction (reach, fatigue)
- Cognitive load in spatial environments
- Gesture semantics and metaphors
- Social interaction and proxemics
- Error prevention and recovery
- Accessibility considerations

**For:** UX designers, product managers, accessibility specialists

---

## Quick Reference

### Gesture Levels

| Level | Name | Latency | Use Case |
|-------|------|---------|----------|
| L0 | Micro-gestures | < 16ms | Intention signals |
| L1 | Atomic | < 50ms | Pinch, grab, point |
| L2 | Compound | < 100ms | Two-hand scale, rotate |
| L3 | Sequential | < 200ms | Gesture sequences |
| L4 | Choreographic | < 500ms | Full-body phrases |
| L5 | Ambient | continuous | Pre-conscious signals |

### Key Metrics

- **Hand Tracking:** 26 DOF, 90Hz target, 0.6 confidence threshold
- **Eye Tracking:** Fixation detection (100ms window, 2° dispersion)
- **Pipeline Latency:** < 20ms total (90fps budget: 11.1ms)
- **Reach Zone:** 0.5-0.8m (comfort), 0.8-1.2m (stretch)
- **Fatigue Onset:** 5-7 minutes continuous use

### Gesture Expression Language (GEL)

```
Atomic:    P = Pinch, G = Grab, R = Release, Pt = Point
Spatial:   → Move, ⟳ Rotate, ⤢ Scale
Temporal:  ∧ Simultaneous, ∨ Alternative, seq Sequential
Modifier:  hold(n), repeat(n)

Example:   SELECT = P ∧ dwell(0.5)
           SCALE  = Gₗ ∧ Gᵣ ∧ ⤢
```

---

## Implementation Status

| Component | Status | Priority |
|-----------|--------|----------|
| Hand tracking formalism | ✅ Spec complete | P0 |
| Eye tracking formalism | ✅ Spec complete | P1 |
| Gesture recognition engine | 📝 Ready to implement | P0 |
| Template matching | 📝 Ready to implement | P1 |
| Multimodal fusion | 📝 Ready to implement | P2 |
| Nemosyne component | 📝 Ready to implement | P1 |

---

## Getting Started

### For Developers

1. Read `GESTURE_SPECIFICATION.md` Section 7 (Implementation)
2. Review `GESTURE_ENGINE.md` Section 2 (Pipeline)
3. Check existing Nemosyne component patterns in `/framework/src/components/`

### For Designers

1. Start with `HUMAN_INTERACTION_PATTERNS.md` Section 1-3
2. Review gesture vocabulary in Section 3.1
3. Study `GESTURE_SPECIFICATION.md` Section 4.3 (Multimodal Fusion)

---

## Next Steps

1. **POC:** Implement pinch detector with WebXR Hand Tracking API
2. **Integration:** Create `nemosyne-gesture-interactable` A-Frame component
3. **Testing:** User studies on gesture accuracy and fatigue
4. **Optimization:** Performance profiling on Quest 2/Pro

---

## References

- [WebXR Hand Input](https://immersive-web.github.io/webxr-hand-input/)
- [Fitts' Law](https://en.wikipedia.org/wiki/Fitts%27s_law)
- [Miller's Law](https://en.wikipedia.org/wiki/The_Magical_Number_Seven,_Plus_or_Minus_Two)

---

*"The body is the primary interface."*
