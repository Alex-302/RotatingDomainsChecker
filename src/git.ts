import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import type { Config, Summary } from "./types.js";
import { Logger, LogLevel } from "./logger.js";

export class GitManager {
  constructor(private config: Config, private logger?: Logger) {}

  async commitOrCreatePR(summary: Summary, dryRun: boolean): Promise<{commitSha?: string, prNumber?: number}> {
    if (summary.replacements.length === 0) {
      if (this.logger) {
        this.logger.logGlobal(LogLevel.INFO, "No changes to commit.");
      }
      return {};
    }

    const message = this.buildCommitMessage(summary);

    if (dryRun) {
      // Dry run - simulate git operations
      if (this.logger) {
        this.logger.logGlobal(LogLevel.INFO, "⬇️ ⬇️ ⬇️  💡 💡 💡  DRY RUN: Simulating Git Operations 💡 💡 💡  ⬇️ ⬇️ ⬇️");
        this.logger.logGlobal(LogLevel.INFO, `Mode: ${this.config.git.mode === "debug" ? "Pull Request" : "Direct Commit"}`);
        this.logger.logGlobal(LogLevel.INFO, `Target branch: ${this.config.git.branch}`);
        this.logger.logGlobal(LogLevel.INFO, `Replacements: ${summary.replacements.length}`);
        this.logger.logGlobal(LogLevel.INFO, "Commit message:");
        this.logger.logGlobal(LogLevel.INFO, message);
        this.logger.logGlobal(LogLevel.INFO, "⬆️ ⬆️ ⬆️  💡 💡 💡  DRY RUN: Simulating Git Operations 💡 💡 💡  ⬆️ ⬆️ ⬆️");
        this.logger.logRaw("");
      }
      return {};
    } else if (this.config.git.mode === "debug") {
      // Debug mode - create pull request
      return await this.createPullRequest(summary, message);
    } else {
      // Production mode - commit directly to master
      return await this.commitDirectly(summary, message);
    }
  }

  private buildCommitMessage(summary: Summary): string {
    const lines: string[] = ["Rotating Domains Checker: Updating domains"];

    // Group errors by type
    const errorsByType = {
      antibot_blocked: summary.errors.filter(e => e.type === 'antibot_blocked'),
      antibot_accepted: summary.errors.filter(e => e.type === 'antibot_accepted'),
      dns: summary.errors.filter(e => e.type === 'dns'),
      http: summary.errors.filter(e => e.type === 'http'),
      probe: summary.errors.filter(e => e.type === 'probe'),
      network: summary.errors.filter(e => e.type === 'network'),
    };

    // Add replacements section - show all actual changes like in the log table
    // Use same logic as replacer to show actual changes
    const actualChanges = summary.replacements.filter(r => {
      const fromHost = r.startedHost || r.oldHost;
      return fromHost !== r.newHost;
    });
    
    // Remove duplicates by siteName (keep the first occurrence)
    const uniqueChanges = actualChanges.filter((change, index, self) => 
      index === self.findIndex(c => c.siteName === change.siteName)
    );
    
    if (uniqueChanges.length > 0) {
      lines.push("\n🔄  Updated domains:\n");
      const maxSiteNameLength = Math.max(...uniqueChanges.map(r => r.siteName.length));
      const maxDomainLength = Math.max(...uniqueChanges.map(r => (r.startedHost || r.oldHost).length));
      const maxFilterLength = Math.max(...uniqueChanges.map(r => r.newHost.length));
      const siteNamePadding = Math.max(maxSiteNameLength, 30);
      const domainPadding = Math.max(maxDomainLength, 20);
      const filterPadding = Math.max(maxFilterLength, 20);
      
      for (const replacement of uniqueChanges) {
        const siteNamePadded = replacement.siteName.padEnd(siteNamePadding);
        const fromHost = replacement.startedHost || replacement.oldHost;
        const domainPadded = fromHost.padEnd(domainPadding);
        const filterPadded = replacement.newHost.padEnd(filterPadding);
        lines.push(`${siteNamePadded}   ${domainPadded} → ${filterPadded}`);
      }
      lines.push("");
    } else {
      lines.push("\n🔄  Updated domains: 0\n");
    }

    // Show errors that are actual failures (not accepted antibot)
    const realErrors = summary.errors.filter(e => e.type !== 'antibot_accepted');
    if (realErrors.length > 0) {
      lines.push("🚨 Errors (no replacements made):");
      for (const { siteName, error, domain, checkDurationMs } of realErrors) {
        const domainInfo = domain ? ` [${domain}]` : '';
        const timeInfo = checkDurationMs ? ` (${(checkDurationMs / 1000).toFixed(2)}s)` : '';
        lines.push(`     - ${siteName}${domainInfo}: ${error}${timeInfo}`);
      }
    }

    if (summary.warnings.length > 0) {
      lines.push("\n");
      lines.push("⚠️  Warnings:");
      for (const warning of summary.warnings) {
        lines.push(`     - ${warning}`);
      }
    }

    // Show accepted antibot separately if any
    if (errorsByType.antibot_accepted.length > 0) {
      lines.push("\n⚠️  Antibot accepted (ignored by config):");
      for (const { siteName, error, domain, checkDurationMs } of errorsByType.antibot_accepted) {
        const domainInfo = domain ? ` [${domain}]` : '';
        const timeInfo = checkDurationMs ? ` (${(checkDurationMs / 1000).toFixed(2)}s)` : '';
        lines.push(`     - ${siteName}${domainInfo}: ${error}${timeInfo}`);
      }
    }

    // Add artifact link if running in GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      const runId = process.env.GITHUB_RUN_ID;
      const repo = process.env.GITHUB_REPOSITORY;
      if (runId && repo) {
        lines.push("\n");
        lines.push(`📋  View detailed log: https://github.com/${repo}/actions/runs/${runId}#artifacts`);
      }
    }
    
