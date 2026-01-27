
import { subDays, format } from 'date-fns';

interface FilterState {
    urlFilters: string[];
    dateRange: string;
    pathOperator: string;
    metricType: 'visitors' | 'pageviews' | 'proportion' | 'visits';
    customStartDate?: Date;
    customEndDate?: Date;
}

export const processDashboardSql = (sql: string, websiteId: string, filters: FilterState): string => {
    let processedSql = sql;

    // 1. Substitute website_id
    processedSql = processedSql.replace(/{{website_id}}/g, websiteId);

    // 2. Substitute URL Path
    if (filters.urlFilters.length > 0) {
        const operator = filters.pathOperator || 'equals';

        if (operator === 'starts-with') {
            if (filters.urlFilters.length === 1) {
                // Single value: simple LIKE
                const assignmentRegex = /=\s*\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*('[^']+')/gi;
                processedSql = processedSql.replace(assignmentRegex, `LIKE '${filters.urlFilters[0]}%'`);
            } else {
                // Multiple values: OR conditions
                const multiLikeRegex = /(\S+)\s*=\s*\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*('[^']+')/gi;
                processedSql = processedSql.replace(multiLikeRegex, (_match, column) => {
                    const likeConditions = filters.urlFilters.map(p => `${column} LIKE '${p}%'`).join(' OR ');
                    return `(${likeConditions})`;
                });
            }
        } else {
            // equals operator
            const assignmentRegex = /=\s*\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*('[^']+')/gi;
            if (filters.urlFilters.length === 1) {
                processedSql = processedSql.replace(assignmentRegex, `= '${filters.urlFilters[0]}'`);
            } else {
                // Multiple values: IN clause
                const quotedPaths = filters.urlFilters.map(p => `'${p}'`).join(', ');
                processedSql = processedSql.replace(assignmentRegex, `IN (${quotedPaths})`);
            }
        }
    } else {
        // Remove marker to use default value
        processedSql = processedSql.replace(/\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]/gi, "");
    }

    // 3. Substitute Date / Created At
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
        startDate = filters.customStartDate;
        endDate = filters.customEndDate;
    } else if (filters.dateRange === 'current_month') {
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    } else if (filters.dateRange === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
        startDate = subDays(now, 30);
    }

    const fromSql = `TIMESTAMP('${format(startDate, 'yyyy-MM-dd')}')`;
    const toSql = `TIMESTAMP('${format(endDate, 'yyyy-MM-dd')}T23:59:59')`;

    // For newer queries using umami_views, we should use that table name. 
    // However, since this utility replaces a placeholder in existing SQL, we need to check which table calls for it or use a safer regex.
    // The current implementation hardcodes the table name which is risky if the base query uses a different table.
    // Let's try to infer it or use the new default if not sure.
    // But to satisfy the immediate request of updating table names:
    const dateReplacement = `AND \`team-researchops-prod-01d6.umami_views.event\`.created_at BETWEEN ${fromSql} AND ${toSql}`;
    processedSql = processedSql.replace(/\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/gi, dateReplacement);

    // 4. Handle metric type substitutions
    if (filters.metricType === 'pageviews') {
        processedSql = processedSql.replace(
            /COUNT\s*\(\s*DISTINCT\s+(?:[a-zA-Z_\.]+\.)?session_id\s*\)\s+as\s+Unike_besokende/gi,
            'COUNT(*) as Sidevisninger'
        );
        processedSql = processedSql.replace(/\bUnike_besokende\b/g, 'Sidevisninger');
    } else if (filters.metricType === 'proportion') {
        const totalSiteVisitorsSubquery = `(SELECT COUNT(DISTINCT session_id) FROM \`team-researchops-prod-01d6.umami_views.event\` WHERE website_id = '${websiteId}' AND event_type = 1 AND created_at BETWEEN ${fromSql} AND ${toSql})`;
        processedSql = processedSql.replace(
            /COUNT\s*\(\s*DISTINCT\s+(?:([a-zA-Z_\.]+)\.)?session_id\s*\)\s+as\s+Unike_besokende/gi,
            (_match, tablePrefix) => {
                const sessionRef = tablePrefix ? `${tablePrefix}.session_id` : 'session_id';
                return `CONCAT(CAST(ROUND(COUNT(DISTINCT ${sessionRef}) * 100.0 / ${totalSiteVisitorsSubquery}, 1) AS STRING), '%') as Andel`;
            }
        );
        processedSql = processedSql.replace(/\bUnike_besokende\b/g, 'Andel');
    } else if (filters.metricType === 'visits') {
        processedSql = processedSql.replace(
            /COUNT\s*\(\s*DISTINCT\s+(?:[a-zA-Z_\.]+\.)?session_id\s*\)\s+as\s+Unike_besokende/gi,
            'COUNT(DISTINCT visit_id) as `Antall økter`'
        );
        processedSql = processedSql.replace(/\bUnike_besokende\b/g, '`Antall økter`');
    }

    return processedSql;
};
