// Undici connection pool diagnostics
import diagnosticsChannel from "node:diagnostics_channel";
import { LogLevel } from "./logger.js";
class ConnectionDiagnostics {
    pools = new Map();
    monitorInterval = null;
    logger = null;
    subscriptions = [];
    stopped = false;
    setLogger(logger) {
        this.logger = logger;
    }
    start() {
        if (this.stopped)
            return;
        // Subscribe to undici:client:connectError
        const sub1 = diagnosticsChannel.subscribe("undici:client:connectError", (message) => {
            if (!this.stopped && this.logger) {
                this.logger.logGlobal(LogLevel.DEBUG, `CONNECTION Connection error: ${message.error?.message || "unknown"}`);
            }
        });
        this.subscriptions.push(sub1);
        // Subscribe to undici:client:connected
        const sub2 = diagnosticsChannel.subscribe("undici:client:connected", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { connected: 1 });
            }
        });
        this.subscriptions.push(sub2);
        // Subscribe to undici:client:disconnected
        const sub3 = diagnosticsChannel.subscribe("undici:client:disconnected", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { connected: -1 });
            }
        });
        this.subscriptions.push(sub3);
        // Subscribe to undici:request:create
        const sub4 = diagnosticsChannel.subscribe("undici:request:create", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { running: 1 });
            }
        });
        this.subscriptions.push(sub4);
        // Subscribe to undici:request:trailers
        const sub5 = diagnosticsChannel.subscribe("undici:request:trailers", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { running: -1 });
            }
        });
        this.subscriptions.push(sub5);
        // Start periodic monitoring
        this.monitorInterval = setInterval(() => {
            if (!this.stopped) {
                this.printStats();
            }
        }, 10000); // Every 10 seconds
    }
    stop() {
        this.stopped = true;
        // Clear monitor interval
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        // Unsubscribe from all channels
        this.subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.subscriptions = [];
        // Print final stats
        this.printStats();
    }
    updatePoolStats(origin, delta) {
        const current = this.pools.get(origin) || {
            connected: 0,
            free: 0,
            pending: 0,
            queued: 0,
            running: 0,
            size: 0,
        };
        for (const [key, value] of Object.entries(delta)) {
            const k = key;
            current[k] = Math.max(0, current[k] + (value || 0));
        }
        this.pools.set(origin, current);
    }
    printStats() {
        if (!this.logger)
            return;
        const totalConnected = Array.from(this.pools.values()).reduce((sum, p) => sum + p.connected, 0);
        const totalRunning = Array.from(this.pools.values()).reduce((sum, p) => sum + p.running, 0);
        this.logger.logGlobal(LogLevel.DEBUG, `HTTP POOL: ${totalConnected} active connections, ${totalRunning} requests in progress across ${this.pools.size} domains`);
        // Show top 5 domains with most connections
        const sorted = Array.from(this.pools.entries())
            .filter(([, stats]) => stats.connected > 0 || stats.running > 0)
            .sort((a, b) => b[1].connected - a[1].connected)
            .slice(0, 5);
        if (sorted.length > 0) {
            // Filter out "unknown" to show only real domains
            const knownDomains = sorted.filter(([origin]) => origin !== "unknown");
            if (knownDomains.length > 0) {
                const originsInfo = knownDomains.map(([origin, stats]) => `${origin}: ${stats.connected} connections, ${stats.running} requests`).join(', ');
                this.logger.logGlobal(LogLevel.DEBUG, `HTTP POOL: Connection details: ${originsInfo}`);
            }
        }
    }
}
export const connectionDiagnostics = new ConnectionDiagnostics();
//# sourceMappingURL=diagnostics.js.map