import type { Config } from "./types.js";
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SUMMARY = 4,
    RAW = 5
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
export declare class Logger {
    private logBuffer;
    private config;
    private logConfig;
    private runMode;
    private separator;
    constructor(config?: Config, runMode?: RunMode);
    private detectRunMode;
    private createLogConfig;
    private formatTimestamp;
    private log;
    debug(site: string, message: string): void;
    info(site: string, message: string): void;
    warn(site: string, message: string): void;
    error(site: string, message: string): void;
    summary(site: string, message: string): void;
    logGlobal(level: LogLevel, message: string): void;
    logRaw(message: string): void;
    shouldLogChangesByFile(): boolean;
    getRunMode(): RunMode;
    saveToFile(): void;
    private rotateLogs;
}
//# sourceMappingURL=logger.d.ts.map