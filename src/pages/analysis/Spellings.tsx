import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Alert, Loader, Tabs, TextField, HelpText, Button, Link as DsLink } from '@navikt/ds-react';
import { Download } from 'lucide-react';

import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import { Website } from '../../types/chart';
import teamsData from '../../data/teamsData.json';
import { getBaseUrl } from '../../lib/environment';
import InfoCard from '../../components/InfoCard';

interface SpellingIssue {
    id: number;
    word: string;
    suggestions?: string[];
    context?: string;
}

interface QualityAssuranceCheck {
    id: number;
    check_date: string;
    misspellings: number;
    potential_misspellings: number;
    // other fields omitted as we don't need them yet
}

interface QualityAssuranceHistoryResponse {
    items: QualityAssuranceCheck[];
    total_items: number;
}

interface CrawlData {
    last_crawl?: string;
    next_crawl?: string;
    is_crawl_running?: boolean;
}

const Spellings = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [siteimproveId, setSiteimproveId] = useState<string | null>(null);
    const [overviewData, setOverviewData] = useState<QualityAssuranceCheck | null>(null);
    const [activeTab, setActiveTab] = useState<string>('potential');

    // Page specific state
    const [pageId, setPageId] = useState<number | null>(null);
    const [misspellings, setMisspellings] = useState<SpellingIssue[]>([]);
    const [potentialMisspellings, setPotentialMisspellings] = useState<SpellingIssue[]>([]);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [crawlInfo, setCrawlInfo] = useState<CrawlData | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchParams] = useSearchParams();
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

    const fetchPageId = async (siteId: string, path: string) => {
        const baseUrl = getBaseUrl({
            localUrl: "https://reops-proxy.intern.nav.no",
            devUrl: "https://reops-proxy.ansatt.dev.nav.no",
            prodUrl: "https://reops-proxy.ansatt.nav.no",
        });
        const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';

        const encodedUrl = encodeURIComponent(path);
        const url = `${baseUrl}/siteimprove/sites/${siteId}/content/pages?url=${encodedUrl}&page_size=1`;

        const response = await fetch(url, { credentials });
        if (!response.ok) return null;

        const data = await response.json();
        if (data && data.items && data.items.length > 0) {
            const match = data.items.find((p: any) => p.url.includes(path));
            return match ? match.id : data.items[0].id;
        }
        return null;
    };

    const fetchSpellingData = async () => {
        if (!siteimproveId) return;

        setLoading(true);
        setError(null);
        setOverviewData(null);
        setPageId(null);
        setMisspellings([]);
        setPotentialMisspellings([]);
        setHasAttemptedFetch(true);
        setCrawlInfo(null);

        try {
            const baseUrl = getBaseUrl({
                localUrl: "https://reops-proxy.intern.nav.no",
                devUrl: "https://reops-proxy.ansatt.dev.nav.no",
                prodUrl: "https://reops-proxy.ansatt.nav.no",
            });
            const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';

            if (!urlPath) {
                // Fetch Overview (Check History) and Crawl Info
                const [historyResponse, crawlResponse] = await Promise.all([
                    fetch(`${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/overview/check_history?page_size=1`, { credentials }),
                    fetch(`${baseUrl}/siteimprove/sites/${siteimproveId}/content/crawl`, { credentials })
                ]);
                if (historyResponse.ok) {
                    const data: QualityAssuranceHistoryResponse = await historyResponse.json();
                    if (data.items && data.items.length > 0) {
                        setOverviewData(data.items[0]);
                    }
                }
                if (crawlResponse.ok) {
                    const crawlData = await crawlResponse.json();
                    setCrawlInfo(crawlData);
                }
            } else {
                // Fetch Page specific data
                const foundPageId = await fetchPageId(siteimproveId, urlPath);

                if (!foundPageId) {
                    setError(`Fant ingen side hos Siteimprove med URL som inneholder "${urlPath}". Sjekk at URL-en er korrekt.`);
                    setLoading(false);
                    return;
                }

                setPageId(foundPageId);

                // Fetch overview + crawl + both tabs data in parallel
                const [overviewResponse, crawlResponse, misResponse, potResponse] = await Promise.all([
                    fetch(`${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/overview/check_history?page_size=1`, { credentials }),
                    fetch(`${baseUrl}/siteimprove/sites/${siteimproveId}/content/crawl`, { credentials }),
                    fetch(`${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/spelling/pages/${foundPageId}/misspellings`, { credentials }),
                    fetch(`${baseUrl}/siteimprove/sites/${siteimproveId}/quality_assurance/spelling/pages/${foundPageId}/potential_misspellings`, { credentials })
                ]);

                if (overviewResponse.ok) {
                    const data: QualityAssuranceHistoryResponse = await overviewResponse.json();
                    if (data.items && data.items.length > 0) {
                        setOverviewData(data.items[0]);
                    }
                }
                if (crawlResponse.ok) {
                    const crawlData = await crawlResponse.json();
                    setCrawlInfo(crawlData);
                }
                if (misResponse.ok) {
                    const data = await misResponse.json();
                    setMisspellings(data.items || []);
                }
                if (potResponse.ok) {
                    const data = await potResponse.json();
                    setPotentialMisspellings(data.items || []);
                }

                // Update URL with configuration for sharing
                const newParams = new URLSearchParams(window.location.search);
                if (urlPath) {
                    newParams.set('urlPath', urlPath);
                } else {
                    newParams.delete('urlPath');
                }
                window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            }

        } catch (err: any) {
            console.error('Error fetching spelling data:', err);
            setError(err.message || 'Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedWebsite) return;

        const sid = getSiteimproveId(selectedWebsite.domain);
        if (!sid) {
            setError('Denne nettsiden er ikke koblet til Siteimprove eller mangler konfigurasjon.');
            setSiteimproveId(null);
            return;
        }
        setSiteimproveId(String(sid));
    }, [selectedWebsite]);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        const hasConfigParams = searchParams.has('urlPath');
        if (siteimproveId && hasConfigParams && !hasAttemptedFetch) {
            fetchSpellingData();
        } else if (siteimproveId && !urlPath && !hasAttemptedFetch) {
            // Auto-fetch overview when website is selected
            fetchSpellingData();
        }
    }, [siteimproveId]);

    const renderTable = (items: SpellingIssue[], emptyMsg: string, filename: string) => {
        if (items.length === 0) {
            return <Alert variant="success">{emptyMsg}</Alert>;
        }
        return (
            <div className="border rounded-lg overflow-x-auto bg-[var(--ax-bg-default)]">
                <Table size="small" zebraStripes>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Ord</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {items.map((item, idx) => (
                            <Table.Row key={item.id || idx}>
                                <Table.DataCell className="font-medium text-red-600">
                                    {item.word}
                                </Table.DataCell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
                <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                    <div className="flex gap-2">
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                                const headers = ['Ord'];
                                const csvRows = [
                                    headers.join(','),
                                    ...items.map((item) => `"${item.word}"`)
                                ];
                                const csvContent = csvRows.join('\n');
                                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `${filename}_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
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
        );
    };

    return (
        <ChartLayout
            title="Stavekontroll"
            description="Oversikt over stavefeil fra Siteimprove."
            currentPage="stavekontroll"
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
                        label="Side eller URL"
                        value={urlPath}
                        onChange={(e) => setUrlPath(e.target.value)}
                    />

                    <div className="mt-8">
                        <Button
                            onClick={fetchSpellingData}
                            disabled={!selectedWebsite || loading}
                            loading={loading}
                            className="w-full"
                            size="small"
                        >
                            Vis stavefeil
                        </Button>
                    </div>
                </>
            }
        >
            {error && (
                <Alert variant="info" className="mb-4">
                    {error}
                </Alert>
            )}

            {!selectedWebsite && !loading && (
                <Alert variant="info">
                    Velg en nettside for å se stavekontroll.
                </Alert>
            )}

            {loading && (
                <div className="flex justify-center items-center h-64">
                    <Loader size="xlarge" title="Henter data..." />
                </div>
            )}

            {!loading && !error && selectedWebsite && hasAttemptedFetch && (
                <>
                    {!urlPath && overviewData && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Mulige stavefeil</div>
                                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                        {overviewData.potential_misspellings.toLocaleString('nb-NO')}
                                    </div>
                                    <div className="text-sm text-[var(--ax-text-subtle)] mt-1">hele nettstedet</div>
                                </div>
                                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Bekreftede stavefeil</div>
                                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                        {overviewData.misspellings.toLocaleString('nb-NO')}
                                    </div>
                                    <div className="text-sm text-[var(--ax-text-subtle)] mt-1">hele nettstedet</div>
                                </div>
                                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Siste sjekk</div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                            {new Date(overviewData.check_date).toLocaleDateString('nb-NO')}
                                        </div>
                                        <HelpText title="Status for scan">
                                            <div className="flex flex-col gap-2 min-w-[200px]">
                                                <div>
                                                    <div className="font-semibold text-sm">Sist sjekket</div>
                                                    <div className="text-sm">
                                                        {crawlInfo?.last_crawl ? new Date(crawlInfo.last_crawl).toLocaleString('nb-NO') : new Date(overviewData.check_date).toLocaleString('nb-NO')}
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
                            <Alert variant="info" className="mb-4">
                                Legg til en URL-sti i filteret over for å se spesifikke stavefeil for en side.
                            </Alert>
                        </>
                    )}

                    {urlPath && pageId && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Mulige stavefeil</div>
                                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                        {potentialMisspellings.length}
                                    </div>
                                </div>
                                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Bekreftede stavefeil</div>
                                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                        {misspellings.length}
                                    </div>
                                </div>
                                {overviewData && (
                                    <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                                        <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Siste sjekk</div>
                                        <div className="flex items-center justify-between">
                                            <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                                                {new Date(overviewData.check_date).toLocaleDateString('nb-NO')}
                                            </div>
                                            <HelpText title="Status for scan">
                                                <div className="flex flex-col gap-2 min-w-[200px]">
                                                    <div>
                                                        <div className="font-semibold text-sm">Sist sjekket</div>
                                                        <div className="text-sm">
                                                            {crawlInfo?.last_crawl ? new Date(crawlInfo.last_crawl).toLocaleString('nb-NO') : new Date(overviewData.check_date).toLocaleString('nb-NO')}
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
                                )}
                            </div>

                            {siteimproveId && (
                                <div className="mb-6">
                                    <InfoCard data-color="info">
                                        <InfoCard.Header>
                                            <InfoCard.Title>Rett opp feil i Siteimprove</InfoCard.Title>
                                        </InfoCard.Header>
                                        <InfoCard.Content>
                                            For å rette opp stavefeil må du logge inn på Siteimprove.
                                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mt-2">
                                                <DsLink
                                                    href={`https://my2.siteimprove.com/QualityAssurance/${siteimproveId}/Spelling/PagesWithSpellingIssues`}
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
                                    <Tabs.Tab value="potential" label="Mulige stavefeil" />
                                    <Tabs.Tab value="misspellings" label="Bekreftede stavefeil" />
                                </Tabs.List>

                                <Tabs.Panel value="potential" className="pt-4">
                                    {renderTable(potentialMisspellings, "Ingen mulige stavefeil funnet.", "mulige_stavefeil")}
                                </Tabs.Panel>
                                <Tabs.Panel value="misspellings" className="pt-4">
                                    {renderTable(misspellings, "Ingen bekreftede stavefeil funnet!", "bekreftede_stavefeil")}
                                </Tabs.Panel>
                            </Tabs>
                        </>
                    )}
                </>
            )}
        </ChartLayout>
    );
};

export default Spellings;
