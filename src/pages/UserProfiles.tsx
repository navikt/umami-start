import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, Radio, RadioGroup, Heading, Table, Pagination, Search, Modal, Link, Label, BodyShort } from '@navikt/ds-react';
import { Monitor, Smartphone, Globe, Clock, User, Laptop, Tablet } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import { Website } from '../types/chart';
import { translateCountry } from '../lib/translations';

const UserProfiles = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // State
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [users, setUsers] = useState<any[]>([]);
    const [totalUsers, setTotalUsers] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState<number>(1);
    const [queryStats, setQueryStats] = useState<any>(null);

    // Details Modal State
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [activityLoading, setActivityLoading] = useState<boolean>(false);
    const [activityData, setActivityData] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const ROWS_PER_PAGE = 50;

    useEffect(() => {
        if (selectedWebsite) {
            fetchUsers();
        }
    }, [selectedWebsite, period, page]);

    const getDateRange = () => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        return { startDate, endDate };
    };

    const fetchUsers = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);

        const { startDate, endDate } = getDateRange();

        try {
            const response = await fetch('/api/bigquery/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    query: searchQuery,
                    limit: ROWS_PER_PAGE,
                    offset: (page - 1) * ROWS_PER_PAGE
                }),
            });

            if (!response.ok) throw new Error('Kunne ikke hente brukere');

            const result = await response.json();
            setUsers(result.users);
            setTotalUsers(result.total);
            setQueryStats(result.queryStats);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'En feil oppstod');
        } finally {
            setLoading(false);
        }
    };

    const fetchUserActivity = async (sessionId: string) => {
        if (!selectedWebsite) return;

        setActivityLoading(true);
        const { startDate, endDate } = getDateRange();

        try {
            const response = await fetch(`/api/bigquery/users/${sessionId}/activity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }),
            });

            if (!response.ok) throw new Error('Kunne ikke hente aktivitet');

            const result = await response.json();
            setActivityData(result.activity);
        } catch (err) {
            console.error(err);
        } finally {
            setActivityLoading(false);
        }
    };

    const handleSearch = (val: string) => {
        setSearchQuery(val);
        setPage(1); // Reset to first page on search
    };

    const handleRowClick = (user: any) => {
        setSelectedSession(user);
        setIsModalOpen(true);
        fetchUserActivity(user.sessionId);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('no-NO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Oslo'
        });
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString('no-NO');
    };

    const getDeviceIcon = (device: string) => {
        switch (device?.toLowerCase()) {
            case 'mobile': return <Smartphone size={16} />;
            case 'tablet': return <Tablet size={16} />;
            case 'laptop':
            case 'desktop': return <Laptop size={16} />;
            default: return <Monitor size={16} />;
        }
    };

    const translateDevice = (device: string) => {
        switch (device?.toLowerCase()) {
            case 'mobile': return 'Mobil';
            case 'tablet': return 'Nettbrett';
            case 'laptop': return 'Bærbar PC';
            case 'desktop': return 'Stasjonær PC';
            default: return device || 'Ukjent';
        }
    };

    return (
        <ChartLayout
            title="Brukerprofiler"
            description="Oversikt over besøkende og deres aktivitet."
            currentPage="brukerprofiler"
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <RadioGroup
                        legend="Periode"
                        value={period}
                        onChange={(val: string) => {
                            setPeriod(val);
                            setPage(1);
                        }}
                    >
                        <Radio value="current_month">Denne måneden</Radio>
                        <Radio value="last_month">Forrige måned</Radio>
                    </RadioGroup>

                    <div className="mt-4">
                        <Label htmlFor="user-search" size="small" spacing>Søk etter bruker ID</Label>
                        <Search
                            id="user-search"
                            label="Søk etter bruker ID"
                            hideLabel={true}
                            variant="simple"
                            onChange={handleSearch}
                            onSearchClick={fetchUsers}
                        />
                        <Button
                            size="small"
                            variant="secondary"
                            className="mt-2 w-full"
                            onClick={fetchUsers}
                        >
                            Søk
                        </Button>
                    </div>
                </>
            }
        >
            {error && <Alert variant="error" className="mb-4">{error}</Alert>}

            {loading && (
                <div className="flex justify-center items-center h-64">
                    <Loader size="xlarge" title="Henter brukere..." />
                </div>
            )}

            {!loading && selectedWebsite && users.length === 0 && (
                <Alert variant="info" className="mb-4">
                    {searchQuery
                        ? `Ingen brukere funnet som matcher "${searchQuery}"`
                        : (
                            <>
                                Ingen brukere funnet.{' '}
                                <Link href="/diagnose">Sjekk diagnostikk</Link> for å se om data blir samlet inn.
                            </>
                        )}
                </Alert>
            )}

            {!loading && users.length > 0 && (
                <>
                    <div className="mb-4">
                        <Heading level="2" size="medium" className="mb-2">
                            {formatNumber(totalUsers)} {totalUsers === 1 ? 'bruker' : 'brukere'}
                        </Heading>
                        <BodyShort className="text-gray-600 max-w-prose">
                            Brukere er unike hver måned og får en ny bruker ID ved månedsskifte. På den måten kan de ikke spores over tid, noe som ivaretar personvernet.
                        </BodyShort>
                    </div>

                    <div className="overflow-x-auto">
                        <Table size="medium" zebraStripes>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>Bruker ID</Table.HeaderCell>
                                    <Table.HeaderCell>Sist sett</Table.HeaderCell>
                                    <Table.HeaderCell>Land</Table.HeaderCell>
                                    <Table.HeaderCell>Enhet</Table.HeaderCell>
                                    <Table.HeaderCell>Nettleser</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {users.map((user) => (
                                    <Table.Row
                                        key={user.sessionId}
                                        onClick={() => handleRowClick(user)}
                                        className="cursor-pointer hover:bg-gray-50"
                                    >
                                        <Table.DataCell>
                                            <Link href="#" onClick={(e) => { e.preventDefault(); handleRowClick(user); }}>
                                                {user.sessionId.substring(0, 8)}...
                                            </Link>
                                        </Table.DataCell>
                                        <Table.DataCell>{formatDate(user.lastSeen)}</Table.DataCell>
                                        <Table.DataCell>{translateCountry(user.country)}</Table.DataCell>
                                        <Table.DataCell>
                                            <div className="flex items-center gap-2">
                                                {getDeviceIcon(user.device)}
                                                {translateDevice(user.device)}
                                            </div>
                                        </Table.DataCell>
                                        <Table.DataCell>{user.browser || '-'}</Table.DataCell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </div>

                    {totalUsers > ROWS_PER_PAGE && (
                        <div className="mt-4 flex justify-center">
                            <Pagination
                                page={page}
                                onPageChange={setPage}
                                count={Math.ceil(totalUsers / ROWS_PER_PAGE)}
                                size="small"
                            />
                        </div>
                    )}

                    {queryStats && (
                        <div className="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-500 flex justify-end">
                            <p>
                                Data prosessert: <strong>{queryStats.totalBytesProcessedGB} GB</strong>
                            </p>
                        </div>
                    )}
                </>
            )}

            <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                header={{
                    heading: "Brukerdetaljer",
                    closeButton: true,
                }}
                width="medium"
            >
                <Modal.Body>
                    {selectedSession && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                <div className="col-span-2">
                                    <Heading level="3" size="xsmall" className="mb-1 text-gray-500">Bruker ID</Heading>
                                    <code className="text-sm break-all">{selectedSession.sessionId}</code>
                                </div>
                                <div>
                                    <Heading level="3" size="xsmall" className="mb-1 text-gray-500">Først sett</Heading>
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-400" />
                                        <span>{formatDate(selectedSession.firstSeen)}</span>
                                    </div>
                                </div>
                                <div>
                                    <Heading level="3" size="xsmall" className="mb-1 text-gray-500">Sist sett</Heading>
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-400" />
                                        <span>{formatDate(selectedSession.lastSeen)}</span>
                                    </div>
                                </div>
                                <div>
                                    <Heading level="3" size="xsmall" className="mb-1 text-gray-500">Enhet</Heading>
                                    <div className="flex items-center gap-2">
                                        {getDeviceIcon(selectedSession.device)}
                                        <span>{translateDevice(selectedSession.device)}</span>
                                    </div>
                                </div>
                                <div>
                                    <Heading level="3" size="xsmall" className="mb-1 text-gray-500">Operativsystem</Heading>
                                    <div className="flex items-center gap-2">
                                        <Monitor size={16} className="text-gray-400" />
                                        <span>{selectedSession.os || '-'}</span>
                                    </div>
                                </div>
                                <div>
                                    <Heading level="3" size="xsmall" className="mb-1 text-gray-500">Nettleser</Heading>
                                    <div className="flex items-center gap-2">
                                        <Globe size={16} className="text-gray-400" />
                                        <span>{selectedSession.browser || '-'}</span>
                                    </div>
                                </div>
                                <div>
                                    <Heading level="3" size="xsmall" className="mb-1 text-gray-500">Land</Heading>
                                    <div className="flex items-center gap-2">
                                        <Globe size={16} className="text-gray-400" />
                                        <span>{translateCountry(selectedSession.country)}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Heading level="3" size="small" className="mb-4">Aktivitetslogg</Heading>

                                {!activityLoading && activityData.length > 0 && (
                                    <div className="bg-gray-50 p-4 rounded-lg mb-6 flex flex-wrap gap-8 border border-gray-100">
                                        <div>
                                            <span className="text-gray-700 block text-sm font-medium mb-1">Sidevisninger</span>
                                            <span className="font-bold text-2xl text-gray-900">
                                                {activityData.filter(a => a.type === 'pageview').length}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-700 block text-sm font-medium mb-1">Hendelser</span>
                                            <span className="font-bold text-2xl text-gray-900">
                                                {activityData.filter(a => a.type !== 'pageview').length}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-700 block text-sm font-medium mb-1">Totalt</span>
                                            <span className="font-bold text-2xl text-gray-900">
                                                {activityData.length}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {activityLoading ? (
                                    <div className="flex justify-center p-4">
                                        <Loader />
                                    </div>
                                ) : (
                                    <div className="relative border-l border-gray-200 ml-3 space-y-8">
                                        {activityData.map((item, index) => (
                                            <div key={index} className="mb-8 ml-8 relative">
                                                <span className="absolute flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full -left-[41px] ring-4 ring-white">
                                                    {item.type === 'pageview' ? (
                                                        <Monitor size={18} className="text-blue-600" />
                                                    ) : (
                                                        <User size={18} className="text-green-600" />
                                                    )}
                                                </span>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm text-gray-500">
                                                        {new Date(item.createdAt).toLocaleTimeString('no-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <h4 className="text-lg font-medium text-gray-900">
                                                        {item.type === 'pageview' ? 'Sidevisning' : item.name}
                                                    </h4>
                                                    <p className="text-base text-gray-700">
                                                        {item.title || item.url}
                                                    </p>
                                                    {item.url && (
                                                        <code className="text-sm text-gray-500 mt-1 block bg-gray-50 p-1.5 rounded w-fit">
                                                            {item.url}
                                                        </code>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </ChartLayout>
    );
};

export default UserProfiles;
