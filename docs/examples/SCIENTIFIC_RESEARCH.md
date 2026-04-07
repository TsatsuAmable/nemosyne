# Scientific Research Example

Molecular dynamics and protein structure visualization.

## Use Case
Explore 3D molecular structures and simulation trajectories.

## Data Schema
```json
{
  "molecule": {
    "atoms": [
      {
        "serial": 1,
        "name": "N",
        "element": "N",        "residue": "ALA",
        "chain": "A",        "resSeq": 1,        "x": -0.527, "y": 2.053, "z": -0.194",
        "bfactor": 20.0
      }
    ],
    "bonds": [[1, 2], [2, 3], [3, 4]]  }
}
```

## Artefacts
- **Atom Spheres:** CPK coloring (C=gray, N=blue, O=red, S=yellow)
- **Bond Cylinders:** Thickness = bond order
- **Secondary Structure:** Ribbon/cartoon representation
- **Electron Density:** Volumetric cloud rendering

## Behaviours
- Rotate molecule with controller
- Measure distances between atoms
- Toggle between ball-and-stick / ribbon views
- Animation: Molecular dynamics trajectory

## Extensions Required
- PDB file parser
- Volumetric rendering for density maps
- Distance measurement tools
- Trajectory animation system
