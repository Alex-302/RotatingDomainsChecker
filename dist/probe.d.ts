import type { Config } from "./types.js";
export declare class ContentProbe {
    private config;
    constructor(config: Config);
    verify(probeTexts: string[], responseBody?: string): Promise<boolean>;
}
//# sourceMappingURL=probe.d.ts.map