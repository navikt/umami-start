import { Alert, BodyLong, Button, Heading, Page, Select, Textarea, TextField } from '@navikt/ds-react';
import { useProjectManager } from '../hooks/useProjectManager.ts';

const ProjectManager = () => {
    const {
        projects, dashboards, graphs, queries,
        selectedProjectId, setSelectedProjectId,
        selectedDashboardId, setSelectedDashboardId,
        selectedGraphId, setSelectedGraphId,
        selectedProject, selectedDashboard, selectedGraph,
        loading, error, message,
        projectName, setProjectName,
        projectDescription, setProjectDescription,
        dashboardName, setDashboardName,
        dashboardDescription, setDashboardDescription,
        graphName, setGraphName,
        graphType, setGraphType,
        queryName, setQueryName,
        querySql, setQuerySql,
        createProject, createDashboard, createGraph, createQuery,
    } = useProjectManager();

    return (
        <Page.Block width="xl" gutters>
            <div className="py-8 space-y-6">
                <Heading level="1" size="large">Prosjektstyring</Heading>

                {error && <Alert variant="error">{error}</Alert>}
                {message && <Alert variant="success">{message}</Alert>}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3 p-4 border rounded-md">
                        <Heading level="2" size="small">Prosjekter</Heading>
                        <Select
                            label="Velg prosjekt"
                            size="small"
                            value={selectedProjectId ?? ''}
                            onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">-</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} (#{p.id})</option>)}
                        </Select>
                        <TextField label="Navn" size="small" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                        <TextField label="Beskrivelse" size="small" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
                        <Button size="small" onClick={createProject} loading={loading}>Opprett prosjekt</Button>
                    </div>

                    <div className="space-y-3 p-4 border rounded-md">
                        <Heading level="2" size="small">Dashboards</Heading>
                        <Select
                            label="Velg dashboard"
                            size="small"
                            value={selectedDashboardId ?? ''}
                            onChange={(e) => setSelectedDashboardId(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">-</option>
                            {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>)}
                        </Select>
                        <TextField label="Navn" size="small" value={dashboardName} onChange={(e) => setDashboardName(e.target.value)} />
                        <TextField label="Beskrivelse" size="small" value={dashboardDescription} onChange={(e) => setDashboardDescription(e.target.value)} />
                        <Button size="small" onClick={createDashboard} loading={loading}>Opprett dashboard</Button>
                    </div>

                    <div className="space-y-3 p-4 border rounded-md">
                        <Heading level="2" size="small">Grafer</Heading>
                        <Select
                            label="Velg graf"
                            size="small"
                            value={selectedGraphId ?? ''}
                            onChange={(e) => setSelectedGraphId(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">-</option>
                            {graphs.map((g) => <option key={g.id} value={g.id}>{g.name} (#{g.id})</option>)}
                        </Select>
                        <TextField label="Navn" size="small" value={graphName} onChange={(e) => setGraphName(e.target.value)} />
                        <Select label="Graftype" size="small" value={graphType} onChange={(e) => setGraphType(e.target.value)}>
                            <option value="LINE">Linjediagram</option>
                            <option value="BAR">Stolpediagram</option>
                            <option value="PIE">Sektordiagram</option>
                            <option value="TABLE">Tabell</option>
                        </Select>
                        <Button size="small" onClick={createGraph} loading={loading}>Opprett graf</Button>
                    </div>

                    <div className="space-y-3 p-4 border rounded-md">
                        <Heading level="2" size="small">Spørringer</Heading>
                        <TextField label="Navn" size="small" value={queryName} onChange={(e) => setQueryName(e.target.value)} />
                        <Textarea label="SQL-tekst" size="small" minRows={6} value={querySql} onChange={(e) => setQuerySql(e.target.value)} />
                        <Button size="small" onClick={createQuery} loading={loading}>Opprett spørring</Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Heading level="2" size="small">Valgt kjede</Heading>
                    <BodyLong size="small">
                        Prosjekt: {selectedProject ? `${selectedProject.name} (#${selectedProject.id})` : '-'}
                        <br />
                        Dashboard: {selectedDashboard ? `${selectedDashboard.name} (#${selectedDashboard.id})` : '-'}
                        <br />
                        Graf: {selectedGraph ? `${selectedGraph.name} (#${selectedGraph.id})` : '-'}
                        <br />
                        Spørringer på graf: {queries.length}
                    </BodyLong>
                </div>
            </div>
        </Page.Block>
    );
};

export default ProjectManager;

