import { useState, useEffect } from 'react';
import { Heading, Link, Button, Alert, Modal, DatePicker, TextField, UNSAFE_Combobox } from '@navikt/ds-react';
import { Copy, ExternalLink, RotateCcw } from 'lucide-react';
import { ILineChartProps, IVerticalBarChartProps } from '@fluentui/react-charting';
import { subDays, format, isEqual } from 'date-fns';
import AlertWithCloseButton from '../AlertWithCloseButton';
import ResultsPanel from './ResultsPanel';
import { translateValue } from '../../../lib/translations';

interface QueryPreviewProps {
  sql: string;
  activeStep?: number;
  openFormprogress?: boolean;
  onOpenChange?: (open: boolean) => void;
  filters?: Array<{ column: string; interactive?: boolean; metabaseParam?: boolean }>;
  metrics?: Array<{ column?: string }>;
  groupByFields?: string[];
  onResetAll?: () => void; // Add new prop for reset functionality
  availableEvents?: string[];
  isEventsLoading?: boolean;
  websiteId?: string; // Optional for AnalysisActionModal
}

const API_TIMEOUT_MS = 60000; // timeout

const timeoutPromise = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const seconds = Math.round(ms / 1000);
      reject(new Error(`Forespørsel feilet etter å ha ventet ${seconds} sekunder`));
    }, ms);
  });
};

