import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Alert, Loader, Link as DsLink, Tabs, HelpText, Button, TextField } from '@navikt/ds-react';
import { ExternalLink, Download } from 'lucide-react';
import ChartLayout from '../../components/analysis/ChartLayout';
import AnalysisActionModal from '../../components/analysis/AnalysisActionModal';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import { Website } from '../../types/chart';
import teamsData from '../../data/teamsData.json';
import { getBaseUrl } from '../../lib/environment';
import InfoCard from '../../components/InfoCard';

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

interface CrawlData {
    last_crawl: string;
    next_crawl: string;
    is_crawl_enabled: boolean;
    is_crawl_running: boolean;
    permission: string;
}

const BrokenLinks = () => {
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
        let team = null;
        let siteDomain = domain;
        if (!siteDomain.startsWith('http')) {
            siteDomain = `https://${siteDomain}`;
        }

        try {
            const urlObj = new URL(siteDomain);
            const domainOrigin = urlObj.origin;
            team = teamsData.find((t: any) => {
                if (!t.teamDomain) return false;
                try {
                    const teamUrl = new URL(t.teamDomain);
                    return domainOrigin === teamUrl.origin;
                } catch {
                    return domainOrigin.startsWith(t.teamDomain);
                }
            });
        } catch {
            return teamsData.find((t: any) => t.teamDomain === domain || domain.includes(t.teamDomain));
        }

        return team?.teamSiteimproveSite;
    };

    const getUrlPath = (urlString: string) => {
        try {
            const url = new URL(urlString);
            return url.pathname + url.search + url.hash;
        } catch {
            return urlString;
        }
    };

    // Helper component to fetch and display broken links for a specific page
    const PageBrokenLinksContent = useCallback(({ pageId }: { pageId: number }) => {
        const [pageBrokenLinks, setPageBrokenLinks] = useState<PageBrokenLink[]>([]);
        const [loadingPageLinks, setLoadingPageLinks] = useState(true);
        const [pageError, setPageError] = useState<string | null>(null);

        const fetchPageBrokenLinks = useCallback(async () => {
            if (!siteimproveId) return;
            setLoadingPageLinks(true);
            setPageError(null);

            try {
                const baseUrl = getBaseUrl({
                    localUrl: "https://reops-proxy.intern.nav.no",
                    prodUrl: "https://reops-proxy.ansatt.nav.no",
                });
                const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';

                const url = `${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/links/pages_with_broken_links/${pageId}/broken_links?page_size=50`;
                const response = await fetch(url, { credentials });

                if (!response.ok) {
                    throw new Error('Kunne ikke hente ødelagte lenker for denne siden.');
                }

                const data = await response.json();
                if (data && data.items) {
                    setPageBrokenLinks(data.items);
                }
            } catch (err: any) {
                console.error('Error fetching page broken links:', err);
                setPageError(err.message || 'Feil ved henting av ødelagte lenker.');
            } finally {
                setLoadingPageLinks(false);
            }
        }, [pageId, siteimproveId]);

        useEffect(() => {
            fetchPageBrokenLinks();
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
    }, [siteimproveId]);

    // Helper component to fetch and display pages where a specific link is broken
    const BrokenLinkPagesContent = useCallback(({ linkId }: { linkId: number }) => {
        const [pages, setPages] = useState<any[]>([]);
        const [loadingPages, setLoadingPages] = useState(true);
        const [pagesError, setPagesError] = useState<string | null>(null);

        const fetchBrokenLinkPages = useCallback(async () => {
            if (!siteimproveId) return;
            setLoadingPages(true);
            setPagesError(null);

            try {
                const baseUrl = getBaseUrl({
                    localUrl: "https://reops-proxy.intern.nav.no",
                    prodUrl: "https://reops-proxy.ansatt.nav.no",
                });
                const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';

                const url = `${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/links/broken_links/${linkId}/pages?page_size=50`;
                const response = await fetch(url, { credentials });

                if (!response.ok) {
                    throw new Error('Kunne ikke hente sider for denne lenken.');
                }

                const data = await response.json();
                if (data && data.items) {
                    setPages(data.items);
                }
            } catch (err: any) {
                console.error('Error fetching broken link pages:', err);
                setPagesError(err.message || 'Feil ved henting av sider.');
            } finally {
                setLoadingPages(false);
            }
        }, [linkId, siteimproveId]);

        useEffect(() => {
            fetchBrokenLinkPages();
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
    }, [siteimproveId]);


    const fetchSiteimproveData = async (siteimproveId: string) => {
        setLoading(true);
        setError(null);
        setBrokenLinks([]);
        setPagesWithBrokenLinks([]);
        setCrawlInfo(null);

        try {
            const baseUrl = getBaseUrl({
                localUrl: "https://reops-proxy.intern.nav.no",
                prodUrl: "https://reops-proxy.ansatt.nav.no",
            });
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

            const brokenLinksData = await brokenLinksResponse.json();
            if (brokenLinksData && brokenLinksData.items) {
                const sortedLinks = (brokenLinksData.items as BrokenLink[]).sort((a, b) => b.pages - a.pages);
                setBrokenLinks(sortedLinks);
            }

            // Fetch Pages with Broken Links
            const pagesUrl = `${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/links/pages_with_broken_links?page_size=50`;
            const pagesResponse = await fetch(pagesUrl, { credentials });

            if (pagesResponse.ok) {
                const pagesData = await pagesResponse.json();
                if (pagesData && pagesData.items) {
                    const sortedPages = (pagesData.items as PageWithBrokenLinks[]).sort((a, b) => b.broken_links - a.broken_links);
                    setPagesWithBrokenLinks(sortedPages);
                }
            }

            // Fetch Content Crawl Info for Last Scan
            const crawlUrl = `${baseUrl}/siteimprove/sites/${siteimproveId}/content/crawl`;
            const crawlResponse = await fetch(crawlUrl, { credentials });

            if (crawlResponse.ok) {
                const crawlData = await crawlResponse.json();
                console.log('Siteimprove Crawl Data:', crawlData);
                setCrawlInfo(crawlData);
            }

        } catch (err: any) {
            console.error('Error fetching broken links data:', err);
            setError(err.message || 'Det oppstod en feil ved henting av ødelagte lenker.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedWebsite) return;

        const siteimproveId = getSiteimproveId(selectedWebsite.domain);
        if (!siteimproveId) {
            setError('Denne nettsiden er ikke koblet til Siteimprove eller mangler konfigurasjon.');
            setLoading(false);
            setBrokenLinks([]);
            setPagesWithBrokenLinks([]);
            setSiteimproveId(null);
            return;
        }

        setSiteimproveId(String(siteimproveId));
        fetchSiteimproveData(String(siteimproveId));
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
                        label="URL-sti (valgfritt)"
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
                                                        content={<PageBrokenLinksContent pageId={page.id} />}
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
                                    <div className="border rounded-lg overflow-x-auto bg-[var(--ax-bg-default)]">
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
                                                        content={<BrokenLinkPagesContent linkId={link.id} />}
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
