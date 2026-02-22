import { type Logger } from "./logger.js";
declare class ConnectionDiagnostics {
    private pools;
    private monitorInterval;
    private logger;
    private subscriptions;
    private stopped;
    setLogger(logger: Logger): void;
    start(): void;
    stop(): void;
    private updatePoolStats;
    private printStats;
}
export declare const connectionDiagnostics: ConnectionDiagnostics;
export {};
//# sourceMappingURL=diagnostics.d.ts.map