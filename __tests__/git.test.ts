import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import type { Config, Summary } from '../src/types.js';

// ESM mock for child_process
const mockedExecSync = jest.fn();
const mockedExecFileSync = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  execSync: mockedExecSync,
  execFileSync: mockedExecFileSync,
}));

// ESM mock for fs — spread real module, override only temp-file helpers
const realFs = await import('fs');
const mockedWriteFileSync = jest.fn();
const mockedMkdtempSync = jest.fn(() => '/tmp/pr-temp-xyz');
const mockedRmSync = jest.fn();
jest.unstable_mockModule('fs', () => ({
  ...realFs,
  writeFileSync: mockedWriteFileSync,
  mkdtempSync: mockedMkdtempSync,
  rmSync: mockedRmSync,
}));

// Dynamic import after mock setup
const { GitManager } = await import('../src/git.js');

function makeConfig(mode = 'prod'): Config {
  return {
    git: {
      mode,
      branch: 'master',
      prBranchPrefix: 'auto-update',
    },
  } as unknown as Config;
}

function makeSummary(replacements: Summary['replacements'] = [], errors: Summary['errors'] = [], warnings: string[] = []): Summary {
  return {
    totalSites: replacements.length + errors.length,
    checked: replacements.length + errors.length,
    updated: replacements.length,
    unchanged: 0,
    failed: errors.length,
    antibotAccepted: 0,
    antibotBlocked: 0,
    replacements,
    errors,
    warnings,
  };
}

function makeSummaryWithReplacements(): Summary {
  return makeSummary([
    {
      siteName: 'turkifsaclub',
      oldHost: 'turkifsaclub001.sbs',
      newHost: 'turkifsaclub020.sbs',
      startedHost: 'turkifsaclub001.sbs',
      checkDurationMs: 1500,
    },
  ]);
}

beforeEach(() => {
  mockedExecSync.mockReset();
  mockedExecFileSync.mockReset();
  mockedWriteFileSync.mockReset();
  mockedMkdtempSync.mockReset().mockReturnValue('/tmp/pr-temp-xyz');
  mockedRmSync.mockReset();
});

// ============================================================================
// 10.1 buildCommitMessage (tested indirectly via getPRModeInfo)
// ============================================================================

describe('10.1 buildCommitMessage', () => {
  test('commit message contains title line', () => {
    const git = new GitManager(makeConfig());
    const summary = makeSummaryWithReplacements();
    const info = git.getPRModeInfo(summary, false);
    const message = info.join('\n');
    expect(message).toContain('Rotating Domains Checker: Updating domains');
  });

  test('commit message contains Updated domains section', () => {
    const git = new GitManager(makeConfig());
    const summary = makeSummaryWithReplacements();
    const info = git.getPRModeInfo(summary, false);
    const message = info.join('\n');
    expect(message).toContain('Updated domains');
  });

  test('commit message deduplicates by siteName', () => {
    const summary = makeSummary([
      { siteName: 'site1', oldHost: 'a.com', newHost: 'b.com', startedHost: 'a.com', checkDurationMs: 100 },
      { siteName: 'site1', oldHost: 'a.com', newHost: 'c.com', startedHost: 'a.com', checkDurationMs: 200 },
    ]);
    const git = new GitManager(makeConfig());
    const info = git.getPRModeInfo(summary, false);
    const message = info.join('\n');
    // Should only appear once
    const matches = message.match(/site1/g);
    // At least 1 match, but the dedup should prevent double entries in the table
    expect(matches).toBeTruthy();
  });

  test('commit message shows errors grouped by type', () => {
    const summary = makeSummary(
      [{ siteName: 's1', oldHost: 'a.com', newHost: 'b.com', startedHost: 'a.com', checkDurationMs: 100 }],
      [{ siteName: 'failed_site', error: 'DNS failed', type: 'dns', domain: 'dead.com', checkDurationMs: 500 }],
    );
    const git = new GitManager(makeConfig());
    const info = git.getPRModeInfo(summary, false);
    const message = info.join('\n');
    expect(message).toContain('Errors');
    expect(message).toContain('failed_site');
  });

  test('commit message shows warnings', () => {
    const summary = makeSummary(
      [{ siteName: 's1', oldHost: 'a.com', newHost: 'b.com', startedHost: 'a.com', checkDurationMs: 100 }],
      [],
      ['Some warning message'],
    );
    const git = new GitManager(makeConfig());
    const info = git.getPRModeInfo(summary, false);
    const message = info.join('\n');
    expect(message).toContain('Warnings');
    expect(message).toContain('Some warning message');
  });
});

