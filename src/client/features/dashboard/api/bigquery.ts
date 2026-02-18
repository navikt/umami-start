import type { Website, EventProperty } from '../model/types.ts';

interface WebsiteApiResponse {
    data: Website[];
}

interface EventPropertiesApiResponse {
    properties: EventProperty[];
    gbProcessed?: number;
    estimatedGbProcessed?: number;
}

export const fetchWebsites = async (): Promise<Website[]> => {
    const response = await fetch('/api/bigquery/websites');
    const json = (await response.json()) as WebsiteApiResponse;
    return json.data || [];
};

export const fetchEventProperties = async (
    websiteId: string,
    startAt: number,
    endAt: number,
    includeParams: boolean
): Promise<EventPropertiesApiResponse> => {
    const apiBase = '/api/bigquery';
    const response = await fetch(
        `${apiBase}/websites/${websiteId}/event-properties?startAt=${startAt}&endAt=${endAt}&includeParams=${includeParams}`
    );
    const responseData = await response.json();
    return responseData as EventPropertiesApiResponse;
};

export const executeBigQuery = async (
    query: string,
    analysisType: string = 'Dashboard'
): Promise<unknown> => {
    const response = await fetch('/api/bigquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, analysisType }),
    });

    if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(
            typeof errPayload === 'object' && errPayload !== null && 'error' in errPayload
                ? String(errPayload.error)
                : 'Feil ved henting av data'
        );
    }

    return await response.json();
};

