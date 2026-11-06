"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginThrottle = void 0;
class LoginThrottle {
    maxFailures;
    windowMs;
    maxEntries;
    entries = new Map();
    constructor(maxFailures = 5, windowMs = 15 * 60 * 1000, maxEntries = 5000) {
        this.maxFailures = maxFailures;
        this.windowMs = windowMs;
        this.maxEntries = maxEntries;
    }
    retryAfterMs(key, now) {
        const entry = this.entries.get(key);
        if (!entry)
            return 0;
        if (now - entry.windowStart >= this.windowMs) {
            this.entries.delete(key);
            return 0;
        }
        return entry.failures >= this.maxFailures ? entry.windowStart + this.windowMs - now : 0;
    }
    recordFailure(key, now) {
        const entry = this.entries.get(key);
        if (entry && now - entry.windowStart < this.windowMs) {
            entry.failures += 1;
            return;
        }
        this.prune(now);
        this.entries.set(key, { failures: 1, windowStart: now });
    }
    reset(key) {
        this.entries.delete(key);
    }
    prune(now) {
        if (this.entries.size < this.maxEntries)
            return;
        for (const [key, entry] of this.entries)
            if (now - entry.windowStart >= this.windowMs)
                this.entries.delete(key);
        while (this.entries.size >= this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined)
                break;
            this.entries.delete(oldest);
        }
    }
}
exports.LoginThrottle = LoginThrottle;
//# sourceMappingURL=login-throttle.js.map