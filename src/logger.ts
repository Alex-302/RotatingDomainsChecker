// Unified logger with log levels and configurable outputs

import { mkdirSync, appendFileSync, writeFileSync, existsSync, readFileSync, statSync, unlinkSync } from "fs";
import { dirname } from "path";
import type { Config } from "./types.js";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUMMARY = 4,
  RAW = 5  // Always visible, no level prefix
}

export interface LogConfig {
  fileLevel: LogLevel;
  consoleLevel: LogLevel;
  outputs: {
    file: boolean;
    console: boolean;
  };
  filters: {
    excludeChangesByFile: boolean;
    excludeMainSeparator: boolean;
  };
}

export type RunMode = 'test_dry' | 'test_live' | 'prod_dry' | 'prod_live';

export class Logger {
  private logBuffer: string[] = [];
  private config: Config | null = null;
  private logConfig: LogConfig;
  private runMode: RunMode;
  private separator = "=".repeat(80);

  constructor(config?: Config, runMode?: RunMode) {
    this.config = config || null;
    this.runMode = runMode || this.detectRunMode();
    this.logConfig = this.createLogConfig(this.runMode);
  }

  private detectRunMode(): RunMode {
    const args = process.argv.slice(2);
    const cliMode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];
    const mode = process.env.INPUT_MODE || cliMode || 'prod_live';
    
    // Validate and return mode
    const validModes: RunMode[] = ['prod_live', 'prod_dry', 'test_live', 'test_dry'];
    return validModes.includes(mode as RunMode) ? (mode as RunMode) : 'prod_live';
  }

  private createLogConfig(mode: RunMode): LogConfig {
    const isTestMode = mode === 'test_dry' || mode === 'test_live';
    
    return {
      fileLevel: isTestMode ? LogLevel.DEBUG : LogLevel.SUMMARY,
      consoleLevel: isTestMode ? LogLevel.DEBUG : LogLevel.INFO,
      outputs: {
        file: true,
        console: true
      },
      filters: {
        excludeChangesByFile: !isTestMode,
        excludeMainSeparator: true,
      }
    };
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
  }

  private log(level: LogLevel, site: string, message: string): void {
    const timestamp = this.formatTimestamp(new Date());
    const levelName = LogLevel[level];
    const siteQuoted = site ? `"${site}"` : '';
    
    // For RAW level, don't include level prefix
    const formattedMessage = level === LogLevel.RAW
      ? `${timestamp} ${message}`
      : site 
        ? `${timestamp} ${levelName} ${siteQuoted} ${message}`
        : `${timestamp} ${levelName} ${message}`;

    // Write to file (RAW always writes, others respect level)
    if (this.logConfig.outputs.file && (level === LogLevel.RAW || level >= this.logConfig.fileLevel)) {
      this.logBuffer.push(formattedMessage);
    }

    // Write to console (RAW always writes, others respect level)
    if (this.logConfig.outputs.console && (level === LogLevel.RAW || level >= this.logConfig.consoleLevel)) {
      console.log(formattedMessage);
    }
  }

  debug(site: string, message: string): void {
    this.log(LogLevel.DEBUG, site, message);
  }

  info(site: string, message: string): void {
    this.log(LogLevel.INFO, site, message);
  }

  warn(site: string, message: string): void {
    this.log(LogLevel.WARN, site, message);
  }

  error(site: string, message: string): void {
    this.log(LogLevel.ERROR, site, message);
  }

  summary(site: string, message: string): void {
    this.log(LogLevel.SUMMARY, site, message);
  }

  // For messages without site context
  logGlobal(level: LogLevel, message: string): void {
    this.log(level, '', message);
  }

  // For raw messages without timestamp
  logRaw(message: string): void {
    // Write to console
    if (this.logConfig.outputs.console) {
      console.log(message);
    }

    // Write to file
    if (this.logConfig.outputs.file) {
      this.logBuffer.push(message);
    }
  }

  shouldLogChangesByFile(): boolean {
    return !this.logConfig.filters.excludeChangesByFile;
  }

  getRunMode(): RunMode {
    return this.runMode;
  }

  saveToFile(): void {
    if (!this.config?.logging.saveToFile) {
      return;
    }

    const filePath = this.config.logging.filePath;
    const incremental = this.config.logging.incremental;

    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Rotate logs if needed
    if (incremental && existsSync(filePath)) {
      this.rotateLogs(filePath);
    }

    // Build log content
    const now = new Date();
    const timestamp = this.formatTimestamp(now);
    const lines: string[] = [];

    if (incremental && existsSync(filePath)) {
      lines.push("");
      lines.push(this.separator);
    }

    lines.push(`Run: ${timestamp}`);
    lines.push(this.separator);
    lines.push("");

    // Add buffered logs
    lines.push(...this.logBuffer);
    lines.push("");

    const content = lines.join("\n");

    if (incremental) {
      appendFileSync(filePath, content, "utf-8");
    } else {
      writeFileSync(filePath, content, "utf-8");
    }

    this.logGlobal(LogLevel.INFO, `Logs saved to: ${filePath}`);
  }

  private rotateLogs(filePath: string): void {
    try {
      const stats = statSync(filePath);
      const maxSize = 5 * 1024 * 1024; // 5MB

      // Check file size
      if (stats.size >= maxSize) {
        unlinkSync(filePath);
        return;
      }

      // Check number of runs
      const content = readFileSync(filePath, 'utf-8');
      const runMatches = content.match(/^Run: /gm);
      const runCount = runMatches ? runMatches.length : 0;

      if (runCount >= 28) {
        // Keep only last 4 runs
        const lines = content.split('\n');
        const runIndices: number[] = [];
        
        lines.forEach((line, index) => {
          if (line.startsWith('Run: ')) {
            runIndices.push(index);
          }
        });

        if (runIndices.length >= 5) {
          // Find the separator before the 2nd run (to keep last 4)
          const keepFromIndex = runIndices[runIndices.length - 4];
          let separatorIndex = keepFromIndex - 1;
          
          // Find the separator line before this run
          while (separatorIndex > 0 && !lines[separatorIndex].startsWith('===')) {
            separatorIndex--;
          }
          
          const keptContent = lines.slice(separatorIndex).join('\n');
          writeFileSync(filePath, keptContent, 'utf-8');
        }
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }
}
