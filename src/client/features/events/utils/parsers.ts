import type {
    ParsedJourneyStep,
    SeriesPoint,
    EventProperty,
    ParameterValue,
    LatestEvent,
    QueryStats,
    EventsResponse,
    SeriesResponse,
    PropertiesResponse,
    ParameterValuesResponse,
    LatestEventsResponse
} from '../model/types';

// Journey step parser
export const parseJourneyStep = (step: string): ParsedJourneyStep => {
    const separatorIndex = step.indexOf(': ');
    if (separatorIndex === -1) {
        return {
            eventName: step.trim(),
            details: [],
        };
    }

    const eventName = step.slice(0, separatorIndex).trim();
    const rawDetails = step.slice(separatorIndex + 2);
    const details = rawDetails
        .split('||')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const detailSeparatorIndex = part.indexOf(':');
            if (detailSeparatorIndex === -1) {
                return { key: part, value: '' };
            }

            return {
                key: part.slice(0, detailSeparatorIndex).trim(),
                value: part.slice(detailSeparatorIndex + 1).trim(),
            };
        });

    return { eventName, details };
};

// Type guards
const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

export const isSeriesPoint = (value: unknown): value is SeriesPoint => {
    return isRecord(value)
        && typeof value.time === 'string'
        && typeof value.count === 'number';
};

export const isEventProperty = (value: unknown): value is EventProperty => {
    return isRecord(value)
        && typeof value.propertyName === 'string'
        && typeof value.total === 'number';
};

export const isParameterValue = (value: unknown): value is ParameterValue => {
    return isRecord(value)
        && typeof value.value === 'string'
        && typeof value.count === 'number';
};

export const isLatestEvent = (value: unknown): value is LatestEvent => {
    return isRecord(value)
        && typeof value.created_at === 'string'
        && (!('properties' in value) || value.properties === undefined || isRecord(value.properties));
};

// Response parsers
export const parseQueryStats = (value: unknown): QueryStats | null => {
    if (!isRecord(value)) return null;
    const totalBytesProcessedGB = typeof value.totalBytesProcessedGB === 'number'
        ? value.totalBytesProcessedGB
        : undefined;
    const estimatedCostUSD = typeof value.estimatedCostUSD === 'number'
        ? value.estimatedCostUSD
        : undefined;
    return totalBytesProcessedGB !== undefined || estimatedCostUSD !== undefined
        ? { totalBytesProcessedGB, estimatedCostUSD }
        : null;
};

export const parseEventsResponse = (value: unknown): EventsResponse => {
    if (!isRecord(value)) return {};
    const events = Array.isArray(value.events)
        ? value.events.filter(item => isRecord(item) && typeof item.name === 'string' && typeof item.count === 'number')
        : undefined;
    const queryStats = parseQueryStats(value.queryStats) ?? undefined;
    return { events, queryStats };
};

export const parseSeriesResponse = (value: unknown): SeriesResponse => {
    if (!isRecord(value)) return {};
    const data = Array.isArray(value.data) ? value.data.filter(isSeriesPoint) : undefined;
    return { data };
};

export const parsePropertiesResponse = (value: unknown): PropertiesResponse => {
    if (!isRecord(value)) return {};
    const properties = Array.isArray(value.properties) ? value.properties.filter(isEventProperty) : undefined;
    const gbProcessed = typeof value.gbProcessed === 'number' || typeof value.gbProcessed === 'string'
        ? value.gbProcessed
        : undefined;
    return { properties, gbProcessed };
};

export const parseParameterValuesResponse = (value: unknown): ParameterValuesResponse => {
    if (!isRecord(value)) return {};
    const values = Array.isArray(value.values) ? value.values.filter(isParameterValue) : undefined;
    const queryStats = parseQueryStats(value.queryStats) ?? undefined;
    return { values, queryStats };
};

export const parseLatestEventsResponse = (value: unknown): LatestEventsResponse => {
    if (!isRecord(value)) return {};
    const events = Array.isArray(value.events) ? value.events.filter(isLatestEvent) : undefined;
    return { events };
};

