#!/usr/bin/env node
/**
 * Process NASA NEO close approach data for Nemosyne visualization
 * Converts CNEOS CAD API JSON to optimized format
 */

import fs from 'fs';
import path from 'path';

const INPUT_FILE = 'data/neo-close-approaches-full.json';
const OUTPUT_FILE = 'data/neo-processed.json';

function parseDate(dateStr) {
  // Format: "2024-Jan-01 02:47"
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  const parts = dateStr.split(' ');
  const dateParts = parts[0].split('-');
  const year = parseInt(dateParts[0]);
  const month = months[dateParts[1]];
  const day = parseInt(dateParts[2]);
  const timeParts = parts[1].split(':');
  const hour = parseInt(timeParts[0]);
  const minute = parseInt(timeParts[1]);
  
  return new Date(year, month, day, hour, minute);
}

function normalizeDate(date) {
  // Convert to days since 2020-01-01 for 3D positioning
  const epoch = new Date('2020-01-01');
  return (date - epoch) / (1000 * 60 * 60 * 24); // Days
}

function estimateDiameter(absoluteMagnitude) {
  // Rough estimate: D = 10^((H - 15)/2.5) * 0.14 km
  // Returns diameter in meters
  if (!absoluteMagnitude || absoluteMagnitude === '') return 100; // Default 100m
  const H = parseFloat(absoluteMagnitude);
  if (isNaN(H)) return 100;
  const km = Math.pow(10, (H - 15) / 2.5) * 0.14;
  return km * 1000; // Convert to meters
}

function classifyHazard(distanceAU) {
  // Potentially Hazardous: < 0.05 AU (about 7.5 million km)
  // Close approach: < 0.1 AU
  // Safe: > 0.1 AU
  const dist = parseFloat(distanceAU);
  if (dist < 0.05) return 'hazardous';
  if (dist < 0.1) return 'close';
  return 'safe';
}

function processData() {
  const rawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  
  const fields = rawData.fields;
  const data = rawData.data;
  
  const processed = data.map((row, index) => {
    const record = {};
    fields.forEach((field, i) => {
      record[field] = row[i];
    });
    
    const date = parseDate(record.cd);
    const normalizedTime = normalizeDate(date);
    const diameter = estimateDiameter(record.h);
    const hazardClass = classifyHazard(record.dist);
    
    // Calculate orbital position approximation
    // Simplified: use distance and time to estimate position in 3D
    const distanceAU = parseFloat(record.dist);
    const angle = (normalizedTime % 365) / 365 * 2 * Math.PI; // Yearly cycle
    
    return {
      id: record.des,
      designation: record.des,
      date: record.cd,
      timeDays: normalizedTime, // Z-axis (time)
      distanceAU: distanceAU,
      distanceKm: distanceAU * 150000000, // Convert to km
      velocityKms: parseFloat(record.v_rel),
      absoluteMagnitude: record.h,
      estimatedDiameter: diameter,
      hazardClass: hazardClass,
      // 3D position (simplified orbital mechanics)
      x: distanceAU * Math.cos(angle) * 5, // Scaled for visibility
      y: distanceAU * Math.sin(angle) * 5,
      z: normalizedTime / 365 * 2, // 2 units per year
    };
  });
  
  // Sort by date
  processed.sort((a, b) => a.timeDays - b.timeDays);
  
  const output = {
    meta: {
      source: 'NASA/JPL CNEOS CAD API',
      generated: new Date().toISOString(),
      count: processed.length,
      timeRange: {
        start: processed[0]?.date,
        end: processed[processed.length - 1]?.date,
      },
      units: {
        distance: 'AU (Astronomical Units)',
        velocity: 'km/s',
        diameter: 'meters',
        time: 'days since 2020-01-01'
      }
    },
    data: processed
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Processed ${processed.length} NEO records`);
  console.log(`Time range: ${output.meta.timeRange.start} to ${output.meta.timeRange.end}`);
  console.log(`Hazardous objects: ${processed.filter(r => r.hazardClass === 'hazardous').length}`);
  console.log(`Close approaches: ${processed.filter(r => r.hazardClass === 'close').length}`);
  console.log(`Safe distances: ${processed.filter(r => r.hazardClass === 'safe').length}`);
}

processData();
