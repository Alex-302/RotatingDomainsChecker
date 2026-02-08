import { validateCommitMessage } from '../src/commit-msg-validate.js';

// ============================================================================
// Commit message validation
// ============================================================================

describe('validateCommitMessage — Conventional Commits format', () => {
  test('accepts valid "feat:" commit message', () => {
    const result = validateCommitMessage('feat: add new feature');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('accepts valid "fix:" commit message', () => {
    expect(validateCommitMessage('fix: resolve regex bug').valid).toBe(true);
  });

  test('accepts valid "docs:" commit message', () => {
    expect(validateCommitMessage('docs: update README').valid).toBe(true);
  });

  test('accepts valid "style:" commit message', () => {
    expect(validateCommitMessage('style: fix formatting').valid).toBe(true);
  });

  test('accepts valid "refactor:" commit message', () => {
    expect(validateCommitMessage('refactor: simplify logic').valid).toBe(true);
  });

  test('accepts valid "test:" commit message', () => {
    expect(validateCommitMessage('test: add unit tests').valid).toBe(true);
  });

  test('accepts valid "chore:" commit message', () => {
    expect(validateCommitMessage('chore: update dependencies').valid).toBe(true);
  });

  test('accepts valid commit message with scope', () => {
    expect(validateCommitMessage('feat(batch): add heuristic support').valid).toBe(true);
  });

  test('rejects message without conventional commit prefix', () => {
    const result = validateCommitMessage('random message without prefix');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Conventional Commits');
  });

  test('rejects message with invalid prefix', () => {
    const result = validateCommitMessage('update: something');
    expect(result.valid).toBe(false);
  });

  test('rejects message missing colon and space', () => {
    const result = validateCommitMessage('feat add feature');
    expect(result.valid).toBe(false);
  });

  test('rejects message with empty description after prefix', () => {
    const result = validateCommitMessage('feat: ');
    expect(result.valid).toBe(false);
  });
});

describe('validateCommitMessage — Auto-generated messages', () => {
  test('accepts auto-generated "Rotating Domains Checker: Updating domains"', () => {
    expect(validateCommitMessage('Rotating Domains Checker: Updating domains').valid).toBe(true);
  });

  test('accepts auto-generated message with different suffix', () => {
    expect(validateCommitMessage('Rotating Domains Checker: Weekly update').valid).toBe(true);
  });
});

describe('validateCommitMessage — Cyrillic detection (English only)', () => {
  test('rejects commit message with Cyrillic in title', () => {
    const result = validateCommitMessage('feat: добавить фичу');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cyrillic');
  });

  test('rejects commit message with Cyrillic in body', () => {
    const result = validateCommitMessage('feat: add feature\n\nОписание на русском');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cyrillic');
  });

  test('accepts commit message with English only', () => {
    expect(validateCommitMessage('feat: add feature\n\nDetailed description in English').valid).toBe(true);
  });

  test('rejects auto-generated message with Cyrillic', () => {
    const result = validateCommitMessage('Rotating Domains Checker: Обновление');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cyrillic');
  });
});

describe('validateCommitMessage — Edge cases', () => {
  test('rejects completely empty commit message', () => {
    const result = validateCommitMessage('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  test('rejects commit message with only whitespace', () => {
    const result = validateCommitMessage('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  test('accepts multiline commit message with valid first line', () => {
    const msg = 'feat: add feature\n\nThis is the body of the commit message.\nWith multiple lines.';
    expect(validateCommitMessage(msg).valid).toBe(true);
  });

  test('accepts long commit message within 80 character limit', () => {
    const msg = 'feat: ' + 'a'.repeat(80);
    expect(validateCommitMessage(msg).valid).toBe(true);
  });
});
