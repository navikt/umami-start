import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { ArrowLeftIcon } from '@navikt/aksel-icons';
import { Alert, Button, Label, Link, Loader, Modal, ReadMore, Select, UNSAFE_Combobox } from '@navikt/ds-react';
import DashboardLayout from '../../dashboard/ui/DashboardLayout.tsx';
import DashboardWebsitePicker from '../../dashboard/ui/DashboardWebsitePicker.tsx';
import { DashboardWidget } from '../../dashboard/ui/DashboardWidget.tsx';
import { getSpanClass } from '../../dashboard/utils/widgetUtils.ts';
import { useOversikt } from '../hooks/useOversikt.ts';
import type { DashboardDto, GraphType, OversiktChart } from '../model/types.ts';
import {
    createGraph,
    createQuery,
    deleteDashboard,
    deleteGraph,
    fetchDashboards,
    fetchGraphs,
    fetchQueries,
    updateDashboard,
    updateGraph,
    updateQuery,
} from '../api/oversiktApi.ts';
import EditChartDialog from './dialogs/EditChartDialog.tsx';
import DeleteChartDialog from './dialogs/DeleteChartDialog.tsx';
import EditDashboardDialog from './dialogs/EditDashboardDialog.tsx';
import DeleteDashboardDialog from './dialogs/DeleteDashboardDialog.tsx';
import CopyChartDialog from './dialogs/CopyChartDialog.tsx';
import ImportChartDialog from './dialogs/ImportChartDialog.tsx';
import { applyWebsiteIdOnly, extractWebsiteId, replaceHardcodedWebsiteId } from '../../sql/utils/sqlProcessing.ts';

const parseChartWidth = (width?: string): number | undefined => {
    const parsed = Number(width);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return Math.round(parsed);
};

const rewriteSqlWebsiteId = (sql: string, targetWebsiteId?: string): string => {
    if (!targetWebsiteId) return sql;
    const withPlaceholderApplied = applyWebsiteIdOnly(sql, targetWebsiteId);
    return replaceHardcodedWebsiteId(withPlaceholderApplied, targetWebsiteId);
};

type CopySuccessState = {
    projectId: number;
    projectName: string;
    dashboardId: number;
    dashboardName: string;
    chartName: string;
};

