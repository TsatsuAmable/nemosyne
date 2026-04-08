#!/usr/bin/env node

/**
 * Build script for Nemosyne
 * Creates production bundles with version stamping
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = require('../package.json').version;
const BUILD_DIR = path.join(__dirname, '../dist');

console.log(`🔨 Building Nemosyne v${VERSION}...\n`);

// Clean dist directory
if (fs.existsSync(BUILD_DIR)) {
  console.log('📁 Cleaning dist directory...');
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}

// Create fresh dist directory
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Run builds for each format
const builds = [
  { format: 'es', mode: 'es', label: 'ES Module' },
  { format: 'umd', mode: 'umd', label: 'UMD Bundle' },
  { format: 'iife', mode: 'iife', label: 'IIFE Bundle' }
];

console.log('📦 Running Vite builds...\n');

for (const build of builds) {
  console.log(`  Building ${build.label}...`);
  try {
    execSync(`npx vite build --mode ${build.mode}`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    console.log(`  ✅ ${build.label} complete`);
  } catch (error) {
    console.error(`  ❌ ${build.label} failed:`, error.message);
    process.exit(1);
  }
}

// Add version header to built files
console.log('\n🏷️  Adding version headers...\n');

const versionBanner = `/**
 * Nemosyne v${VERSION}
 * VR Artefacts for Real-World Data
 * https://nemosyne.world
 * License: MIT
 */\n`;

const jsFiles = fs.readdirSync(BUILD_DIR)
  .filter(f => f.endsWith('.js'));

jsFiles.forEach(file => {
  const filePath = path.join(BUILD_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, versionBanner + content);
  console.log(`   ✓ ${file}`);
});

// Generate file size report
console.log('\n📊 Bundle Sizes:');
jsFiles.forEach(file => {
  const stats = fs.statSync(path.join(BUILD_DIR, file));
  const size = (stats.size / 1024).toFixed(2);
  console.log(`   ${file.padEnd(30)} ${size.padStart(8)} KB`);
});

// Create manifest
const manifest = {
  name: 'nemosyne',
  version: VERSION,
  description: 'VR Artefacts for Real-World Data',
  files: jsFiles.map(f => ({
    file: f,
    format: f.includes('.es.') ? 'es' : f.includes('.umd.') ? 'umd' : 'iife',
    minified: f.includes('.min.')
  })),
  buildDate: new Date().toISOString()
};

fs.writeFileSync(
  path.join(BUILD_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log(`\n✅ Build complete!`);
console.log(`\n📂 Output: ${BUILD_DIR}`);
console.log('\nUsage:');
console.log('  ES Module:  import Nemosyne from "./dist/nemosyne.es.js"');
console.log('  UMD:        const Nemosyne = require("./dist/nemosyne.umd.js")');
console.log('  CDN/IIFE:   <script src="./dist/nemosyne.iife.js"></script>');
console.log('  Minified:   <script src="./dist/nemosyne.min.iife.js"></script>');