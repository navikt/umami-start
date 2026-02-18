import type { Website } from '../model';

export async function fetchWebsites(): Promise<Website[]> {
    try {
        const response = await fetch('/api/bigquery/websites');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error("Error fetching websites:", error);
        throw error;
    }
}

