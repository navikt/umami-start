// Event Journey Types
export type ParsedStepDetail = {
    key: string;
    value: string;
};

export type ParsedJourneyStep = {
    eventName: string;
    details: ParsedStepDetail[];
};

export type JourneyStats = {
    total_sessions?: number;
    sessions_with_events?: number;
    sessions_no_events_navigated?: number;
    sessions_no_events_bounced?: number;
};

export type QueryStats = {
    totalBytesProcessedGB?: number;
    estimatedCostUSD?: number;
};

export type EventJourneyResponse = {
    journeys?: { path: string[]; count: number }[];
    journeyStats?: JourneyStats;
    queryStats?: QueryStats;
};

// Event Explorer Types
export type SeriesPoint = {
    time: string;
    count: number;
};

export type EventProperty = {
    propertyName: string;
    total: number;
};

export type ParameterValue = {
    value: string;
    count: number;
};

export type LatestEvent = {
    created_at: string;
    properties?: Record<string, string | undefined>;
};

export type EventsResponse = {
    events?: { name: string; count: number }[];
    queryStats?: QueryStats;
};

export type SeriesResponse = {
    data?: SeriesPoint[];
};

export type PropertiesResponse = {
    properties?: EventProperty[];
    gbProcessed?: number | string;
};

export type ParameterValuesResponse = {
    values?: ParameterValue[];
    queryStats?: QueryStats;
};

export type LatestEventsResponse = {
    events?: LatestEvent[];
};

