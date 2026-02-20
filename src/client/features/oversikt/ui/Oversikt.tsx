import { useState } from 'react';
import { ArrowUp, ArrowDown, MoreVertical } from 'lucide-react';
import { ActionMenu, Alert, Button, Label, Loader, Select, UNSAFE_Combobox } from '@navikt/ds-react';
import DashboardLayout from '../../dashboard/ui/DashboardLayout.tsx';
import DashboardWebsitePicker from '../../dashboard/ui/DashboardWebsitePicker.tsx';
import { DashboardWidget } from '../../dashboard/ui/DashboardWidget.tsx';
import { useOversikt } from '../hooks/useOversikt.ts';
import type { DashboardDto, GraphType, OversiktChart } from '../model/types.ts';
import { deleteDashboard, deleteGraph, updateDashboard, updateGraph, updateQuery } from '../api/oversiktApi.ts';
import EditChartDialog from './dialogs/EditChartDialog.tsx';
import DeleteChartDialog from './dialogs/DeleteChartDialog.tsx';
import EditDashboardDialog from './dialogs/EditDashboardDialog.tsx';
import DeleteDashboardDialog from './dialogs/DeleteDashboardDialog.tsx';

const Oversikt = () => {
    const {
        selectedProject, selectedDashboard,
        selectedProjectId, selectedDashboardId,
        setSelectedProjectId, setSelectedDashboardId,
        projectOptions, dashboardOptions,
        projects,
        selectedProjectLabel, selectedDashboardLabel,
        selectedWebsite, setSelectedWebsite,
        activeWebsite, activeWebsiteId,
        tempPathOperator, setTempPathOperator,
        tempUrlPaths,
        tempDateRange, setTempDateRange,
        tempMetricType, setTempMetricType,
        comboInputValue,
        activeFilters,
        charts, supportsStandardFilters, hasChanges,
        isLoading, loadingProjects, loadingDashboards, error,
        handleUpdate, handleProjectSelected, handleDashboardSelected,
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

    const handleSaveChart = async (params: { name: string; graphType: GraphType; sqlText: string }) => {
        if (!editChart || !selectedProjectId || !selectedDashboardId) return;
        setSavingEdit(true);
        setMutationError(null);
        try {
            await updateGraph(selectedProjectId, selectedDashboardId, editChart.graphId, {
                name: params.name,
                graphType: params.graphType,
            });
            await updateQuery(selectedProjectId, selectedDashboardId, editChart.graphId, editChart.queryId, {
                name: editChart.queryName,
                sqlText: params.sqlText,
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

    const filters = (
        <>
            <div className="w-full md:w-[20rem]">
                <UNSAFE_Combobox
                    label="Prosjekt"
                    options={projectOptions}
                    selectedOptions={selectedProjectLabel ? [selectedProjectLabel] : []}
                    onToggleSelected={(option, isSelected) => {
                        void handleProjectSelected(option, isSelected);
                    }}
                    isMultiSelect={false}
                    allowNewValues
                    size="small"
                    clearButton
                    disabled={loadingProjects}
                />
            </div>

            <div className="w-full md:w-[22rem] flex items-end gap-2">
                <UNSAFE_Combobox
                    label="Dashboard"
                    options={dashboardOptions}
                    selectedOptions={selectedDashboardLabel ? [selectedDashboardLabel] : []}
                    onToggleSelected={(option, isSelected) => {
                        void handleDashboardSelected(option, isSelected);
                    }}
                    isMultiSelect={false}
                    allowNewValues
                    size="small"
                    clearButton
                    disabled={!selectedProject || loadingDashboards}
                />
                <ActionMenu>
                    <ActionMenu.Trigger>
                        <Button
                            variant="tertiary"
                            size="small"
                            icon={<MoreVertical aria-hidden />}
                            title="Dashboardvalg"
                            aria-label="Dashboardvalg"
                            disabled={!selectedDashboard}
                        />
                    </ActionMenu.Trigger>
                    <ActionMenu.Content>
                        <ActionMenu.Item onSelect={openEditDashboardDialog}>
                            Rediger dashboard
                        </ActionMenu.Item>
                        <ActionMenu.Item onSelect={openDeleteDashboardDialog}>
                            Slett dashboard
                        </ActionMenu.Item>
                        <ActionMenu.Divider />
                        <ActionMenu.Item as="a" href="/prosjekter">
                            Administrer prosjekt
                        </ActionMenu.Item>
                    </ActionMenu.Content>
                </ActionMenu>
            </div>

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
            filters={filters}
        >
            {error && <Alert variant="error">{error}</Alert>}

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
                        Ingen lagrede grafer med SQL funnet for valgt dashboard.
                    </Alert>
                </div>
            )}

            {!isLoading && selectedDashboard && (!supportsStandardFilters || activeWebsiteId) && charts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-20 gap-6">
                    {charts.map((chart, index) => (
                        <div key={chart.id} className="relative col-span-full md:col-span-10">
                            {charts.length > 1 && (
                                <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                                    <Button
                                        variant="tertiary"
                                        size="xsmall"
                                        icon={<ArrowUp aria-hidden />}
                                        title="Flytt opp"
                                        aria-label={`Flytt ${chart.title} opp`}
                                        disabled={index === 0}
                                        onClick={() => void handleReorderCharts(index, index - 1)}
                                    />
                                    <Button
                                        variant="tertiary"
                                        size="xsmall"
                                        icon={<ArrowDown aria-hidden />}
                                        title="Flytt ned"
                                        aria-label={`Flytt ${chart.title} ned`}
                                        disabled={index === charts.length - 1}
                                        onClick={() => void handleReorderCharts(index, index + 1)}
                                    />
                                </div>
                            )}
                            <DashboardWidget
                                chart={chart}
                                websiteId={activeWebsiteId}
                                filters={activeFilters}
                                selectedWebsite={activeWebsite ? { ...activeWebsite } : undefined}
                                dashboardTitle={selectedDashboard.name}
                                onEditChart={openEditDialog}
                                onDeleteChart={openDeleteDialog}
                            />
                        </div>
                    ))}
                </div>
            )}

            <EditChartDialog
                key={editChart?.id ?? 'edit-chart-dialog'}
                open={!!editChart}
                chart={editChart}
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
