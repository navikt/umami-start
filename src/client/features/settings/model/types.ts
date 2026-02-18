export interface Website {
    id: string;
    name: string;
    domain: string;
    shareId: string;
    teamId: string;
    createdAt: string;
}

export interface GroupedWebsite {
    baseName: string;
    prod?: Website;
    dev?: Website;
    domain: string;
    createdAt: string;
}

export type FilterType = 'all' | 'prod-only' | 'dev-only' | 'both';

export interface SelectedWebsite {
    name: string;
    id: string;
    domain?: string;
    createdAt?: string;
}

