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
      
      <div className="mt-3 bg-white p-4 rounded-md border shadow-sm">
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              !hasDateFilter() || selectedDateRange === 'all'
                ? 'bg-blue-600 text-white border-blue-700' 
                : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
            onClick={() => applyDateRange('all')}
          >
            Alt
          </button>
          {DATE_RANGE_SUGGESTIONS.map((dateRange) => (
            <button
              key={dateRange.id}
              className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                selectedDateRange === dateRange.id 
                  ? 'bg-blue-600 text-white border-blue-700' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
              onClick={() => applyDateRange(dateRange.id)}
            >
              {dateRange.label}
            </button>
          ))}
        </div>

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

        <div className="mt-2 text-xs text-gray-600">
          {getStartDateDisplay()}
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
