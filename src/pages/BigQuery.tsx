import { useState, useEffect } from 'react';
import ResultsDisplay from '../components/chartbuilder/ResultsDisplay';
import { Button, Alert, Heading, BodyLong } from '@navikt/ds-react';
import Editor from '@monaco-editor/react';
import * as sqlFormatter from 'sql-formatter';
import { PlayIcon } from 'lucide-react';
import { ReadMore } from '@navikt/ds-react';

const defaultQuery = `SELECT 
  website_id,
  name
FROM 
  \`team-researchops-prod-01d6.umami.public_website\`
LIMIT 
  100;`;

// Alternative query to list datasets if the above doesn't work:
// SELECT schema_name FROM \`team-researchops-prod-01d6.INFORMATION_SCHEMA.SCHEMATA\`
export default function BigQuery() {
    // State for editor height (for resizable editor)
    const [editorHeight, setEditorHeight] = useState(400);
    // Initialize state with empty string to avoid showing default until we check URL
    const [query, setQuery] = useState('');
    const [validateError, setValidateError] = useState<string | null>(null);
        const [showValidation, setShowValidation] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [estimate, setEstimate] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [estimating, setEstimating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEstimate, setShowEstimate] = useState(true);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [formatSuccess, setFormatSuccess] = useState(false);

    // Check for SQL in URL params on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sqlParam = urlParams.get('sql');
        
        console.log('URL search params:', window.location.search);
        console.log('SQL param:', sqlParam);
        
        if (sqlParam) {
            try {
                // URL params are already decoded by URLSearchParams
                console.log('Setting query to:', sqlParam);
                setQuery(sqlParam);
            } catch (e) {
                console.error('Failed to set SQL parameter:', e);
                setQuery(defaultQuery);
            }
        } else {
            // No SQL param, use default
            setQuery(defaultQuery);
        }
    }, []);

    const estimateCost = async () => {
        setEstimating(true);
        setError(null);

        // Update URL with current query
        const encodedSql = encodeURIComponent(query);
        window.history.replaceState({}, '', `/sql?sql=${encodedSql}`);

        try {
            const response = await fetch('/api/bigquery/estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Estimation failed');
            }

            setEstimate(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setEstimating(false);
        }
    };

    const executeQuery = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        // Update URL with current query
        const encodedSql = encodeURIComponent(query);
        window.history.replaceState({}, '', `/sql?sql=${encodedSql}`);

        try {
            const response = await fetch('/api/bigquery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Query failed');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    // Simple SQL validation: check for empty input and basic SELECT/statement
    const validateSQL = () => {
        // Update URL with current query
        const encodedSql = encodeURIComponent(query);
        window.history.replaceState({}, '', `/sql?sql=${encodedSql}`);

        if (!query.trim()) {
            setValidateError('SQL kan ikke være tom.');
            setShowValidation(true);
            return false;
        }
        // Basic check for SQL command
        const valid = /\b(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|DROP|ALTER|SHOW|DESCRIBE)\b/i.test(query);
        if (!valid) {
            setValidateError('SQL må inneholde en gyldig kommando (f.eks. SELECT, INSERT, ...).');
            setShowValidation(true);
            return false;
        }
        // Try formatting to catch syntax errors
        try {
            sqlFormatter.format(query);
            setValidateError('SQL er gyldig!');
            setShowValidation(true);
            return true;
        } catch (e: any) {
            setValidateError('Ugyldig SQL: ' + (e.message || 'Syntaksfeil'));
            setShowValidation(true);
            return false;
        }
    };

    const formatSQL = () => {
        // Update URL with current query
        const encodedSql = encodeURIComponent(query);
        window.history.replaceState({}, '', `/sql?sql=${encodedSql}`);

        try {
            const formatted = sqlFormatter.format(query);
            setQuery(formatted);
            setFormatSuccess(true);
            setTimeout(() => setFormatSuccess(false), 2000);
        } catch (e) {
            setValidateError('Kunne ikke formatere SQL. Sjekk om den er gyldig.');
            setShowValidation(true);
        }
    };

    const shareQuery = () => {
        const encodedSql = encodeURIComponent(query);
        const shareUrl = `${window.location.origin}/sql?sql=${encodedSql}`;
        navigator.clipboard.writeText(shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
    };

    // Clear validation message on edit
    const handleQueryChange = (val: string) => {
        setQuery(val);
        setShowValidation(false);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Heading level="1" size="large" spacing>
                Umami SQL-spørringer
            </Heading>
            <BodyLong spacing>
                Kjør SQL-spørringer mot Umami datasettet i BigQuery.
            </BodyLong>
            <div className="flex flex-col md:flex-row gap-8 -mt-3 min-w-0">
                {/* Main content */}
                <div className="flex-1 space-y-6 min-w-0">
                    {/* Available Tables Section using ReadMore with subtitles */}
                    <ReadMore header="Tilgjengelige tabeller" size="small" className="mb-6">
                        <ul className="space-y-3">
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Nettsider/apper</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">team-researchops-prod-01d6.umami.public_website</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_website'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Personer</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">team-researchops-prod-01d6.umami.public_session</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_session'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Alle hendelser</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">team-researchops-prod-01d6.umami.public_website_event</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_website_event'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Egenfedinerte hendelser metadata</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">team-researchops-prod-01d6.umami.public_event_data</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_event_data'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                        </ul>
                    </ReadMore>
                    {/* Query Input */}
                    <div>
                        <label className="block font-medium mb-2" htmlFor="sql-editor">SQL-spørring</label>
                        <div
                            className="border rounded resize-y overflow-auto"
                            style={{ position: 'relative', isolation: 'isolate', minHeight: 100, maxHeight: 800, height: editorHeight }}
                            onMouseUp={e => {
                                // On mouse up, update the editor height to the container's height
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
                        <div className="flex gap-2 mt-2 mb-4">
                            <Button size="small" variant="secondary" type="button" onClick={formatSQL}>
                                {formatSuccess ? '✓ Formatert' : 'Formater SQL'}
                            </Button>
                            <Button size="small" variant="secondary" type="button" onClick={validateSQL}>Valider SQL</Button>
                            <Button 
                                size="small" 
                                variant="secondary" 
                                type="button" 
                                onClick={shareQuery}
                            >
                                {shareSuccess ? '✓ Lenke kopiert' : 'Del spørring'}
                            </Button>
                        </div>
                        {showValidation && validateError && (
                            <div
                                className={`relative rounded px-4 py-3 mb-2 ${validateError === 'SQL er gyldig!' ? 'bg-green-100 border border-green-400 text-green-800' : 'bg-red-100 border border-red-400 text-red-800'}`}
                                style={{ fontFamily: 'Menlo, Monaco, "Fira Mono", monospace', fontSize: 14, minHeight: 36 }}
                            >
                                <span>{validateError}</span>
                                <button
                                    type="button"
                                    aria-label="Lukk"
                                    onClick={() => setShowValidation(false)}
                                    style={{
                                        position: 'absolute',
                                        right: 8,
                                        top: 8,
                                        background: 'none',
                                        border: 'none',
                                        color: 'inherit',
                                        fontWeight: 'bold',
                                        fontSize: 18,
                                        cursor: 'pointer',
                                        lineHeight: 1,
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Submit Button */}
                    <div className="flex gap-2">
                        <Button
                            onClick={executeQuery}
                            loading={loading}
                            icon={<PlayIcon size={18} />}
                            variant="primary"
                        >
                            Vis resultater
                        </Button>
                                                <Button
                            onClick={estimateCost}
                            loading={estimating}
                            variant="secondary"
                        >
                            Estimer kostnad
                        </Button>
                    </div>
                    {/* Cost Estimate Display */}
                    {estimate && showEstimate && (
                        <Alert variant="info" className="relative">
                            <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => setShowEstimate(false)}
                                style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: 8,
                                    background: 'none',
                                    border: 'none',
                                    color: 'inherit',
                                    fontWeight: 'bold',
                                    fontSize: 18,
                                    cursor: 'pointer',
                                    lineHeight: 1,
                                }}
                            >
                                ×
                            </button>
                            <div className="space-y-2">
                                <BodyLong>
                                    <strong>Data å prossesere:</strong>
                                    {parseFloat(estimate.totalBytesProcessedGB) >= 0.01 && ` ${estimate.totalBytesProcessedGB} GB`}
                                </BodyLong>
                                {parseFloat(estimate.estimatedCostUSD) > 0 && (
                                    <BodyLong>
                                        <strong>Estimert kostnad:</strong> ${estimate.estimatedCostUSD} USD
                                    </BodyLong>
                                )}
                                {estimate.cacheHit && (
                                    <BodyLong className="text-green-700">
                                        ✓ This query will use cached results (no cost)
                                    </BodyLong>
                                )}
                            </div>
                        </Alert>
                    )}
                    {/* Error Display */}
                    {error && (
                        <Alert variant="error">
                            <Heading level="3" size="small" spacing>
                                Query Error
                            </Heading>
                            <BodyLong>{error}</BodyLong>
                        </Alert>
                    )}

                        {result && (
                            <ReadMore header="Raw JSON" size="small" className="mb-4" defaultOpen>
                                <pre className="bg-gray-100 border border-gray-300 rounded p-3 text-xs font-mono whitespace-pre-wrap" style={{ margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
                            </ReadMore>
                        )}
                </div>

                
                {/* Aside: ResultsDisplay */}
                <aside className="w-full md:w-[420px] lg:w-[500px] xl:w-[600px] md:min-w-0 flex-shrink">
                    <ResultsDisplay
                        result={result}
                        loading={loading}
                        error={error}
                        queryStats={estimate}
                        lastAction={null}
                        showLoadingMessage={estimating || loading}
                        executeQuery={executeQuery}
                        handleRetry={executeQuery}
                        prepareLineChartData={() => null}
                        prepareBarChartData={() => null}
                        preparePieChartData={() => null}
                    />
                </aside>
            </div>
        </div>
    );
}
