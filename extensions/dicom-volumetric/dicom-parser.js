/**
 * DICOM Parser and Volumetric Renderer Extension
 * Medical imaging visualization for CT/MRI scans
 */

/**
 * DICOM Data Set Parser (simplified)
 * Parses DICOM header and pixel data
 */
export class DICOMParser {
  constructor() {
    this.littleEndian = true;
    this.explicitVR = true;
  }

  /**
   * Parse DICOM file buffer
   * @param {ArrayBuffer} buffer - Raw DICOM file
   * @returns {Object} Parsed dataset
   */
  parse(buffer) {
    const dataView = new DataView(buffer);
    let offset = 0;
    
    // Skip preamble (128 bytes) if present
    if (this.isPreamblePresent(dataView)) {
      offset = 128 + 4; // 128 bytes + 'DICM' marker
    }
    
    const dataset = {
      meta: {},
      pixelData: null,
      dimensions: { x: 0, y: 0, z: 1 },
      spacing: { x: 1, y: 1, z: 1 },
      window: { center: 40, width: 400 },
      rescale: { slope: 1, intercept: 0 }
    };
    
    // Parse header elements
    while (offset < dataView.byteLength - 8) {
      const element = this.readElement(dataView, offset);
      if (!element) break;
      
      this.processElement(element, dataset);
      offset = element.nextOffset;
      
      // Stop at pixel data (7FE0,0010)
      if (element.group === 0x7FE0 && element.element === 0x0010) {
        dataset.pixelData = this.extractPixelData(dataView, element);
        break;
      }
    }
    
    return dataset;
  }

  isPreamblePresent(dataView) {
    if (dataView.byteLength < 132) return false;
    const marker = String.fromCharCode(
      dataView.getUint8(128),
      dataView.getUint8(129),
      dataView.getUint8(130),
      dataView.getUint8(131)
    );
    return marker === 'DICM';
  }

  readElement(dataView, offset) {
    try {
      let elementOffset = offset;
      
      // Read group and element numbers
      const group = dataView.getUint16(elementOffset, this.littleEndian);
      const element = dataView.getUint16(elementOffset + 2, this.littleEndian);
      elementOffset += 4;
      
      // Read VR (Value Representation)
      let vr = '';
      let length = 0;
      
      if (this.explicitVR) {
        vr = String.fromCharCode(
          dataView.getUint8(elementOffset),
          dataView.getUint8(elementOffset + 1)
        );
        elementOffset += 2;
        
        // Handle different VR length encoding
        if (['OB', 'OW', 'OF', 'SQ', 'UC', 'UN', 'UT'].includes(vr)) {
          // Skip reserved bytes
          elementOffset += 2;
          length = dataView.getUint32(elementOffset, this.littleEndian);
          elementOffset += 4;
        } else {
          length = dataView.getUint16(elementOffset, this.littleEndian);
          elementOffset += 2;
        }
      } else {
        length = dataView.getUint32(elementOffset, this.littleEndian);
        elementOffset += 4;
      }
      
      const dataOffset = elementOffset;
      const nextOffset = dataOffset + length;
      
      return {
        group,
        element,
        vr,
        length,
        dataOffset,
        nextOffset,
        tag: `(${group.toString(16).padStart(4, '0')},${element.toString(16).padStart(4, '0')})`
      };
    } catch (e) {
      return null;
    }
  }