const Oversikt = () => {
    const {
        selectedDashboard,
        selectedProjectId, selectedDashboardId,
        setSelectedProjectId, setSelectedDashboardId,
        projects,
        selectedWebsite, setSelectedWebsite,
        activeWebsite, activeWebsiteId,
        tempPathOperator, setTempPathOperator,
        tempUrlPaths,
        tempDateRange, setTempDateRange,
        tempMetricType, setTempMetricType,
        comboInputValue,
        activeFilters,
        charts, supportsStandardFilters, hasChanges,
        isLoading, error,
        handleUpdate,
        handleUrlToggleSelected, handleComboChange,
        handleReorderCharts,
        refreshGraphs, refreshDashboards,
    } = useOversikt();
    const [editChart, setEditChart] = useState<OversiktChart | null>(null);
    const [deleteChartTarget, setDeleteChartTarget] = useState<OversiktChart | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingChart, setDeletingChart] = useState(false);
    const [dashboardMutationError, setDashboardMutationError] = useState<string | null>(null);
    const [editDashboardTarget, setEditDashboardTarget] = useState<DashboardDto | null>(null);
    const [deleteDashboardTarget, setDeleteDashboardTarget] = useState<DashboardDto | null>(null);
    const [savingDashboard, setSavingDashboard] = useState(false);
    const [deletingDashboard, setDeletingDashboard] = useState(false);
    const [copyChartTarget, setCopyChartTarget] = useState<{ chart: OversiktChart; sourceWebsiteId?: string } | null>(null);
    const [copyMutationError, setCopyMutationError] = useState<string | null>(null);
    const [copyingChart, setCopyingChart] = useState(false);
    const [copySuccess, setCopySuccess] = useState<CopySuccessState | null>(null);
    const [reorderingGraphId, setReorderingGraphId] = useState<number | null>(null);
    const [grabbedGraphId, setGrabbedGraphId] = useState<number | null>(null);
    const [draggedGraphId, setDraggedGraphId] = useState<number | null>(null);
    const [dropTargetGraphId, setDropTargetGraphId] = useState<number | null>(null);
    const [reorderAnnouncement, setReorderAnnouncement] = useState('');
    const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
    const [stats, setStats] = useState<Record<string, { gb: number; title: string }>>({});
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importingChart, setImportingChart] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const chartRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const chartPositionsRef = useRef<Map<number, DOMRect>>(new Map());
    const totalGb = Object.values(stats).reduce((acc, curr) => acc + curr.gb, 0);

    useEffect(() => {
        setStats({});
    }, [selectedDashboardId, activeWebsiteId, activeFilters]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!selectedProjectId) return;
        window.localStorage.setItem('projectmanager:lastSelectedProjectId', String(selectedProjectId));
    }, [selectedProjectId]);

    useEffect(() => {
        const chartIds = new Set(charts.map((chart) => chart.id));
        setStats((prev) => {
            const nextEntries = Object.entries(prev).filter(([id]) => chartIds.has(id));
            if (nextEntries.length === Object.keys(prev).length) return prev;
            return Object.fromEntries(nextEntries);
        });
    }, [charts]);

    useLayoutEffect(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            const currentPositions = new Map<number, DOMRect>();
            chartRefs.current.forEach((element, graphId) => {
                currentPositions.set(graphId, element.getBoundingClientRect());
            });
            chartPositionsRef.current = currentPositions;
            return;
        }

        const currentPositions = new Map<number, DOMRect>();
        chartRefs.current.forEach((element, graphId) => {
            currentPositions.set(graphId, element.getBoundingClientRect());
        });

        currentPositions.forEach((newRect, graphId) => {
            const element = chartRefs.current.get(graphId);
            const oldRect = chartPositionsRef.current.get(graphId);
            if (!element || !oldRect) return;

            const deltaX = oldRect.left - newRect.left;
            const deltaY = oldRect.top - newRect.top;
            if (deltaX === 0 && deltaY === 0) return;

            element.style.transition = 'none';
            element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            requestAnimationFrame(() => {
                element.style.transition = 'transform 220ms ease';
                element.style.transform = '';
            });
        });

        chartPositionsRef.current = currentPositions;
    }, [charts]);

    const openEditDialog = (chartId?: string) => {
        if (!chartId) return;
        const chart = charts.find((item) => item.id === chartId) ?? null;
        if (!chart) return;
        setMutationError(null);
        setEditChart(chart);
    };

    const openDeleteDialog = (chartId?: string) => {
        if (!chartId) return;
        const chart = charts.find((item) => item.id === chartId) ?? null;
        if (!chart) return;
        setMutationError(null);
        setDeleteChartTarget(chart);
    };

    const openCopyDialog = (chartId?: string, sourceWebsiteId?: string) => {
        if (!chartId) return;
        const chart = charts.find((item) => item.id === chartId) ?? null;
        if (!chart) return;
        const resolvedSourceWebsiteId =
            sourceWebsiteId
            || (chart.sql ? extractWebsiteId(chart.sql) : undefined)
            || (activeWebsiteId || undefined);
        setCopyMutationError(null);
        setCopyChartTarget({ chart, sourceWebsiteId: resolvedSourceWebsiteId });
    };

    const handleSaveChart = async (params: { name: string; graphType: GraphType; sqlText: string; width: number; websiteId?: string }) => {
        if (!editChart || !selectedProjectId || !selectedDashboardId) return;
        setSavingEdit(true);
        setMutationError(null);
        try {
            const sqlForSave = rewriteSqlWebsiteId(params.sqlText, params.websiteId);
            await updateGraph(selectedProjectId, selectedDashboardId, editChart.graphId, {
                name: params.name,
                graphType: params.graphType,
                width: params.width,
            });
            await updateQuery(selectedProjectId, selectedDashboardId, editChart.graphId, editChart.queryId, {
                name: editChart.queryName,
                sqlText: sqlForSave,
            });
            await refreshGraphs();
            setEditChart(null);
        } catch (err: unknown) {
            setMutationError(err instanceof Error ? err.message : 'Kunne ikke oppdatere graf');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteChart = async () => {
        if (!deleteChartTarget || !selectedProjectId || !selectedDashboardId) return;
        setDeletingChart(true);
        setMutationError(null);
        try {
            await deleteGraph(selectedProjectId, selectedDashboardId, deleteChartTarget.graphId);
            await refreshGraphs();
            setDeleteChartTarget(null);
        } catch (err: unknown) {
            setMutationError(err instanceof Error ? err.message : 'Kunne ikke slette graf');
        } finally {
            setDeletingChart(false);
        }
    };

    const handleCopyChart = async (params: {
        projectId: number;
        projectName: string;
        dashboardId: number;
        dashboardName: string;
        chartName: string;
        websiteId?: string;
    }) => {
        if (!copyChartTarget) return;
        const sqlText = copyChartTarget.chart.sql?.trim() ?? '';
        if (!sqlText) {
            setCopyMutationError('Grafen mangler SQL og kan ikke kopieres');
            return;
        }
        if (!params.chartName.trim()) {
            setCopyMutationError('Grafnavn er påkrevd');
            return;
        }
        const sqlForCopy = rewriteSqlWebsiteId(sqlText, params.websiteId);

        setCopyingChart(true);
        setCopyMutationError(null);
        try {
            const graphItems = await fetchGraphs(params.projectId, params.dashboardId);
            const sourceName = params.chartName.trim();
            const sourceNameLower = sourceName.toLowerCase();
            const isSameDashboard =
                selectedProjectId === params.projectId && selectedDashboardId === params.dashboardId;
            const existingGraph = graphItems.find((graph) => {
                if (isSameDashboard && graph.id === copyChartTarget.chart.graphId) return false;
                return graph.name.trim().toLowerCase() === sourceNameLower;
            });

            const width = parseChartWidth(copyChartTarget.chart.width);
            if (existingGraph) {
                await updateGraph(params.projectId, params.dashboardId, existingGraph.id, {
                    name: sourceName,
                    graphType: copyChartTarget.chart.graphType,
                    width,
                });

                const existingQueries = await fetchQueries(params.projectId, params.dashboardId, existingGraph.id);
                const firstQuery = existingQueries[0];
                if (firstQuery) {
                    await updateQuery(params.projectId, params.dashboardId, existingGraph.id, firstQuery.id, {
                        name: copyChartTarget.chart.queryName,
                        sqlText: sqlForCopy,
                    });
                } else {
                    await createQuery(params.projectId, params.dashboardId, existingGraph.id, {
                        name: copyChartTarget.chart.queryName,
                        sqlText: sqlForCopy,
                    });
                }
            } else {
                const createdGraph = await createGraph(params.projectId, params.dashboardId, {
                    name: sourceName,
                    graphType: copyChartTarget.chart.graphType,
                    width,
                });

                await createQuery(params.projectId, params.dashboardId, createdGraph.id, {
                    name: copyChartTarget.chart.queryName,
                    sqlText: sqlForCopy,
                });
            }

            if (isSameDashboard) {
                await refreshGraphs();
            }

            setCopyChartTarget(null);
            setCopySuccess({
                projectId: params.projectId,
                projectName: params.projectName,
                dashboardId: params.dashboardId,
                dashboardName: params.dashboardName,
                chartName: params.chartName.trim(),
            });
        } catch (err: unknown) {
            setCopyMutationError(err instanceof Error ? err.message : 'Kunne ikke kopiere graf');
        } finally {
            setCopyingChart(false);
        }
    };

    const handleGoToCopiedDashboard = async () => {
        if (!copySuccess) return;
        setSelectedProjectId(copySuccess.projectId);
        await refreshDashboards(copySuccess.projectId, copySuccess.dashboardId);
        setCopySuccess(null);
    };

    const openEditDashboardDialog = () => {
        if (!selectedDashboard) return;
        setDashboardMutationError(null);
        setEditDashboardTarget(selectedDashboard);
    };

    const openDeleteDashboardDialog = () => {
        if (!selectedDashboard) return;
        setDashboardMutationError(null);
        setDeleteDashboardTarget(selectedDashboard);
    };

    const handleSaveDashboard = async (params: { name: string; projectId: number }) => {
        if (!editDashboardTarget || !selectedProjectId) return;
        setSavingDashboard(true);
        setDashboardMutationError(null);
        try {
            const updatedDashboard = await updateDashboard(selectedProjectId, editDashboardTarget.id, {
                name: params.name,
                projectId: params.projectId,
            });

            setSelectedDashboardId(updatedDashboard.id);
            if (params.projectId !== selectedProjectId) {
                setSelectedProjectId(params.projectId);
            } else {
                await refreshDashboards(selectedProjectId, updatedDashboard.id);
            }
            setEditDashboardTarget(null);
        } catch (err: unknown) {
            setDashboardMutationError(err instanceof Error ? err.message : 'Kunne ikke oppdatere dashboard');
        } finally {
            setSavingDashboard(false);
        }
    };

    const handleDeleteDashboard = async () => {
        if (!deleteDashboardTarget || !selectedProjectId) return;
        if (charts.length > 0) {
            setDashboardMutationError('Dashboard med grafer kan ikke slettes');
            return;
        }

        setDeletingDashboard(true);
        setDashboardMutationError(null);
        try {
            await deleteDashboard(selectedProjectId, deleteDashboardTarget.id);
            await refreshDashboards(selectedProjectId, null);
            setDeleteDashboardTarget(null);
        } catch (err: unknown) {
            setDashboardMutationError(err instanceof Error ? err.message : 'Kunne ikke slette dashboard');
        } finally {
            setDeletingDashboard(false);
        }
    };

    const handleMoveChart = async (fromIndex: number, toIndex: number): Promise<boolean> => {
        if (fromIndex === toIndex) return true;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= charts.length || toIndex >= charts.length) return false;

        const movedChart = charts[fromIndex];
        if (!movedChart) return false;

        setReorderingGraphId(movedChart.graphId);
        const success = await handleReorderCharts(fromIndex, toIndex);
        if (success) {
            setReorderAnnouncement(`${movedChart.title} flyttet til plass ${toIndex + 1} av ${charts.length}.`);
        } else {
            setReorderAnnouncement(`Kunne ikke flytte ${movedChart.title}. Prøv igjen.`);
        }
        setReorderingGraphId(null);
        return success;
    };

    const getChartIndex = (graphId: number) => charts.findIndex((item) => item.graphId === graphId);

    const handleMoveHandleKeyDown = async (event: KeyboardEvent<HTMLButtonElement>, graphId: number, title: string) => {
        if (!isEditPanelOpen) return;
        if (charts.length <= 1) return;

        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            if (grabbedGraphId === graphId) {
                setGrabbedGraphId(null);
                setReorderAnnouncement(`${title} sluppet.`);
            } else {
                const index = getChartIndex(graphId);
                if (index < 0) return;
                setGrabbedGraphId(graphId);
                setReorderAnnouncement(`${title} valgt for flytting. Plass ${index + 1} av ${charts.length}.`);
            }
            return;
        }

        if (event.key === 'Escape' && grabbedGraphId === graphId) {
            event.preventDefault();
            setGrabbedGraphId(null);
            setReorderAnnouncement(`Flytting av ${title} avbrutt.`);
            return;
        }

        if (grabbedGraphId !== graphId) return;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

        event.preventDefault();
        const fromIndex = getChartIndex(graphId);
        if (fromIndex < 0) return;
        const toIndex = event.key === 'ArrowUp' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= charts.length) return;
        await handleMoveChart(fromIndex, toIndex);
    };

    const handleDragStart = (event: DragEvent<HTMLButtonElement>, graphId: number, title: string) => {
        if (!isEditPanelOpen) return;
        setDraggedGraphId(graphId);
        setDropTargetGraphId(null);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(graphId));
        const chartElement = chartRefs.current.get(graphId);
        if (chartElement) {
            event.dataTransfer.setDragImage(chartElement, 24, 24);
        }
        const index = getChartIndex(graphId);
        if (index >= 0) {
            setReorderAnnouncement(`${title} valgt for flytting. Plass ${index + 1} av ${charts.length}.`);
        }
    };

    const handleDropOnChart = async (event: DragEvent<HTMLDivElement>, targetGraphId: number) => {
        if (!isEditPanelOpen) return;
        event.preventDefault();
        const sourceGraphId = draggedGraphId ?? Number(event.dataTransfer.getData('text/plain'));
        if (!Number.isFinite(sourceGraphId)) return;
        const fromIndex = getChartIndex(sourceGraphId);
        const toIndex = getChartIndex(targetGraphId);
        if (fromIndex < 0 || toIndex < 0) return;
        await handleMoveChart(fromIndex, toIndex);
        setDraggedGraphId(null);
        setDropTargetGraphId(null);
    };

    const openImportModal = () => {
        if (!selectedDashboardId) return;
        setImportError(null);
        setIsImportModalOpen(true);
    };

    const handleImportChart = async (params: {
        name: string;
        graphType: GraphType;
        width: string;
        sqlText: string;
    }) => {
        if (!selectedProjectId || !selectedDashboardId) return;

        const parsedWidth = Number(params.width);
        if (!Number.isFinite(parsedWidth)) {
            setImportError('Bredde må være et tall mellom 1 og 100');
            return;
        }
        const normalizedWidth = Math.max(1, Math.min(100, Math.round(parsedWidth)));
        const sqlForSave = params.sqlText;

        setImportError(null);
        setImportingChart(true);
        try {
            const createdGraph = await createGraph(selectedProjectId, selectedDashboardId, {
                name: params.name,
                graphType: params.graphType,
                width: normalizedWidth,
            });
            await createQuery(selectedProjectId, selectedDashboardId, createdGraph.id, {
                name: `${params.name} - query`,
                sqlText: sqlForSave,
            });
            await refreshGraphs();
            setIsImportModalOpen(false);
        } catch (err: unknown) {
            setImportError(err instanceof Error ? err.message : 'Kunne ikke importere graf');
        } finally {
            setImportingChart(false);
        }
    };

    const handleDataLoaded = (data: { id: string; gb: number; title: string }) => {
        setStats((prev) => ({
            ...prev,
            [data.id]: { gb: data.gb, title: data.title },
        }));
    };

    const filters = (
        <>
            {supportsStandardFilters && (
                <>
                    <div className="w-full md:w-[18rem]">
                        <DashboardWebsitePicker
                            selectedWebsite={selectedWebsite}
                            onWebsiteChange={setSelectedWebsite}
                            variant="minimal"
                            size="small"
                            disableUrlUpdate
                        />
                    </div>

                    <div className="w-full md:w-[20rem]">
                        <div className="flex items-center gap-2 mb-1">
                            <Label size="small" htmlFor="oversikt-url-filter">URL-sti</Label>
                            <select
                                className="text-sm bg-[var(--ax-bg-default)] border border-[var(--ax-border-neutral-subtle)] rounded text-[var(--ax-text-accent)] font-medium cursor-pointer focus:outline-none py-1 px-2"
                                value={tempPathOperator}
                                onChange={(e) => setTempPathOperator(e.target.value)}
                            >
                                <option value="equals">er lik</option>
                                <option value="starts-with">starter med</option>
                            </select>
                        </div>
                        <UNSAFE_Combobox
                            id="oversikt-url-filter"
                            label="URL-stier"
                            hideLabel
                            size="small"
                            isMultiSelect
                            allowNewValues
                            options={tempUrlPaths.map((path) => ({ label: path, value: path }))}
                            selectedOptions={tempUrlPaths}
                            onToggleSelected={handleUrlToggleSelected}
                            value={comboInputValue}
                            onChange={handleComboChange}
                            clearButton
                        />
                    </div>

                    <div className="w-full sm:w-auto min-w-[180px]">
                        <Select
                            label="Datoperiode"
                            size="small"
                            value={tempDateRange}
                            onChange={(e) => setTempDateRange(e.target.value)}
                        >
                            <option value="current_month">Denne måneden</option>
                            <option value="last_month">Forrige måned</option>
                            <option value="last_30_days">Siste 30 dager</option>
                        </Select>
                    </div>

                    <div className="w-full sm:w-auto min-w-[150px]">
                        <Select
                            label="Visning"
                            size="small"
                            value={tempMetricType}
                            onChange={(e) => setTempMetricType(e.target.value as 'visitors' | 'pageviews' | 'proportion' | 'visits')}
                        >
                            <option value="visitors">Unike besøkende</option>
                            <option value="visits">Økter / besøk</option>
                            <option value="pageviews">Sidevisninger</option>
                            <option value="proportion">Andel (%)</option>
                        </Select>
                    </div>

                    <div className="flex items-end pb-[2px]">
                        <Button size="small" onClick={handleUpdate} disabled={!hasChanges}>
                            Oppdater
                        </Button>
                    </div>
                </>
            )}
        </>
    );

    return (
        <DashboardLayout
            title={selectedDashboard ? `Dashboard: ${selectedDashboard.name}` : 'Dashboard'}
            description={(
                <Link
                    href={selectedProjectId ? `/prosjekter?projectId=${selectedProjectId}` : '/prosjekter'}
                    className="inline-flex items-center gap-1"
                >
                    <ArrowLeftIcon aria-hidden fontSize="1rem" />
                    <span>Arbeidsområder</span>
                </Link>
            )}
            filters={supportsStandardFilters ? filters : undefined}
        >
            {error && <Alert variant="error">{error}</Alert>}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
                {reorderAnnouncement}
            </p>

            {isLoading && (
                <div className="flex justify-center p-8">
                    <Loader />
                </div>
            )}

            {!isLoading && !selectedDashboard && (
                <div className="w-fit">
                    <Alert variant="info" size="small">
                        Velg prosjekt og dashboard for å vise grafer.
                    </Alert>
                </div>
            )}

            {!isLoading && supportsStandardFilters && selectedDashboard && !activeWebsiteId && (
                <div className="w-fit">
                    <Alert variant="info" size="small">
                        Velg nettside eller app for å vise grafdata.
                    </Alert>
                </div>
            )}

            {!isLoading && selectedDashboard && (!supportsStandardFilters || activeWebsiteId) && charts.length === 0 && (
                <div className="w-fit">
                    <Alert variant="info" size="small">
                        Gå til <Link href="/grafbygger">Grafbyggeren</Link> for å legge til din første graf.
                    </Alert>
                </div>
            )}

            {!isLoading && selectedDashboard && (!supportsStandardFilters || activeWebsiteId) && charts.length > 0 && (
                <>
                    <div className="flex justify-end gap-2 mb-4">
                        <Button
                            variant={isEditPanelOpen ? 'primary' : 'secondary'}
                            size="small"
                            onClick={() => {
                                setIsEditPanelOpen((prev) => {
                                    const next = !prev;
                                    if (!next) {
                                        setGrabbedGraphId(null);
                                        setDraggedGraphId(null);
                                        setDropTargetGraphId(null);
                                        setReorderAnnouncement('Rekkefølge-redigering avsluttet.');
                                    }
                                    return next;
                                });
                            }}
                        >
                            {isEditPanelOpen ? 'Lukk' : 'Rediger'}
                        </Button>
                        <Button as="a" href="/grafbygger" variant="secondary" size="small">
                            Legg til ny graf
                        </Button>
                    </div>
                    {isEditPanelOpen && (
                        <section className="mb-4 p-3 border border-[var(--ax-border-neutral-subtle)] rounded-md bg-[var(--ax-bg-default)]">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={openEditDashboardDialog}
                                    disabled={!selectedDashboard}
                                >
                                    Rediger navn / plassering
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={openDeleteDashboardDialog}
                                    disabled={!selectedDashboard}
                                >
                                    Slett dashboard
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={openImportModal}
                                    disabled={!selectedDashboard}
                                >
                                    Importer graf
                                </Button>
                            </div>
                        </section>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-20 gap-6">
                        {charts.map((chart, index) => (
                            <div
                                key={chart.id}
                                className={`relative ${getSpanClass(chart.width)}`}
                                ref={(element) => {
                                    if (element) chartRefs.current.set(chart.graphId, element);
                                    else chartRefs.current.delete(chart.graphId);
                                }}
                                onDragOver={(event) => {
                                    if (!isEditPanelOpen || draggedGraphId === null) return;
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                }}
                                onDragEnter={() => {
                                    if (!isEditPanelOpen || draggedGraphId === null || draggedGraphId === chart.graphId) return;
                                    setDropTargetGraphId(chart.graphId);
                                }}
                                onDragLeave={() => {
                                    if (dropTargetGraphId === chart.graphId) {
                                        setDropTargetGraphId(null);
                                    }
                                }}
                                onDrop={(event) => {
                                    void handleDropOnChart(event, chart.graphId);
                                }}
                                style={{
                                    opacity: draggedGraphId === chart.graphId ? 0.65 : 1,
                                    outline: dropTargetGraphId === chart.graphId ? '2px dashed var(--ax-border-accent)' : 'none',
                                    outlineOffset: dropTargetGraphId === chart.graphId ? '4px' : undefined,
                                }}
                            >
                                <DashboardWidget
                                    chart={chart}
                                    websiteId={activeWebsiteId}
                                    filters={activeFilters}
                                    onDataLoaded={handleDataLoaded}
                                    selectedWebsite={activeWebsite ? { ...activeWebsite } : undefined}
                                    dashboardTitle={selectedDashboard.name}
                                    onEditChart={openEditDialog}
                                    onDeleteChart={openDeleteDialog}
                                    onCopyChart={openCopyDialog}
                                    titlePrefix={isEditPanelOpen && charts.length > 1 ? (
                                        <Button
                                            variant="secondary"
                                            size="xsmall"
                                            icon={<GripVertical aria-hidden />}
                                            title={grabbedGraphId === chart.graphId ? 'Slipp graf' : 'Flytt graf'}
                                            aria-label={`${grabbedGraphId === chart.graphId ? 'Slipp' : 'Flytt'} ${chart.title}. Plass ${index + 1} av ${charts.length}.`}
                                            aria-pressed={grabbedGraphId === chart.graphId}
                                            disabled={reorderingGraphId !== null}
                                            loading={reorderingGraphId === chart.graphId}
                                            draggable={reorderingGraphId === null}
                                            onKeyDown={(event) => {
                                                void handleMoveHandleKeyDown(event, chart.graphId, chart.title);
                                            }}
                                            onDragStart={(event) => handleDragStart(event, chart.graphId, chart.title)}
                                            onDragEnd={() => {
                                                setDraggedGraphId(null);
                                                setDropTargetGraphId(null);
                                            }}
                                        >
                                            Flytt
                                        </Button>
                                    ) : undefined}
                                />
                            </div>
                        ))}
                    </div>

                    {Object.keys(stats).length > 0 && (
                        <div className="mt-5">
                            <ReadMore header={`${Math.round(totalGb)} GB prosessert`} size="small">
                                <div className="text-sm text-[var(--ax-text-subtle)]">
                                    <ul className="list-disc pl-5">
                                        {Object.entries(stats).map(([id, stat]) => (
                                            <li key={id}>
                                                <span className="font-medium">{Math.round(stat.gb)} GB</span> - {stat.title}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </ReadMore>
                        </div>
                    )}

                    {charts.length > 4 && (
                        <div className="flex justify-end mt-4 pb-6">
                            <Button as="a" href="/grafbygger" variant="secondary" size="small">
                                Legg til ny graf
                            </Button>
                        </div>
                    )}
                </>
            )}

            <EditChartDialog
                key={editChart?.id ?? 'edit-chart-dialog'}
                open={!!editChart}
                chart={editChart}
                defaultWebsiteId={
                    editChart?.sql
                        ? (extractWebsiteId(editChart.sql) ?? (activeWebsiteId || undefined))
                        : (activeWebsiteId || undefined)
                }
                loading={savingEdit}
                error={mutationError}
                onClose={() => {
                    setEditChart(null);
                    setMutationError(null);
                }}
                onSave={handleSaveChart}
            />

            <DeleteChartDialog
                open={!!deleteChartTarget}
                chart={deleteChartTarget}
                loading={deletingChart}
                error={mutationError}
                onClose={() => {
                    setDeleteChartTarget(null);
                    setMutationError(null);
                }}
                onConfirm={handleDeleteChart}
            />

            <CopyChartDialog
                open={!!copyChartTarget}
                chart={copyChartTarget?.chart ?? null}
                projects={projects}
                selectedProjectId={selectedProjectId}
                selectedDashboardId={selectedDashboardId}
                loading={copyingChart}
                error={copyMutationError}
                onClose={() => {
                    setCopyChartTarget(null);
                    setCopyMutationError(null);
                }}
                sourceWebsiteId={copyChartTarget?.sourceWebsiteId}
                loadDashboards={fetchDashboards}
                onCopy={handleCopyChart}
            />

            <Modal
                open={!!copySuccess}
                onClose={() => setCopySuccess(null)}
                header={{ heading: 'Graf kopiert' }}
                width="small"
            >
                <Modal.Body>
                    {copySuccess && (
                        <p>
                            {copySuccess.chartName} er kopiert til {copySuccess.projectName} / {copySuccess.dashboardName}. Vil du gå dit nå?
                        </p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={() => void handleGoToCopiedDashboard()}>
                        Ja, gå dit
                    </Button>
                    <Button variant="secondary" onClick={() => setCopySuccess(null)}>
                        Nei, bli her
                    </Button>
                </Modal.Footer>
            </Modal>

            {isImportModalOpen && (
                <ImportChartDialog
                    open={isImportModalOpen}
                    loading={importingChart}
                    error={importError}
                    onClose={() => {
                        setIsImportModalOpen(false);
                        setImportError(null);
                    }}
                    onImport={handleImportChart}
                />
            )}

            <EditDashboardDialog
                key={editDashboardTarget ? `edit-dashboard-${editDashboardTarget.id}-${editDashboardTarget.projectId}` : 'edit-dashboard-dialog'}
                open={!!editDashboardTarget}
                dashboard={editDashboardTarget}
                projects={projects}
                loading={savingDashboard}
                error={dashboardMutationError}
                onClose={() => {
                    setEditDashboardTarget(null);
                    setDashboardMutationError(null);
                }}
                onSave={handleSaveDashboard}
            />

            <DeleteDashboardDialog
                open={!!deleteDashboardTarget}
                dashboard={deleteDashboardTarget}
                hasCharts={charts.length > 0}
                loading={deletingDashboard}
                error={dashboardMutationError}
                onClose={() => {
                    setDeleteDashboardTarget(null);
                    setDashboardMutationError(null);
                }}
                onConfirm={handleDeleteDashboard}
            />
        </DashboardLayout>
    );
};

export default Oversikt;
