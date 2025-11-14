import { useState } from 'react';
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

            <div className="space-y-6">
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
                        Kjør spørring
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

                {/* Results Display */}
                {result && (
                    <div className="space-y-4">
                         {/* 
                        <Alert variant="success">
                            Query kjørte vellyket. Returned {result.rowCount} rows.
                        </Alert>*/}

                        {result.data && result.data.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-gray-50 p-4">
                                    <Heading level="2" size="medium">
                                        Resultater
                                    </Heading>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                {Object.keys(result.data[0]).map((key) => (
                                                    <th
                                                        key={key}
                                                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                                                    >
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {result.data.map((row: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    {Object.values(row).map((value: any, cellIdx: number) => (
                                                        <td
                                                            key={cellIdx}
                                                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                                        >
                                                            {value !== null && value !== undefined
                                                                ? String(value)
                                                                : '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Raw JSON Output */}
                        <details className="border rounded-lg p-4">
                            <summary className="cursor-pointer font-medium">
                                View Raw JSON
                            </summary>
                            <pre className="mt-4 p-4 bg-gray-50 rounded overflow-x-auto text-sm">
                                {JSON.stringify(result.data, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}
