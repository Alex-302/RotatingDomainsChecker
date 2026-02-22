export interface ValidationResult {
    valid: boolean;
    error?: string;
}
/**
 * Validate a commit message against project rules:
 * 1. Must follow Conventional Commits OR be an allowed auto-generated prefix
 * 2. Must not contain Cyrillic characters (English only)
 */
export declare function validateCommitMessage(message: string): ValidationResult;
//# sourceMappingURL=commit-msg-validate.d.ts.map