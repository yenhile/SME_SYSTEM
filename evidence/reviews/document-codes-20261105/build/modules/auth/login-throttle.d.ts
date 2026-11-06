export declare class LoginThrottle {
    readonly maxFailures: number;
    readonly windowMs: number;
    private readonly maxEntries;
    private readonly entries;
    constructor(maxFailures?: number, windowMs?: number, maxEntries?: number);
    retryAfterMs(key: string, now: number): number;
    recordFailure(key: string, now: number): void;
    reset(key: string): void;
    private prune;
}