  processElement(element, dataset) {
    const tag = `${element.group.toString(16).padStart(4, '0')},${element.element.toString(16).padStart(4, '0')}`;
    
    switch (tag) {
      // Patient Info
      case '0010,0010':
        dataset.meta.patientName = 'ANONYMOUS';
        break;
      case '0010,0020':
        dataset.meta.patientID = 'ANON';
        break;
        
      // Study Info
      case '0020,000d':
        dataset.meta.studyInstanceUID = '';
        break;
        
      // Image Dimensions
      case '0028,0010':
        dataset.dimensions.y = this.readUint16Value(element);
        break;
      case '0028,0011':
        dataset.dimensions.x = this.readUint16Value(element);
        break;
      case '0028,0008':
        dataset.dimensions.z = this.readUint16Value(element) || 1;
        break;
        
      // Pixel Spacing
      case '0028,0030':
        const spacing = this.readStringValue(element).split('\\').map(parseFloat);
        dataset.spacing.y = spacing[0] || 1;
        dataset.spacing.x = spacing[1] || 1;
        break;
      case '0018,0050':
        dataset.spacing.z = parseFloat(this.readStringValue(element)) || 1;
        break;
        
      // Window Settings
      case '0028,1050':
        dataset.window.center = parseFloat(this.readStringValue(element)) || 40;
        break;
      case '0028,1051':
        dataset.window.width = parseFloat(this.readStringValue(element)) || 400;
        break;
        
      // Rescale
      case '0028,1052':
        dataset.rescale.intercept = parseFloat(this.readStringValue(element)) || 0;
        break;
      case '0028,1053':
        dataset.rescale.slope = parseFloat(this.readStringValue(element)) || 1;
        break;
        
      // Bits Allocated
      case '0028,0100':
        dataset.bitsAllocated = this.readUint16Value(element);
        break;
      case '0028,0101':
        dataset.bitsStored = this.readUint16Value(element);
        break;
        
      // Modality
      case '0008,0060':
        dataset.meta.modality = this.readStringValue(element).trim();
        break;
    }
  }

  readUint16Value(element) {
    // Would read from actual buffer - placeholder
    return 512;
  }

  readStringValue(element) {
    // Would read from actual buffer - placeholder
    return '';
  }

  extractPixelData(dataView, element) {
    // Extract raw pixel data
    return {
      offset: element.dataOffset,
      length: element.length,
      // Actual extraction would happen here
      sample: 'pixel-buffer'
    };
  }

  /**
   * Generate sample CT dataset for demo
   */
  static generateSampleCT(dimensions = { x: 64, y: 64, z: 32 }) {
    const volume = new Float32Array(dimensions.x * dimensions.y * dimensions.z);
    
    // Generate synthetic CT data (Hounsfield units)
    for (let z = 0; z < dimensions.z; z++) {
      for (let y = 0; y < dimensions.y; y++) {
        for (let x = 0; x < dimensions.x; x++) {
          const idx = z * dimensions.x * dimensions.y + y * dimensions.x + x;
          
          // Create some structures (sphere in center)
          const cx = dimensions.x / 2;
          const cy = dimensions.y / 2;
          const cz = dimensions.z / 2;
          
          const dx = x - cx;
          const dy = y - cy;
          const dz = z - cz;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          // Bone-like structure
          if (dist < 15) {
            volume[idx] = 1000 + Math.random() * 200; // Bone: ~1000 HU
          } 
          // Soft tissue
          else if (dist < 25) {
            volume[idx] = 40 + Math.random() * 20; // Soft tissue: ~40 HU
          }
          // Air/lung
          else if (y > dimensions.y * 0.7 && Math.random() > 0.3) {
            volume[idx] = -800 + Math.random() * 100; // Lung: ~-800 HU
          }
          // Background
          else {
            volume[idx] = -1000; // Air
          }
        }
      }
    }
    
    return {
      meta: {
        modality: 'CT',
        patientName: 'DEMO,PATIENT',
        patientID: 'DEMO001',
        studyDescription: 'Chest CT'
      },
      dimensions,
      spacing: { x: 1, y: 1, z: 2 },
      window: { center: 40, width: 400 },
      rescale: { slope: 1, intercept: 0 },
      volume,
      minValue: -1000,
      maxValue: 1200
    };
  }
}

/**
 * Transfer Function Editor
 * Maps voxel values to colors and opacities
 */
export class TransferFunction {
  constructor() {
    this.controlPoints = [];
    this.defaultPresets = this.initPresets();
  }

