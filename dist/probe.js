export class ContentProbe {
    config;
    constructor(config) {
        this.config = config;
    }
    async verify(probeTexts, responseBody) {
        if (!this.config.contentProbe.enabled || probeTexts.length === 0) {
            return true; // Skip if disabled or no probe texts
        }
        // If no response body provided, cannot verify
        if (!responseBody) {
            return false;
        }
        // Check if all probe texts are present
        for (const text of probeTexts) {
            if (!responseBody.includes(text)) {
                return false;
            }
        }
        return true;
    }
}
//# sourceMappingURL=probe.js.map