import { useState } from 'react';
import { Alert, Button, Label, Loader, Select, UNSAFE_Combobox } from '@navikt/ds-react';
import DashboardLayout from '../../dashboard/ui/DashboardLayout.tsx';
import DashboardWebsitePicker from '../../dashboard/ui/DashboardWebsitePicker.tsx';
import { DashboardWidget } from '../../dashboard/ui/DashboardWidget.tsx';
import { useOversikt } from '../hooks/useOversikt.ts';
import type { GraphType, OversiktChart } from '../model/types.ts';
import { deleteGraph, updateGraph, updateQuery } from '../api/oversiktApi.ts';
import EditChartDialog from './dialogs/EditChartDialog.tsx';
import DeleteChartDialog from './dialogs/DeleteChartDialog.tsx';

const Oversikt = () => {
    const {
        selectedProject, selectedDashboard,
        selectedProjectId, selectedDashboardId,
        projectOptions, dashboardOptions,
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
        refreshGraphs,
    } = useOversikt();
    const [editChart, setEditChart] = useState<OversiktChart | null>(null);
    const [deleteChartTarget, setDeleteChartTarget] = useState<OversiktChart | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingChart, setDeletingChart] = useState(false);

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

    const filters = (
        <>
            <div className="w-full md:w-[20rem]">
                <UNSAFE_Combobox
                    label="Prosjekt"
                    options={projectOptions}
                    selectedOptions={selectedProjectLabel ? [selectedProjectLabel] : []}
                    onToggleSelected={handleProjectSelected}
                    isMultiSelect={false}
                    size="small"
                    clearButton
                    disabled={loadingProjects}
                />
            </div>

            <div className="w-full md:w-[20rem]">
                <UNSAFE_Combobox
                    label="Dashboard"
                    options={dashboardOptions}
                    selectedOptions={selectedDashboardLabel ? [selectedDashboardLabel] : []}
                    onToggleSelected={handleDashboardSelected}
                    isMultiSelect={false}
                    size="small"
                    clearButton
                    disabled={!selectedProject || loadingDashboards}
                />
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
                    {charts.map((chart) => (
                        <DashboardWidget
                            key={chart.id}
                            chart={chart}
                            websiteId={activeWebsiteId}
                            filters={activeFilters}
                            selectedWebsite={activeWebsite ? { ...activeWebsite } : undefined}
                            dashboardTitle={selectedDashboard.name}
                            onEditChart={openEditDialog}
                            onDeleteChart={openDeleteDialog}
                        />
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
        </DashboardLayout>
    );
};

export default Oversikt;
