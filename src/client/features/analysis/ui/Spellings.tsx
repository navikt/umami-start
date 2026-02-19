import { Table, Alert, Loader, Tabs, TextField, HelpText, Button, Link as DsLink } from '@navikt/ds-react';
import { Download } from 'lucide-react';

import ChartLayout from './ChartLayout.tsx';
import WebsitePicker from './WebsitePicker.tsx';
import InfoCard from '../../../shared/ui/InfoCard.tsx';
import type { SpellingIssue } from '../model/types.ts';
import { downloadCsv } from '../utils/siteimprove.ts';
import { useSpellings } from '../hooks/useSpellings.ts';

const Spellings = () => {
    const {
        selectedWebsite, setSelectedWebsite,
        siteimproveId,
        overviewData, activeTab, setActiveTab,
        pageId, misspellings, potentialMisspellings,
        hasAttemptedFetch, crawlInfo,
        loading, error,
        urlPath, setUrlPath,
        fetchSpellingData,
    } = useSpellings();

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
                                downloadCsv(
                                    `${filename}_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`,
                                    ['Ord'],
                                    items.map((item) => [`"${item.word}"`]),
                                );
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
                        label="URL"
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
