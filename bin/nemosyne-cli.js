#!/usr/bin/env node

/**
 * Nemosyne CLI - Quick project scaffolding
 * Usage: npx nemosyne init my-project
 */

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('nemosyne')
  .description('CLI for Nemosyne VR Framework')
  .version('0.2.1');

program
  .command('init <name>')
  .description('Create a new Nemosyne project')
  .option('-t, --template <type>', 'Template type: basic, advanced, websocket', 'basic')
  .action((name, options) => {
    const projectPath = path.resolve(process.cwd(), name);
    
    if (fs.existsSync(projectPath)) {
      console.error(`❌ Directory "${name}" already exists`);
      process.exit(1);
    }

    console.log(`🌌 Creating Nemosyne project "${name}"...`);
    
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      dependencies: {
        "nemosyne": "^0.2.1",
        "aframe": "^1.7.0"
      },
      devDependencies: {
        "vite": "^5.0.0"
      }
    };
    
    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create index.html based on template
    const templates = {
      basic: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${name} - Nemosyne</title>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="./node_modules/nemosyne/dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene background="color: #111">
    <!-- Camera -->
    <a-entity position="0 1.6 4">
      <a-camera look-controls wasd-controls></a-camera>
    </a-entity>
    
    <!-- Lights -->
    <a-light type="ambient" color="#444"></a-light>
    <a-light type="directional" position="-2 4 4" intensity="0.8"></a-light>
    
    <!-- Sample visualization -->
    <a-entity position="0 0 0"
      nemosyne-artefact-v2="
        spec: {
          id: 'demo',
          geometry: { type: 'cylinder', radius: 0.3, height: 2 },
          material: { properties: { color: '#00d4aa' } }
        };
        dataset: {
          records: [
            { month: 'Jan', sales: 100 },
            { month: 'Feb', sales: 150 },
            { month: 'Mar', sales: 120 }
          ]
        };
        layout: grid;
        layout-options: { columns: 3, spacing: 2 }
      ">
    </a-entity>
    
    <!-- Floor -->
    <a-plane position="0 0 0" rotation="-90 0 0" width="20" height="20" color="#222"></a-plane>
  </a-scene>
</body>
</html>`,
      
      advanced: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${name} - Advanced Nemosyne</title>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="./node_modules/nemosyne/dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene background="color: #111">
    <a-entity position="0 1.6 8">
      <a-camera look-controls wasd-controls></a-camera>
    </a-entity>
    
    <a-light type="ambient" color="#444"></a-light>
    <a-light type="directional" position="-2 4 4" intensity="0.8"></a-light>
    
    <!-- Force-directed graph -->
    <a-entity id="graph-container" position="0 2 0"></a-entity>
    
    <script type="module">
      import { DataNativeEngine, NemosyneDataPacket } from 'nemosyne';
      
      const engine = new DataNativeEngine();
      
      // Create network data
      const nodes = [
        new NemosyneDataPacket({ id: 'A', value: 100, links: ['B', 'C'] }),
        new NemosyneDataPacket({ id: 'B', value: 80, links: ['C'] }),
        new NemosyneDataPacket({ id: 'C', value: 60 })
      ];
      
      nodes.forEach(n => engine.ingest(n));
      
      const positions = engine.layout('nemosyne-graph-force');
      console.log('Layout positions:', positions);
    </script>
    
    <a-plane position="0 0 0" rotation="-90 0 0" width="30" height="30" color="#1a1a1a"></a-plane>
  </a-scene>
</body>
</html>`,
      
      websocket: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${name} - Real-time Nemosyne</title>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="./node_modules/nemosyne/dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene background="color: #111">
    <a-entity position="0 1.6 6">
      <a-camera look-controls wasd-controls></a-camera>
    </a-entity>
    
    <a-light type="ambient" color="#444"></a-light>
    <a-light type="directional" position="-2 4 4" intensity="0.8"></a-light>
    
    <a-text id="status" value="Connecting..." position="-2 3 -4" color="#FFF"></a-text>
    
    <a-entity id="viz-container" position="0 1 0"></a-entity>
    
    <script type="module">
      import { DataNativeEngine } from 'nemosyne';
      
      const engine = new DataNativeEngine({
        websocket: { url: 'ws://localhost:8080/data' }
      });
      
      const status = document.querySelector('#status');
      
      engine.on('websocket-open', () => {
        status.setAttribute('value', 'Connected!');
        status.setAttribute('color', '#00FF00');
      });
      
      engine.on('websocket-message', (data) => {
        engine.ingest(data);
        engine.layout('nemosyne-timeline-linear');
      });
      
      engine.connectWebSocket();
    </script>
    
    <a-plane position="0 0 0" rotation="-90 0 0" width="20" height="20" color="#222"></a-plane>
  </a-scene>
</body>
</html>`
    };
    
    fs.writeFileSync(
      path.join(projectPath, 'index.html'),
      templates[options.template] || templates.basic
    );
    
    // Create README
    fs.writeFileSync(
      path.join(projectPath, 'README.md'),
      `# ${name}

Generated with Nemosyne CLI.

## Getting Started

\`\`\`bash
cd ${name}
npm install
npm run dev
\`\`\`

Open http://localhost:5173 in your browser.

## Next Steps

- Read the [Nemosyne Documentation](https://github.com/TsatsuAmable/nemosyne#readme)
- Explore [Layout Guides](https://github.com/TsatsuAmable/nemosyne/blob/main/docs/LAYOUT_GUIDE.md)
- Check out [Examples](https://github.com/TsatsuAmable/nemosyne/tree/main/examples)

## Resources

- [A-Frame Documentation](https://aframe.io/docs/)
- [WebXR Device API](https://immersiveweb.dev/)
`
    );
    
    // Create .gitignore
    fs.writeFileSync(
      path.join(projectPath, '.gitignore'),
      `node_modules/
dist/
.vite/
*.log
.DS_Store
`
    );
    
    console.log('✅ Project created!');
    console.log('');
    console.log(`  cd ${name}`);
    console.log('  npm install');
    console.log('  npm run dev');
    console.log('');
    console.log('📖 Documentation: https://github.com/TsatsuAmable/nemosyne');
  });

program
  .command('templates')
  .description('List available templates')
  .action(() => {
    console.log('Available templates:');
    console.log('  basic     - Simple bar chart with sample data');
    console.log('  advanced  - Force-directed graph with module imports');
    console.log('  websocket - Real-time data streaming setup');
  });

program.parse();
