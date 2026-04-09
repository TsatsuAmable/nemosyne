# VRIDE: Implementation Roadmap

## From Documentation to Production

**Branch:** `vride`  
**Status:** Documentation complete, POCs pending

---

## Phase 0: Risk Validation POCs (Weeks 1-4)

**Objective:** Validate Red Team concerns before major investment

### POC 1: Hot-Reload Performance
**Question:** Can we maintain 90fps with live preview?

**Deliverable:** `poc/hot-reload/`
- A-Frame scene with 100 moving crystals
- Worker-thread preview context
- Hot-reload 10x without dropping below 90fps

**Kill Criteria:** Cannot maintain 90fps after optimization

### POC 2: Gesture Precision
**Question:** Can users accurately manipulate VR objects?

**Deliverable:** `poc/gestures/`
- Scene with 20 crystals
- Target: 80%+ correct selections

**Kill Criteria:** <80% accuracy

### POC 3: Hybrid Editor
**Question:** Does 2D/VR hybrid feel natural?

**Deliverable:** `poc/hybrid-editor/`
- 2D web form for config
- "Send to VR" flow
- Adjust in VR, save back

---

## Phase 1: MVP - Template Customizer (Months 2-5)

**Scope:** Single user, templates + data import

### Features
1. **Template Gallery** (10 templates)
   - Solar system
   - Factory floor
   - Stock chart
   - Network topology

2. **Data Import**
   - CSV/JSON drag-drop (2D)
   - Automatic field mapping
   - Preview before import

3. **VR Layout Mode**
   - Enter VR, adjust positions/rotations/scales
   - Switch layouts (grid, bar, scatter)
   - Export HTML

### Technology Stack
- **Core:** Nemosyne framework
- **VR:** A-Frame + WebXR
- **2D Editor:** React
- **Build:** Vite

---

## Phase 2: Enhanced Authoring (Months 6-9)

**If MVP succeeds:**

1. **Data Flow Designer**
   - Visual node graph
   - Filter, aggregate, map nodes

2. **Voice Input**
   - Natural language to config
   - Whisper integration

3. **Ghost Mode + Time Dilation**

---

## Phase 3: Collaboration (Months 10-12)

**Only if Phase 2 succeeds:**

1. **Multi-user VR Sessions**
2. **CRDT State Sync**
3. **Comments + Annotations**

---

## Key Decisions

1. **Text Input:** 2D companion app ✅
2. **Collaboration:** Deferred to Phase 3 ✅
3. **Scope:** Template Customizer, not full IDE ✅
4. **Target Vertical:** TBD (education/finance/industrial)

---

## Success Criteria

**Phase 0:**
- [ ] 90fps maintained across hot-reloads
- [ ] 80%+ gesture accuracy
- [ ] Hybrid editor completes without confusion

**Phase 1:**
- [ ] 5-minute CSV → VR workflow
- [ ] User exports HTML successfully
- [ ] 40%+ week-1 retention

---

## Kill Criteria

**STOP if:**
1. POC cannot maintain 90fps after 2 weeks
2. User testing shows <60% gesture accuracy
3. No pilot customer by Month 3
4. Performance complaints >50% of feedback

---

## Repository Structure

```
nemosyne/
├── docs/vride/             # Documentation ✅
│   ├── ARCHITECTURE.md
│   ├── PRODUCT.md
│   ├── RISKS.md
│   └── IMPLEMENTATION.md
├── vride/                  # Implementation
│   ├── poc/                # Proof-of-concepts
│   ├── src/                # Source code
│   └── README.md
└── ...
```

---

## Immediate Actions

1. Review documents with stakeholders
2. Prioritize POCs
3. Assign POC 1 (hot-reload) to developer
4. Schedule user testing for POC 2
5. Select target vertical

---

*"Plan for failure, hope for success."*

