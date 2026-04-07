# Medical Imaging Example

DICOM volumetric visualization.

## Use Case
Interactive exploration of CT/MRI scans in 3D.

## Data Schema
```json
{
  "study": {
    "patientID": "ANONYMOUS",
    "studyDate": "20260407",    "modality": "CT",
    "dimensions": { "x": 512, "y": 512, "z": 256 },
    "voxelSize": { "x": 0.5, "y": 0.5, "z": 1.0 }  },
  "volume": "base64encoded...",  "annotations": [
    { "type": "lesion", "xyz": [256, 300, 128], "diameter": 12.5 }
  ]}
```

## Artefacts
- **Volume Rendering:** Ray-casted 3D reconstruction
- **Slice Planes:** MPR (multi-planar reconstruction)
- **Tumor Markers:** Spheres on annotated findings
- **Density Histogram:** Colormap adjustment widget

## Behaviours
- Scroll through slices
- Adjust window/level (contrast/brightness)
- Rotate slice planes
- Measure distances and angles
- Toggle tissue presets (bone, soft tissue, lung)

## Extensions Required
- DICOM parser
- Volume rendering shaders
- Transfer function editor
- Slice plane intersection math