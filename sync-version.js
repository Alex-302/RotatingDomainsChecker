#!/usr/bin/env node

/**
 * Sync version from src/index.ts to package.json
 * This ensures single source of truth for version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from src/index.ts
function getVersionFromSource() {
  const indexPath = path.join(__dirname, 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf8');
  const match = content.match(/const VERSION = "([^"]+)"/);
  return match ? match[1] : null;
}

// Update package.json with new version
function updatePackageJson(version) {
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  if (packageJson.version !== version) {
    packageJson.version = version;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✅ Updated package.json to v${version}`);
    return true;
  } else {
    console.log(`✅ package.json already at v${version}`);
    return false;
  }
}

// Main execution
const version = getVersionFromSource();
if (!version) {
  console.error('❌ Could not find VERSION in src/index.ts');
  process.exit(1);
}

const updated = updatePackageJson(version);

// Exit with different codes for CI/CD
process.exit(updated ? 1 : 0); // 1 = updated, 0 = no changes
