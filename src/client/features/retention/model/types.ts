export type RetentionRow = {
    day: number;
    percentage: number;
    returning_users: number;
};

export type QueryStats = {
    totalBytesProcessedGB?: number;
    estimatedCostUSD?: number;
};

export type RetentionStats = {
    baseline: number;
    day1: RetentionRow | undefined;
    day7: RetentionRow | undefined;
    lastDay: RetentionRow | undefined;
};

