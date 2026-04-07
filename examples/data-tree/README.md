# Data Tree Example

A hierarchical file system visualization.

## Structure

```
Documents (root)
├── Work/
│   ├── Reports/
│   │   └── Budget.xlsx
│   └── Reports
├── Personal/
│   └── Photos/
└── Projects/
    ├── Nemosyne/
    │   ├── src/
    │   │   └── index.html
    │   └── docs/
    └── Research
```

## Features

- Hierarchical positioning (Y = depth level)
- Color coded by file type:
  - Purple: Folders
  - Blue: Projects
  - Teal: Documents
  - Gold: Files
- Connecting pillars between parent and child nodes
- Size indicates importance/collapsed content

## Running

Open `index.html` or serve with:

```bash
npx serve
```

Navigate to `/data-tree/`
