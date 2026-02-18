export interface Website {
    id: string;
    name: string;
    domain: string;
    teamId: string;
    createdAt: string;
}

export interface EventProperty {
    eventName: string;
    propertyName: string;
    total: number;
    type?: 'string' | 'number';
}

export interface EventParam {
    key: string;
    type: 'string';
}

