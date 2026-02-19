import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseISO } from 'date-fns';
import type { Website } from '../../../shared/types/chart';
import { normalizeUrlToPath, getStoredPeriod, savePeriodPreference } from '../../../shared/lib/utils';
import { fetchEventJourneys } from '../api/eventJourneyApi';
import type { JourneyStats, QueryStats } from '../model/types';

export const useEventJourney = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || searchParams.get('pagePath') || '');
    const [period, setPeriodState] = useState<string>(() => getStoredPeriod(searchParams.get('period')));

    const setPeriod = (newPeriod: string) => {
        setPeriodState(newPeriod);
        savePeriodPreference(newPeriod);
    };

    // Support custom dates from URL
    const fromDateFromUrl = searchParams.get("from");
    const toDateFromUrl = searchParams.get("to");
    const initialCustomStartDate = fromDateFromUrl ? parseISO(fromDateFromUrl) : undefined;
    const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);

    const [data, setData] = useState<{ path: string[], count: number }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [journeyStats, setJourneyStats] = useState<JourneyStats | null>(null);
    const [queryStats, setQueryStats] = useState<QueryStats | null>(null);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
    const [lastAppliedFilterKey, setLastAppliedFilterKey] = useState<string | null>(null);

    const buildFilterKey = useCallback(() =>
        JSON.stringify({
            websiteId: selectedWebsite?.id ?? null,
            urlPath: normalizeUrlToPath(urlPath),
            period,
            customStartDate: customStartDate?.toISOString() ?? null,
            customEndDate: customEndDate?.toISOString() ?? null,
        }), [selectedWebsite?.id, urlPath, period, customStartDate, customEndDate]);

    const hasUnappliedFilterChanges = buildFilterKey() !== lastAppliedFilterKey;

    const fetchData = useCallback(async () => {
        if (!selectedWebsite) return;
        if (!urlPath) return;

        const appliedFilterKey = buildFilterKey();

        setLoading(true);
        setError(null);
        setData([]);
        setJourneyStats(null);
        setQueryStats(null);
        setHasAutoSubmitted(true);

        // Calculate date range
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        } else if (period === 'last_month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (period === 'custom') {
            if (!customStartDate || !customEndDate) {
                setError('Vennligst velg en gyldig periode.');
                setLoading(false);
                return;
            }
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0);

            const isToday = customEndDate.getDate() === now.getDate() &&
                customEndDate.getMonth() === now.getMonth() &&
                customEndDate.getFullYear() === now.getFullYear();

            if (isToday) {
                endDate = now;
            } else {
                endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        try {
            const result = await fetchEventJourneys({
                websiteId: selectedWebsite.id,
                urlPath,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                minEvents: 1
            });

            setData(result.journeys || []);
            setJourneyStats(result.journeyStats || null);
            setQueryStats(result.queryStats || null);

            // Update URL
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('urlPath', urlPath);
            newParams.delete('minEvents');
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            setLastAppliedFilterKey(appliedFilterKey);

        } catch (err) {
            console.error(err);
            setError('Kunne ikke laste hendelsesreiser. Prøv igjen senere.');
        } finally {
            setLoading(false);
        }
    }, [
        selectedWebsite,
        urlPath,
        buildFilterKey,
        period,
        customStartDate,
        customEndDate,
    ]);

    // Auto-submit when URL parameters are present
    useEffect(() => {
        const hasConfigParams = searchParams.has('period') || searchParams.has('urlPath');
        if (selectedWebsite && hasConfigParams && !hasAutoSubmitted && !loading) {
            setHasAutoSubmitted(true);
            void fetchData();
        }
    }, [selectedWebsite, searchParams, hasAutoSubmitted, loading, fetchData]);

    return {
        selectedWebsite,
        setSelectedWebsite,
        urlPath,
        setUrlPath,
        period,
        setPeriod,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        data,
        loading,
        error,
        journeyStats,
        queryStats,
        hasUnappliedFilterChanges,
        fetchData
    };
};