  initPresets() {
    return {
      'ct-bone': [
        { value: -1000, color: [0, 0, 0, 0] },      // Air
        { value: -600, color: [0.8, 0.2, 0.2, 0.1] }, // Lung
        { value: 40, color: [0.9, 0.6, 0.6, 0.2] },   // Soft tissue
        { value: 200, color: [1, 1, 0.9, 0.8] },      // Bone start
        { value: 1000, color: [1, 1, 1, 1] }          // Bone
      ],
      'ct-soft': [
        { value: -1000, color: [0, 0, 0, 0] },
        { value: -100, color: [0.1, 0.1, 0.3, 0.0] },
        { value: 0, color: [0.8, 0.2, 0.2, 0.1] },
        { value: 40, color: [0.9, 0.5, 0.4, 0.6] },
        { value: 80, color: [0.8, 0.3, 0.3, 0.8] },
        { value: 200, color: [0.9, 0.9, 0.9, 0.9] }
      ],
      'mri-brain': [
        { value: 0, color: [0, 0, 0, 0] },
        { value: 200, color: [0.1, 0.1, 0.4, 0.1] },
        { value: 500, color: [0.9, 0.9, 0.9, 0.5] },
        { value: 800, color: [1, 1, 1, 0.9] }
      ]
    };
  }

  applyPreset(name) {
    this.controlPoints = [...(this.defaultPresets[name] || this.defaultPresets['ct-bone'])];
  }

  /**
   * Map value to RGBA
   */
  sample(value) {
    // Find surrounding control points
    let lower = this.controlPoints[0];
    let upper = this.controlPoints[this.controlPoints.length - 1];
    
    for (let i = 0; i < this.controlPoints.length - 1; i++) {
      if (value >= this.controlPoints[i].value && value <= this.controlPoints[i + 1].value) {
        lower = this.controlPoints[i];
        upper = this.controlPoints[i + 1];
        break;
      }
    }
    
    // Interpolate
    const t = (value - lower.value) / (upper.value - lower.value || 1);
    return [
      lower.color[0] + t * (upper.color[0] - lower.color[0]),
      lower.color[1] + t * (upper.color[1] - lower.color[1]),
      lower.color[2] + t * (upper.color[2] - lower.color[2]),
      lower.color[3] + t * (upper.color[3] - lower.color[3])
    ];
  }

  /**
   * Convert to Nemosyne color scale format
   */
  toNemosyneScale(min, max) {
    const steps = 256;
    const colors = [];
    
    for (let i = 0; i < steps; i++) {
      const value = min + (i / (steps - 1)) * (max - min);
      const rgba = this.sample(value);
      const hex = `#${Math.round(rgba[0]*255).toString(16).padStart(2,'0')}${Math.round(rgba[1]*255).toString(16).padStart(2,'0')}${Math.round(rgba[2]*255).toString(16).padStart(2,'0')}`;
      colors.push({ value, color: hex, opacity: rgba[3] });
    }
    
    return colors;
  }
}

/**
 * Slice plane intersection calculator
 */
export class SliceCalculator {
  /**
   * Calculate intersection of plane with volume
   */
  static getSlice(volume, dimensions, plane, axis = 'z') {
    const slice = [];
    const { x: width, y: height, z: depth } = dimensions;
    
    const planeIndex = Math.floor(plane);
    
    if (axis === 'z' && planeIndex >= 0 && planeIndex < depth) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = planeIndex * width * height + y * width + x;
          slice.push({ x, y, value: volume[idx] });
        }
      }
    }
    
    return slice;
  }

  /**
   * Generate height map from slice for 3D terrain visualization
   */
  static sliceToHeightmap(slice, dimensions, windowCenter, windowWidth) {
    return slice.map(pixel => {
      // Apply window/level
      let value = pixel.value;
      value = ((value - windowCenter + windowWidth/2) / windowWidth);
      value = Math.max(0, Math.min(1, value));
      
      return {
        x: pixel.x,
        y: pixel.y,
        height: value
      };
    });
  }
}
