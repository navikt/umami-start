import { useState, useEffect } from 'react';
import { Heading, Link, CopyButton, Button, Alert, FormProgress, Modal, ReadMore, Tabs, Search } from '@navikt/ds-react';
import { ChevronDown, ChevronUp, Copy, ExternalLink, RotateCcw, PlayIcon, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { utils as XLSXUtils, write as XLSXWrite } from 'xlsx';
import { LineChart, ILineChartProps, VerticalBarChart, IVerticalBarChartProps, AreaChart, PieChart } from '@fluentui/react-charting';
import AlertWithCloseButton from './AlertWithCloseButton';
import { translateValue } from '../../lib/translations';

interface SQLPreviewProps {
  sql: string;
  activeStep?: number;
  openFormprogress?: boolean;
  onOpenChange?: (open: boolean) => void;
  filters?: Array<{ column: string; interactive?: boolean; metabaseParam?: boolean }>;
  metrics?: Array<{ column?: string }>;
  groupByFields?: string[];
  onResetAll?: () => void; // Add new prop for reset functionality
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

const SQLPreview = ({
  sql,
  activeStep = 1,
  openFormprogress = true,
  onOpenChange,
  filters = [],
  metrics = [],
  groupByFields = [],
  onResetAll,
}: SQLPreviewProps) => {
  const [showCode, setShowCode] = useState(false);
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
  const [activeTab, setActiveTab] = useState<string>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
    navigator.clipboard.writeText(sql);
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
          body: JSON.stringify({ query: sql }),
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
      const estimateResponse = await Promise.race([
        fetch('/api/bigquery/estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
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
      
      if (gb >= 15) {
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

    try {
      const response = await Promise.race([
        fetch('/api/bigquery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
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
            body: JSON.stringify({ query: sql }),
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
            body: JSON.stringify({ query: sql }),
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
            body: JSON.stringify({ query: sql }),
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
  const isSQLMeaningful = () => {
    if (!sql) return false;

    // Basic template SQL should not be shown, it's not useful yet
    if (isBasicTemplate()) return false;

    return true;
  };

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
  const handleFormProgressOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
      // If the user manually opens it, track this action
      if (open && activeStep === FINAL_STEP) {
        setWasManuallyOpened(true);
      }
    }
  };

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
    setSortColumn(null);
    setSortDirection('asc');
  }, [sql]);

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
    <>
      <div className="space-y-4 bg-white p-6 rounded-lg border shadow-sm">
        {isBasicTemplate() ? (
          // Show getting started guidance
          <div className="space-y-4">
            <Heading level="2" size="small">Klargjør spørsmålet ditt</Heading>
            
            {/* Only show SQL code button if the SQL is meaningful */}
            {isSQLMeaningful() && (
              <div className="mt-4">
                <Button
                  variant="tertiary"
                  size="small"
                  onClick={() => setShowCode(!showCode)}
                  icon={showCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  className="mb-2"
                >
                  {showCode ? 'Skjul SQL-kode' : 'Vis SQL-kode'}
                </Button>

                {showCode && (
                  <div className="relative">
                    <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                      {sql}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton copyText={sql} text="Kopier" activeText="Kopiert!" size="small" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Show the original SQL preview instructions
          <div>
            {/* Direct Query Execution Section */}
            <div className="space-y-2 mb-6">
              <Heading level="2" size="small">Vis resultater</Heading>
              
              <div className="bg-green-50 p-4 rounded-md border border-green-100">
                {/* <p className="mb-3">Få resultatet med en gang uten å åpne Metabase.</p>*/}
                
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
                            const chartData = prepareLineChartData();
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
                            const chartData = prepareLineChartData(false);
                            
                            if (!chartData) {
                              return (
                                <Alert variant="info">
                                  Kunne ikke lage områdediagram fra dataene. Trenger minst to kolonner (x-akse og y-akse).
                                </Alert>
                              );
                            }
                            return (
                              <div style={{ overflow: 'visible' }}>
                                <AreaChart
                                  data={chartData.data}
                                  height={400}
                                  legendsOverflowText="Flere"
                                  yAxisTickCount={10}
                                  width={700}
                                  enablePerfOptimization={true}
                                  margins={{ left: 50, right: 50, top: 20, bottom: 35 }}
                                />
                                <div className="mt-2 text-xs text-gray-500">
                                  Viser {chartData.data.lineChartData?.[0]?.data?.length || 0} datapunkter
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

            {/* Metabase Section */}
            <div className="space-y-2 mb-4">
              <Heading level="2" size="small">Legg til i Metabase</Heading>

              {/* Add incompatibility warning */}
              {showIncompatibilityWarning && (
                <Alert variant="warning" className="mt-3 mb-3">
                  <div>
                    <p className="font-medium">Interaktiv dato + besøksvarighet = funker ikke</p>
                    <p className="mt-1">
                      Du bruker både interaktivt datofilter og besøksvarighet, som ikke fungerer sammen i Metabase.
                      Vurder å bruke en av de andre datofiltrene i stedet.
                    </p>
                  </div>
                </Alert>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-grow">
                    <p className="font-medium">Kopier spørsmålet</p>
                    <div className="mt-2">
                      {!copied ? (
                        <Button
                          variant="primary"
                          onClick={handleCopy}
                          icon={<Copy size={18} />}
                          className="w-full md:w-auto"
                          loading={estimating}
                        >
                          Kopier spørsmålet
                        </Button>
                      ) : (
                        <Alert variant="success" className="w-fit p-2 flex items-center">
                          Spørsmålet er kopiert!
                        </Alert>
                      )}
                      
                      {/* Cost Estimate Display */}
                      {estimating && (
                        <div className="mt-2 text-sm text-gray-600">
                          Estimerer kostnad...
                        </div>
                      )}
                      
                      {estimate && !estimating && (() => {
                        const gb = parseFloat(estimate.totalBytesProcessedGB);
                       // const mb = parseFloat(estimate.totalBytesProcessedMB);
                        
                        // Determine variant and message based on data size
                        let variant: 'info' | 'warning' | 'error' = 'info';
                        let showAsAlert = false;
                        
                        if (gb >= 100) { // Crazy much - 100+ GB
                          variant = 'error';
                          showAsAlert = true;
                        } else if (gb >= 20) { // Many GB - 10-100 GB
                          variant = 'warning';
                          showAsAlert = true;
                        } else if (gb >= 15) { // More than 1 GB
                          variant = 'info';
                          showAsAlert = true;
                        }
                        // Less than 1 GB - just show as simple text line
                        
                        if (!showAsAlert) {
                          // Simple line for small queries (< 1 GB)
                          return (
                            <div className="mt-2 text-sm text-gray-800">
                              Data å prosessere: {gb} GB
                              {parseFloat(estimate.estimatedCostUSD) > 0 && ` • Kostnad: $${estimate.estimatedCostUSD}`}
                            </div>
                          );
                        }
                        
                        // Alert for larger queries
                        return (
                          <Alert variant={variant} className="mt-2">
                            <div className="text-sm space-y-1">
                              <p>
                                <strong>Data å prosessere:</strong> {estimate.totalBytesProcessedGB} GB
                              </p>
                              {parseFloat(estimate.estimatedCostUSD) > 0 && (
                                <p>
                                  <strong>Estimert kostnad:</strong> ${estimate.estimatedCostUSD} USD
                                </p>
                              )}
                              {gb >= 100 && (
                                <p className="font-medium mt-2">
                                  ⚠️ Dette er en veldig stor spørring! Vurder å begrense dataene.
                                </p>
                              )}
                              {gb >= 10 && gb < 100 && (
                                <p className="font-medium mt-2">
                                  Dette er en stor spørring. Sjekk at du trenger all denne dataen.
                                </p>
                              )}
                            </div>
                          </Alert>
                        );
                      })()}
                      {/* {estimateError && (
                        <Alert variant="warning" className="mt-2">
                          <p className="text-sm">Kunne ikke estimere kostnad: {estimateError}</p>
                        </Alert>
                      )} */}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-grow">
                    <p className="font-medium mb-2">Lim inn i Metabase</p>
                    <Link
                      href="https://metabase.ansatt.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImRhdGFiYXNlIjo3MzEsInR5cGUiOiJuYXRpdmUiLCJuYXRpdmUiOnsicXVlcnkiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX19LCJkaXNwbGF5IjoidGFibGUiLCJ2aXN1YWxpemF0aW9uX3NldHRpbmdzIjp7fSwidHlwZSI6InF1ZXN0aW9uIn0="
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      Åpne Metabase <ExternalLink size={14} />
                    </Link>{' '}
                    (Merk: Hvis siden "Velg dine startdata" vises, lukk den og klikk på lenken på nytt.)
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium">
                      Trykk på <span role="img" aria-label="spill av-knapp">▶️</span> "vis resultater"-knappen
                    </p>
                    <p className="text-md text-gray-700 mt-1">
                      Trykk "visualisering" for å bytte fra tabell til graf
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {sql && (
              <div className="mt-4">
                <Button
                  variant="tertiary"
                  size="small"
                  onClick={() => setShowCode(!showCode)}
                  icon={showCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  className="mb-2"
                >
                  {showCode ? 'Skjul SQL-kode' : 'Vis SQL-kode'}
                </Button>

                {showCode && (
                  <div className="relative">
                    <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                      {sql}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton copyText={sql} text="Kopier" activeText="Kopiert!" size="small" />
                    </div>

                    <div className="mt-2 mb-8 text-sm bg-yellow-50 p-3 rounded-md border border-yellow-100">
                      <p>
                        <strong>Tips:</strong> Du trenger ikke å forstå koden! Den er generert basert på valgene dine,
                        og vil fungere når du kopierer og limer inn i Metabase.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
      </div>

      <div className="mt-4 mr-4">
        {/* Only show reset button after step 1 */}
        {onResetAll && activeStep > 1 && (
          <>
            <div className="flex justify-end">
              <Button
                variant="tertiary"
                size="small"
                onClick={() => {
                  onResetAll();
                  setShowAlert(true);

                  // Move this call AFTER onResetAll to ensure it happens last
                  // Use a small timeout to ensure it happens after any state changes in onResetAll
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

            {/* Show success alert below the button */}
            {showAlert && (
              <div className="mt-2">
                <AlertWithCloseButton variant="success">
                  Alle innstillinger ble tilbakestilt
                </AlertWithCloseButton>
              </div>
            )}
          </>
        )}
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
                    </p>
                    {parseFloat(pendingQueryEstimate.estimatedCostUSD) > 0 && (
                      <p>
                        <strong>Estimert kostnad:</strong> ${pendingQueryEstimate.estimatedCostUSD} USD
                      </p>
                    )}
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

export default SQLPreview;