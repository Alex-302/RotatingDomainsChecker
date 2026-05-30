import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  extractVersionFromFile,
  updateJsonFile,
  updatePackageLockVersion,
  updateSourceVersion,
  validateVersion,
} from '../sync-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('sync-version.js', () => {
  const testDir = path.join(__dirname, 'fixtures', 'sync-version-test');
  const indexPath = path.join(testDir, 'src', 'index.ts');
  const packagePath = path.join(testDir, 'package.json');
  const lockPath = path.join(testDir, 'package-lock.json');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(path.join(testDir, 'src'))) {
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('extractVersionFromFile', () => {
    test('extracts version from package.json', () => {
      const packageJson = {
        name: 'test-package',
        version: '1.2.3',
      };
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

      const version = extractVersionFromFile(packagePath);
      expect(version).toBe('1.2.3');
    });

    test('returns null if version is missing', () => {
      fs.writeFileSync(packagePath, JSON.stringify({ name: 'test-package' }, null, 2) + '\n', 'utf8');

      const version = extractVersionFromFile(packagePath);
      expect(version).toBeNull();
    });

    test('throws error if file does not exist', () => {
      expect(() => extractVersionFromFile('/nonexistent/package.json')).toThrow();
    });
  });

  describe('validateVersion', () => {
    test('accepts valid SemVer strings', () => {
      expect(() => validateVersion('2.0.0')).not.toThrow();
      expect(() => validateVersion('2.0.0-beta.1+build.7')).not.toThrow();
    });

    test('rejects invalid SemVer strings', () => {
      expect(() => validateVersion('1.1.51`')).toThrow('Invalid SemVer version: 1.1.51`');
      expect(() => validateVersion('1.2')).toThrow('Invalid SemVer version: 1.2');
    });
  });

  describe('updateSourceVersion', () => {
    test('updates VERSION constant in src/index.ts', () => {
      const content = `#!/usr/bin/env node
import { something } from "./something.js";

// Version
const VERSION = "1.2.3";

function main() {
  console.log("Hello");
}`;
      fs.writeFileSync(indexPath, content, 'utf8');

      const updated = updateSourceVersion(indexPath, '1.3.0');

      expect(updated).toBe(true);
      expect(fs.readFileSync(indexPath, 'utf8')).toContain('const VERSION = "1.3.0";');
    });

    test('does not update when source version is same', () => {
      fs.writeFileSync(indexPath, 'const VERSION = "2.0.0";', 'utf8');

      const updated = updateSourceVersion(indexPath, '2.0.0');

      expect(updated).toBe(false);
    });

    test('throws if VERSION constant is missing', () => {
      fs.writeFileSync(indexPath, 'console.log("missing version");', 'utf8');

      expect(() => updateSourceVersion(indexPath, '2.0.0')).toThrow(
        'Could not find VERSION constant in source file'
      );
    });
  });

  describe('updateJsonFile', () => {
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

  describe('updatePackageLockVersion', () => {
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

  describe('integration', () => {
    test('syncs version from package.json to src/index.ts and package-lock.json', () => {
      fs.writeFileSync(indexPath, 'const VERSION = "1.0.0";', 'utf8');
      fs.writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '2.0.0' }, null, 2) + '\n', 'utf8');
      fs.writeFileSync(lockPath, JSON.stringify({
        name: 'test',
        version: '1.0.0',
        packages: { '': { name: 'test', version: '1.0.0' } }
      }, null, 2) + '\n', 'utf8');

      const version = extractVersionFromFile(packagePath);
      validateVersion(version!);
      const sourceUpdated = updateSourceVersion(indexPath, version!);
      const lockUpdated = updatePackageLockVersion(lockPath, version!);

      expect(sourceUpdated).toBe(true);
      expect(lockUpdated).toBe(true);
      expect(fs.readFileSync(indexPath, 'utf8')).toContain('const VERSION = "2.0.0";');

      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      expect(lock.version).toBe('2.0.0');
      expect(lock.packages[''].version).toBe('2.0.0');
    });
  });
});
