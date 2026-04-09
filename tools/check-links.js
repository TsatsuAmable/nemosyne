#!/usr/bin/env node
/**
 * Link Checker for Nemosyne Documentation
 * Tests all links in HTML files point to valid destinations
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const FILES_TO_CHECK = [
    'examples/gallery.html',
    'docs/index.html',
    'examples/animated-memory-explorer.html',
    'examples/nemosyne-ecosystem-demo.html',
    'examples/data-native-demo.html'
];

// Common external URLs to skip
const EXTERNAL_URLS = [
    'https://',
    'http://'
];

function isExternal(url) {
    return EXTERNAL_URLS.some(prefix => url.startsWith(prefix));
}

function extractLinks(htmlContent, filePath) {
    const links = [];
    const hrefRegex = /href=["']([^"']+)["']/g;
    let match;
    
    while ((match = hrefRegex.exec(htmlContent)) !== null) {
        const url = match[1];
        if (!url.startsWith('#') && !url.startsWith('javascript:')) {
            links.push(url);
        }
    }
    
    return [...new Set(links)]; // Remove duplicates
}

function resolveLink(link, baseDir) {
    if (path.isAbsolute(link)) {
        return path.join(BASE_DIR, link);
    }
    return path.resolve(baseDir, link);
}

function checkLink(link, baseDir) {
    if (isExternal(link)) {
        return { valid: true, external: true, path: link };
    }
    
    const fullPath = resolveLink(link, baseDir);
    const exists = fs.existsSync(fullPath);
    
    return {
        valid: exists,
        external: false,
        path: link,
        fullPath: fullPath.replace(BASE_DIR, '')
    };
}

function checkFile(filePath) {
    const fullFilePath = path.join(BASE_DIR, filePath);
    
    if (!fs.existsSync(fullFilePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return { file: filePath, error: 'File not found', links: [] };
    }
    
    const content = fs.readFileSync(fullFilePath, 'utf8');
    const links = extractLinks(content, path.dirname(fullFilePath));
    const baseDir = path.dirname(fullFilePath);
    
    const results = links.map(link => {
        const result = checkLink(link, baseDir);
        return {
            link,
            ...result
        };
    });
    
    return {
        file: filePath,
        links: results
    };
}

function main() {
    console.log('🔍 Nemosyne Link Checker\n');
    console.log('=' .repeat(60));
    
    let totalLinks = 0;
    let brokenLinks = 0;
    let externalLinks = 0;
    
    FILES_TO_CHECK.forEach(file => {
        const result = checkFile(file);
        
        if (result.error) {
            console.log(`\n📄 ${result.file}`);
            console.log(`   ${result.error}`);
            return;
        }
        
        const fileLinks = result.links.length;
        const validLinks = result.links.filter(l => l.valid).length;
        const broken = result.links.filter(l => !l.valid && !l.external);
        
        totalLinks += fileLinks;
        brokenLinks += broken.length;
        externalLinks += result.links.filter(l => l.external).length;
        
        console.log(`\n📄 ${result.file} (${fileLinks} links)`);
        
        if (broken.length === 0) {
            console.log('   ✅ All internal links valid');
        } else {
            console.log('   ⚠️  Broken links found:');
            broken.forEach(b => {
                console.log(`      ❌ ${b.link} -> ${b.fullPath}`);
            });
        }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total links checked: ${totalLinks}`);
    console.log(`   External links: ${externalLinks}`);
    console.log(`   Broken internal links: ${brokenLinks}`);
    
    if (brokenLinks === 0) {
        console.log('\n✅ All internal links are working!');
    } else {
        console.log(`\n⚠️  Found ${brokenLinks} broken link(s)`);
        process.exit(1);
    }
}

main();
