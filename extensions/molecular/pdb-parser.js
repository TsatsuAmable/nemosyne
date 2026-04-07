/**
 * Molecular Visualization Extension
 * PDB file parsing and molecule rendering
 */

export class PDBParser {
  constructor() {
    this.atoms = [];
    this.bonds = [];
  }

  /**
   * Parse PDB file content
   * @param {string} pdbContent - Raw PDB file text
   * @returns {Object} Parsed molecule data
   */
  parse(pdbContent) {
    const lines = pdbContent.split('\n');
    const atoms = [];
    const connect = [];
    
    lines.forEach(line => {
      if (line.startsWith('ATOM')) {
        atoms.push(this.parseAtom(line));
      } else if (line.startsWith('HETATM')) {
        atoms.push(this.parseAtom(line, true));
      } else if (line.startsWith('CONECT')) {
        connect.push(this.parseConnection(line));
      }
    });
    
    // Calculate bonds if not provided
    const bonds = connect.length > 0 
        ? this.buildBondsFromConnect(connect, atoms)
        : this.inferBonds(atoms);
    
    return {
      atoms: atoms,
      bonds: bonds,
      atomCount: atoms.length,
      bondCount: bonds.length
    };
  }

  parseAtom(line, isHet = false) {
    return {
      serial: parseInt(line.substring(6, 11).trim()) || 0,
      name: line.substring(12, 16).trim(),
      altLoc: line.substring(16, 17).trim(),
      resName: line.substring(17, 20).trim(),
      chainID: line.substring(21, 22).trim(),
      resSeq: parseInt(line.substring(22, 26).trim()) || 0,
      x: parseFloat(line.substring(30, 38).trim()) || 0,
      y: parseFloat(line.substring(38, 46).trim()) || 0,
      z: parseFloat(line.substring(46, 54).trim()) || 0,
      occupancy: parseFloat(line.substring(54, 60).trim()) || 1.0,
      tempFactor: parseFloat(line.substring(60, 66).trim()) || 0.0,
      element: line.substring(76, 78).trim() || line.substring(13, 14).trim(),
      charge: line.substring(78, 80).trim()
    };
  }

  parseConnection(line) {
    const parts = line.trim().split(/\s+/);
    const atom = parseInt(parts[1]);
    const bonds = parts.slice(2).map(s => parseInt(s)).filter(n => !isNaN(n));
    return { atom, bonds };
  }

  buildBondsFromConnect(connect, atoms) {
    const bonds = [];
    connect.forEach(c => {
      c.bonds.forEach(target => {
        // Avoid duplicate bonds
        const exists = bonds.some(b => 
          (b.source === c.atom && b.target === target) ||
          (b.source === target && b.target === c.atom)
        );
        if (!exists) {
          bonds.push({
            source: c.atom,
            target: target,
            id: `bond-${c.atom}-${target}`
          });
        }
      });
    });
    return bonds;
  }

