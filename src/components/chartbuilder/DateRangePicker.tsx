import { Heading, DatePicker } from '@navikt/ds-react';
import { format, startOfMonth, subMonths, startOfYear, subDays } from 'date-fns';
import { Filter } from '../../types/chart';
import { useState, useEffect } from 'react';

// Date range suggestions for quick date filtering
const DATE_RANGE_SUGGESTIONS = [
{
    id: 'today',
    label: 'I dag',
    getRange: () => {
        const today = new Date();
        return {
        from: today,
        to: today
        };
    }
    },
    {
    id: 'yesterday',
    label: 'I går',
    getRange: () => {
        const yesterday = subDays(new Date(), 1);
        return {
        from: yesterday,
        to: yesterday
        };
    }
    },
  {
    id: 'thismonth',
    label: 'Denne måneden',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: new Date()
    })
  },
  {
    id: 'lastmonth',
    label: 'Forrige måned',
    getRange: () => {
      const today = new Date();
      const firstDayOfCurrentMonth = startOfMonth(today);
      const lastMonth = subMonths(firstDayOfCurrentMonth, 1);
      const endOfLastMonth = subDays(firstDayOfCurrentMonth, 1);
      return {
        from: lastMonth,
        to: endOfLastMonth
      };
    }
  },
  {
    id: 'thisyear',
    label: 'I år',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: new Date()
    })
  }
];

// Add dynamic date range options
const DYNAMIC_DATE_RANGES = [
  {
    id: 'today_dynamic',
    label: 'I dag',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), DAY)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'yesterday_dynamic',
    label: 'I går',
    fromSQL: "DATE_TRUNC(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY), DAY)",
    toSQL: "DATE_SUB(DATE_TRUNC(CURRENT_TIMESTAMP(), DAY), INTERVAL 1 SECOND)"
  },
  {
    id: 'this_week',
    label: 'Denne uken',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), WEEK(MONDAY))",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'last_week',
    label: 'Forrige uke',
    fromSQL: "TIMESTAMP(DATE_SUB(DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY)), INTERVAL 1 WEEK))",
    toSQL: "TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY)))"
  },
  {
    id: 'last7days',
    label: 'Siste 7 dager',
    fromSQL: "TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'last30days',
    label: 'Siste 30 dager',
    fromSQL: "TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'thismonth_dynamic',
    label: 'Denne måneden',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), MONTH)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'lastmonth_dynamic',
    label: 'Forrige måned',
    fromSQL: "TIMESTAMP(DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 MONTH))",
    toSQL: "TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))"
  },
  {
    id: 'thisyear_dynamic',
    label: 'I år',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), YEAR)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'lastyear_dynamic',
    label: 'I fjor',
    fromSQL: "TIMESTAMP(DATE_SUB(DATE_TRUNC(CURRENT_DATE(), YEAR), INTERVAL 1 YEAR))",
    toSQL: "TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), YEAR))"
  }
];

// Add time unit options
const TIME_UNITS = [
  { value: 'minute', label: 'Minutt' },
  { value: 'hour', label: 'Time' },
  { value: 'day', label: 'Dag' },
  { value: 'week', label: 'Uke' },
  { value: 'month', label: 'Måned' },
  { value: 'quarter', label: 'Kvartal' },
  { value: 'year', label: 'År' }
];

// Add current period options
const CURRENT_PERIODS = [
  {
    id: 'current_hour',
    label: 'Time',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), HOUR)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'current_day',
    label: 'Dag',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), DAY)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'current_week',
    label: 'Uke',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), WEEK(MONDAY))",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'current_month',
    label: 'Måned',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), MONTH)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'current_quarter',
    label: 'Kvartalet',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), QUARTER)",
    toSQL: "CURRENT_TIMESTAMP()"
  },
  {
    id: 'current_year',
    label: 'År',
    fromSQL: "DATE_TRUNC(CURRENT_TIMESTAMP(), YEAR)",
    toSQL: "CURRENT_TIMESTAMP()"
  }
];

interface DateRangePickerProps {
  filters: Filter[];
  setFilters: (filters: Filter[]) => void;
  maxDaysAvailable: number;
  selectedDateRange: string;
  setSelectedDateRange: (range: string) => void;
  customPeriodInputs: Record<number, {amount: string, unit: string}>;
  setCustomPeriodInputs: (inputs: Record<number, {amount: string, unit: string}>) => void;
}

interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