const QueryPreview = ({
  sql,
  activeStep = 1,
  openFormprogress = true,
  onOpenChange,
  filters = [],
  metrics = [],
  groupByFields = [],
  onResetAll,
  availableEvents = [],
  isEventsLoading = false,
  websiteId
}: QueryPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [wasManuallyOpened, setWasManuallyOpened] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const [estimating, setEstimating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'copy' | 'estimate' | 'execute' | 'run' | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingQueryEstimate, setPendingQueryEstimate] = useState<any>(null);
  const [queryStats, setQueryStats] = useState<any>(null);
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);

  // Metabase Date Filter State
  const [hasMetabaseDateFilter, setHasMetabaseDateFilter] = useState(false);
  const [hasUrlPathFilter, setHasUrlPathFilter] = useState(false);
  const [hasEventNameFilter, setHasEventNameFilter] = useState(false);

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [urlPath, setUrlPath] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');

  // Track executed parameters to show/hide Update button
  const [executedParams, setExecutedParams] = useState<{
    dateRange: { from: Date | undefined; to?: Date | undefined };
    urlPath: string;
    eventName: string;
  }>({
    dateRange: { from: subDays(new Date(), 30), to: new Date() },
    urlPath: '',
    eventName: ''
  });

  // Check if parameters have changed
  const hasChanges = () => {
    const dateChanged = !isEqual(dateRange.from || 0, executedParams.dateRange.from || 0) ||
      !isEqual(dateRange.to || 0, executedParams.dateRange.to || 0);
    const urlPathChanged = urlPath !== executedParams.urlPath;
    const eventNameChanged = eventName !== executedParams.eventName;

    return dateChanged || urlPathChanged || eventNameChanged;
  };

  // Detect Metabase date filter pattern
  useEffect(() => {
    if (!sql) {
      setHasMetabaseDateFilter(false);
      setHasUrlPathFilter(false);
      setHasEventNameFilter(false);
      return;
    }
    // Pattern: [[AND {{created_at}} ]] or variations with spaces
    const datePattern = /\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/i;
    setHasMetabaseDateFilter(datePattern.test(sql));

    // Pattern: [[ {{url_sti}} --]] '/'
    // Matches [[ {{url_sti}} --]] followed by optional whitespace and '/'
    const urlPathPattern = /\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*'\/'/i;
    setHasUrlPathFilter(urlPathPattern.test(sql));

    // Pattern: {{event_name}} or {{hendelse}}
    const eventNamePattern = /\{\{\s*(event_name|hendelse)\s*\}\}/i;
    setHasEventNameFilter(eventNamePattern.test(sql));
  }, [sql]);

  // Generate processed SQL with date substitution
  const getProcessedSql = () => {
    let processedSql = sql;

    // Date Filter Substitution
    if (hasMetabaseDateFilter && dateRange.from && dateRange.to) {
      const fromSql = `TIMESTAMP('${format(dateRange.from, 'yyyy-MM-dd')}')`;
      const toSql = `TIMESTAMP('${format(dateRange.to, 'yyyy-MM-dd')}T23:59:59')`;
      const replacement = `AND \`team-researchops-prod-01d6.umami.public_website_event\`.created_at BETWEEN ${fromSql} AND ${toSql}`;
      processedSql = processedSql.replace(/\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/gi, replacement);
    }

    // URL Path Substitution
    if (hasUrlPathFilter) {
      const pattern = /\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*'\/'/gi;
      if (urlPath && urlPath.trim() !== '') {
        processedSql = processedSql.replace(pattern, `'${urlPath.replace(/'/g, "''")}'`);
      } else {
        processedSql = processedSql.replace(pattern, `'/'`);
      }
    }

    // Event Name Substitution
    if (hasEventNameFilter) {
      const pattern = /\{\{\s*(event_name|hendelse)\s*\}\}/gi;
      if (eventName && eventName.trim() !== '') {
        const safeEventName = eventName.replace(/'/g, "''");
        processedSql = processedSql.replace(pattern, `'${safeEventName}'`);
      } else {
        processedSql = processedSql.replace(pattern, `''`);
      }
    }

    return processedSql;
  };

  // Helper function to prepare data for LineChart
  const prepareLineChartData = (includeAverage: boolean = true): ILineChartProps | null => {
    if (!result || !result.data || result.data.length === 0) return null;

    const data = result.data;
    const keys = Object.keys(data[0]);

    // Need at least 2 columns (x-axis and y-axis)
    if (keys.length < 2) return null;

    console.log('Preparing LineChart with keys:', keys);
    console.log('Sample row:', data[0]);

    // Check if we have 3 columns - likely x-axis, series grouping, and y-axis
    if (keys.length === 3) {
      const xKey = keys[0];
      const seriesKey = keys[1]; // e.g., 'browser'
      const yKey = keys[2]; // e.g., 'Unike_besokende'

      // Group data by series
      const seriesMap = new Map<string, any[]>();

      data.forEach((row: any) => {
        const rawSeriesValue = row[seriesKey];
        const translatedSeriesValue = translateValue(seriesKey, rawSeriesValue);
        const seriesValue = String(translatedSeriesValue || 'Ukjent');
        if (!seriesMap.has(seriesValue)) {
          seriesMap.set(seriesValue, []);
        }

        const xValue = row[xKey];
        const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;

        let x: number | Date;
        if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) {
          x = new Date(xValue);
        } else if (typeof xValue === 'number') {
          x = xValue;
        } else {
          x = new Date(xValue).getTime() || 0;
        }

        seriesMap.get(seriesValue)!.push({
          x,
          y: yValue,
          xAxisCalloutData: String(xValue),
          yAxisCalloutData: String(yValue),
        });
      });

      // Convert to line chart format with colors
      // Using colorblind-friendly palette with good contrast
      const colors = [
        '#0067C5', // Blue (NAV blue)
        '#FF9100', // Orange
        '#06893A', // Green
        '#C30000', // Red
        '#634689', // Purple
        '#A8874C', // Brown/Gold
        '#005B82', // Teal
        '#E18AAA', // Pink
      ];
      const lineChartData = Array.from(seriesMap.entries()).map(([seriesName, points], index) => ({
        legend: seriesName,
        data: points,
        color: colors[index % colors.length],
        lineOptions: {
          lineBorderWidth: '2',
        },
      }));

      // Calculate average line across all data points (only if requested)
      if (includeAverage) {
        // Collect all unique x values
        const allXValues = new Set<number>();
        lineChartData.forEach(series => {
          series.data.forEach((point: any) => {
            const xVal = point.x instanceof Date ? point.x.getTime() : Number(point.x);
            allXValues.add(xVal);
          });
        });

        // For each x value, calculate the average y value across all series
        const averagePoints = Array.from(allXValues).sort((a, b) => a - b).map(xVal => {
          const yValues: number[] = [];
          lineChartData.forEach(series => {
            const point = series.data.find((p: any) => {
              const pxVal = p.x instanceof Date ? p.x.getTime() : Number(p.x);
              return pxVal === xVal;
            });
            if (point) {
              yValues.push(point.y);
            }
          });

          const avgY = yValues.length > 0
            ? yValues.reduce((sum, val) => sum + val, 0) / yValues.length
            : 0;

          // Find original xAxisCalloutData from any series
          const originalPoint = lineChartData[0].data.find((p: any) => {
            const pxVal = p.x instanceof Date ? p.x.getTime() : Number(p.x);
            return pxVal === xVal;
          });

          return {
            x: new Date(xVal),
            y: avgY,
            xAxisCalloutData: originalPoint?.xAxisCalloutData || String(xVal),
            yAxisCalloutData: avgY.toFixed(2),
          };
        });

        // Add average line to the chart
        lineChartData.push({
          legend: 'Gjennomsnitt',
          data: averagePoints,
          color: '#262626', // Dark gray for average line
          lineOptions: {
            lineBorderWidth: '2',
            strokeDasharray: '5 5',
          } as any,
        });
      }

      console.log('Multi-line chart data:', lineChartData.length, 'series' + (includeAverage ? ' (including average)' : ''));

      return {
        data: {
          lineChartData,
        },
        enabledLegendsWrapLines: true,
      };
    }

    // Single line: assume first column is x-axis and second is y-axis
    const xKey = keys[0];
    const yKey = keys[1];

    const chartPoints = data.map((row: any, index: number) => {
      const xValue = row[xKey];
      const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;

      let x: number | Date;
      if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) {
        x = new Date(xValue);
      } else if (typeof xValue === 'number') {
        x = xValue;
      } else {
        x = index;
      }

      return {
        x,
        y: yValue,
        xAxisCalloutData: String(xValue),
        yAxisCalloutData: String(yValue),
      };
    });

    console.log('Single-line chart points:', chartPoints.slice(0, 3));

    // Build the line chart data array
    const lineChartData: any[] = [{
      legend: yKey,
      data: chartPoints,
      color: '#0067C5',
      lineOptions: {
        lineBorderWidth: '2',
      },
    }];

    // Add average line (only if requested)
    if (includeAverage) {
      // Calculate average y value for horizontal average line
      const avgY = chartPoints.reduce((sum: number, point: any) => sum + point.y, 0) / chartPoints.length;

      // Create average line points (horizontal line across all x values)
      const averageLinePoints = chartPoints.map((point: any) => ({
        x: point.x,
        y: avgY,
        xAxisCalloutData: point.xAxisCalloutData,
        yAxisCalloutData: avgY.toFixed(2),
      }));

      lineChartData.push({
        legend: 'Gjennomsnitt',
        data: averageLinePoints,
        color: '#262626',
        lineOptions: {
          lineBorderWidth: '2',
          strokeDasharray: '5 5',
        } as any,
      });
    }

    return {
      data: {
        lineChartData,
      },
      enabledLegendsWrapLines: true,
    };
  };

  // Helper function to prepare data for VerticalBarChart
  // Helper function to prepare data for VerticalBarChart
  const prepareBarChartData = (): IVerticalBarChartProps | null => {
    if (!result || !result.data || result.data.length === 0) return null;

    const data = result.data;

    // Only show bar chart if 10 or fewer items
    if (data.length > 12) return null;

    const keys = Object.keys(data[0]);

    // Need at least 2 columns (label and value)
    if (keys.length < 2) return null;

    // Assume first column is label and second is value
    const labelKey = keys[0];
    const valueKey = keys[1];

    console.log('Preparing VerticalBarChart with keys:', { labelKey, valueKey });
    console.log('Sample row:', data[0]);

    // Calculate total for percentages
    const total = data.reduce((sum: number, row: any) => {
      const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
      return sum + value;
    }, 0);

    console.log('Total value for bar chart:', total);

    const barChartData = data.map((row: any) => {
      const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';

      // Use label for x-axis, with translation
      const rawLabel = row[labelKey];
      const translatedLabel = translateValue(labelKey, rawLabel);
      const label = String(translatedLabel || 'Ukjent');

      return {
        x: label,
        y: value,
        xAxisCalloutData: label,
        yAxisCalloutData: `${value} (${percentage}%)`,
        color: '#0067C5', // NAV blue color
        legend: label,
      };
    });

    console.log('VerticalBarChart data points:', barChartData.slice(0, 3)); // Log first 3 points

    return {
      data: barChartData,
      barWidth: 'auto',
      yAxisTickCount: 5,
      enableReflow: true,
      legendProps: {
        allowFocusOnLegends: true,
        canSelectMultipleLegends: false,
        styles: {
          root: {
            display: 'flex',
            flexWrap: 'wrap',
            rowGap: '8px',
            columnGap: '16px',
            maxWidth: '100%',
          },
          legend: {
            marginRight: 0,
          },
        },
      },
    };
  };

  // Helper function to prepare data for PieChart
  const preparePieChartData = (): { data: Array<{ y: number; x: string }>; total: number } | null => {
    if (!result || !result.data || result.data.length === 0) return null;

    const data = result.data;

    // Only show pie chart if 10 or fewer items
    if (data.length > 12) return null;

    const keys = Object.keys(data[0]);

    // Need at least 2 columns (label and value)
    if (keys.length < 2) return null;

    // Assume first column is label and second is value
    const labelKey = keys[0];
    const valueKey = keys[1];

    console.log('Preparing PieChart with keys:', { labelKey, valueKey });
    console.log('Sample row:', data[0]);

    // Calculate total for percentages
    const total = data.reduce((sum: number, row: any) => {
      const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
      return sum + value;
    }, 0);

    console.log('Total value for pie chart:', total);

    const pieChartData = data.map((row: any) => {
      const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
      const rawLabel = row[labelKey];
      const translatedLabel = translateValue(labelKey, rawLabel);
      const label = String(translatedLabel || 'Ukjent');

      return {
        y: value,
        x: label,
      };
    });

    console.log('PieChart data points:', pieChartData.slice(0, 3)); // Log first 3 points

    return {
      data: pieChartData,
      total,
    };
  };

  const handleCopy = async () => {
    const processedSql = getProcessedSql();
    navigator.clipboard.writeText(processedSql);
    setCopied(true);

    // Also run cost estimation
    setEstimating(true);
    setLastAction('copy');

    try {
      const response = await Promise.race([
        fetch('/api/bigquery/estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: processedSql, analysisType: 'Grafbyggeren' }),
        }),
        timeoutPromise(API_TIMEOUT_MS)
      ]) as Response;

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Estimation failed');
      }

      setEstimate(data);
    } catch (err: any) {
      // Record a non-fatal error so user can retry if it was a timeout
      setError(err.message || 'En feil oppstod');
    } finally {
      setEstimating(false);
    }

    setTimeout(() => setCopied(false), 3000);
  };

  const executeQuery = async () => {
    // First, estimate the cost
    setLoading(true);
    setError(null);
    setLastAction('execute');

    try {
      const processedSql = getProcessedSql();
      const estimateResponse = await Promise.race([
        fetch('/api/bigquery/estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: processedSql, analysisType: 'Grafbyggeren' }),
        }),
        timeoutPromise(API_TIMEOUT_MS)
      ]) as Response;

      const estimateData = await estimateResponse.json();

      if (!estimateResponse.ok) {
        throw new Error(estimateData.error || 'Estimation failed');
      }

      const gb = parseFloat(estimateData.totalBytesProcessedGB);

      // Check if we should warn the user
      let shouldWarn = false;

      if (gb >= 50) {
        shouldWarn = true;
      }

      // If warning threshold is met, show modal for confirmation
      if (shouldWarn) {
        setPendingQueryEstimate(estimateData);
        setShowConfirmModal(true);
        setLoading(false);
        return;
      }

      // Proceed with the actual query for small queries
      await runQuery();
    } catch (err: any) {
      setError(err.message || 'En feil oppstod');
      setLoading(false);
    }
  };

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setQueryStats(null);
    setLastAction('run');

    // Update executed params
    setExecutedParams({
      dateRange,
      urlPath,
      eventName
    });

    try {
      const processedSql = getProcessedSql();
      const response = await Promise.race([
        fetch('/api/bigquery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: processedSql, analysisType: 'Grafbyggeren' }),
        }),
        timeoutPromise(API_TIMEOUT_MS)
      ]) as Response;

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Query failed');
      }

      setResult(data);

      // Also get the query stats by running estimate (it's fast and gives us the GB info)
      try {
        const estimateResponse = await Promise.race([
          fetch('/api/bigquery/estimate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: processedSql, analysisType: 'Grafbyggeren' }),
          }),
          timeoutPromise(API_TIMEOUT_MS)
        ]) as Response;
        const estimateData = await estimateResponse.json();
        if (estimateResponse.ok) {
          setQueryStats(estimateData);
        }
      } catch {
        // If estimate fails, it's not critical
      }
    } catch (err: any) {
      setError(err.message || 'En feil oppstod');
    } finally {
      setLoading(false);
    }
  };

  // Retry handler based on the lastAction
  const handleRetry = async () => {
    if (!lastAction) return;

    setError(null);

    if (lastAction === 'copy') {
      // Retry the estimate used in the copy flow
      setEstimating(true);
      try {
        const response = await Promise.race([
          fetch('/api/bigquery/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: getProcessedSql(), analysisType: 'Grafbyggeren' }),
          }),
          timeoutPromise(API_TIMEOUT_MS),
        ]) as Response;
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Estimation failed');
        setEstimate(data);
      } catch (err: any) {
        setError(err.message || 'En feil oppstod');
      } finally {
        setEstimating(false);
      }
    } else if (lastAction === 'execute') {
      await executeQuery();
    } else if (lastAction === 'run') {
      await runQuery();
    } else if (lastAction === 'estimate') {
      // generic estimate
      try {
        const response = await Promise.race([
          fetch('/api/bigquery/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: getProcessedSql(), analysisType: 'Grafbyggeren' }),
          }),
          timeoutPromise(API_TIMEOUT_MS),
        ]) as Response;
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Estimation failed');
        setEstimate(data);
      } catch (err: any) {
        setError(err.message || 'En feil oppstod');
      }
    }
  };

  const handleConfirmQuery = async () => {
    setShowConfirmModal(false);
    await runQuery();
  };

  const handleCancelQuery = () => {
    setShowConfirmModal(false);
    setPendingQueryEstimate(null);
  };

  // Show loading message after 10 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (loading) {
      setShowLoadingMessage(false);
      timer = setTimeout(() => {
        setShowLoadingMessage(true);
      }, 10000);
    } else {
      setShowLoadingMessage(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  // Check if SQL is just a basic template without metrics or groupings
  const isBasicTemplate = () => {
    if (!sql) return true;

    // Check if it's the "please select website" message
    if (sql.includes('Please select a website')) return true;

    // Check if there are any SELECT columns specified or if it's just the basic structure
    const selectPattern = /SELECT\s+(\s*FROM|\s*$)/i;
    return selectPattern.test(sql);
  };

  // Check if SQL is meaningful enough to display
  {/* const isSQLMeaningful = () => {
    if (!sql) return false;

    // Basic template SQL should not be shown, it's not useful yet
    if (isBasicTemplate()) return false;

    return true;
  }; */}

  // Check for interactive date filter and visit duration combination
  const hasInteractiveDateFilter = filters.some(
    (f) => f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
  );

  const hasVisitDuration =
    metrics.some((m) => m.column === 'visit_duration') || groupByFields.includes('visit_duration');

  // Flag to show warning
  const showIncompatibilityWarning = hasInteractiveDateFilter && hasVisitDuration;

  // Track previous step to detect transitions
  const [prevStep, setPrevStep] = useState(activeStep);
  const [autoClosedFinalStep, setAutoClosedFinalStep] = useState(false);

  const FINAL_STEP = 3;

  // Update the function to track manual opening state
  const ensureFormProgressOpen = () => {
    if (onOpenChange) {
      onOpenChange(true);
      setWasManuallyOpened(true);
      setAutoClosedFinalStep(false);
    }
  };

  // Custom handler for form progress open state changes
  {/* const handleFormProgressOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
      // If the user manually opens it, track this action
      if (open && activeStep === FINAL_STEP) {
        setWasManuallyOpened(true);
      }
    }
  }; */}

  useEffect(() => {
    if (onOpenChange) {
      // Case 1: Moving to final step - auto-close it if it wasn't manually opened
      if (activeStep === FINAL_STEP && prevStep !== FINAL_STEP && !wasManuallyOpened) {
        onOpenChange(false);
        setAutoClosedFinalStep(true);
      }
      // Case 2: Moving back from final step to an earlier step - reopen it
      else if (prevStep === FINAL_STEP && activeStep < FINAL_STEP) {
        onOpenChange(true);
        setAutoClosedFinalStep(false);
      }
      // Case 3: Initial setup on first render
      else if (prevStep === activeStep && activeStep === 1) {
        onOpenChange(openFormprogress);
      }
      // Case 4: If parent explicitly sets openFormprogress, respect that
      else if (
        openFormprogress !== undefined &&
        prevStep !== activeStep // Only process external state changes on step changes
      ) {
        onOpenChange(openFormprogress);
      }
    }

    // Update previous step
    setPrevStep(activeStep);

    // Reset manual opening flag when changing steps (except when at step 3)
    if (prevStep !== activeStep && activeStep !== FINAL_STEP) {
      setWasManuallyOpened(false);
    }
  }, [activeStep, openFormprogress, onOpenChange, prevStep, autoClosedFinalStep, wasManuallyOpened, FINAL_STEP]);

  // Clear results when SQL changes (website change or reset)
  useEffect(() => {
    setResult(null);
    setQueryStats(null);
    setError(null);
    setEstimate(null);
    setCopied(false);
  }, [sql]);

  return (
    <>
      <div>
        {isBasicTemplate() ? (
          <>

            {/* <div className="space-y-4">
            <Heading level="2" size="small">Klargjør spørsmålet ditt</Heading>
            {isSQLMeaningful() && (
              <SqlCodeDisplay sql={sql} showEditButton={true} />
            )}
          </div> */}
          </>
        ) : (
          // Show the original SQL preview instructions
          <div>
            {/* Results Section with Integrated Date Filter */}
            <div>
              {/* Header with Reset Button */}
              {onResetAll && activeStep > 1 && (
                <div className="flex justify-end mb-2">
                  <Button
                    variant="tertiary"
                    size="small"
                    onClick={() => {
                      onResetAll();
                      // Reset local filter states
                      setDateRange({ from: subDays(new Date(), 30), to: new Date() });
                      setUrlPath('');
                      setEventName('');
                      setExecutedParams({
                        dateRange: { from: subDays(new Date(), 30), to: new Date() },
                        urlPath: '',
                        eventName: ''
                      });
                      setResult(null); // Clear results

                      setShowAlert(true);

                      // Move this call AFTER onResetAll to ensure it happens last
                      setTimeout(() => {
                        ensureFormProgressOpen();
                      }, 0);

                      // Auto-hide the alert after 4 seconds
                      setTimeout(() => setShowAlert(false), 4000);
                    }}
                    icon={<RotateCcw size={16} />}
                  >
                    Tilbakestill alle valg
                  </Button>
                </div>
              )}

              <Heading level="2" size="small" className="mb-3">Vis resultater</Heading>

              {/* Success Alert for Reset */}
              {showAlert && (
                <div className="mb-3">
                  <AlertWithCloseButton variant="success">
                    Alle innstillinger ble tilbakestilt
                  </AlertWithCloseButton>
                </div>
              )}

              {/* Metabase Parameters Filter */}
              {(hasMetabaseDateFilter || hasUrlPathFilter || hasEventNameFilter) && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-4 items-end">
                    {/* Date Filter */}
                    {hasMetabaseDateFilter && (
                      <DatePicker
                        mode="range"
                        selected={dateRange}
                        onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                        showWeekNumber
                      >
                        <div className="flex flex-wrap items-end gap-4">
                          <div>
                            <DatePicker.Input
                              label="Fra dato"
                              id="preview-date-from"
                              value={dateRange.from ? format(dateRange.from, 'dd.MM.yyyy') : ''}
                              size="small"
                            />
                          </div>
                          <div>
                            <DatePicker.Input
                              label="Til dato"
                              id="preview-date-to"
                              value={dateRange.to ? format(dateRange.to, 'dd.MM.yyyy') : ''}
                              size="small"
                            />
                          </div>
                        </div>
                      </DatePicker>
                    )}

                    {/* URL Path Filter */}
                    {hasUrlPathFilter && (
                      <div className="w-64">
                        <TextField
                          label="URL-sti"
                          size="small"
                          value={urlPath}
                          onChange={(e) => setUrlPath(e.target.value)}
                          description="F.eks. / for forsiden"
                        />
                      </div>
                    )}

                    {/* Event Name Filter */}
                    {hasEventNameFilter && (
                      <div className="w-64">
                        {isEventsLoading && <div className="text-xs text-[var(--ax-text-subtle)] mb-1">Laster hendelser...</div>}
                        <div className={isEventsLoading ? 'opacity-50 pointer-events-none' : ''}>
                          <UNSAFE_Combobox
                            label="Hendelsesnavn"
                            options={availableEvents.map(e => ({ label: e, value: e }))}
                            selectedOptions={eventName ? [eventName] : []}
                            onToggleSelected={(option, isSelected) => {
                              setEventName(isSelected ? option : '');
                            }}
                            isMultiSelect={false}
                            size="small"
                            // @ts-ignore
                            disabled={isEventsLoading}
                          />
                        </div>
                      </div>
                    )}

                    {/* Update Button - inline with filters */}
                    {hasChanges() && (result || error) && (
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => executeQuery()}
                        loading={loading}
                      >
                        Oppdater
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <ResultsPanel
                result={result}
                loading={loading}
                error={error}
                queryStats={queryStats}
                lastAction={lastAction}
                showLoadingMessage={showLoadingMessage}
                executeQuery={executeQuery}
                handleRetry={handleRetry}
                prepareLineChartData={prepareLineChartData}
                prepareBarChartData={prepareBarChartData}
                preparePieChartData={preparePieChartData}
                sql={getProcessedSql()}
                hideHeading={true}
                containerStyle="none"
                showSqlCode={true}
                showEditButton={true}
                showCost={true}
                websiteId={websiteId}
              />
            </div>

            {/* Metabase Section */}
            <div className="space-y-3 mb-4">
              <Heading level="2" size="small" spacing>Legg til i Metabase</Heading>

              {/* Add incompatibility warning */}
              {showIncompatibilityWarning && (
                <Alert variant="warning" size="small">
                  <div>
                    <p className="font-medium">Interaktiv dato + besøksvarighet = funker ikke</p>
                    <p className="mt-1 text-sm">
                      Du bruker både interaktivt datofilter og besøksvarighet, som ikke fungerer sammen i Metabase.
                    </p>
                  </div>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <div>
                  {!copied ? (
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={handleCopy}
                      icon={<Copy size={18} />}
                      loading={estimating}
                    >
                      Kopier spørringen
                    </Button>
                  ) : (
                    <Alert variant="success" size="small" className="w-fit py-1 px-3">
                      Spørringen er kopiert!
                    </Alert>
                  )}

                  {/* Cost Estimate Display */}
                  {estimating && (
                    <div className="mt-2 text-sm text-[var(--ax-text-subtle)]">
                      Estimerer kostnad...
                    </div>
                  )}

                  {estimate && !estimating && (() => {
                    const gb = parseFloat(estimate.totalBytesProcessedGB);
                    // Calculate cost if not provided by backend (approx $6.25 per TB)
                    const cost = parseFloat(estimate.estimatedCostUSD) || (gb * 0.00625);

                    let variant: 'info' | 'warning' | 'error' = 'info';
                    let showAsAlert = false;

                    if (gb >= 300) {
                      variant = 'error';
                      showAsAlert = true;
                    } else if (gb >= 100) {
                      variant = 'warning';
                      showAsAlert = true;
                    } else if (gb >= 50) {
                      variant = 'info';
                      showAsAlert = true;
                    }

                    if (!showAsAlert) {
                      return (
                        <div className="mt-2 text-sm text-[var(--ax-text-subtle)]">
                          Data å prosessere: {gb} GB
                          {cost > 0 && ` • Kostnad: $${cost.toFixed(2)}`}
                        </div>
                      );
                    }

                    return (
                      <Alert variant={variant} size="small" className="mt-2">
                        <div className="text-sm space-y-1">
                          <p>
                            <strong>Data å prosessere:</strong> {estimate.totalBytesProcessedGB} GB
                            {cost > 0 && ` • Kostnad: $${cost.toFixed(2)}`}
                          </p>
                          {gb >= 300 && (
                            <p className="font-medium mt-2">
                              ⚠️ Dette er en veldig stor spørring! Vurder å begrense dataene.
                            </p>
                          )}
                          {gb >= 100 && gb < 300 && (
                            <p className="font-medium mt-2">
                              Dette er en stor spørring. Sjekk at du trenger all denne dataen.
                            </p>
                          )}
                        </div>
                      </Alert>
                    );
                  })()}
                </div>

                <Link
                  href="https://metabase.ansatt.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImRhdGFiYXNlIjo3MzEsInR5cGUiOiJuYXRpdmUiLCJuYXRpdmUiOnsicXVlcnkiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX19LCJkaXNwbGF5IjoidGFibGUiLCJ2aXN1YWxpemF0aW9uX3NldHRpbmdzIjp7fSwidHlwZSI6InF1ZXN0aW9uIn0="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1"
                >
                  Åpne Metabase <ExternalLink size={14} />
                </Link>
              </div>

              {/* Detailed instructions in ReadMore 
              <ReadMore header="Neste steg i Metabase" size="small">
                <ol className="list-decimal list-inside space-y-2 text-sm mt-2" start={3}>
                  <li>Lim inn spørringen i SQL-editoren</li>
                  <li>Trykk på <span role="img" aria-label="spill av-knapp">▶️</span> "vis resultater"-knappen</li>
                  <li>Trykk "Visualisering" for å bytte fra tabell til graf</li>
                </ol>
                <p className="text-sm text-[var(--ax-text-subtle)] mt-2">
                  Merk: Hvis siden "Velg dine startdata" vises, lukk den og klikk på lenken på nytt.
                </p>
              </ReadMore>*/}
            </div>
          </div>
        )}
        {/* 
        <div className="pt-0">
          <FormProgress
            activeStep={Math.min(activeStep, FINAL_STEP)} // Ensure we never show step 4
            totalSteps={3}
            open={openFormprogress}
            onOpenChange={handleFormProgressOpenChange}
            interactiveSteps={false}
          >
            <FormProgress.Step>Velg nettside eller app</FormProgress.Step>
            <FormProgress.Step>Formuler spørsmålet</FormProgress.Step>
            <FormProgress.Step>Vis resultater</FormProgress.Step>
          </FormProgress>
        </div>
        */}
      </div>

      {/* Confirmation Modal for Large Queries */}
      <Modal
        open={showConfirmModal}
        onClose={handleCancelQuery}
        header={{
          heading: "Bekreft stor spørring",
          closeButton: false,
        }}
      >
        <Modal.Body>
          {pendingQueryEstimate && (() => {
            const gb = parseFloat(pendingQueryEstimate.totalBytesProcessedGB);
            // Calculate cost if not provided by backend (approx $6.25 per TB)
            const cost = parseFloat(pendingQueryEstimate.estimatedCostUSD) || (gb * 0.00625);
            let variant: 'info' | 'warning' | 'error' = 'info';
            let message = '';

            if (gb >= 100) {
              variant = 'error';
              message = 'Dette er en veldig stor spørring!';
            } else if (gb >= 20) {
              variant = 'warning';
              message = 'Dette er en stor spørring.';
            } else {
              variant = 'info';
              message = 'Denne spørringen vil prosessere en del data.';
            }

            return (
              <div className="space-y-4">
                <Alert variant={variant}>
                  <div className="space-y-2">
                    <p className="font-medium">{message}</p>
                    <p>
                      <strong>Data å prosessere:</strong> {pendingQueryEstimate.totalBytesProcessedGB} GB
                      {cost > 0 && ` • Kostnad: $${cost.toFixed(2)}`}
                    </p>
                  </div>
                </Alert>
                <p>Er du sikker på at du vil kjøre denne spørringen?</p>
              </div>
            );
          })()}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={handleConfirmQuery}
            loading={loading}
          >
            Ja, kjør spørringen
          </Button>
          <Button
            variant="secondary"
            onClick={handleCancelQuery}
          >
            Avbryt
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default QueryPreview;