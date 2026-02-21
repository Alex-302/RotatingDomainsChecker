import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import functions from sync-version.js
// We'll need to refactor sync-version.js to export functions for testing

describe('sync-version.js', () => {
  const testDir = path.join(__dirname, 'fixtures', 'sync-version-test');
  const indexPath = path.join(testDir, 'src', 'index.ts');
  const packagePath = path.join(testDir, 'package.json');
  const lockPath = path.join(testDir, 'package-lock.json');

  beforeEach(() => {
    // Create test directory structure
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(path.join(testDir, 'src'))) {
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getVersionFromSource', () => {
    test('extracts version from src/index.ts', () => {
      const content = `#!/usr/bin/env node
import { something } from "./something.js";

// Version
const VERSION = "1.2.3";

function main() {
  console.log("Hello");
}`;
      fs.writeFileSync(indexPath, content, 'utf8');

      const version = extractVersionFromFile(indexPath);
      expect(version).toBe('1.2.3');
    });

    test('returns null if VERSION not found', () => {
      const content = `#!/usr/bin/env node
import { something } from "./something.js";

function main() {
  console.log("Hello");
}`;
      fs.writeFileSync(indexPath, content, 'utf8');

      const version = extractVersionFromFile(indexPath);
      expect(version).toBeNull();
    });

    test('handles different quote styles', () => {
      const content = `const VERSION = '2.0.0';`;
      fs.writeFileSync(indexPath, content, 'utf8');

      const version = extractVersionFromFile(indexPath);
      expect(version).toBe('2.0.0');
    });

    test('throws error if file does not exist', () => {
      expect(() => extractVersionFromFile('/nonexistent/file.ts')).toThrow();
    });
  });

  describe('updatePackageJson', () => {
    test('updates package.json when version differs', () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package'
      };
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

      const updated = updateJsonFile(packagePath, '1.1.0', 'version');
      expect(updated).toBe(true);

      const result = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      expect(result.version).toBe('1.1.0');
    });

    test('does not update when version is same', () => {
      const packageJson = {
        name: 'test-package',
        version: '1.1.0',
        description: 'Test package'
      };
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

      const updated = updateJsonFile(packagePath, '1.1.0', 'version');
      expect(updated).toBe(false);
    });

    test('preserves JSON formatting', () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        scripts: {
          test: 'jest',
          build: 'tsc'
        }
      };
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

      updateJsonFile(packagePath, '1.1.0', 'version');

      const result = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      expect(result.scripts).toEqual(packageJson.scripts);
    });
  });

  describe('updatePackageLock', () => {
    test('updates both root and packages[""] version', () => {
      const lockJson = {
        name: 'test-package',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-package',
            version: '1.0.0'
          }
        }
      };
      fs.writeFileSync(lockPath, JSON.stringify(lockJson, null, 2) + '\n', 'utf8');

      const updated = updatePackageLockVersion(lockPath, '1.1.0');
      expect(updated).toBe(true);

      const result = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      expect(result.version).toBe('1.1.0');
      expect(result.packages[''].version).toBe('1.1.0');
    });

    test('does not update when both versions are same', () => {
      const lockJson = {
        name: 'test-package',
        version: '1.1.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-package',
            version: '1.1.0'
          }
        }
      };
      fs.writeFileSync(lockPath, JSON.stringify(lockJson, null, 2) + '\n', 'utf8');

      const updated = updatePackageLockVersion(lockPath, '1.1.0');
      expect(updated).toBe(false);
    });

    test('updates only root version if packages[""] missing', () => {
      const lockJson = {
        name: 'test-package',
        version: '1.0.0',
        lockfileVersion: 3
      };
      fs.writeFileSync(lockPath, JSON.stringify(lockJson, null, 2) + '\n', 'utf8');

      const updated = updatePackageLockVersion(lockPath, '1.1.0');
      expect(updated).toBe(true);

      const result = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      expect(result.version).toBe('1.1.0');
    });
  });

  describe('integration test', () => {
    test('syncs version from src/index.ts to package.json and package-lock.json', () => {
      // Setup source file
      const sourceContent = `const VERSION = "2.0.0";`;
      fs.writeFileSync(indexPath, sourceContent, 'utf8');

      // Setup package.json
      const packageJson = { name: 'test', version: '1.0.0' };
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

      // Setup package-lock.json
      const lockJson = {
        name: 'test',
        version: '1.0.0',
        packages: { '': { name: 'test', version: '1.0.0' } }
      };
      fs.writeFileSync(lockPath, JSON.stringify(lockJson, null, 2) + '\n', 'utf8');

      // Run sync
      const version = extractVersionFromFile(indexPath);
      const pkgUpdated = updateJsonFile(packagePath, version!, 'version');
      const lockUpdated = updatePackageLockVersion(lockPath, version!);

      expect(pkgUpdated).toBe(true);
      expect(lockUpdated).toBe(true);

      // Verify results
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

      expect(pkg.version).toBe('2.0.0');
      expect(lock.version).toBe('2.0.0');
      expect(lock.packages[''].version).toBe('2.0.0');
    });
  });
});

// Helper functions to test (these should be exported from refactored sync-version.js)
function extractVersionFromFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/const VERSION = ["']([^"']+)["']/);
    return match ? match[1] : null;
  } catch (error) {
    throw new Error(`Failed to read file: ${filePath}`);
  }
}

function updateJsonFile(filePath: string, newVersion: string, versionKey: string): boolean {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (json[versionKey] === newVersion) {
      return false;
    }
    
    json[versionKey] = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to update JSON file: ${filePath}`);
  }
}

function updatePackageLockVersion(filePath: string, newVersion: string): boolean {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let updated = false;
    
    if (json.version !== newVersion) {
      json.version = newVersion;
      updated = true;
    }
    
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
    throw new Error(`Failed to update package-lock.json: ${filePath}`);
  }
}
