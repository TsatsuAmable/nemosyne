/**
 * Build script for Nemosyne bundles
 * Creates distribution files with optional modules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const dirDist = path.join(rootDir, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(dirDist)) {
  fs.mkdirSync(dirDist, { recursive: true });
}

// Core files
const coreFiles = [
  'src/index.js',
  'src/core/index.js',
  'src/animation/index.js'
];

// Hyperion artefacts
const hyperionFiles = [
  'src/artefacts/hyperion/nemosyne-shrike.js',
  'src/artefacts/hyperion/nemosyne-time-tomb.js',
  'src/artefacts/hyperion/nemosyne-farcaster.js',
  'src/artefacts/hyperion/nemosyne-templar-tree.js',
  'src/artefacts/hyperion/nemosyne-memory-crystal.js'
];

// Physics module
const physicsFiles = [
  'src/physics/AmmoPhysicsEngine.js'
];

/**
 * Build the Hyperion bundle
 */
function buildHyperionBundle() {
  console.log('Building Hyperion bundle...');
  
  const header = `/**
 * Nemosyne Hyperion-Cantos Theme Pack
 * Themed VR data visualization artefacts
 * @version 1.2.0
 */

`;

  const content = [];
  
  for (const file of hyperionFiles) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      content.push(`// === ${path.basename(file)} ===\n${fileContent}\n`);
    } else {
      console.warn(`Warning: ${file} not found`);
    }
  }
  
  const bundle = header + content.join('\n');
  const outputPath = path.join(dirDist, 'nemosyne-hyperion.js');
  fs.writeFileSync(outputPath, bundle);
  
  console.log(`✅ Hyperion bundle: ${outputPath} (${(bundle.length / 1024).toFixed(1)}KB)`);
  return bundle.length;
}

/**
 * Build the Physics bundle
 */
function buildPhysicsBundle() {
  console.log('Building Physics bundle...');
  
  const header = `/**
 * Nemosyne Physics Extension (Ammo.js)
 * High-performance physics for force-directed graphs
 * @version 1.2.0
 * @requires ammo.js
 */

`;

  const content = [];
  
  for (const file of physicsFiles) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      content.push(`// === ${path.basename(file)} ===\n${fileContent}\n`);
    } else {
      console.warn(`Warning: ${file} not found`);
    }
  }
  
  const bundle = header + content.join('\n');
  const outputPath = path.join(dirDist, 'nemosyne-physics.js');
  fs.writeFileSync(outputPath, bundle);
  
  console.log(`✅ Physics bundle: ${outputPath} (${(bundle.length / 1024).toFixed(1)}KB)`);
  return bundle.length;
}

/**
 * Update package.json exports
 */
function updatePackageExports() {
  const packagePath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  // Ensure exports exist
  if (!pkg.exports) {
    pkg.exports = {};
  }
  
  // Add Hyperion and Physics exports
  pkg.exports['./hyperion'] = './dist/nemosyne-hyperion.js';
  pkg.exports['./physics'] = './dist/nemosyne-physics.js';
  
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('✅ Updated package.json exports');
}

/**
 * Main build function
 */
function build() {
  console.log('\n🔨 Nemosyne Bundle Builder\n');
  
  const hyperionSize = buildHyperionBundle();
  const physicsSize = buildPhysicsBundle();
  updatePackageExports();
  
  console.log('\n📦 Build Summary:');
  console.log(`  Hyperion: ${(hyperionSize / 1024).toFixed(1)}KB`);
  console.log(`  Physics: ${(physicsSize / 1024).toFixed(1)}KB`);
  console.log(`  Total: ${((hyperionSize + physicsSize) / 1024).toFixed(1)}KB`);
  console.log('\n✅ Build complete!\n');
}

// Run build
build();
