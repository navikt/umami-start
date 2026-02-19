export type Website = {
    id: string;
    name: string;
    domain: string;
    teamId: string;
    createdAt: string;
};

export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
    [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type Row = Record<string, JsonValue | undefined>;

export type QueryStats = {
    totalBytesProcessed?: number;
    totalBytesProcessedGB?: string;
    estimatedCostUSD?: string;
    cacheHit?: boolean;
};

export type QueryResult = {
    data?: Row[];
    queryStats?: QueryStats;
};

declare global {
    interface Window {
        __GCP_PROJECT_ID__?: string;
    }
}