const DateRangePicker = ({
  filters,
  setFilters,
  maxDaysAvailable,
  selectedDateRange,
  setSelectedDateRange,
}: DateRangePickerProps) => {
  // Calculate available date range
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);
  // Add state for date mode (fixed vs dynamic)
  const [dateMode, setDateMode] = useState<'frequent' | 'dynamic' | 'fixed'>('frequent');
  const [relativeMode, setRelativeMode] = useState<'current' | 'previous'>('current');
  const [selectedUnit, setSelectedUnit] = useState('day');
  const [numberOfUnits, setNumberOfUnits] = useState('1');

  const hasDateFilter = (): boolean => {
    return filters.some(filter => filter.column === 'created_at');
  };

  // Convert max days available to a specific date
  useEffect(() => {
    if (maxDaysAvailable) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - maxDaysAvailable);
      setFromDate(startDate);
    }
  }, [maxDaysAvailable]);

  // Generate SQL for date range
  const generateDateRangeSQL = (from: Date, to: Date): {fromSQL: string, toSQL: string} => {
    const fromSql = `TIMESTAMP('${format(from, 'yyyy-MM-dd')}')`;
    const toSql = `TIMESTAMP('${format(to, 'yyyy-MM-dd')}T23:59:59')`;
    return { fromSQL: fromSql, toSQL: toSql };
  };

  // Function to generate SQL for previous periods
  const generatePreviousPeriodSQL = (amount: string, unit: string): { fromSQL: string, toSQL: string } => {
    const normalizedUnit = unit.toUpperCase();
    return {
      fromSQL: `DATE_TRUNC(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${amount} ${normalizedUnit}), ${normalizedUnit})`,
      toSQL: `DATE_SUB(DATE_TRUNC(CURRENT_TIMESTAMP(), ${normalizedUnit}), INTERVAL 1 SECOND)`
    };
  };

  // Apply a custom date range picked from the calendar
  const applyCustomDateRange = (from: Date, to: Date) => {
    setSelectedDateRange('custom');
    
    // Generate SQL expressions
    const { fromSQL, toSQL } = generateDateRangeSQL(from, to);
    
    // Find existing date filters
    const filtersWithoutDate = filters.filter(f => f.column !== 'created_at');
    
    // Create new date range filters
    const newFilters = [
      {
        column: 'created_at',
        operator: '>=',
        value: fromSQL,
        dateRangeType: 'custom'
      },
      {
        column: 'created_at',
        operator: '<=',
        value: toSQL,
        dateRangeType: 'custom'
      }
    ];
    
    // Update filters
    setFilters([...filtersWithoutDate, ...newFilters]);
  };

  // Apply a preset date range
  const applyDateRange = (rangeId: string) => {
    if (rangeId === 'all') {
      setSelectedDateRange('all');
      setFilters(filters.filter(f => f.column !== 'created_at'));
      setSelectedRange(undefined);
      return;
    }
    
    if (selectedDateRange === rangeId) {
      setSelectedDateRange('all');
      setFilters(filters.filter(f => f.column !== 'created_at'));
      setSelectedRange(undefined);
      return;
    }
    
    // Handle fixed date ranges
    if (dateMode === 'fixed') {
      const dateRange = DATE_RANGE_SUGGESTIONS.find(dr => dr.id === rangeId);
      if (!dateRange) return;
      
      setSelectedDateRange(rangeId);
      
      // Get date range from the suggestion
      const range = dateRange.getRange();
      
      // Apply the range
      applyCustomDateRange(range.from, range.to);
      
      // Update the date picker UI
      setSelectedRange({
        from: range.from,
        to: range.to
      });
    } 
    // Handle dynamic date ranges
    else {
      const dynamicRange = DYNAMIC_DATE_RANGES.find(dr => dr.id === rangeId);
      if (!dynamicRange) return;
      
      setSelectedDateRange(rangeId);
      
      // Find existing date filters
      const filtersWithoutDate = filters.filter(f => f.column !== 'created_at');
      
      // Create new dynamic date range filters
      const newFilters = [
        {
          column: 'created_at',
          operator: '>=',
          value: dynamicRange.fromSQL,
          dateRangeType: 'dynamic'
        },
        {
          column: 'created_at',
          operator: '<=',
          value: dynamicRange.toSQL,
          dateRangeType: 'dynamic'
        }
      ];
      
      // Update filters
      setFilters([...filtersWithoutDate, ...newFilters]);
      
      // Clear the date picker UI since it's not relevant for dynamic dates
      setSelectedRange(undefined);
    }
  };

  // Get message about available data range
  const getStartDateDisplay = (): string => {
    if (!maxDaysAvailable) return 'Velg nettside for å se tilgjengelig data.';
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - maxDaysAvailable);
    
    const day = String(startDate.getDate()).padStart(2, '0');
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const year = startDate.getFullYear();
    
    return `Data er tilgjengelig fra ${day}.${month}.${year} til i dag.`;
  };

  // Format dates for display in inputs
  const formatDate = (date: Date | undefined): string => {
    return date ? format(date, 'dd.MM.yyyy') : '';
  };

  return (
    <div className="mb-6">
      <Heading level="3" size="xsmall" spacing>
        Datoområde
      </Heading>
      
      <div className="mt-3 bg-white p-4 rounded-md border shadow-inner">
        {/* Date mode toggle buttons */}
        <div className="flex gap-2 mb-6">
          <button 
            className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              dateMode === 'frequent'
                ? 'bg-blue-600 text-white border-blue-700' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
            onClick={() => setDateMode('frequent')}
          >
            Ofte brukte
          </button>
          <button 
            className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              dateMode === 'dynamic'
                ? 'bg-blue-600 text-white border-blue-700' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
            onClick={() => setDateMode('dynamic')}
          >
            Relative datoer
          </button>
          <button 
            className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              dateMode === 'fixed'
                ? 'bg-blue-600 text-white border-blue-700' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
            onClick={() => setDateMode('fixed')}
          >
            Bestemte datoer
          </button>
        </div>

        {/* Content for each mode */}
        {dateMode === 'frequent' && (
          <div className="flex flex-wrap gap-2">
            <button 
              className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                !hasDateFilter() || selectedDateRange === 'all'
                  ? 'bg-blue-600 text-white border-blue-700' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
              onClick={() => applyDateRange('all')}
            >
              Alt
            </button>
            {DYNAMIC_DATE_RANGES.map((period) => (
              <button
                key={period.id}
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  selectedDateRange === period.id
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => {
                  const filtersWithoutDate = filters.filter(f => f.column !== 'created_at');
                  setFilters([
                    ...filtersWithoutDate,
                    {
                      column: 'created_at',
                      operator: '>=',
                      value: period.fromSQL,
                      dateRangeType: 'dynamic'
                    },
                    {
                      column: 'created_at',
                      operator: '<=',
                      value: period.toSQL,
                      dateRangeType: 'dynamic'
                    }
                  ]);
                  setSelectedDateRange(period.id);
                }}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}

        {dateMode === 'dynamic' && (
          <div className="mb-2">
            <div className="flex gap-2 mb-6">
              <button
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  relativeMode === 'current'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => setRelativeMode('current')}
              >
                Nåværende
              </button>
              <button
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  relativeMode === 'previous'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => setRelativeMode('previous')}
              >
                Tidligere
              </button>
            </div>

            {relativeMode === 'current' ? (
              <div className="flex flex-wrap gap-2">
                {CURRENT_PERIODS.map((period) => (
                  <button
                    key={period.id}
                    className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      selectedDateRange === period.id
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      const filtersWithoutDate = filters.filter(f => f.column !== 'created_at');
                      setFilters([
                        ...filtersWithoutDate,
                        {
                          column: 'created_at',
                          operator: '>=',
                          value: period.fromSQL,
                          dateRangeType: 'dynamic'
                        },
                        {
                          column: 'created_at',
                          operator: '<=',
                          value: period.toSQL,
                          dateRangeType: 'dynamic'
                        }
                      ]);
                      setSelectedDateRange(period.id);
                    }}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Antall
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfUnits}
                    onChange={(e) => setNumberOfUnits(e.target.value)}
                    className="w-20 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periode
                  </label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => {
                      setSelectedUnit(e.target.value);
                      const sql = generatePreviousPeriodSQL(numberOfUnits, e.target.value);
                      const filtersWithoutDate = filters.filter(f => f.column !== 'created_at');
                      setFilters([
                        ...filtersWithoutDate,
                        {
                          column: 'created_at',
                          operator: '>=',
                          value: sql.fromSQL,
                          dateRangeType: 'dynamic'
                        },
                        {
                          column: 'created_at',
                          operator: '<=',
                          value: sql.toSQL,
                          dateRangeType: 'dynamic'
                        }
                      ]);
                    }}
                    className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIME_UNITS.map(unit => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {dateMode === 'fixed' && (
          <DatePicker className="pt-4"
            mode="range"
            selected={selectedRange}
            onSelect={(range) => {
              if (range) {
                setSelectedRange(range);
                if (range.from && range.to) {
                  applyCustomDateRange(range.from, range.to);
                }
              }
            }}
            fromDate={fromDate}
            showWeekNumber
          >
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <DatePicker.Input
                  label="Fra dato"
                  id="date-from"
                  value={formatDate(selectedRange?.from)}
                  size="small"
                />
              </div>
              <div>
                <DatePicker.Input
                  label="Til dato"
                  id="date-to"
                  value={formatDate(selectedRange?.to)}
                  size="small"
                />
              </div>
            </div>
          </DatePicker>
        )}

        <div className="mt-3 text-xs text-gray-600">
          {getStartDateDisplay()}
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
