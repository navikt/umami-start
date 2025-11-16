import { useState } from 'react';
import ResultsDisplay from '../components/chartbuilder/ResultsDisplay';
import { Button, Textarea, Alert, Heading, BodyLong } from '@navikt/ds-react';
import { PlayIcon } from 'lucide-react';

const defaultQuery = `SELECT 
  website_id, 
  name 
FROM \`team-researchops-prod-01d6.umami.public_website\`
LIMIT 100`;

// Alternative query to list datasets if the above doesn't work:
// SELECT schema_name FROM \`team-researchops-prod-01d6.INFORMATION_SCHEMA.SCHEMATA\`
export default function BigQuery() {
    const [query, setQuery] = useState(defaultQuery);
    const [result, setResult] = useState<any>(null);
    const [estimate, setEstimate] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [estimating, setEstimating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const estimateCost = async () => {
        setEstimating(true);
        setError(null);

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

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Heading level="1" size="large" spacing>
                BigQuery spørringer
            </Heading>
            <BodyLong spacing>
                Kjør BigQuery spørringer mot Umami datasett.
            </BodyLong>
            <div className="flex flex-col md:flex-row gap-8 mt-8">
                {/* Main content */}
                <div className="flex-1 space-y-6">
                    {/* Query Input */}
                    <div>
                        <Textarea
                            label="SQL Query"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            minRows={8}
                        />
                    </div>
                    {/* Submit Button */}
                    <div className="flex gap-4">
                        <Button
                            onClick={estimateCost}
                            loading={estimating}
                            variant="secondary"
                        >
                            Estimer kostnad
                        </Button>
                        <Button
                            onClick={executeQuery}
                            loading={loading}
                            icon={<PlayIcon size={18} />}
                            variant="primary"
                        >
                            Vis resultater
                        </Button>
                    </div>
                    {/* Cost Estimate Display */}
                    {estimate && (
                        <Alert variant="info">
                            <Heading level="3" size="small" spacing>
                                Kostnadsestimator
                            </Heading>
                            <div className="space-y-2">
                                <BodyLong>
                                    <strong>Data å prossesere:</strong> {estimate.totalBytesProcessedMB} MB 
                                    {parseFloat(estimate.totalBytesProcessedGB) >= 0.01 && ` (${estimate.totalBytesProcessedGB} GB)`}
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
                </div>
                {/* Aside: ResultsDisplay */}
                <aside className="w-full md:w-[420px] lg:w-[500px] xl:w-[600px] shrink-0">
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
// ...no trailing brace needed here, already closed by the function above
