#!/usr/bin/env node

/**
 * Nemosyne CLI - VR Framework Project Tool
 * Full-featured CLI for scaffolding, serving, building, and validating Nemosyne projects
 * 
 * @version 1.2.0
 */

import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');

// ANSI color codes for cross-platform compatibility
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`),
  dim: (msg) => console.log(`${colors.dim}${msg}${colors.reset}`)
};

// Template definitions
const templates = {
  basic: {
    name: 'Basic Visualization',
    description: 'Simple bar chart - good for beginners',
    files: (projectName) => ({
      'package.json': JSON.stringify({
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'nemosyne serve',
          build: 'nemosyne build',
          validate: 'nemosyne validate'
        },
        dependencies: {
          nemosyne: '^1.2.0',
          aframe: '^1.7.0'
        }
      }, null, 2),
      
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Nemosyne Visualization</title>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="https://unpkg.com/nemosyne@latest/dist/nemosyne.iife.js"></script>
  <style>
    body { margin: 0; overflow: hidden; background: #000; }
    #ui {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 100;
      pointer-events: none;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    .badge {
      background: rgba(0, 212, 170, 0.2);
      border: 1px solid #00d4aa;
      color: #00d4aa;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      text-transform: uppercase;
    }
    h1 { margin: 10px 0 5px; font-size: 24px; font-weight: 300; }
    .subtitle { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div id="ui">
    <div class="badge">Bar Chart</div>
    <h1>${projectName}</h1>
    <p class="subtitle">Monthly revenue data</p>
  </div>

  <a-scene nemosyne-scene="theme: void">
    <a-entity position="-8 2 8" rotation="0 -45 0">
      <a-camera look-controls wasd-controls="acceleration: 100">
        <a-cursor color="#00d4aa" scale="0.5 0.5 0.5"></a-cursor>
      </a-camera>
    </a-entity>

    <a-entity nemosyne-artefact-v2="
      spec: {
        id: 'revenue-chart',
        geometry: { type: 'cylinder' },
        material: { properties: { color: '#00d4aa', emissive: '#00d4aa', emissiveIntensity: 0.3 } },
        transform: { scale: { $data: 'revenue', $range: [1, 5] } }
      };
      dataset: { records: [{ month: 'Jan', revenue: 45 }, { month: 'Feb', revenue: 52 }, { month: 'Mar', revenue: 38 }] };
      layout: grid;
      layout-options: { columns: 3, spacing: 2 }
    "></a-entity>

    <a-box position="0 -0.1 -2" width="10" height="0.1" depth="10" 
           material="color: #111; roughness: 0.8" shadow="receive: true"></a-box>
  </a-scene>
</body>
</html>`,

      'data.json': JSON.stringify({
        records: [
          { month: 'January', revenue: 45000, target: 40000 },
          { month: 'February', revenue: 52000, target: 45000 },
          { month: 'March', revenue: 38000, target: 42000 },
          { month: 'April', revenue: 65000, target: 50000 },
          { month: 'May', revenue: 78000, target: 60000 },
          { month: 'June', revenue: 92000, target: 70000 }
        ]
      }, null, 2),

      'README.md': `# ${projectName}

A Nemosyne VR visualization project.

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Data Format

Edit \`data.json\` to change the visualization. Each record should have:
- \`month\`: Category label
- \`revenue\`: Numeric value (drives bar height)
- \`target\`: Optional comparison value

## Layouts

Try different layouts by editing \`index.html\`:
- \`grid\`: Organized rows/columns
- \`radial\`: Circular arrangement
- \`timeline\`: Linear left-to-right

## Documentation

- [Nemosyne Docs](https://github.com/TsatsuAmable/nemosyne/tree/main/docs)
- [API Reference](https://github.com/TsatsuAmable/nemosyne/blob/main/docs/API_REFERENCE_COMPLETE.md)
`
    })
  },

  network: {
    name: 'Network Graph',
    description: 'Force-directed graph with node interactions',
    files: (projectName) => ({
      'package.json': JSON.stringify({
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'nemosyne serve',
          build: 'nemosyne build',
          validate: 'nemosyne validate'
        },
        dependencies: {
          nemosyne: '^1.2.0',
          aframe: '^1.7.0'
        }
      }, null, 2),

      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Network Graph</title>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="https://unpkg.com/nemosyne@latest/dist/nemosyne.iife.js"></script>
  <style>
    body { margin: 0; overflow: hidden; background: #000; }
    #ui {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 100;
      pointer-events: none;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    .badge { background: rgba(100, 100, 255, 0.2); border: 1px solid #6464ff; color: #6464ff; padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: uppercase; }
    h1 { margin: 10px 0 5px; font-size: 24px; font-weight: 300; }
    .subtitle { color: #888; font-size: 14px; }
    #controls {
      position: absolute;
      bottom: 20px;
      left: 20px;
      z-index: 100;
    }
    button {
      background: rgba(0, 212, 170, 0.2);
      border: 1px solid #00d4aa;
      color: #00d4aa;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      margin-right: 8px;
    }
    button:hover { background: rgba(0, 212, 170, 0.4); }
  </style>
</head>
<body>
  <div id="ui">
    <div class="badge">Network Graph</div>
    <h1>${projectName}</h1>
    <p class="subtitle">Force-directed node visualization</p>
  </div>

  <div id="controls">
    <button onclick="resetCamera()">Reset View</button>
    <button onclick="togglePhysics()">Toggle Physics</button>
  </div>

  <a-scene nemosyne-scene="theme: void">
    <a-entity position="0 0 10">
      <a-camera look-controls wasd-controls="acceleration: 50">
        <a-cursor color="#6464ff" scale="0.5 0.5 0.5" raycaster="objects: .clickable"></a-cursor>
      </a-camera>
    </a-entity>

    <a-entity id="graph-container"></a-entity>

    <script>
      // Load network data and create visualization
      fetch('data.json')
        .then(r => r.json())
        .then(data => {
          const container = document.getElementById('graph-container');
          
          // Create nodes
          data.nodes.forEach((node, i) => {
            const el = document.createElement('a-entity');
            el.setAttribute('position', \`\${(i % 5) * 2 - 4} \${Math.floor(i / 5) * 2} 0\`);
            el.setAttribute('nemosyne-artefact-v2', \`
              spec: {
                id: 'node-\${node.id}',
                geometry: { type: 'sphere', radius: \${node.connections * 0.2 + 0.3 } },
                material: { properties: { color: '#6464ff', emissive: '#3232aa' } }
              };
              dataset: { records: [{ id: '\${node.id}', value: \${node.value} }] };
              layout: scatter
            \`);
            el.classList.add('clickable');
            container.appendChild(el);
          });
        });

      function resetCamera() {
        const camera = document.querySelector('a-camera');
        camera.setAttribute('position', '0 0 10');
        camera.setAttribute('rotation', '0 0 0');
      }
      
      function togglePhysics() {
        console.log('Physics toggle - implement with ammo.js');
      }
    </script>

    <a-sky color="#000510"></a-sky>
  </a-scene>
</body>
</html>`,

      'data.json': JSON.stringify({
        nodes: [
          { id: 'A', value: 100, category: 'core', connections: 5 },
          { id: 'B', value: 80, category: 'secondary', connections: 3 },
          { id: 'C', value: 60, category: 'secondary', connections: 4 },
          { id: 'D', value: 40, category: 'leaf', connections: 2 },
          { id: 'E', value: 90, category: 'secondary', connections: 3 },
          { id: 'F', value: 30, category: 'leaf', connections: 1 }
        ],
        edges: [
          { from: 'A', to: 'B' },
          { from: 'A', to: 'C' },
          { from: 'B', to: 'D' },
          { from: 'C', to: 'E' },
          { from: 'E', to: 'F' }
        ]
      }, null, 2),

      'README.md': `# ${projectName}

Network graph visualization using Nemosyne.

## Features

- Force-directed layout (scatter)
- Interactive nodes with hover/click
- Camera controls with reset

## Data Format

\`data.json\` contains:
- \`nodes\`: Array of {id, value, category, connections}
- \`edges\`: Array of {from, to} connections

## Controls

- **WASD**: Move around the graph
- **Click nodes**: Selection interaction
- **Reset View**: Return to starting position
- **Toggle Physics**: (requires Ammo.js setup)
`
    })
  },

  timeline: {
    name: 'Timeline Spiral',
    description: 'Time-series data in spiral layout',
    files: (projectName) => ({
      'package.json': JSON.stringify({
        name: projectName,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'nemosyne serve',
          build: 'nemosyne build',
          validate: 'nemosyne validate'
        },
        dependencies: {
          nemosyne: '^1.2.0',
          aframe: '^1.7.0'
        }
      }, null, 2),

      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Timeline</title>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="https://unpkg.com/nemosyne@latest/dist/nemosyne.iife.js"></script>
  <style>
    body { margin: 0; overflow: hidden; background: #000; }
    #ui {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 100;
      pointer-events: none;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    .badge { background: rgba(212, 175, 55, 0.2); border: 1px solid #d4af37; color: #d4af37; padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: uppercase; }
    h1 { margin: 10px 0 5px; font-size: 24px; font-weight: 300; }
    .subtitle { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div id="ui">
    <div class="badge">Timeline</div>
    <h1>${projectName}</h1>
    <p class="subtitle">Time-series spiral visualization</p>
  </div>

  <a-scene nemosyne-scene="theme: void">
    <a-entity position="0 5 15" rotation="-15 0 0">
      <a-camera look-controls wasd-controls="acceleration: 50"></a-camera>
    </a-entity>

    <a-entity position="0 0 0">
      <a-entity nemosyne-artefact-v2="
        spec: {
          id: 'timeline-data',
          geometry: { type: 'octahedron' },
          material: { properties: { color: '#d4af37', metalness: 0.8 } }
        };
        dataset: { records: [{ date: '2024-01', value: 100 }, { date: '2024-02', value: 120 }, { date: '2024-03', value: 90 }, { date: '2024-04', value: 140 }, { date: '2024-05', value: 160 }] };
        layout: spiral;
        layout-options: { radius: 5, heightStep: 1, rotations: 2 }
      "></a-entity>
    </a-entity>

    <a-sky color="#000205"></a-sky>
  </a-scene>
</body>
</html>`,

      'data.json': JSON.stringify({
        records: [
          { date: '2024-01-01', value: 100, label: 'Q1 Start', category: 'milestone' },
          { date: '2024-02-01', value: 120, change: '+20%' },
          { date: '2024-03-01', value: 90, change: '-25%' },
          { date: '2024-04-01', value: 140, change: '+55%', category: 'peak' },
          { date: '2024-05-01', value: 160, change: '+14%', category: 'milestone' },
          { date: '2024-06-01', value: 130, change: '-19%' }
        ]
      }, null, 2),

      'README.md': `# ${projectName}

Timeline spiral visualization using Nemosyne.

## Spiral Layout

Data points arranged in a spiral pattern, useful for:
- Time-series with cyclical patterns
- Sequential data with 3D depth
- Showing progression over time

## Data Format

\`data.json\`:
- \`date\`: ISO date or label
- \`value\`: Primary metric
- \`change\`: Optional % change label
- \`category\`: Optional grouping

## Layout Options

Edit the \`layout-options\` in \`index.html\`:
- \`radius\`: Base spiral radius
- \`heightStep\`: Vertical rise per point
- \`rotations\`: Number of spiral turns
`
    })
  }
};

// CLI metadata
const CLI_VERSION = '1.2.0';

program
  .name('nemosyne')
  .description('CLI for Nemosyne VR Framework')
  .version(CLI_VERSION, '-v, --version', 'Display version number');
async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

// Helper: Copy file
async function copyFile(src, dest) {
  await fs.copyFile(src, dest);
}

// INIT command
program
  .command('init <name>')
  .description('Create a new Nemosyne project from a template')
  .option('-t, --template <type>', 'Template type (basic, network, timeline)', 'basic')
  .option('--force', 'Overwrite existing directory')
  .action(async (name, options) => {
    log.header(`🌌 Creating Nemosyne Project: ${name}`);
    
    const projectPath = path.resolve(process.cwd(), name);
    
    // Check if directory exists
    if (await directoryExists(projectPath)) {
      if (!options.force) {
        log.error(`Directory "${name}" already exists. Use --force to overwrite.`);
        process.exit(1);
      }
      log.warn(`Overwriting existing directory "${name}"...`);
      await fs.rm(projectPath, { recursive: true });
    }

    // Validate template
    if (!templates[options.template]) {
      log.error(`Unknown template: ${options.template}`);
      log.info(`Available templates: ${Object.keys(templates).join(', ')}`);
      process.exit(1);
    }

    const template = templates[options.template];
    log.info(`Using template: ${template.name}`);
    log.dim(`  ${template.description}`);

    try {
      // Create directory
      await fs.mkdir(projectPath, { recursive: true });
      log.success(`Created directory: ${name}/`);

      // Generate files
      const files = template.files(name);
      for (const [fileName, content] of Object.entries(files)) {
        const filePath = path.join(projectPath, fileName);
        await fs.writeFile(filePath, content);
        log.success(`Created: ${fileName}`);
      }

      // Final message
      console.log(`\n${colors.green}✨ Project created successfully!${colors.reset}\n`);
      console.log(`Next steps:\n`);
      console.log(`  cd ${name}`);
      console.log(`  npm install`);
      console.log(`  npm run dev\n`);
      
    } catch (error) {
      log.error(`Failed to create project: ${error.message}`);
      process.exit(1);
    }
  });

// SERVE command
program
  .command('serve [dir]')
  .description('Start development server with hot reload')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (dir = '.', options) => {
    const servePath = path.resolve(process.cwd(), dir);
    const port = parseInt(options.port);
    
    log.header(`🚀 Starting Nemosyne Dev Server`);
    log.info(`Serving: ${servePath}`);
    log.info(`Port: ${port}`);

    // Simple static server
    const server = createServer(async (req, res) => {
      let filePath = path.join(servePath, req.url === '/' ? 'index.html' : req.url);
      
      try {
        const content = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        const contentType = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.css': 'text/css'
        }[ext] || 'text/plain';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      log.success(`Server running at http://localhost:${port}/`);
      if (options.open !== false) {
        console.log(`\n${colors.cyan}Press Ctrl+C to stop${colors.reset}\n`);
      }
    });
  });

// BUILD command
program
  .command('build [dir]')
  .description('Build project for production')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .action(async (dir = '.', options) => {
    log.header(`🔨 Building Nemosyne Project`);
    
    const projectPath = path.resolve(process.cwd(), dir);
    const outputPath = path.resolve(projectPath, options.output);
    
    log.info(`Source: ${projectPath}`);
    log.info(`Output: ${outputPath}`);
    
    try {
      // Check for required files
      const indexPath = path.join(projectPath, 'index.html');
      try {
        await fs.access(indexPath);
      } catch {
        log.error('No index.html found. Are you in a Nemosyne project directory?');
        process.exit(1);
      }
      
      // Create output directory
      await fs.mkdir(outputPath, { recursive: true });
      
      // Copy static files
      const files = await fs.readdir(projectPath);
      for (const file of files) {
        if (file === options.output) continue; // Skip output dir
        
        const src = path.join(projectPath, file);
        const dest = path.join(outputPath, file);
        const stats = await fs.stat(src);
        
        if (stats.isDirectory()) {
          // Recursively copy directories
          await execAsync(`cp -r "${src}" "${dest}"`).catch(() => {});
        } else {
          await copyFile(src, dest);
        }
      }
      
      log.success(`Build complete: ${options.output}/`);
      
    } catch (error) {
      log.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
  });

// VALIDATE command
program
  .command('validate [dir]')
  .description('Validate project structure and data files')
  .action(async (dir = '.') => {
    log.header(`🔍 Validating Nemosyne Project`);
    
    const projectPath = path.resolve(process.cwd(), dir);
    const errors = [];
    const warnings = [];
    
    // Check for required files
    const requiredFiles = ['index.html'];
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(projectPath, file));
      } catch {
        errors.push(`Missing required file: ${file}`);
      }
    }
    
    // Check index.html for Nemosyne references
    try {
      const indexContent = await fs.readFile(path.join(projectPath, 'index.html'), 'utf-8');
      
      if (!indexContent.includes('nemosyne')) {
        warnings.push('index.html does not reference Nemosyne');
      }
      
      if (indexContent.includes('nemosyne.min.js') && !indexContent.includes('nemosyne.iife.js')) {
        warnings.push('index.html uses nemosyne.min.js (stub) instead of nemosyne.iife.js (working bundle)');
      }
      
      if (!indexContent.includes('aframe')) {
        warnings.push('index.html does not include A-Frame');
      }
    } catch {
      // index.html check already failed above
    }
    
    // Validate data.json if exists
    const dataPath = path.join(projectPath, 'data.json');
    try {
      const dataContent = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(dataContent);
      
      if (!data.records && !data.nodes) {
        warnings.push('data.json should have "records" or "nodes" array');
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        errors.push(`data.json is invalid JSON: ${e.message}`);
      }
    }
    
    // Report results
    console.log();
    if (errors.length === 0 && warnings.length === 0) {
      log.success('Project structure is valid!');
    } else {
      if (errors.length > 0) {
        errors.forEach(e => log.error(e));
      }
      if (warnings.length > 0) {
        warnings.forEach(w => log.warn(w));
      }
      
      if (errors.length > 0) {
        process.exit(1);
      }
    }
  });

// TEMPLATE command
program
  .command('template')
  .description('List available project templates')
  .action(() => {
    log.header('📦 Available Templates');
    
    for (const [id, template] of Object.entries(templates)) {
      console.log(`\n${colors.cyan}${id}${colors.reset}`);
      console.log(`  ${colors.bright}${template.name}${colors.reset}`);
      console.log(`  ${colors.dim}${template.description}${colors.reset}`);
    }
    
    console.log(`\n${colors.dim}Use with: nemosyne init <name> -t <template>${colors.reset}\n`);
  });

// Parse and execute
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.help();
}
