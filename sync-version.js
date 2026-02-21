#!/usr/bin/env node

/**
 * Sync version from src/index.ts to package.json and package-lock.json
 * This ensures single source of truth for version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract version from source file
 * @param {string} filePath - Path to source file
 * @returns {string | null} Version string or null if not found
 */
export function extractVersionFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/const VERSION = ["']([^"']+)["']/);
    return match ? match[1] : null;
  } catch (error) {
    throw new Error(`Failed to read file: ${filePath}\n${error.message}`);
  }
}

/**
 * Update a JSON file's version field
 * @param {string} filePath - Path to JSON file
 * @param {string} newVersion - New version to set
 * @param {string} versionKey - Key to update (default: 'version')
 * @returns {boolean} True if file was updated, false if already at correct version
 */
export function updateJsonFile(filePath, newVersion, versionKey = 'version') {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (json[versionKey] === newVersion) {
      return false;
    }
    
    json[versionKey] = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to update JSON file: ${filePath}\n${error.message}`);
  }
}

/**
 * Update package-lock.json version (both root and packages[""])
 * @param {string} filePath - Path to package-lock.json
 * @param {string} newVersion - New version to set
 * @returns {boolean} True if file was updated, false if already at correct version
 */
export function updatePackageLockVersion(filePath, newVersion) {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let updated = false;
    
    // Update root version
    if (json.version !== newVersion) {
      json.version = newVersion;
      updated = true;
    }
    
    // Update packages[""] version
    if (json.packages?.['']?.version !== newVersion) {
      if (!json.packages) json.packages = {};
      if (!json.packages['']) json.packages[''] = {};
      json.packages[''].version = newVersion;
      updated = true;
    }
    
    if (updated) {
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    }
    
    return updated;
  } catch (error) {
    throw new Error(`Failed to update package-lock.json: ${filePath}\n${error.message}`);
  }
}

/**
 * Main sync function
 */
function main() {
  const indexPath = path.join(__dirname, 'src', 'index.ts');
  const packagePath = path.join(__dirname, 'package.json');
  const lockPath = path.join(__dirname, 'package-lock.json');
  
  // Extract version from source
  const version = extractVersionFromFile(indexPath);
  if (!version) {
    console.error('❌ Could not find VERSION in src/index.ts');
    process.exit(1);
  }
  
  let anyUpdated = false;
  
  // Update package.json
  try {
    const pkgUpdated = updateJsonFile(packagePath, version);
    if (pkgUpdated) {
      console.log(`✅ Updated package.json to v${version}`);
      anyUpdated = true;
    } else {
      console.log(`✅ package.json already at v${version}`);
    }
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
  
  // Update package-lock.json
  try {
    const lockUpdated = updatePackageLockVersion(lockPath, version);
    if (lockUpdated) {
      console.log(`✅ Updated package-lock.json to v${version}`);
      anyUpdated = true;
    } else {
      console.log(`✅ package-lock.json already at v${version}`);
    }
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
  
  // Exit with standard codes: 0 = success, 1 = error
  process.exit(0);
}

// Run main if executed directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath) {
    main();
  }
}