  inferBonds(atoms, maxDistance = 1.8) {
    const bonds = [];
    
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dist = this.distance(atoms[i], atoms[j]);
        if (dist <= maxDistance) {
          bonds.push({
            source: atoms[i].serial,
            target: atoms[j].serial,
            distance: dist,
            id: `bond-${atoms[i].serial}-${atoms[j].serial}`
          });
        }
      }
    }
    
    return bonds;
  }

  distance(atom1, atom2) {
    const dx = atom1.x - atom2.x;
    const dy = atom1.y - atom2.y;
    const dz = atom1.z - atom2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get CPK color for element
   */
  static getCPKColor(element) {
    const colors = {
      'H': '#FFFFFF',   // White
      'C': '#909090',   // Gray
      'N': '#3050F8',   // Blue
      'O': '#FF0D0D',   // Red
      'S': '#FFFF30',   // Yellow
      'P': '#FF8000',   // Orange
      'F': '#90E050',   // Light green
      'CL': '#1FF01F',  // Green
      'BR': '#A62929',  // Dark red
      'I': '#940094',   // Purple
      'FE': '#E06633',  // Rust
      'ZN': '#7FA8D3',  // Light blue
      'CA': '#3DFF00',  // Lime
      'MG': '#8AFF00',  // Pale green
      'NA': '#AB5CF2',  // Violet
      'K': '#8F40D4',   // Purple
      'AU': '#FFD123'   // Gold
    };
    return colors[element.toUpperCase()] || '#FF69B4';
  }

  /**
   * Get van der Waals radius for element (in Å)
   */
  static getVdWRadius(element) {
    const radii = {
      'H': 1.2, 'C': 1.7, 'N': 1.55, 'O': 1.52,
      'S': 1.8, 'P': 1.8, 'F': 1.47, 'CL': 1.75,
      'BR': 1.85, 'I': 1.98, 'FE': 2.0, 'ZN': 2.0
    };
    return radii[element.toUpperCase()] || 1.7;
  }

  /**
   * Convert to Nemosyne records
   */
  toNemosyneRecords(molecule) {
    const atomRecords = molecule.atoms.map(atom => ({
      id: `atom-${atom.serial}`,
      type: 'atom',
      element: atom.element,
      resName: atom.resName,
      chainID: atom.chainID,
      resSeq: atom.resSeq,
      x: atom.x / 10, // Convert Å to meters (scaled)
      y: atom.y / 10,
      z: atom.z / 10,
      radius: PDBParser.getVdWRadius(atom.element) / 10,
      color: PDBParser.getCPKColor(atom.element),
      tempFactor: atom.tempFactor,
      occupancy: atom.occupancy
    }));

    const bondRecords = molecule.bonds.map(bond => ({
      id: bond.id,
      type: 'bond',
      source: bond.source,
      target: bond.target,
      distance: bond.distance
    }));

    return { atoms: atomRecords, bonds: bondRecords };
  }
}

/**
 * Secondary structure calculator (simplified)
 */
export class StructureCalculator {
  /**
   * Calculate secondary structure from PDB coordinates
   * Simplified implementation - returns alpha helices and beta sheets
   */
  calculateSecondaryStructure(molecule) {
    // This is a simplified placeholder
    // Real implementation would use DSSP algorithm or similar
    const helices = [];
    const sheets = [];
    
    // Group atoms by residue
    const residues = this.groupByResidue(molecule.atoms);
    
    // Detect helices (simplified: look for repeating patterns)
    let currentHelix = null;
    residues.forEach((res, i) => {
      if (this.isHelical(res, residues[i + 1], residues[i + 2])) {
        if (!currentHelix) {
          currentHelix = { startRes: res.resSeq, startIdx: i, residues: [] };
        }
        currentHelix.residues.push(res);
      } else if (currentHelix) {
        if (currentHelix.residues.length >= 4) {
          currentHelix.endRes = residues[i - 1].resSeq;
          currentHelix.endIdx = i - 1;
          helices.push(currentHelix);
        }
        currentHelix = null;
      }
    });
    
    return { helices, sheets };
  }

  groupByResidue(atoms) {
    const residues = [];
    let currentRes = null;
    let currentAtoms = [];
    
    atoms.forEach(atom => {
      const resKey = `${atom.chainID}-${atom.resSeq}-${atom.resName}`;
      if (!currentRes || currentRes !== resKey) {
        if (currentRes) residues.push({ resSeq: currentRes, atoms: currentAtoms });
        currentRes = resKey;
        currentAtoms = [];
      }
      currentAtoms.push(atom);
    });
    
    if (currentRes) residues.push({ resSeq: currentRes, atoms: currentAtoms });
    return residues;
  }

  isHelical(res1, res2, res3) {
    // Simplified: check if consecutive residues exist
    if (!res1 || !res2 || !res3) return false;
    const r1 = parseInt(res1.resSeq.split('-')[1]);
    const r2 = parseInt(res2.resSeq.split('-')[1]);
    const r3 = parseInt(res3.resSeq.split('-')[1]);
    return (r2 === r1 + 1) && (r3 === r2 + 1);
  }
}