    return lines.join("\n");
  }

  private async commitDirectly(summary: Summary, message: string): Promise<{commitSha?: string, prNumber?: number}> {
    try {
      if (this.logger) {
        this.logger.logGlobal(LogLevel.INFO, "=== Direct Commit Mode ===");
        this.logger.logGlobal(LogLevel.INFO, `Target branch: ${this.config.git.branch}`);
        this.logger.logGlobal(LogLevel.INFO, `Replacements: ${summary.replacements.length}`);
        this.logger.logGlobal(LogLevel.INFO, "Commit message:");
        this.logger.logGlobal(LogLevel.INFO, message);
      }

      // Check if there are changes to commit
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (!gitStatus.trim()) {
        if (this.logger) {
          this.logger.logGlobal(LogLevel.INFO, "No changes to commit");
        }
        return {};
      }

      // Add and commit changes directly to master
      execSync('git add -A', { encoding: 'utf8' });
      
      // Use stdin to avoid command injection from commit message
      execSync('git commit -F -', { input: message, encoding: 'utf8' });
      
      // Get commit SHA
      const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      
      // Push to master
      execSync(`git push origin ${this.config.git.branch}`, { encoding: 'utf8' });
      
      if (this.logger) {
        this.logger.logGlobal(LogLevel.INFO, "✅ Changes committed directly to master");
        this.logger.logGlobal(LogLevel.INFO, `🔗 Branch: ${this.config.git.branch}`);
        this.logger.logGlobal(LogLevel.INFO, `🔗 Commit: ${commitSha}`);
        this.logger.logRaw("");
      }
      
      return { commitSha };

    } catch (error) {
      if (this.logger) {
        this.logger.logGlobal(LogLevel.ERROR, `❌ Failed to commit directly: ${error}`);
      }
      throw error;
    }
  }

  private async createPullRequest(summary: Summary, message: string): Promise<{commitSha?: string, prNumber?: number}> {
    try {
      if (this.logger) {
        this.logger.logGlobal(LogLevel.INFO, "=== Creating Pull Request ===");
        this.logger.logGlobal(LogLevel.INFO, `Replacements: ${summary.replacements.length}`);
      }

      // Check if there are changes to commit
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (!gitStatus.trim()) {
        if (this.logger) {
          this.logger.logGlobal(LogLevel.INFO, "No changes to commit");
        }
        return {};
      }

      // Create branch with timestamp to avoid conflicts
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const branchName = `${this.config.git.prBranchPrefix}/${dateStr}-${timeStr}`;
      
      if (this.logger) {
        this.logger.logGlobal(LogLevel.INFO, `Creating branch: ${branchName}`);
      }

      execSync(`git checkout -b "${branchName}"`, { encoding: 'utf8' });
      
      // Add and commit changes
      execSync('git add -A', { encoding: 'utf8' });
      // Use stdin to avoid command injection from commit message
      execSync('git commit -F -', { input: message, encoding: 'utf8' });
      
      // Push branch
      execSync(`git push origin "${branchName}"`, { encoding: 'utf8' });
      
      // Create PR using GitHub CLI with script-generated commit message
      const prTitle = message.split('\n')[0]; // Use first line of commit message as PR title
      const prBody = `${message}

---

## Changes
- Updated domain names in filter rules
- Updated watchers.yml with new last_known_mirror values

## Verification
Please review the changes before merging.

---
*This PR was created automatically by Rotating Domains Checker*`;

      // Create temporary directory and file for PR body to avoid command injection
      const tempDir = mkdtempSync(join(process.cwd(), 'pr-temp-'));
      const prBodyFile = join(tempDir, 'pr-body.txt');
      
      try {
        writeFileSync(prBodyFile, prBody, 'utf8');
        execSync(`gh pr create --title "${prTitle}" --body-file "${prBodyFile}" --head "${branchName}" --base "${this.config.git.branch}"`, { encoding: 'utf8' });
      } finally {
        // Clean up temporary file and directory
        try {
          unlinkSync(prBodyFile);
          rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
      
      // Get commit SHA and PR number
      const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      const prNumber = parseInt(execSync(`gh pr view --json number --jq '.number'`, { encoding: 'utf8' }).trim());
      
      if (this.logger) {
        this.logger.logGlobal(LogLevel.INFO, `✅ Pull request created: ${prTitle}`);
        this.logger.logGlobal(LogLevel.INFO, `🔗 Branch: ${branchName}`);
        this.logger.logGlobal(LogLevel.INFO, `🔗 Pull Request: #${prNumber}`);
        this.logger.logGlobal(LogLevel.INFO, `🔗 Commit SHA: ${commitSha}`);
        this.logger.logRaw("");
      }
      
      return { commitSha, prNumber };

    } catch (error) {
      if (this.logger) {
        this.logger.logGlobal(LogLevel.ERROR, `❌ Failed to create pull request: ${error}`);
      }
      throw error;
    }
  }

  getPRModeInfo(summary: Summary, dryRun: boolean): string[] {
    const lines: string[] = [];

    if (dryRun || this.config.git.mode === "debug") {
      lines.push("⬇️ ⬇️ ⬇️  💡 💡 💡  Pull Request Mode 💡 💡 💡  ⬇️ ⬇️ ⬇️");
      lines.push(`Branch: ${this.config.git.prBranchPrefix}/${new Date().toISOString().split("T")[0]}`);
      lines.push("Commit message:");
      lines.push(this.buildCommitMessage(summary));
      lines.push("⬆️ ⬆️ ⬆️  💡 💡 💡  Pull Request Mode 💡 💡 💡  ⬆️ ⬆️ ⬆️");
      lines.push("");
    } else {

      lines.push("⬇️ ⬇️ ⬇️  💡 💡 💡  Direct Commit Mode 💡 💡 💡  ⬇️ ⬇️ ⬇️");
      lines.push(`Target branch: ${this.config.git.branch}`);
      lines.push("Commit message:");
      lines.push(this.buildCommitMessage(summary));
      lines.push("⬆️ ⬆️ ⬆️  💡 💡 💡  Direct Commit Mode 💡 💡 💡  ⬆️ ⬆️ ⬆️");
      lines.push("");
    }

    return lines;
  }
}
