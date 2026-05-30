#!/usr/bin/env node

/**
 * Sync version from package.json to src/index.ts and package-lock.json.
 * package.json is the single source of truth for releases.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

/**
 * Extract version from package.json
 * @param {string} filePath - Path to package.json
 * @returns {string | null} Version string or null if not found
 */
export function extractVersionFromFile(filePath) {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return typeof json.version === 'string' ? json.version : null;
  } catch (error) {
    throw new Error(`Failed to read file: ${filePath}\n${error.message}`);
  }
}

/**
 * Validate release version against SemVer
 * @param {string} version - Version to validate
 */
export function validateVersion(version) {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Invalid SemVer version: ${version}`);
  }
}

/**
 * Update VERSION constant in src/index.ts
 * @param {string} filePath - Path to source file
 * @param {string} newVersion - New version to set
 * @returns {boolean} True if file was updated, false if already at correct version
 */
export function updateSourceVersion(filePath, newVersion) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const pattern = /const VERSION = ["']([^"']+)["'];/;
    const match = content.match(pattern);

    if (!match) {
      throw new Error('Could not find VERSION constant in source file');
    }

    if (match[1] === newVersion) {
      return false;
    }

    const updatedContent = content.replace(pattern, `const VERSION = "${newVersion}";`);
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to update source version: ${filePath}\n${error.message}`);
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

  // Extract version from package.json
  const version = extractVersionFromFile(packagePath);
  if (!version) {
    console.error('❌ Could not find version in package.json');
    process.exit(1);
  }

  try {
    validateVersion(version);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  // Update src/index.ts
  try {
    const sourceUpdated = updateSourceVersion(indexPath, version);
    if (sourceUpdated) {
      console.log(`✅ Updated src/index.ts to v${version}`);
    } else {
      console.log(`✅ src/index.ts already at v${version}`);
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
