import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@navikt/ds-react';
import { BarChart2, ExternalLink, Activity, Search, Users, Map, Repeat, TrendingUp, UserSearch, Copy, Check, SpellCheck, Unlink } from 'lucide-react';
import { useSiteimproveSupport } from '../../hooks/useSiteimproveSupport';

interface AnalysisActionModalProps {
    open: boolean;
    onClose: () => void;
    urlPath: string | null;
    websiteId?: string;
    period?: string;
    domain?: string;
}

const AnalysisActionModal: React.FC<AnalysisActionModalProps> = ({
    open,
    onClose,
    urlPath,
    websiteId,
    period = 'current_month',
    domain: propDomain
}) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const [domain, setDomain] = useState<string>(propDomain || 'nav.no');
    const hasSiteimprove = useSiteimproveSupport(domain);

    useEffect(() => {
        if (propDomain) {
            setDomain(propDomain);
            return;
        }

        const findDomain = async () => {
            if (!websiteId) return;

            // 1. Try to find in localStorage cache (shared with WebsitePicker)
            try {
                const cached = localStorage.getItem('umami_websites_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.data) {
                        const website = parsed.data.find((w: any) => w.id === websiteId);
                        if (website && website.domain) {
                            setDomain(website.domain);
                            return;
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to read from cache', e);
            }

            // 2. Fetch if not found
            try {
                const response = await fetch('/api/bigquery/websites');
                const result = await response.json();
                if (result && result.data) {
                    const website = result.data.find((w: any) => w.id === websiteId);
                    if (website && website.domain) {
                        setDomain(website.domain);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch websites', e);
            }
        };

        findDomain();
    }, [websiteId, propDomain]);

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
                        {/* Column 1: Trafikk & Hendelser */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                Trafikk & Hendelser
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/trafikkanalyse', 'urlPath')} icon={<BarChart2 aria-hidden />} className="justify-start">
                                Trafikkanalyse
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/markedsanalyse', 'urlPath')} icon={<TrendingUp aria-hidden />} className="justify-start">
                                Markedsanalyse
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/utforsk-hendelser', 'pagePath')} icon={<Search aria-hidden />} className="justify-start">
                                Hendelse-utforsker
                            </Button>
                        </div>

                        {/* Column 2: Brukere & lojalitet */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                Brukere & lojalitet
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukersammensetning', 'pagePath')} icon={<Users aria-hidden />} className="justify-start">
                                Brukerdetaljer
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerprofiler', 'pagePath')} icon={<UserSearch aria-hidden />} className="justify-start">
                                Brukerprofiler
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerlojalitet', 'urlPath')} icon={<Repeat aria-hidden />} className="justify-start">
                                Brukerlojalitet
                            </Button>
                        </div>

                        {/* Column 3: Brukerreiser */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                Brukerreiser
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerreiser', 'startUrl')} icon={<Map aria-hidden />} className="justify-start">
                                Navigasjonsflyt
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/hendelsesreiser', 'urlPath')} icon={<Activity aria-hidden />} className="justify-start">
                                Hendelsesflyt
                            </Button>
                        </div>

                        {/* Column 4: Innholdskvalitet - Only show if Siteimprove is supported */}
                        {hasSiteimprove && (
                            <div className="flex flex-col gap-2">
                                <div className="text-xs font-semibold text-[var(--ax-text-subtle)] uppercase tracking-wider mb-1">
                                    Innholdskvalitet
                                </div>
                                <Button variant="secondary" onClick={() => openAnalysis('/kvalitet/stavekontroll', 'urlPath')} icon={<SpellCheck aria-hidden />} className="justify-start">
                                    Stavekontroll
                                </Button>
                                <Button variant="secondary" onClick={() => openAnalysis('/kvalitet/odelagte-lenker', 'urlPath')} icon={<Unlink aria-hidden />} className="justify-start">
                                    Ødelagte lenker
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
