# Medical Imaging: DICOM Viewer

VR visualization of medical imaging data with DICOM-compatible slice navigation.

## Overview

Displays CT and MRI scan slices in an interactive 3D environment. Features window/level controls, slice navigation, and volume reconstruction preview.

## Data Sources

**Simulation Mode (default):**
- Procedurally generates realistic anatomical patterns
- Simulates Hounsfield unit distributions
- CT and MRI texture generation

**Production Integration:**

**PACS Server (Orthanc):**
```javascript
const ws = new WebSocket('wss://pacs.hospital.org/ws/studies');
ws.send(JSON.stringify({
  studyInstanceUID: '1.2.3.4.5.6',
  seriesInstanceUID: '1.2.3.4.5.6.7'
}));
```

**DICOMWeb:**
```javascript
fetch('https://pacs.hospital.org/dicomweb/studies/1.2.3.4/series/5.6.7.8/instances')
  .then(r => r.json())
  .then(renderSlices);
```

## DICOM Features

**Modalities Supported:**
| Modality | Description | Window Presets |
|----------|-------------|----------------|
| CT | Computed Tomography | Soft tissue, Bone, Lung |
| MRI | Magnetic Resonance | T1, T2, FLAIR |
| PET | Positron Emission | SUV window |
| X-Ray | Radiography | Full dynamic range |

**Window/Level (WW/WL):**
| Preset | Window Center | Window Width | Use Case |
|--------|---------------|--------------|----------|
| Soft Tissue | 40 | 400 | Liver, muscle |
| Bone | 400 | 1800 | Fractures, implants |
| Lung | -600 | 1500 | COVID, pneumonia |
| Brain | 35 | 80 | Stroke, tumors |

## Component API

```javascript
// Create DICOM slice viewer
const viewer = document.createElement('a-entity');
viewer.setAttribute('dicom-slice', {
  sliceIndex: 64,
  totalSlices: 128,
  modality: 'CT',
  windowCenter: 40,
  windowWidth: 400
});
```

## Implementation Details

**Procedural Generation:**
```javascript
// Simulates CT Hounsfield units
function generateCTSlice(ctx) {
  // Bone structures (bright)
  ctx.fillStyle = '#ddd';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Air pockets (dark)
  ctx.fillStyle = '#111';
  // ...
}
```

**Hounsfield Unit Mapping:**
| Tissue | HU Value | Color |
|--------|----------|-------|
| Air | -1000 | Black |
| Lung | -600 | Dark gray |
| Fat | -100 | Gray |
| Water | 0 | Gray |
| Soft Tissue | 40 | Light gray |
| Bone | 400+ | White |

## Privacy & Security

**HIPAA Compliance:**
- All data encrypted in transit (TLS 1.3)
- No PHI in logs
- Access audit trails
- Automatic session timeout

**De-identification:**
```javascript
// Remove patient info from DICOM
const deIdentified = {
  ...dicomData,
  PatientName: 'ANONYMOUS',
  PatientID: hash(dicomData.PatientID)
};
```

## Performance

**Memory Usage:**
- 512×512 slice: ~256KB uncompressed
- 1024×1024 slice: ~1MB uncompressed
- Recommended: Load on-demand, cache 5 slices

**Bandwidth:**
- DICOM: ~500KB per slice
- Compressed JPEG2000: ~50KB per slice
- Streaming: Progressive download

## Browser Support

- Chrome 90+ (WebGL 2.0 required)
- Firefox 88+
- Safari 14+ (limited WebGL)
- Edge 90+

**Mobile:**
- iPad Pro: ✓ (limited studies)
- Android tablets: ✓
- Phones: Not recommended (screen size)

## Clinical Validation

**Not for diagnostic use.** This is a visualization research tool. All clinical decisions require FDA/CE approved PACS viewers.

## License

MIT License - TsatsuAmable 2026

**Medical Disclaimer:** This software is for educational and research purposes only. Not intended for clinical diagnosis.