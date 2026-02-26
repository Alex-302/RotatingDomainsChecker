import { loadConfig, loadWatchers, saveWatchers } from '../src/config.js';
import { readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('9. config.ts — Configuration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rdc-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('loadConfig loads YAML correctly', () => {
    const configContent = `
http:
  timeout: 5000
  retries: 3
  heuristicTimeout: 3000
  userAgent: "TestAgent"
processing:
  parallel: 5
  redirectDepth: 5
dnsPreCheck:
  enabled: true
  timeout: 3000
  retryOnce: true
contentProbe:
  enabled: true
antibot:
  detectCodes: [403, 409]
  detectUrlPattern: "__cf_chl_tk"
thresholds:
  failedDaysWarning: 14
heuristic:
  enabled: true
  maxAttempts: 20
  skipOnAntibot: true
  forceHeuristicOnCodes: [404]
logging:
  saveToFile: false
  incremental: false
  filePath: ""
git:
  mode: "prod"
  branch: "master"
  prBranchPrefix: "auto-update"
filtersdir:
  repoPath: ""
  filterDirPattern: "*Filter"
  filePattern: "*.txt"
`;
    const configPath = join(tempDir, 'config.yml');
    writeFileSync(configPath, configContent, 'utf-8');

    const config = loadConfig(configPath);
    expect(config.http.timeout).toBe(5000);
    expect(config.http.retries).toBe(3);
    expect(config.antibot.detectCodes).toEqual([403, 409]);
    expect(config.git.mode).toBe('prod');
  });

  test('loadWatchers loads YAML with comments', () => {
    const watchersContent = `# Main watchers file
sites:
  # Turkish sites
  example001.com:
    initial_domain: example001.com
    last_known_mirror: example020.com
    last_seen: "2024-01-15"
    failed_since: ""
    failed_days: 0
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = loadWatchers(watchersPath);
    expect(watchers.sites).toBeDefined();
    expect(watchers.sites['example001.com']).toBeDefined();
    expect(watchers.sites['example001.com'].last_known_mirror).toBe('example020.com');
  });

  test('saveWatchers preserves comments', () => {
    const watchersContent = `# Main watchers file
sites:
  # Turkish sites
  example001.com:
    initial_domain: example001.com
    last_known_mirror: example020.com
    last_seen: "2024-01-15"
    failed_since: ""
    failed_days: 0
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = loadWatchers(watchersPath);
    watchers.sites['example001.com'].last_known_mirror = 'example025.com';
    saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    expect(savedContent).toContain('example025.com');
  });

  test('updating individual site fields does not overwrite others', () => {
    const watchersContent = `sites:
  site1:
    initial_domain: site1.com
    last_known_mirror: site1new.com
    last_seen: "2024-01-15"
    failed_since: ""
    failed_days: 0
    probe_text:
      - "keyword"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = loadWatchers(watchersPath);
    watchers.sites['site1'].last_seen = '2024-02-01 12:00';
    saveWatchers(watchers, watchersPath);

    const reloaded = loadWatchers(watchersPath);
    expect(reloaded.sites['site1'].initial_domain).toBe('site1.com');
    expect(reloaded.sites['site1'].last_seen).toBe('2024-02-01 12:00');
    expect(reloaded.sites['site1'].probe_text).toEqual(['keyword']);
  });
});
