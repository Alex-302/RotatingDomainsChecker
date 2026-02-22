import type { Config, Summary } from './types.js';
import { Logger } from './logger.js';
export declare class GitManager {
    private config;
    private logger?;
    constructor(config: Config, logger?: Logger | undefined);
    commitOrCreatePR(summary: Summary, dryRun: boolean): Promise<{
        commitSha?: string;
        prNumber?: number;
    }>;
    private buildCommitMessage;
    private commitDirectly;
    private createPullRequest;
    getPRModeInfo(summary: Summary, dryRun: boolean): string[];
}
