import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hasSiteimproveSupport } from '../../../shared/hooks/useSiteimproveSupport.ts';
import { chartGroups } from '../model/chartGroups.tsx';
import { SHARED_PARAMS } from '../model/types.ts';

export const useChartNavigation = (
    websiteDomain?: string,
    hideAnalysisSelector = false,
) => {
    const isNavOpen = !hideAnalysisSelector;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const domain = websiteDomain || searchParams.get('domain');
    const showSiteimproveSection = useMemo(() => hasSiteimproveSupport(domain), [domain]);

    const filteredChartGroups = useMemo(() => {
        if (!showSiteimproveSection) {
            return chartGroups.filter(group => group.title !== "Innholdskvalitet");
        }
        return chartGroups;
    }, [showSiteimproveSection]);

    const getTargetUrl = useCallback((href: string) => {
        const currentParams = new URLSearchParams(window.location.search);
        const preservedParams = new URLSearchParams();

        SHARED_PARAMS.forEach(param => {
            const value = currentParams.get(param);
            if (value) {
                preservedParams.set(param, value);
            }
        });

        const queryString = preservedParams.toString();
        return queryString ? `${href}?${queryString}` : href;
    }, []);

    const handleNavigation = useCallback((e: React.MouseEvent, href: string) => {
        e.preventDefault();
        const targetUrl = getTargetUrl(href);
        void navigate(targetUrl);
    }, [getTargetUrl, navigate]);

    // Trigger resize for charts when sidebar widths change
    useEffect(() => {
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
        return () => clearTimeout(timer);
    }, [isNavOpen]);

    return {
        filteredChartGroups,
        handleNavigation,
    };
};

