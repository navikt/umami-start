import { useState } from 'react';
import { Heading, Button, Alert, Tabs, Search, Switch, ReadMore } from '@navikt/ds-react';
import { PlayIcon, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { utils as XLSXUtils, write as XLSXWrite } from 'xlsx';
import { LineChart, ILineChartProps, VerticalBarChart, IVerticalBarChartProps, AreaChart, PieChart } from '@fluentui/react-charting';
import { translateValue } from '../../lib/translations';

interface ResultsDisplayProps {
  result: any;
  loading: boolean;
  error: string | null;
  queryStats: any;
  lastAction: 'copy' | 'estimate' | 'execute' | 'run' | null;
  showLoadingMessage: boolean;
  executeQuery: () => void;
  handleRetry: () => void;
  prepareLineChartData: (includeAverage?: boolean) => ILineChartProps | null;
  prepareBarChartData: () => IVerticalBarChartProps | null;
  preparePieChartData: () => { data: Array<{ y: number; x: string }>; total: number } | null;
}

const ResultsDisplay = ({
  result,
  loading,
  error,
  queryStats,
  lastAction,
  showLoadingMessage,
  executeQuery,
  handleRetry,
  prepareLineChartData,
  prepareBarChartData,
  preparePieChartData,
}: ResultsDisplayProps) => {
  const [activeTab, setActiveTab] = useState<string>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAverage, setShowAverage] = useState<boolean>(false);
  const [isPercentageStacked, setIsPercentageStacked] = useState<boolean>(false);

  // Handler for sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Function to convert results to CSV
  const downloadCSV = () => {
    if (!result || !result.data || result.data.length === 0) return;

    const headers = Object.keys(result.data[0]);
    const csvRows = [
      headers.join(','), // Header row
      ...result.data.map((row: any) =>
        headers
          .map((header) => {
            const value = row[header];
            const translatedValue = translateValue(header, value);
            // Escape quotes and wrap in quotes if contains comma or quote
            const stringValue = translatedValue !== null && translatedValue !== undefined ? String(translatedValue) : '';
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel compatibility
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to convert results to a real XLSX file
  const downloadExcel = () => {
    if (!result || !result.data || result.data.length === 0) return;

    const headers = Object.keys(result.data[0]);
    const worksheetData = [
      headers,
      ...result.data.map((row: any) =>
        headers.map((header) => {
          const value = row[header];
          const translatedValue = translateValue(header, value);
          return translatedValue !== null && translatedValue !== undefined ? translatedValue : '';
        })
      ),
    ];

    const worksheet = XLSXUtils.aoa_to_sheet(worksheetData);
    const workbook = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(workbook, worksheet, 'Query Results');

    const wbout = XLSXWrite(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Function to convert results to JSON
  const downloadJSON = () => {
    if (!result || !result.data || result.data.length === 0) return;

    // Create translated data for JSON export
    const translatedData = result.data.map((row: any) => {
      const translatedRow: any = {};
      Object.keys(row).forEach((key) => {
        translatedRow[key] = translateValue(key, row[key]);
      });
      return translatedRow;
    });

    const jsonContent = JSON.stringify(translatedData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 10)}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Function to convert results to JSONL (JSON Lines)
  const downloadJSONL = () => {
    if (!result || !result.data || result.data.length === 0) return;

    // Create translated data for JSONL export (one JSON object per line)
    const jsonlContent = result.data
      .map((row: any) => {
        const translatedRow: any = {};
        Object.keys(row).forEach((key) => {
          translatedRow[key] = translateValue(key, row[key]);
        });
        return JSON.stringify(translatedRow);
      })
      .join('\n');

    const blob = new Blob([jsonlContent], { type: 'application/jsonl;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 10)}.jsonl`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2 mb-6">
      <Heading level="2" size="small">Vis resultater</Heading>
      
      <div className="bg-green-50 p-4 rounded-md border border-green-100">
        {/* Only show button if no results yet */}
        {!result && !error && (
          <div className="space-y-2">
            <Button
              onClick={executeQuery}
              loading={loading}
              icon={<PlayIcon size={18} />}
              variant="primary"
              size="medium"
            >
              Vis resultater
            </Button>
            {loading && showLoadingMessage && (
              <Alert variant="info" className="text-sm">
                <p className="font-medium">Spørring kjører...</p>
                <p className="mt-1">Dette kan ta opptil 20-30 sekunder for store datasett. Vennligst vent.</p>
              </Alert>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="error" className="mt-3">
            <div className="text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <p className="font-medium">Feil ved kjøring</p>
                <p className="mt-1">{error}</p>
              </div>
              {lastAction && (
                <div className="flex-shrink-0">
                  <Button size="small" variant="primary" onClick={handleRetry}>
                    Prøv igjen
                  </Button>
                </div>
              )}
            </div>
          </Alert>
        )}

        {/* Results Display */}
        {result && result.data && result.data.length > 0 && (
          <div className="mt-2 space-y-3">
            {/* Tabbed Display */}
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="table" label="Tabell" />
                <Tabs.Tab value="linechart" label="Linje" />
                <Tabs.Tab value="areachart" label="Område" />
                <Tabs.Tab value="barchart" label="Stolpe" />
                <Tabs.Tab value="piechart" label="Kake" />
              </Tabs.List>

              {/* Table Tab */}
              <Tabs.Panel value="table" className="pt-4">
                <div className="space-y-3">
                  <div className="border rounded-lg overflow-hidden bg-white">
                    {/* Search Input */}
                    <div className="p-3 bg-gray-50 border-b">
                      <Search
                        label="Søk i tabellen"
                        hideLabel={false}
                        size="small"
                        value={searchQuery}
                        onChange={(value) => setSearchQuery(value)}
                        onClear={() => setSearchQuery('')}
                        variant="simple"
                      />
                    </div>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      {(() => {
                        // Filter the data based on search query
                        const filteredData = result.data.filter((row: any) => {
                          if (!searchQuery) return true;
                          
                          const query = searchQuery.toLowerCase();
                          return Object.values(row).some((value: any) => {
                            if (value === null || value === undefined) return false;
                            return String(value).toLowerCase().includes(query);
                          });
                        });

                        // Sort the filtered data
                        const sortedData = sortColumn 
                          ? [...filteredData].sort((a: any, b: any) => {
                              const aVal = a[sortColumn];
                              const bVal = b[sortColumn];
                              
                              // Handle null/undefined values
                              if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
                              if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;
                              
                              // Numeric comparison
                              if (typeof aVal === 'number' && typeof bVal === 'number') {
                                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                              }
                              
                              // String comparison
                              const aStr = String(aVal).toLowerCase();
                              const bStr = String(bVal).toLowerCase();
                              
                              if (sortDirection === 'asc') {
                                return aStr.localeCompare(bStr, 'nb-NO');
                              } else {
                                return bStr.localeCompare(aStr, 'nb-NO');
                              }
                            })
                          : filteredData;

                        if (sortedData.length === 0) {
                          return (
                            <div className="p-8 text-center text-gray-500">
                              <p>Ingen resultater funnet for "{searchQuery}"</p>
                            </div>
                          );
                        }

                        return (
                          <>
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                  {Object.keys(result.data[0]).map((key) => (
                                    <th
                                      key={key}
                                      className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 select-none"
                                      onClick={() => handleSort(key)}
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{key}</span>
                                        {sortColumn === key ? (
                                          sortDirection === 'asc' ? (
                                            <ArrowUp size={14} className="text-blue-600" />
                                          ) : (
                                            <ArrowDown size={14} className="text-blue-600" />
                                          )
                                        ) : (
                                          <ArrowUpDown size={14} className="text-gray-400" />
                                        )}
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {sortedData.map((row: any, idx: number) => {
                                  const keys = Object.keys(row);
                                  return (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      {keys.map((key, cellIdx: number) => {
                                        const value = row[key];
                                        const translatedValue = translateValue(key, value);
                                        return (
                                          <td
                                            key={cellIdx}
                                            className="px-4 py-2 whitespace-nowrap text-sm text-gray-900"
                                          >
                                            {typeof translatedValue === 'number'
                                              ? translatedValue.toLocaleString('nb-NO')
                                              : translatedValue !== null && translatedValue !== undefined
                                              ? String(translatedValue)
                                              : '-'}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </>
                        );
                      })()}
                    </div>
                    {/* Table Footer */}
                    <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 border-t">
                      <div className="flex justify-between items-center">
                        <span>
                          {searchQuery ? (
                            <>Viser {result.data.filter((row: any) => {
                              const query = searchQuery.toLowerCase();
                              return Object.values(row).some((value: any) => {
                                if (value === null || value === undefined) return false;
                                return String(value).toLowerCase().includes(query);
                              });
                            }).length} av {result.data.length} rader</>
                          ) : (
                            <>{result.data.length} {result.data.length === 1 ? 'rad' : 'rader'}</>
                          )}
                        </span>
                        {queryStats && (
                          <span>
                            Data prosessert: {queryStats.totalBytesProcessedGB} GB
                            {parseFloat(queryStats.estimatedCostUSD) > 0 && ` • Kostnad: $${queryStats.estimatedCostUSD}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Tabs.Panel>

              {/* Line Chart Tab */}
              <Tabs.Panel value="linechart" className="pt-4">
                <div className="border rounded-lg bg-white p-4">
                  {(() => {
                    const chartData = prepareLineChartData(showAverage);
                    console.log('Line Chart Data:', chartData);
                    console.log('Raw Result Data:', result.data);
                    
                    if (!chartData) {
                      return (
                        <Alert variant="info">
                          Kunne ikke lage linjediagram fra dataene. Trenger minst to kolonner (x-akse og y-akse).
                        </Alert>
                      );
                    }
                    return (
                      <div style={{ overflow: 'visible' }}>
                        <div className="mb-3">
                          <Switch
                            checked={showAverage}
                            onChange={(e) => setShowAverage(e.target.checked)}
                            size="small"
                          >
                            Vis gjennomsnitt
                          </Switch>
                        </div>
                        <LineChart
                          data={chartData.data}
                          height={400}
                          legendsOverflowText="Flere"
                          yAxisTickCount={10}
                          allowMultipleShapesForPoints={false}
                          enablePerfOptimization={true}
                          width={700}
                          margins={{ left: 50, right: 40, top: 20, bottom: 35 }}
                        />
                        <div className="mt-2 text-xs text-gray-500">
                          Viser {chartData.data.lineChartData?.[0]?.data?.length || 0} datapunkter
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Tabs.Panel>

              {/* Area Chart Tab */}
              <Tabs.Panel value="areachart" className="pt-4">
                <div className="border rounded-lg bg-white p-4">
                  {(() => {
                    const baseChartData = prepareLineChartData(false);
                    
                    if (!baseChartData) {
                      return (
                        <Alert variant="info">
                          Kunne ikke lage områdediagram fra dataene. Trenger minst til kolonner (x-akse og y-akse).
                        </Alert>
                      );
                    }
                    
                    // Check if we have multiple series
                    const hasMultipleSeries = baseChartData.data.lineChartData && baseChartData.data.lineChartData.length > 1;
                    
                    // Transform data for percentage view if needed
                    let chartData = baseChartData;
                    if (isPercentageStacked && baseChartData.data.lineChartData) {
                      // Create a map of x values to total y values
                      const xTotals = new Map<number, number>();
                      
                      // Calculate totals for each x value
                      baseChartData.data.lineChartData.forEach((series: any) => {
                        series.data.forEach((point: any) => {
                          const xVal = point.x instanceof Date ? point.x.getTime() : Number(point.x);
                          const currentTotal = xTotals.get(xVal) || 0;
                          xTotals.set(xVal, currentTotal + point.y);
                        });
                      });
                      
                      // Transform each series to percentages
                      const percentageData = baseChartData.data.lineChartData.map((series: any) => ({
                        ...series,
                        data: series.data.map((point: any) => {
                          const xVal = point.x instanceof Date ? point.x.getTime() : Number(point.x);
                          const total = xTotals.get(xVal) || 1;
                          const percentage = (point.y / total) * 100;
                          
                          return {
                            ...point,
                            y: percentage,
                            yAxisCalloutData: `${percentage.toFixed(1)}%`,
                            originalY: point.y,
                          };
                        }),
                      }));
                      
                      chartData = {
                        ...baseChartData,
                        data: {
                          lineChartData: percentageData,
                        },
                      };
                    }
                    
                    return (
                      <div style={{ overflow: 'visible' }}>
                        {hasMultipleSeries && (
                          <div className="mb-3">
                            <Switch
                              checked={isPercentageStacked}
                              onChange={(e) => setIsPercentageStacked(e.target.checked)}
                              size="small"
                            >
                              Stablet 100%
                            </Switch>
                          </div>
                        )}
                        <AreaChart
                          data={chartData.data}
                          height={400}
                          legendsOverflowText="Flere"
                          yAxisTickCount={isPercentageStacked ? 5 : 10}
                          width={700}
                          enablePerfOptimization={true}
                          margins={{ left: 50, right: 50, top: 20, bottom: 35 }}
                          yMinValue={isPercentageStacked ? 0 : undefined}
                          yMaxValue={isPercentageStacked ? 100 : undefined}
                        />
                        <div className="mt-2 text-xs text-gray-500">
                          Viser {chartData.data.lineChartData?.[0]?.data?.length || 0} datapunkter
                          {isPercentageStacked && ' (prosent av totalen per tidspunkt)'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Tabs.Panel>

              {/* Bar Chart Tab */}
              <Tabs.Panel value="barchart" className="pt-4">
                <div className="border rounded-lg bg-white p-4">
                  {(() => {
                    const chartData = prepareBarChartData();
                    console.log('Bar Chart Data:', chartData);
                    
                    // Check if too many items
                    if (result && result.data && result.data.length > 12) {
                      return (
                        <Alert variant="info">
                          Stolpediagram vises kun for resultater med maks 12 rader. Dette resultatet har {result.data.length} rader.
                        </Alert>
                      );
                    }
                    
                    if (!chartData || !chartData.data || (Array.isArray(chartData.data) && chartData.data.length === 0)) {
                      return (
                        <Alert variant="info">
                          Kunne ikke lage stolpediagram fra dataene. Trenger minst to kolonner (kategori og verdi).
                        </Alert>
                      );
                    }
                    return (
                      <div className="w-full">
                        <div className="overflow-y-auto max-h-[500px]" style={{ overflow: 'visible' }}>
                          <style>{`
                            .bar-chart-hide-xaxis .ms-Chart-xAxis text,
                            .bar-chart-hide-xaxis g[class*="xAxis"] text {
                              display: none !important;
                            }
                          `}</style>
                          <div className="bar-chart-hide-xaxis">
                            <VerticalBarChart
                              data={chartData.data}
                              barWidth={chartData.barWidth}
                              yAxisTickCount={chartData.yAxisTickCount}
                              margins={{ left: 50, right: 40, top: 20, bottom: 35 }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 text-center">
                          Viser {Array.isArray(chartData.data) ? chartData.data.length : 0} kategorier (hover over stolpene for detaljer)
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Tabs.Panel>

              {/* Pie Chart Tab */}
              <Tabs.Panel value="piechart" className="pt-4">
                <div className="border rounded-lg bg-white p-4">
                  {(() => {
                    const chartData = preparePieChartData();
                    console.log('Pie Chart Data:', chartData);
                    
                    // Check if too many items
                    if (result && result.data && result.data.length > 12) {
                      return (
                        <Alert variant="info">
                          Sirkeldiagram vises kun for resultater med maks 12 rader. Dette resultatet har {result.data.length} rader.
                        </Alert>
                      );
                    }
                    
                    if (!chartData) {
                      return (
                        <Alert variant="info">
                          Kunne ikke lage sirkeldiagram fra dataene. Trenger minst to kolonner (kategori og verdi).
                        </Alert>
                      );
                    }
                    
                    return (
                      <div>
                        <div className="flex flex-col items-center">
                          <style>{`
                            /* Make the labels transparent but keep them for hover functionality */
                            .pie-chart-wrapper text[class*="pieLabel"],
                            .pie-chart-wrapper g[class*="arc"] text {
                              opacity: 0 !important;
                              pointer-events: none !important;
                            }
                            /* Make the pie slices hoverable */
                            .pie-chart-wrapper path {
                              cursor: pointer !important;
                            }
                            /* Style the callout to be larger and more readable */
                            .pie-chart-wrapper .ms-Callout-main {
                              padding: 24px !important;
                              background: white !important;
                              border: 3px solid #0067C5 !important;
                              border-radius: 8px !important;
                              box-shadow: 0 6px 20px rgba(0,0,0,0.3) !important;
                              min-width: 300px !important;
                            }
                            .pie-chart-wrapper .ms-Callout-main div {
                              font-size: 24px !important;
                              line-height: 1.8 !important;
                              font-weight: 700 !important;
                              color: #262626 !important;
                            }
                          `}</style>
                          <div className="pie-chart-wrapper">
                            <PieChart
                              data={chartData.data}
                              width={600}
                              height={400}
                              chartTitle=""
                            />
                          </div>
                          <div className="mt-4 text-md text-gray-800 text-center">
                            <p>Viser {chartData.data.length} kategorier med prosentandeler:</p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 justify-center">
                              {chartData.data.map((item, idx) => {
                                const percentage = ((item.y / chartData.total) * 100).toFixed(1);
                                return (
                                  <span key={idx}>
                                    {item.x}: <strong>{percentage}%</strong>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Tabs.Panel>
            </Tabs>

            {/* Download Options */}
            <ReadMore header="Last ned resultater">
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button
                  onClick={downloadCSV}
                  variant="secondary"
                  size="small"
                  icon={<Download size={16} />}
                >
                  Last ned CSV
                </Button>
                <Button
                  onClick={downloadExcel}
                  variant="secondary"
                  size="small"
                  icon={<Download size={16} />}
                >
                  Last ned Excel (XLSX)
                </Button>
                <Button
                  onClick={downloadJSON}
                  variant="secondary"
                  size="small"
                  icon={<Download size={16} />}
                >
                  Last ned JSON
                </Button>
                <Button
                  onClick={downloadJSONL}
                  variant="secondary"
                  size="small"
                  icon={<Download size={16} />}
                >
                  Last ned JSONL
                </Button>
              </div>

            </ReadMore>
            
          </div>
        )}

        {result && result.data && result.data.length === 0 && (
          <Alert variant="info" className="mt-3">
            Spørringen returnerte ingen resultater.
          </Alert>
        )}
      </div>
    </div>
  );
};

export default ResultsDisplay;
