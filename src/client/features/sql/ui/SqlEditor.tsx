import { ResultsPanel } from '../../chartbuilder';
import ChartLayout from '../../analysis/ui/ChartLayoutOriginal.tsx';
import { Button, Alert, Heading, BodyLong, TextField, Link } from '@navikt/ds-react';
import Editor from '@monaco-editor/react';
import { PlayIcon, Copy, X } from 'lucide-react';
import { ReadMore } from '@navikt/ds-react';
import WebsitePicker from '../../analysis/ui/WebsitePicker.tsx';
import PeriodPicker from '../../analysis/ui/PeriodPicker.tsx';
import { getGcpProjectId, truncateJSON } from '../utils/formatters';
import { useSqlEditor } from '../hooks/useSqlEditor';

export default function SqlEditor() {
    const projectId = getGcpProjectId();
    const {
        query,
        result,
        estimate,
        loading,
        estimating,
        error,
        validateError,
        showValidation,
        showEstimate,
        shareSuccess,
        formatSuccess,
        lastProcessedSql,
        copiedMetabase,
        editorHeight,
        hasAttemptedFetch,
        oldTableWarning,
        showUpgradeSuccess,
        websiteId,
        period,
        dateRange,
        urlPath,
        selectedWebsite,
        customVariables,
        customVariableValues,
        hasMetabaseDateFilter,
        hasUrlPathFilter,
        hasWebsiteIdPlaceholder,
        hasNettsidePlaceholder,
        hasHardcodedWebsiteId,

        setEditorHeight,
        setShowValidation,
        setShowEstimate,
        setShowUpgradeSuccess,
        setUrlPath,
        setCustomVariableValues,

        handleQueryChange,
        handleWebsiteChange,
        handleUpgradeTables,
        handleAddDateFilter,
        handleCopyMetabase,
        handlePeriodChange,
        handleStartDateChange,
        handleEndDateChange,
        estimateCost,
        executeQuery,
        validateSQL,
        formatSQL,
        shareQuery,

        prepareLineChartData,
        prepareBarChartData,
        preparePieChartData,
    } = useSqlEditor();

    return (
        <ChartLayout
            title="Umami SQL-spørringer"
            description="Kjør SQL-spørringer mot Umami datasettet i BigQuery."
            currentPage="sql"
            wideSidebar={true}
            filters={
                <>
                    {/* Metabase-lignende filterkontroller (auto når placeholders finnes) */}
                    {(hasMetabaseDateFilter || hasUrlPathFilter || hasWebsiteIdPlaceholder || hasNettsidePlaceholder || hasHardcodedWebsiteId || customVariables.length > 0) && (
                        <>
                            <Heading size="xsmall" level="3" style={{ paddingBottom: '8px' }}>Filtre</Heading>
                            <div className="flex flex-col gap-4 mb-4 p-3 border border-[var(--ax-border-neutral-subtle)] rounded" style={{ backgroundColor: 'var(--ax-bg-default, #fff)' }}>
                                {(hasWebsiteIdPlaceholder || hasNettsidePlaceholder || hasHardcodedWebsiteId) && (
                                    <div className="flex-1 min-w-[260px]">
                                        <WebsitePicker
                                            selectedWebsite={selectedWebsite}
                                            onWebsiteChange={handleWebsiteChange}
                                            variant="minimal"
                                            disableAutoRestore={hasHardcodedWebsiteId}
                                            customLabel={hasHardcodedWebsiteId ? "Nettside eller app (overskriver SQL-koden)" : "Nettside eller app"}
                                        />
                                    </div>
                                )}

                                {hasMetabaseDateFilter && (
                                    <div className="flex-1 min-w-[260px]">
                                        <PeriodPicker
                                            period={period}
                                            onPeriodChange={handlePeriodChange}
                                            startDate={dateRange.from}
                                            onStartDateChange={handleStartDateChange}
                                            endDate={dateRange.to}
                                            onEndDateChange={handleEndDateChange}
                                        />
                                    </div>
                                )}

                                {hasUrlPathFilter && (
                                    <div className="flex-1 min-w-[240px]">
                                        <TextField
                                            label="URL"
                                            size="small"
                                            description="F.eks. / for forsiden"
                                            value={urlPath}
                                            onChange={(e) => setUrlPath(e.target.value)}
                                        />
                                    </div>
                                )}

                                {/* Custom variable inputs */}
                                {customVariables.map((varName) => (
                                    <div key={varName} className="flex-1 min-w-[200px]">
                                        <TextField
                                            label={varName.replace(/_/g, ' ')}
                                            size="small"
                                            value={customVariableValues[varName] || ''}
                                            onChange={(e) => setCustomVariableValues(prev => ({
                                                ...prev,
                                                [varName]: e.target.value
                                            }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <ReadMore header="Tilgjengelige tabeller" size="small" className="mt-4">
                        <ul className="space-y-3">
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Nettsider/apper</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{projectId}.umami.public_website</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami.public_website`); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Personer</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{projectId}.umami_views.session</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami_views.session`); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Alle hendelser</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{projectId}.umami_views.event</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami_views.event`); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Egenfedinerte hendelser metadata</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{projectId}.umami_views.event_data</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami_views.event_data`); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                        </ul>
                        <ReadMore header="Umami (legacy)" size="small" className="mt-6 mb-6">
                            <ul className="space-y-3">
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Nettsider/apper</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{projectId}.umami.public_website</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami.public_website`); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Personer</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{projectId}.umami.public_session</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami.public_session`); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Alle hendelser</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{`${projectId}.umami.public_website_event`}</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami.public_website_event`); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Egenfedinerte hendelser metadata</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">{`${projectId}.umami.public_event_data`}</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { void navigator.clipboard.writeText(`${projectId}.umami.public_event_data`); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                            </ul>
                        </ReadMore>
                    </ReadMore>

                    {/* Query Input */}
                    <div>
                        {/* Old Table Warning & Fix */}
                        {oldTableWarning && (
                            <Alert variant="warning" className="mb-4">
                                <Heading level="3" size="small" spacing>
                                    Utdaterte tabeller oppdaget
                                </Heading>
                                <BodyLong>
                                    Spørringen din bruker gamle tabellnavn. Vi anbefaler å bytte til de nye <code>umami_views</code> tabellene:
                                    <ul className="list-disc list-inside mt-2 text-sm">
                                        <li><code>public_website_event</code> &rarr; <code>umami_views.event</code></li>
                                        <li><code>public_session</code> &rarr; <code>umami_views.session</code></li>
                                    </ul>
                                </BodyLong>
                                <div className="mt-3">
                                    <Button
                                        size="small"
                                        variant="primary"
                                        onClick={handleUpgradeTables}
                                    >
                                        Oppdater SQL-spørringen til nye tabeller
                                    </Button>
                                </div>
                            </Alert>
                        )}

                        {/* Success Message */}
                        {showUpgradeSuccess && (
                            <Alert variant="success" className="mb-4 relative">
                                <Heading level="3" size="small" spacing>
                                    Tabeller oppgradert!
                                </Heading>
                                <BodyLong>
                                    SQL-spørringen er nå oppdatert til å bruke nye tabeller (<code>umami_views</code>).
                                </BodyLong>
                                <button
                                    onClick={() => setShowUpgradeSuccess(false)}
                                    className="absolute right-3 top-3 p-1 hover:bg-[var(--ax-bg-neutral-soft)] rounded text-[var(--ax-text-default)]"
                                    aria-label="Lukk melding"
                                    type="button"
                                >
                                    <X size={20} />
                                </button>
                            </Alert>
                        )}

                        <label className="block font-medium mb-2" htmlFor="sql-editor">SQL-spørring</label>
                        <div
                            className="border rounded resize-y overflow-auto"
                            style={{ position: 'relative', isolation: 'isolate', minHeight: 100, maxHeight: 600, height: editorHeight }}
                            onMouseUp={e => {
                                const target = e.currentTarget as HTMLDivElement;
                                setEditorHeight(target.offsetHeight);
                            }}
                        >
                            <Editor
                                height={editorHeight}
                                defaultLanguage="sql"
                                value={query}
                                onChange={(value) => handleQueryChange(value || '')}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    tabSize: 2,
                                    wordWrap: 'on',
                                    fixedOverflowWidgets: true,
                                    stickyScroll: { enabled: false },
                                    lineNumbersMinChars: 4,
                                    glyphMargin: false,
                                }}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <Button size="small" variant="secondary" type="button" onClick={formatSQL}>
                                {formatSuccess ? '✓ Formatert' : 'Formater'}
                            </Button>
                            <Button size="small" variant="secondary" type="button" onClick={validateSQL}>Valider</Button>
                            <Button
                                size="small"
                                variant="secondary"
                                type="button"
                                onClick={estimateCost}
                                loading={estimating}
                            >
                                Estimer kostnad
                            </Button>
                            <Button
                                size="small"
                                variant="secondary"
                                type="button"
                                onClick={shareQuery}
                            >
                                {shareSuccess ? '✓ Kopiert' : 'Del'}
                            </Button>
                        </div>
                        {showValidation && validateError && (
                            <div
                                className={`relative rounded px-3 py-2 mt-2 text-sm ${validateError === 'SQL er gyldig!' ? 'bg-[var(--ax-bg-success-soft)] border border-[var(--ax-border-success-subtle)] text-[var(--ax-text-success)]' : 'bg-[var(--ax-bg-danger-soft)] border border-[var(--ax-border-danger-subtle)] text-[var(--ax-text-danger)]'}`}
                            >
                                <span>{validateError}</span>
                                <button
                                    type="button"
                                    aria-label="Lukk"
                                    onClick={() => setShowValidation(false)}
                                    className="absolute right-2 top-2 font-bold cursor-pointer"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Cost Estimate Display */}
                    {estimate && showEstimate && (
                        <Alert variant="info" className="relative" size="small" style={{ marginTop: 24 }}>
                            <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => setShowEstimate(false)}
                                className="absolute right-2 top-2 font-bold cursor-pointer"
                            >
                                ×
                            </button>
                            <div className="space-y-1 text-sm">
                                {(() => {
                                    const gb = Number(estimate.totalBytesProcessedGB ?? 0);
                                    const cost = Number(estimate.estimatedCostUSD ?? NaN) || (isFinite(gb) ? gb * 0.00625 : 0);
                                    return (
                                        <>
                                            <div>
                                                <strong>Data:</strong>
                                                {isFinite(gb) && gb >= 0.01 ? ` ${gb} GB` : ''}
                                            </div>
                                            {cost > 0 && (
                                                <div>
                                                    <strong>Kostnad:</strong> ${cost.toFixed(2)} USD
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                {estimate.cacheHit && (
                                    <div className="text-[var(--ax-text-success)]">
                                        ✓ Cached (no cost)
                                    </div>
                                )}
                            </div>
                        </Alert>
                    )}

                    {/* Submit Buttons */}
                    <div className="flex flex-wrap gap-2 mt-6">
                        <Button
                            onClick={executeQuery}
                            loading={loading}
                            icon={<PlayIcon size={18} />}
                            variant="primary"
                        >
                            Vis resultater
                        </Button>
                    </div>
                </>
            }
        >


            {/* Error Display */}
            {error && (
                <Alert variant="error" className="mb-4">
                    <Heading level="3" size="small" spacing>
                        Query Error
                    </Heading>
                    <BodyLong>{error}</BodyLong>

                    {/* Helper button for partition error */}
                    {error.includes("partition elimination") && error.includes("created_at") && (
                        <div className="mt-3">
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={handleAddDateFilter}
                            >
                                Legg til datofilter [[AND {"{{created_at}}"}]]
                            </Button>
                            <p className="text-sm mt-2 text-[var(--ax-text-subtle)]">
                                Tabellen krever et filter på created_at for partisjonering
                            </p>
                        </div>
                    )}

                    {lastProcessedSql && (
                        <ReadMore header="SQL etter filtre" size="small" className="mt-3">
                            <pre className="bg-[var(--ax-bg-neutral-soft)] border border-[var(--ax-border-neutral-subtle)] rounded p-3 text-xs font-mono whitespace-pre-wrap" style={{ margin: 0 }}>
                                {lastProcessedSql}
                            </pre>
                        </ReadMore>
                    )}
                </Alert>
            )}

            {/* Results Display Area */}
            {hasAttemptedFetch && (
                <>
                    <ResultsPanel
                        result={result}
                        loading={loading}
                        error={error}
                        queryStats={result?.queryStats || estimate}
                        lastAction={null}
                        showLoadingMessage={estimating || loading}
                        executeQuery={executeQuery}
                        handleRetry={executeQuery}
                        prepareLineChartData={prepareLineChartData}
                        prepareBarChartData={prepareBarChartData}
                        preparePieChartData={preparePieChartData}
                        sql={lastProcessedSql || query}
                        showSqlCode={true}
                        showEditButton={true}
                        showCost={true}
                        websiteId={websiteId}
                    />

                    {/* JSON Output - below results */}
                    {result && (
                        <ReadMore header="JSON" size="small" className="mt-6">
                            <pre className="bg-[var(--ax-bg-neutral-soft)] border border-gray-300 rounded p-3 text-xs font-mono whitespace-pre-wrap" style={{ margin: 0 }}>{truncateJSON(result)}</pre>
                        </ReadMore>
                    )}

                    {/* Metabase quick actions */}
                    <div className="mt-6 pt-2 space-y-1.5">
                        <Heading level="3" size="xsmall">Legg til i Metabase</Heading>
                        <div className="h-1" aria-hidden="true" />
                        <div className="flex flex-col items-start gap-2">
                            <Button
                                size="small"
                                variant="secondary"
                                type="button"
                                onClick={handleCopyMetabase}
                                icon={<Copy size={16} />}
                            >
                                {copiedMetabase ? 'Kopiert!' : 'Kopier spørring'}
                            </Button>
                            <div className="pl-[2px]">
                                <Link
                                    href="https://metabase.ansatt.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImRhdGFiYXNlIjo3MzEsInR5cGUiOiJuYXRpdmUiLCJuYXRpdmUiOnsicXVlcnkiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX19LCJkaXNwbGF5IjoidGFibGUiLCJ2aXN1YWxpemF0aW9uX3NldHRpbmdzIjp7fSwidHlwZSI6InF1ZXN0aW9uIn0="
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm"
                                >
                                    Åpne Metabase
                                </Link>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </ChartLayout>
    );
}
