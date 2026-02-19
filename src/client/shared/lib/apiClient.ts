/**
 * Shared JSON fetch wrapper with robust error handling.
 *
 * Parses the response body as JSON, surfaces `details` or `error` fields
 * from error payloads, and gracefully handles non-JSON responses.
 */

const toErrorMessage = (status: number, payload: unknown): string => {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error;
        const details = (payload as { details?: unknown }).details;
        if (typeof details === 'string' && details.trim()) return details;
        if (typeof error === 'string' && error.trim()) return error;
    }
    return `Forespørsel feilet (${status})`;
};

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    let payload: unknown = null;

    if (text) {
        try {
            payload = JSON.parse(text) as unknown;
        } catch {
            payload = { error: text };
        }
    }

    if (!response.ok) {
        throw new Error(toErrorMessage(response.status, payload));
    }

    return payload as T;
}

