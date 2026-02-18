import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Alert, Loader, Link as DsLink, Tabs, HelpText, Button, TextField } from '@navikt/ds-react';
import { ExternalLink, Download } from 'lucide-react';
import ChartLayout from '../../analysis/ui/ChartLayout.tsx';
import AnalysisActionModal from '../../analysis/ui/AnalysisActionModal.tsx';
import WebsitePicker from '../../analysis/ui/WebsitePicker.tsx';
import type { Website } from '../../../shared/types/chart.ts';
import teamsData from '../../../../data/teamsData.json';
import InfoCard from '../../../shared/ui/InfoCard.tsx';

interface BrokenLink {
    id: number;
    url: string;
    checking_now: boolean;
    last_checked: string;
    first_detected: string;
    pages: number;
}

interface PageWithBrokenLinks {
    id: number;
    url: string;
    broken_links: number;
}

interface PageBrokenLink {
    url: string;
    link_text?: string;
}

interface BrokenLinkPage {
    url: string;
    title?: string;
}

interface CrawlData {
    last_crawl: string;
    next_crawl: string;
    is_crawl_enabled: boolean;
    is_crawl_running: boolean;
    permission: string;
}

type SiteimproveListResponse<T> = { items?: T[] };

type TeamData = {
    teamDomain?: string;
    teamSiteimproveSite?: string | number | boolean;
    [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object';

const isBrokenLink = (value: unknown): value is BrokenLink =>
    isRecord(value) && typeof value.id === 'number' && typeof value.url === 'string' && typeof value.pages === 'number';

const isPageWithBrokenLinks = (value: unknown): value is PageWithBrokenLinks =>
    isRecord(value) && typeof value.id === 'number' && typeof value.url === 'string' && typeof value.broken_links === 'number';

const isPageBrokenLink = (value: unknown): value is PageBrokenLink =>
    isRecord(value) && typeof value.url === 'string';

const isBrokenLinkPage = (value: unknown): value is BrokenLinkPage =>
    isRecord(value) && typeof value.url === 'string';

const isCrawlData = (value: unknown): value is CrawlData =>
    isRecord(value)
    && typeof value.last_crawl === 'string'
    && typeof value.next_crawl === 'string'
    && typeof value.is_crawl_enabled === 'boolean'
    && typeof value.is_crawl_running === 'boolean'
    && typeof value.permission === 'string';

const parseListResponse = <T,>(value: unknown, itemGuard: (item: unknown) => item is T): SiteimproveListResponse<T> => {
    if (!isRecord(value)) return { items: [] };
    const rawItems = Array.isArray(value.items) ? value.items : [];
    return { items: rawItems.filter(itemGuard) };
};

const getUrlPath = (urlString: string) => {
    try {
        const url = new URL(urlString);
        return url.pathname + url.search + url.hash;
    } catch {
        return urlString;
    }
};

function PageBrokenLinksContent({
    pageId,
    siteimproveId,
    siteimproveBaseUrl,
}: {
    pageId: number;
    siteimproveId: string;
    siteimproveBaseUrl: string;
}) {
    const [pageBrokenLinks, setPageBrokenLinks] = useState<PageBrokenLink[]>([]);
    const [loadingPageLinks, setLoadingPageLinks] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    const fetchPageBrokenLinks = useCallback(async () => {
        setLoadingPageLinks(true);
        setPageError(null);

        try {
            const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';
            const url = `${siteimproveBaseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/links/pages_with_broken_links/${pageId}/broken_links?page_size=50`;
            const response = await fetch(url, { credentials });

            if (!response.ok) {
                throw new Error('Kunne ikke hente ødelagte lenker for denne siden.');
            }

            const pageLinksJson: unknown = await response.json();
            const data: SiteimproveListResponse<PageBrokenLink> = parseListResponse(
                pageLinksJson,
                isPageBrokenLink,
            );
            setPageBrokenLinks(data.items ?? []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Feil ved henting av ødelagte lenker.';
            setPageError(message);
        } finally {
            setLoadingPageLinks(false);
        }
    }, [pageId, siteimproveBaseUrl, siteimproveId]);

    useEffect(() => {
        void fetchPageBrokenLinks();
    }, [fetchPageBrokenLinks]);

    if (loadingPageLinks) {
        return (
            <div className="flex items-center gap-2 py-2">
                <Loader size="small" title="Henter ødelagte lenker..." />
                <span className="text-sm text-[var(--ax-text-subtle)]">Henter ødelagte lenker...</span>
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="flex flex-col gap-2 items-start py-2">
                <Alert variant="warning" size="small">{pageError}</Alert>
                <Button variant="secondary" size="small" onClick={fetchPageBrokenLinks}>Prøv igjen</Button>
            </div>
        );
    }

    if (pageBrokenLinks.length === 0) {
        return <span className="text-sm text-[var(--ax-text-subtle)]">Ingen ødelagte lenker funnet.</span>;
    }

    return (
        <div className="py-4">
            <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Ødelagte lenker på denne siden</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {pageBrokenLinks.map((link, idx) => (
                        <Table.Row key={idx}>
                            <Table.DataCell>
                                <DsLink href={link.url} target="_blank" className="break-all flex items-center gap-1 text-base">
                                    {link.url} <ExternalLink size={16} />
                                </DsLink>
                            </Table.DataCell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </div>
    );
}

function BrokenLinkPagesContent({
    linkId,
    siteimproveId,
    siteimproveBaseUrl,
}: {
    linkId: number;
    siteimproveId: string;
    siteimproveBaseUrl: string;
}) {
    const [pages, setPages] = useState<BrokenLinkPage[]>([]);
    const [loadingPages, setLoadingPages] = useState(true);
    const [pagesError, setPagesError] = useState<string | null>(null);

    const fetchBrokenLinkPages = useCallback(async () => {
        setLoadingPages(true);
        setPagesError(null);

        try {
            const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';
            const url = `${siteimproveBaseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/links/broken_links/${linkId}/pages?page_size=50`;
            const response = await fetch(url, { credentials });

            if (!response.ok) {
                throw new Error('Kunne ikke hente sider for denne lenken.');
            }

            const pagesJson: unknown = await response.json();
            const data: SiteimproveListResponse<BrokenLinkPage> = parseListResponse(
                pagesJson,
                isBrokenLinkPage,
            );
            setPages(data.items ?? []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Feil ved henting av sider.';
            setPagesError(message);
        } finally {
            setLoadingPages(false);
        }
    }, [linkId, siteimproveBaseUrl, siteimproveId]);

    useEffect(() => {
        void fetchBrokenLinkPages();
    }, [fetchBrokenLinkPages]);

    if (loadingPages) {
        return (
            <div className="flex items-center gap-2 py-2">
                <Loader size="small" title="Henter sider..." />
                <span className="text-sm text-[var(--ax-text-subtle)]">Henter sider...</span>
            </div>
        );
    }

    if (pagesError) {
        return (
            <div className="flex flex-col gap-2 items-start py-2">
                <Alert variant="warning" size="small">{pagesError}</Alert>
                <Button variant="secondary" size="small" onClick={fetchBrokenLinkPages}>Prøv igjen</Button>
            </div>
        );
    }

    if (pages.length === 0) {
        return <span className="text-sm text-[var(--ax-text-subtle)]">Ingen sider funnet.</span>;
    }

    return (
        <div className="py-4">
            <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Side URL</Table.HeaderCell>
                        <Table.HeaderCell>Sidetittel</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {pages.map((page, idx) => (
                        <Table.Row key={idx}>
                            <Table.DataCell>
                                <DsLink href={page.url} target="_blank" className="break-all flex items-center gap-1 text-base">
                                    {getUrlPath(page.url)} <ExternalLink size={16} />
                                </DsLink>
                            </Table.DataCell>
                            <Table.DataCell>
                                {page.title || '-'}
                            </Table.DataCell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </div>
    );
}

const BrokenLinks = () => {
    const siteimproveBaseUrl = '/api/siteimprove';
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([]);
    const [pagesWithBrokenLinks, setPagesWithBrokenLinks] = useState<PageWithBrokenLinks[]>([]);
    const [siteimproveId, setSiteimproveId] = useState<string | null>(null);
    const [actionModalUrl, setActionModalUrl] = useState<string | null>(null);
    const [crawlInfo, setCrawlInfo] = useState<CrawlData | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<string>('pages');
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || '');

    const getSiteimproveId = (domain: string) => {
        let team: TeamData | undefined;
        let siteDomain = domain;
        if (!siteDomain.startsWith('http')) {
            siteDomain = `https://${siteDomain}`;
        }

        try {
            const urlObj = new URL(siteDomain);
            const domainOrigin = urlObj.origin;
            team = (teamsData as TeamData[]).find((t) => {
                if (!t.teamDomain) return false;
                try {
                    const teamUrl = new URL(t.teamDomain);
                    return domainOrigin === teamUrl.origin;
                } catch {
                    return domainOrigin.startsWith(String(t.teamDomain));
                }
            });
        } catch {
            team = (teamsData as TeamData[]).find((t) => !!t.teamDomain && (t.teamDomain === domain || domain.includes(String(t.teamDomain))));
        }

        const siteId = team?.teamSiteimproveSite;
        if (typeof siteId === 'string' || typeof siteId === 'number') {
            return siteId;
        }
        return undefined;
    };

    const fetchSiteimproveData = async (siteimproveId: string) => {
        setLoading(true);
        setError(null);
        setBrokenLinks([]);
        setPagesWithBrokenLinks([]);
        setCrawlInfo(null);

        try {
            const baseUrl = siteimproveBaseUrl;
            const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';

            // Fetch Broken Links
            const brokenLinksUrl = `${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/links/broken_links?page_size=50`;
            const brokenLinksResponse = await fetch(brokenLinksUrl, { credentials });

            if (!brokenLinksResponse.ok) {
                if (brokenLinksResponse.status === 403) {
                    throw new Error('Du mangler tilgang til Siteimprove. Sjekk at du er logget inn/har tilgang via reops-proxy.');
                }
                throw new Error('Kunne ikke hente data fra Siteimprove.');
            }

            const brokenLinksJson: unknown = await brokenLinksResponse.json();
            const brokenLinksData: SiteimproveListResponse<BrokenLink> = parseListResponse(
                brokenLinksJson,
                isBrokenLink,
            );
            if (brokenLinksData.items) {
                const sortedLinks = brokenLinksData.items.sort((a, b) => b.pages - a.pages);
                setBrokenLinks(sortedLinks);
            }

            // Fetch Pages with Broken Links
            const pagesUrl = `${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/links/pages_with_broken_links?page_size=50`;
            const pagesResponse = await fetch(pagesUrl, { credentials });

            if (pagesResponse.ok) {
                const pagesJson: unknown = await pagesResponse.json();
                const pagesData: SiteimproveListResponse<PageWithBrokenLinks> = parseListResponse(
                    pagesJson,
                    isPageWithBrokenLinks,
                );
                if (pagesData.items) {
                    const sortedPages = pagesData.items.sort((a, b) => b.broken_links - a.broken_links);
                    setPagesWithBrokenLinks(sortedPages);
                }
            }

            // Fetch Content Crawl Info for Last Scan
            const crawlUrl = `${baseUrl}/siteimprove/sites/${siteimproveId}/content/crawl`;
            const crawlResponse = await fetch(crawlUrl, { credentials });

            if (crawlResponse.ok) {
                const crawlData: unknown = await crawlResponse.json();
                if (isCrawlData(crawlData)) {
                    setCrawlInfo(crawlData);
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Det oppstod en feil ved henting av ødelagte lenker.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedWebsite) return;

        const resolvedSiteimproveId = getSiteimproveId(selectedWebsite.domain);
        if (!resolvedSiteimproveId) {
            setError('Denne nettsiden er ikke koblet til Siteimprove eller mangler konfigurasjon.');
            setLoading(false);
            setBrokenLinks([]);
            setPagesWithBrokenLinks([]);
            setSiteimproveId(null);
            return;
        }

        const idStr = String(resolvedSiteimproveId);
        setSiteimproveId(idStr);
        void fetchSiteimproveData(idStr);
    }, [selectedWebsite]);

    const filteredPages = pagesWithBrokenLinks.filter(page => !urlPath || page.url.toLowerCase().includes(urlPath.toLowerCase()));

    return (
        <ChartLayout
            title="Ødelagte lenker"
            description="Oversikt over ødelagte lenker fra Siteimprove."
            currentPage="odelagte-lenker"
            websiteDomain={selectedWebsite?.domain}
            websiteName={selectedWebsite?.name}
            sidebarContent={
                <WebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={setSelectedWebsite}
                    variant="minimal"
                />
            }
            filters={
                <>
                    <TextField
                        size="small"
                        label="URL"
                        value={urlPath}
                        onChange={(e) => {
                            const val = e.target.value;
                            setUrlPath(val);

                            // Update URL params
                            const newParams = new URLSearchParams(searchParams);
                            if (val) {
                                newParams.set('urlPath', val);
                            } else {
                                newParams.delete('urlPath');
                            }
                            setSearchParams(newParams, { replace: true });
                        }}
                    />
                </>
            }
        >
            {error && (
                <Alert variant="info" className="mb-4">
                    {error}
                </Alert>
            )}

            {
                !selectedWebsite && !loading && (
                    <Alert variant="info">
                        Velg en nettside for å se status på lenker.
                    </Alert>
                )
            }

            {
                loading && (
                    <div className="flex justify-center items-center h-64">
                        <Loader size="xlarge" title="Henter ødelagte lenker..." />
                    </div>
                )
            }

            {
                !loading && !error && selectedWebsite && (
                    <>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Antall sider med ødelagte lenker</div>
                                <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                    {pagesWithBrokenLinks.length.toLocaleString('nb-NO')}
                                </div>
                            </div>
                            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Totalt antall ødelagte lenker</div>
                                <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                    {brokenLinks.length.toLocaleString('nb-NO')}
                                </div>
                            </div>
                            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Siste scan</div>
                                <div className="flex items-center justify-between">
                                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                        {crawlInfo?.last_crawl ? new Date(crawlInfo.last_crawl).toLocaleDateString('nb-NO') : '-'}
                                    </div>
                                    <HelpText title="Status for scan">
                                        <div className="flex flex-col gap-2 min-w-[200px]">
                                            <div>
                                                <div className="font-semibold text-sm">Sist sjekket</div>
                                                <div className="text-sm">
                                                    {crawlInfo?.last_crawl ? new Date(crawlInfo.last_crawl).toLocaleString('nb-NO') : '-'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm">Neste planlagte scan</div>
                                                <div className="text-sm">
                                                    {crawlInfo?.next_crawl ? new Date(crawlInfo.next_crawl).toLocaleString('nb-NO') : '-'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm">Kjører nå</div>
                                                <div className="text-sm">{crawlInfo?.is_crawl_running ? 'Ja' : 'Nei'}</div>
                                            </div>
                                        </div>
                                    </HelpText>
                                </div>
                            </div>
                        </div>

                        {siteimproveId && (
                            <div className="mb-6">
                                <InfoCard data-color="info">
                                    <InfoCard.Header>
                                        <InfoCard.Title>Rett opp feil i Siteimprove</InfoCard.Title>
                                    </InfoCard.Header>
                                    <InfoCard.Content>
                                        For å rette opp i de ødelagte lenkene må du logge inn på Siteimprove.
                                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mt-2">
                                            <DsLink
                                                href={`https://my2.siteimprove.com/QualityAssurance/${siteimproveId}/Links/Pages/1/PageLevel/Asc?pageSize=100`}
                                                target="_blank"
                                                className="font-semibold"
                                            >
                                                Gå til Siteimprove for å korrigere
                                            </DsLink>
                                            <DsLink
                                                href="https://jira.adeo.no/plugins/servlet/desk/portal/581/create/2641"
                                                target="_blank"
                                            >
                                                Få tilgang til Siteimprove
                                            </DsLink>
                                        </div>
                                    </InfoCard.Content>
                                </InfoCard>
                            </div>
                        )}

                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="pages" label="Sider med ødelagte lenker" />
                                <Tabs.Tab value="links" label="Alle ødelagte lenker" />
                            </Tabs.List>

                            <Tabs.Panel value="pages" className="pt-4">
                                {filteredPages.length === 0 ? (
                                    <Alert variant="success">
                                        {urlPath
                                            ? `Fant ingen ødelagte lenker for "${urlPath}"`
                                            : "Fant ingen sider med ødelagte lenker!"
                                        }
                                    </Alert>
                                ) : (
                                    <div className="border rounded-lg overflow-x-auto bg-[var(--ax-bg-default)]">
                                        <Table size="small" zebraStripes>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.HeaderCell />
                                                    <Table.HeaderCell>URL</Table.HeaderCell>
                                                    <Table.HeaderCell>Ødelagte</Table.HeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {filteredPages.map((page, index) => (
                                                    <Table.ExpandableRow
                                                        key={page.id || index}
                                                        content={
                                                            siteimproveId ? (
                                                                <PageBrokenLinksContent
                                                                    pageId={page.id}
                                                                    siteimproveId={siteimproveId}
                                                                    siteimproveBaseUrl={siteimproveBaseUrl}
                                                                />
                                                            ) : null
                                                        }
                                                        togglePlacement="left"
                                                    >
                                                        <Table.HeaderCell scope="row">
                                                            <DsLink
                                                                href="#"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setActionModalUrl(getUrlPath(page.url));
                                                                }}
                                                                className="break-all flex items-center gap-1"
                                                            >
                                                                {getUrlPath(page.url)} <ExternalLink size={14} />
                                                            </DsLink>
                                                        </Table.HeaderCell>
                                                        <Table.DataCell>
                                                            {page.broken_links}
                                                        </Table.DataCell>
                                                    </Table.ExpandableRow>
                                                ))}
                                            </Table.Body>
                                        </Table>
                                        <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                                            <div className="flex gap-2">
                                                <Button
                                                    size="small"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        const headers = ['URL', 'Ødelagte lenker'];
                                                        const csvRows = [
                                                            headers.join(','),
                                                            ...filteredPages.map((page) => [
                                                                `"${getUrlPath(page.url)}"`,
                                                                page.broken_links
                                                            ].join(','))
                                                        ];
                                                        const csvContent = csvRows.join('\n');
                                                        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                                        const link = document.createElement('a');
                                                        const url = URL.createObjectURL(blob);
                                                        link.setAttribute('href', url);
                                                        link.setAttribute('download', `sider_med_odelagte_lenker_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
                                                        link.style.visibility = 'hidden';
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                    icon={<Download size={16} />}
                                                >
                                                    Last ned CSV
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Tabs.Panel>

                            <Tabs.Panel value="links" className="pt-4">
                                {brokenLinks.length === 0 ? (
                                    <Alert variant="success">Fant ingen ødelagte lenker! 🎉</Alert>
                                ) : (
                                    <div className="border rounded-lg overflow-x-auto bg-[var(--ax-bg-neutral)]">
                                        <Table size="small" zebraStripes>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.HeaderCell />
                                                    <Table.HeaderCell>URL</Table.HeaderCell>
                                                    <Table.HeaderCell>Tilfeller</Table.HeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {brokenLinks.map((link, index) => (
                                                    <Table.ExpandableRow
                                                        key={link.id || index}
                                                        content={
                                                            siteimproveId ? (
                                                                <BrokenLinkPagesContent
                                                                    linkId={link.id}
                                                                    siteimproveId={siteimproveId}
                                                                    siteimproveBaseUrl={siteimproveBaseUrl}
                                                                />
                                                            ) : null
                                                        }
                                                        togglePlacement="left"
                                                    >
                                                        <Table.HeaderCell scope="row">
                                                            <DsLink href={link.url} target="_blank" className="break-all flex items-center gap-1">
                                                                {link.url} <ExternalLink size={14} />
                                                            </DsLink>
                                                        </Table.HeaderCell>
                                                        <Table.DataCell>
                                                            {link.pages}
                                                        </Table.DataCell>
                                                    </Table.ExpandableRow>
                                                ))}
                                            </Table.Body>
                                        </Table>
                                        <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                                            <div className="flex gap-2">
                                                <Button
                                                    size="small"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        const headers = ['URL', 'Tilfeller'];
                                                        const csvRows = [
                                                            headers.join(','),
                                                            ...brokenLinks.map((bl) => [
                                                                `"${bl.url}"`,
                                                                bl.pages
                                                            ].join(','))
                                                        ];
                                                        const csvContent = csvRows.join('\n');
                                                        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                                        const link = document.createElement('a');
                                                        const url = URL.createObjectURL(blob);
                                                        link.setAttribute('href', url);
                                                        link.setAttribute('download', `odelagte_lenker_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
                                                        link.style.visibility = 'hidden';
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                    icon={<Download size={16} />}
                                                >
                                                    Last ned CSV
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Tabs.Panel>
                        </Tabs>
                    </>
                )
            }

            <AnalysisActionModal
                open={!!actionModalUrl}
                onClose={() => setActionModalUrl(null)}
                urlPath={actionModalUrl}
                websiteId={selectedWebsite?.id}
                domain={selectedWebsite?.domain}
            />

        </ChartLayout >
    );
};

export default BrokenLinks;
