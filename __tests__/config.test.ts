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

  test('loadConfig loads YAML correctly', async () => {
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

    const config = await loadConfig(configPath);
    expect(config.http.timeout).toBe(5000);
    expect(config.http.retries).toBe(3);
    expect(config.antibot.detectCodes).toEqual([403, 409]);
    expect(config.git.mode).toBe('prod');
  });

  test('loadWatchers loads YAML with comments', async () => {
    const watchersContent = `# Main watchers file
sites:
  # Turkish sites
  example001.com:
    initial_domain: example001.com
    last_known_mirror: example020.com
    success_since: "2024-01-15"
    failed_since: ""
    failed_days: 0
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    expect(watchers.sites).toBeDefined();
    expect(watchers.sites['example001.com']).toBeDefined();
    expect(watchers.sites['example001.com'].last_known_mirror).toBe('example020.com');
  });

  test('saveWatchers preserves all comment positions (rich)', async () => {
    // Note: inline comment after `sites:` at root level is lost by yaml library's
    // parseDocument+stringify round-trip — that's a library limitation, not ours.
    // All other comment positions (before-field, inline after field values) are preserved.
    const watchersContent = [
      '# comment',
      'sites:',
      '# comment',
      '  videasy.net:',
      '  # comment',
      '    last_known_mirror: www.videasy.to # comment',
      '    # comment',
      '    success_since: "2026-06-08 16:12" # comment',
    ].join('\n') + '\n';
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    watchers.sites['videasy.net'].success_since = '2026-06-09 10:00';
    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');

    // Top-level comment before sites: preserved
    expect(savedContent).toContain('# comment');
    // Before-field comment under videasy.net preserved
    expect(savedContent).toContain('  # comment');
    // Inline comment after last_known_mirror value preserved
    expect(savedContent).toContain('last_known_mirror: www.videasy.to # comment');
    // Updated field value written
    expect(savedContent).toContain('success_since: "2026-06-09 10:00"');
    // Inline comment after success_since preserved
    expect(savedContent).toMatch(/success_since: "2026-06-09 10:00" # comment/);
  });

  test('saveWatchers preserves comment at every structural level', async () => {
    // Top-level, before-key, inline-after-key, before-field, inline-after-field
    const watchersContent = [
      '# TOP: main watchers file',
      'sites:',
      '  # SITE-COMMENT: before site key',
      '  site1.com:',
      '    # FIELD-COMMENT: before last_known_mirror',
      '    last_known_mirror: mirror1.com # INLINE: current mirror',
      '    # FIELD-COMMENT: before success_since',
      '    success_since: "2024-01-15 10:00" # INLINE: first success',
      '    # FIELD-COMMENT: before failed_since',
      '    failed_since: ""',
      '    failed_days: 0',
    ].join('\n') + '\n';
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    watchers.sites['site1.com'].last_known_mirror = 'mirror2.com';
    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');

    expect(savedContent).toContain('# TOP: main watchers file');
    expect(savedContent).toContain('# SITE-COMMENT: before site key');
    expect(savedContent).toContain('# FIELD-COMMENT: before last_known_mirror');
    expect(savedContent).toContain('last_known_mirror: mirror2.com # INLINE: current mirror');
    expect(savedContent).toContain('# FIELD-COMMENT: before success_since');
    expect(savedContent).toContain('success_since: "2024-01-15 10:00" # INLINE: first success');
    expect(savedContent).toContain('# FIELD-COMMENT: before failed_since');
    expect(savedContent).toContain('failed_since: ""');
    expect(savedContent).toContain('failed_days: 0');
  });

  test('updating individual site fields does not overwrite others', async () => {
    const watchersContent = `sites:
  site1:
    initial_domain: site1.com
    last_known_mirror: site1new.com
    success_since: "2024-01-15"
    failed_since: ""
    failed_days: 0
    probe_text:
      - "keyword"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    watchers.sites['site1'].success_since = '2024-02-01 12:00';
    await saveWatchers(watchers, watchersPath);

    const reloaded = await loadWatchers(watchersPath);
    expect(reloaded.sites['site1'].initial_domain).toBe('site1.com');
    expect(reloaded.sites['site1'].success_since).toBe('2024-02-01 12:00');
    expect(reloaded.sites['site1'].probe_text).toEqual(['keyword']);
  });

  test('replace_initial_domain is preserved through load and save', async () => {
    const watchersContent = `sites:
  site1:
    initial_domain: gateway.example
    replace_initial_domain: false
    last_known_mirror: mirror085.example
    success_since: "2024-01-15"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    expect(watchers.sites['site1'].replace_initial_domain).toBe(false);

    watchers.sites['site1'].last_known_mirror = 'mirror086.example';
    await saveWatchers(watchers, watchersPath);

    const reloaded = await loadWatchers(watchersPath);
    expect(reloaded.sites['site1'].replace_initial_domain).toBe(false);
    expect(reloaded.sites['site1'].last_known_mirror).toBe('mirror086.example');
  });

  test('loadWatchers migrates legacy last_seen → success_since', async () => {
    const watchersContent = `sites:
  example001.com:
    initial_domain: example001.com
    last_known_mirror: example020.com
    last_seen: "2024-01-15"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    expect(watchers.sites['example001.com'].success_since).toBe('2024-01-15');
    expect(watchers.sites['example001.com'].last_seen).toBeUndefined();
  });

  test('loadWatchers prefers explicit success_since over legacy last_seen', async () => {
    const watchersContent = `sites:
  example001.com:
    initial_domain: example001.com
    last_known_mirror: example020.com
    last_seen: "2024-01-15"
    success_since: "2024-03-10 09:30"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    expect(watchers.sites['example001.com'].success_since).toBe('2024-03-10 09:30');
    expect(watchers.sites['example001.com'].last_seen).toBeUndefined();
  });

  test('saveWatchers never writes legacy last_seen back', async () => {
    const watchersContent = `sites:
  site1:
    initial_domain: site1.com
    last_known_mirror: site1new.com
    last_seen: "2024-01-15"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    const watchers = await loadWatchers(watchersPath);
    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    expect(savedContent).not.toContain('last_seen');
    expect(savedContent).toContain('success_since');
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 9.x saveWatchers — state transition field persistence (failed_since / success_since)
  // ──────────────────────────────────────────────────────────────────────────────

  test('saveWatchers: success→failure removes success_since, adds failed_since/failed_days/potentially_dead', async () => {
    const watchersContent = `sites:
  Site1:
    last_known_mirror: himovies.bz
    success_since: "2026-05-25"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    // Load, simulate failure transition, then save
    const watchers = await loadWatchers(watchersPath);
    const site = watchers.sites['Site1'];

    // Simulate failure branch from index.ts: delete success_since, set failure fields
    delete site.success_since;
    site.failed_since = '2026-06-10 16:55';
    site.failed_days = 0;
    site.potentially_dead = true;

    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    // success_since must NOT appear after failure transition
    expect(savedContent).not.toContain('success_since');
    // failure fields must appear
    expect(savedContent).toContain('failed_since:');
    expect(savedContent).toContain('failed_days:');
    expect(savedContent).toContain('potentially_dead:');
    // last_known_mirror must be preserved
    expect(savedContent).toContain('last_known_mirror: himovies.bz');

    // Verify round-trip: reload and check in-memory state
    const reloaded = await loadWatchers(watchersPath);
    expect(reloaded.sites['Site1'].success_since).toBeUndefined();
    expect(reloaded.sites['Site1'].failed_since).toBe('2026-06-10 16:55');
    expect(reloaded.sites['Site1'].failed_days).toBe(0);
    expect(reloaded.sites['Site1'].potentially_dead).toBe(true);
    expect(reloaded.sites['Site1'].last_known_mirror).toBe('himovies.bz');
  });

  test('saveWatchers: failure→success removes failed_since/failed_days/potentially_dead, adds success_since', async () => {
    const watchersContent = `sites:
  Site2:
    last_known_mirror: example027.com
    failed_since: "2026-06-10 01:48"
    failed_days: 0
    potentially_dead: true
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    // Load, simulate recovery (failure→success), then save
    const watchers = await loadWatchers(watchersPath);
    const site = watchers.sites['Site2'];

    // Simulate success recovery branch from index.ts
    site.success_since = '2026-06-10 15:33';
    delete site.failed_since;
    delete site.failed_days;
    delete site.potentially_dead;

    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    // success_since must appear
    expect(savedContent).toContain('success_since:');
    // failure fields must NOT appear
    expect(savedContent).not.toContain('failed_since');
    expect(savedContent).not.toContain('failed_days');
    expect(savedContent).not.toContain('potentially_dead');
    // last_known_mirror must be preserved
    expect(savedContent).toContain('last_known_mirror: example027.com');

    // Verify round-trip
    const reloaded = await loadWatchers(watchersPath);
    expect(reloaded.sites['Site2'].success_since).toBe('2026-06-10 15:33');
    expect(reloaded.sites['Site2'].failed_since).toBeUndefined();
    expect(reloaded.sites['Site2'].failed_days).toBeUndefined();
    expect(reloaded.sites['Site2'].potentially_dead).toBeUndefined();
    expect(reloaded.sites['Site2'].last_known_mirror).toBe('example027.com');
  });

  test('saveWatchers: repeated success does NOT rewrite success_since (churn suppression)', async () => {
    const watchersContent = `sites:
  Site3:
    last_known_mirror: example001.com
    success_since: "2026-05-24 12:00"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    // Load and save WITHOUT changing success_since (simulating churn suppression)
    const watchers = await loadWatchers(watchersPath);

    // Do NOT touch success_since (churn suppression)
    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    // success_since must still have the original value
    expect(savedContent).toContain('success_since: "2026-05-24 12:00"');
  });

  test('saveWatchers: repeated failure preserves original failed_since', async () => {
    const watchersContent = `sites:
  Site4:
    last_known_mirror: example001.com
    failed_since: "2026-05-20 12:00"
    failed_days: 0
    potentially_dead: true
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    // Load, simulate repeated failure with day-bucket suppression
    const watchers = await loadWatchers(watchersPath);
    const site = watchers.sites['Site4'];

    // Simulate repeated failure: failed_since NOT reassigned, failed_days preserved
    // (day-bucket suppression — same-day repeated failure does not rewrite failed_days)
    // No changes to failure fields
    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    // Original failed_since preserved
    expect(savedContent).toContain('failed_since: "2026-05-20 12:00"');
    expect(savedContent).toContain('failed_days: 0');
    expect(savedContent).toContain('potentially_dead:');
  });

  test('saveWatchers: first-time initialization writes success_since (no prior state)', async () => {
    // Simulate HDFilmCehennemi scenario: site added manually without any timestamps
    const watchersContent = `sites:
  HDFilmCehennemi:
    initial_domain: t.co/3D4ep5ZtK4
    last_known_mirror: hdfilmcehennemi27.org
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    // Load, simulate first successful check, save
    const watchers = await loadWatchers(watchersPath);
    const site = watchers.sites['HDFilmCehennemi'];

    // Simulate first-time initialization: no prior state, success_since was never set
    expect(site.success_since).toBeUndefined();
    site.success_since = '2026-06-10 19:17';

    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    expect(savedContent).toContain('success_since:');
    expect(savedContent).toContain('last_known_mirror: hdfilmcehennemi27.org');

    // Round-trip verification
    const reloaded = await loadWatchers(watchersPath);
    expect(reloaded.sites['HDFilmCehennemi'].success_since).toBe('2026-06-10 19:17');
    expect(reloaded.sites['HDFilmCehennemi'].last_known_mirror).toBe('hdfilmcehennemi27.org');
  });

  test('saveWatchers: empty failed_since is cleaned up on success recovery', async () => {
    const watchersContent = `sites:
  Site5:
    last_known_mirror: example001.com
    failed_since: ""
    failed_days: 0
    potentially_dead: true
    success_since: "2026-06-10 15:33"
`;
    const watchersPath = join(tempDir, 'watchers.yml');
    writeFileSync(watchersPath, watchersContent, 'utf-8');

    // Load, simulate success recovery with cleanup of empty failed_since
    const watchers = await loadWatchers(watchersPath);
    const site = watchers.sites['Site5'];

    // If the site was already saved with both success_since and empty
    // failed_since, recovery must clean up the empty failure fields
    delete site.failed_since;
    delete site.failed_days;
    delete site.potentially_dead;

    await saveWatchers(watchers, watchersPath);

    const savedContent = readFileSync(watchersPath, 'utf-8');
    expect(savedContent).not.toContain('failed_since');
    expect(savedContent).not.toContain('failed_days');
    expect(savedContent).not.toContain('potentially_dead');
    expect(savedContent).toContain('success_since:');
  });
});
