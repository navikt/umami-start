import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@navikt/ds-react';
import { BarChart2, ExternalLink, Activity, Search, Users, Map, Repeat, TrendingUp, UserSearch, Copy, Check, SpellCheck, Unlink } from 'lucide-react';
import { useSiteimproveSupport, useMarketingSupport } from '../../hooks/useSiteimproveSupport.ts';

interface AnalysisActionModalProps {
    open: boolean;
    onClose: () => void;
    urlPath: string | null;
    websiteId?: string;
    period?: string;
    domain?: string;
    websiteName?: string;  // Website name for dev environment detection
}

type Website = {
    id: string;
    domain?: string;
    name?: string;
};

type WebsitesResponse = {
    data: Website[];
};

const isWebsitesResponse = (value: unknown): value is WebsitesResponse => {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    if (!Array.isArray(record.data)) return false;
    return record.data.every((item) => {
        if (!item || typeof item !== 'object') return false;
        const website = item as Record<string, unknown>;
        return typeof website.id === 'string';
    });
};

const AnalysisActionModal: React.FC<AnalysisActionModalProps> = ({
    open,
    onClose,
    urlPath,
    websiteId,
    period = 'current_month',
    domain: propDomain,
    websiteName: propWebsiteName
}) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const [resolvedDomain, setResolvedDomain] = useState<string | null>(null);
    const [resolvedWebsiteName, setResolvedWebsiteName] = useState<string | undefined>(undefined);
    const domain = propDomain ?? resolvedDomain ?? 'nav.no';
    const websiteName = propWebsiteName ?? resolvedWebsiteName;
    const hasSiteimprove = useSiteimproveSupport(domain);
    const hasMarketing = useMarketingSupport(domain, websiteName);

    useEffect(() => {
        const shouldResolveDomain = !propDomain;
        const shouldResolveWebsiteName = !propWebsiteName;
        if (!websiteId || (!shouldResolveDomain && !shouldResolveWebsiteName)) return;

        let isActive = true;

        const applyWebsite = (website: Website | undefined) => {
            if (!isActive || !website) return;
            if (shouldResolveDomain && website.domain) {
                setResolvedDomain(website.domain);
            }
            if (shouldResolveWebsiteName && website.name) {
                setResolvedWebsiteName(website.name);
            }
        };

        const findDomain = async () => {
            // 1. Try to find in localStorage cache (shared with WebsitePicker)
            try {
                const cached = localStorage.getItem('umami_websites_cache');
                if (cached) {
                    const parsed: unknown = JSON.parse(cached);
                    if (isWebsitesResponse(parsed)) {
                        const website = parsed.data.find((w) => w.id === websiteId);
                        applyWebsite(website);
                        if (website) return;
                    }
                }
            } catch (e) {
                console.error('Failed to read from cache', e);
            }

            // 2. Fetch if not found
            try {
                const response = await fetch('/api/bigquery/websites');
                if (!response.ok) return;
                const result: unknown = await response.json();
                if (isWebsitesResponse(result)) {
                    const website = result.data.find((w) => w.id === websiteId);
                    applyWebsite(website);
                }
            } catch (e) {
                console.error('Failed to fetch websites', e);
            }
        };

        void findDomain();

        return () => {
            isActive = false;
        };
    }, [websiteId, propDomain, propWebsiteName]);

    if (!urlPath || !websiteId) return null;

    const openAnalysis = (path: string, paramName: string = 'urlPath') => {
        const encodedPath = encodeURIComponent(urlPath);
        const url = `${path}?websiteId=${websiteId}&period=${period}&${paramName}=${encodedPath}`;
        window.open(url, '_blank');
        onClose();
    };

    const openOnWebsite = () => {
        const protocol = domain.includes('http') ? '' : 'https://';
        const url = `${protocol}${domain}${urlPath}`;
        window.open(url, '_blank');
        onClose();
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(urlPath);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <Modal open={open} onClose={onClose} header={{ heading: 'Hva vil du gjøre med lenken?' }} width="medium">
            <Modal.Body>
                <div className="p-2 pb-4 flex flex-col gap-6 text-left">
                    <div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                            <div className="text-sm font-medium text-[var(--ax-text-subtle)]">
                                URL-sti
                            </div>
                            <div className="flex gap-1 self-end sm:self-auto">
                                <Button
                                    size="small"
                                    variant="tertiary"
                                    onClick={copyLink}
                                    icon={copySuccess ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} />}
                                >
                                    {copySuccess ? 'Kopiert!' : 'Kopier'}
                                </Button>
                                <Button
                                    size="small"
                                    variant="tertiary"
                                    onClick={openOnWebsite}
                                    icon={<ExternalLink aria-hidden size={18} />}
                                >
                                    Åpne siden
                                </Button>
                            </div>
                        </div>
                        <div className="text-sm font-mono bg-[var(--ax-bg-neutral-soft)] p-3 rounded-md border border-[var(--ax-border-neutral-subtle)] break-all text-[var(--ax-text-default)]">
                            {urlPath}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                Trafikk
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/trafikkanalyse', 'urlPath')} icon={<BarChart2 aria-hidden />} className="justify-start">
                                Trafikkoversikt
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerreiser', 'startUrl')} icon={<Map aria-hidden />} className="justify-start">
                                Navigasjonsflyt
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/trakt', 'urlPath')} icon={<BarChart2 aria-hidden />} className="justify-start">
                                Trakt
                            </Button>
                            {hasMarketing && (
                                <Button variant="secondary" onClick={() => openAnalysis('/markedsanalyse', 'urlPath')} icon={<TrendingUp aria-hidden />} className="justify-start">
                                    Kampanjer
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                Hendelser
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/utforsk-hendelser', 'pagePath')} icon={<Search aria-hidden />} className="justify-start">
                                Egendefinerte hendelser
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/hendelsesreiser', 'urlPath')} icon={<Activity aria-hidden />} className="justify-start">
                                Hendelsesforløp
                            </Button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                Brukere
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukersammensetning', 'pagePath')} icon={<Users aria-hidden />} className="justify-start">
                                Brukerdetaljer
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerprofiler', 'pagePath')} icon={<UserSearch aria-hidden />} className="justify-start">
                                Enkeltbrukere
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerlojalitet', 'urlPath')} icon={<Repeat aria-hidden />} className="justify-start">
                                Gjenbesøk
                            </Button>
                        </div>

                        {hasSiteimprove && (
                            <div className="flex flex-col gap-2">
                                <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                    Innholdskvalitet
                                </div>
                                <Button variant="secondary" onClick={() => openAnalysis('/kvalitet/odelagte-lenker', 'urlPath')} icon={<Unlink aria-hidden />} className="justify-start">
                                    Ødelagte lenker
                                </Button>
                                <Button variant="secondary" onClick={() => openAnalysis('/kvalitet/stavekontroll', 'urlPath')} icon={<SpellCheck aria-hidden />} className="justify-start">
                                    Stavekontroll
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default AnalysisActionModal;