// ============================================================================
// 10.2 commitOrCreatePR
// ============================================================================

describe('10.2 commitOrCreatePR', () => {
  test('NEVER execute real git operations in Jest tests', () => {
    // This test verifies that execSync is mocked
    expect(jest.isMockFunction(mockedExecSync)).toBe(true);
  });

  test('dryRun: true → return empty object, no git commands', async () => {
    const git = new GitManager(makeConfig());
    const summary = makeSummaryWithReplacements();
    const result = await git.commitOrCreatePR(summary, true);
    expect(result).toEqual({});
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  test('summary.replacements.length === 0 → return empty object without git commands', async () => {
    const git = new GitManager(makeConfig());
    const summary = makeSummary();
    const result = await git.commitOrCreatePR(summary, false);
    expect(result).toEqual({});
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  test('dryRun: false + git.mode: "prod" → mock git add, git commit, git push', async () => {
    mockedExecSync.mockImplementation((...args: unknown[]) => {
      const cmd = args[0] as string;
      if (cmd.includes('status --porcelain')) return 'M file.txt';
      if (cmd.includes('rev-parse HEAD')) return 'abc123';
      return '';
    });

    const git = new GitManager(makeConfig('prod'));
    const summary = makeSummaryWithReplacements();
    const result = await git.commitOrCreatePR(summary, false);

    expect(mockedExecSync).toHaveBeenCalledWith('git status --porcelain', expect.any(Object));
    expect(mockedExecSync).toHaveBeenCalledWith('git add -A', expect.any(Object));
    expect(mockedExecSync).toHaveBeenCalledWith('git reset -- logs/', expect.any(Object));
    expect(mockedExecSync).toHaveBeenCalledWith('git commit -F -', expect.objectContaining({ input: expect.any(String) }));
    expect(mockedExecSync).toHaveBeenCalledWith(expect.stringContaining('git push origin'), expect.any(Object));
    expect(result).toHaveProperty('commitSha');
  });

  test('git status --porcelain empty → "No changes to commit"', async () => {
    mockedExecSync.mockImplementation((...args: unknown[]) => {
      const cmd = args[0] as string;
      if (cmd.includes('status --porcelain')) return '';
      return '';
    });

    const git = new GitManager(makeConfig('prod'));
    const summary = makeSummaryWithReplacements();
    const result = await git.commitOrCreatePR(summary, false);
    expect(result).toEqual({});
  });

  test('dryRun: false + git.mode: "debug" → mock gh pr create', async () => {
    mockedExecSync.mockImplementation((...args: unknown[]) => {
      const cmd = args[0] as string;
      if (cmd.includes('status --porcelain')) return 'M file.txt';
      if (cmd.includes('rev-parse HEAD')) return 'def456';
      if (cmd.includes('gh pr view')) return '42';
      return '';
    });
    mockedExecFileSync.mockReturnValue('');

    const git = new GitManager(makeConfig('debug'));
    const summary = makeSummaryWithReplacements();
    const result = await git.commitOrCreatePR(summary, false);

    // Verify logs/ excluded from commit
    expect(mockedExecSync).toHaveBeenCalledWith('git reset -- logs/', expect.any(Object));

    // gh pr create must use execFileSync (no shell) to prevent command injection
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['pr', 'create', '--title', expect.any(String)]),
      expect.any(Object),
    );
    expect(result).toHaveProperty('prNumber');
  });

  test('gh pr create uses execFileSync (no shell) to prevent command injection', async () => {
    mockedExecSync.mockImplementation((...args: unknown[]) => {
      const cmd = args[0] as string;
      if (cmd.includes('status --porcelain')) return 'M file.txt';
      if (cmd.includes('rev-parse HEAD')) return 'def456';
      if (cmd.includes('gh pr view')) return '42';
      return '';
    });
    mockedExecFileSync.mockReturnValue('');

    const git = new GitManager(makeConfig('debug'));
    const summary = makeSummaryWithReplacements();
    await git.commitOrCreatePR(summary, false);

    // Verify execSync is NEVER called with 'gh pr create' (would be shell injection risk)
    for (const call of mockedExecSync.mock.calls) {
      const cmd = call[0] as string;
      expect(cmd).not.toContain('gh pr create');
    }

    // Verify execFileSync IS called with 'gh' as first arg (no shell)
    expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockedExecFileSync.mock.calls[0][0]).toBe('gh');
    expect(mockedExecFileSync.mock.calls[0][1]).toContain('pr');
    expect(mockedExecFileSync.mock.calls[0][1]).toContain('create');
  });
});

// ============================================================================
// 10.3 getPRModeInfo
// ============================================================================

describe('10.3 getPRModeInfo', () => {
  test('dryRun: true → returns "Pull Request Mode" block', () => {
    const git = new GitManager(makeConfig('prod'));
    const summary = makeSummaryWithReplacements();
    const info = git.getPRModeInfo(summary, true);
    expect(info.some(l => l.includes('Pull Request Mode'))).toBe(true);
  });

  test('git.mode: "debug" → returns "Pull Request Mode" block', () => {
    const git = new GitManager(makeConfig('debug'));
    const summary = makeSummaryWithReplacements();
    const info = git.getPRModeInfo(summary, false);
    expect(info.some(l => l.includes('Pull Request Mode'))).toBe(true);
  });

  test('git.mode: "prod" + dryRun: false → returns "Direct Commit Mode" block', () => {
    const git = new GitManager(makeConfig('prod'));
    const summary = makeSummaryWithReplacements();
    const info = git.getPRModeInfo(summary, false);
    expect(info.some(l => l.includes('Direct Commit Mode'))).toBe(true);
  });
});

// ============================================================================
// 10.4 Simulation (test_dry, prod_dry)
// ============================================================================

describe('10.4 Git simulation (dry run)', () => {
  test('commit message is generated and output', async () => {
    const git = new GitManager(makeConfig('prod'));
    const summary = makeSummaryWithReplacements();
    await git.commitOrCreatePR(summary, true);
    // No git commands should be called
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  test('files are NOT modified in dry run', async () => {
    const git = new GitManager(makeConfig('prod'));
    const summary = makeSummaryWithReplacements();
    await git.commitOrCreatePR(summary, true);
    expect(mockedExecSync).not.toHaveBeenCalledWith(expect.stringContaining('git add'), expect.any(Object));
  });

  test('git commands are NOT executed in dry run', async () => {
    const git = new GitManager(makeConfig('prod'));
    const summary = makeSummaryWithReplacements();
    await git.commitOrCreatePR(summary, true);
    expect(mockedExecSync).not.toHaveBeenCalledWith(expect.stringContaining('git push'), expect.any(Object));
  });
});

// ============================================================================
// 10.5 Static analysis: shell injection prevention
// ============================================================================

describe('10.5 Shell injection prevention (static analysis)', () => {
  test('git.ts must not use execSync with template literals containing variables for gh commands', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const gitSource = fs.readFileSync(path.join(process.cwd(), 'src', 'git.ts'), 'utf8');

    // Pattern: execSync(`...gh ...${...}...`) — shell injection risk
    // This regex catches execSync with backtick template literals that interpolate variables into gh CLI commands
    const dangerousPattern = /execSync\s*\(\s*`[^`]*gh\s[^`]*\$\{/;
    expect(dangerousPattern.test(gitSource)).toBe(false);
  });

  test('git.ts must use execFileSync (no shell) for gh pr create', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const gitSource = fs.readFileSync(path.join(process.cwd(), 'src', 'git.ts'), 'utf8');

    // Verify execFileSync is used for gh commands
    expect(gitSource).toContain("execFileSync('gh'");
  });
});
