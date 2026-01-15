import { useState, useEffect } from 'react';
import { RadioGroup, Radio, DatePicker } from '@navikt/ds-react';
import { format, parse, isValid } from 'date-fns';

interface PeriodPickerProps {
    period: string;
    onPeriodChange: (period: string) => void;
    startDate: Date | undefined;
    onStartDateChange: (date: Date | undefined) => void;
    endDate: Date | undefined;
    onEndDateChange: (date: Date | undefined) => void;
    showToday?: boolean;
    lastMonthLabel?: string;
    currentMonthLabel?: string;
}

export const PeriodPicker = ({
    period,
    onPeriodChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    showToday = false,
    lastMonthLabel = 'Forrige måned',
    currentMonthLabel = 'Denne måneden'
}: PeriodPickerProps) => {
    const [fromInputValue, setFromInputValue] = useState<string>('');
    const [toInputValue, setToInputValue] = useState<string>('');

    // Sync inputs when dates change externally (e.g. from calendar click)
    useEffect(() => {
        if (startDate) {
            setFromInputValue(format(startDate, 'dd.MM.yyyy'));
        } else {
            setFromInputValue('');
        }
    }, [startDate]);

    useEffect(() => {
        if (endDate) {
            setToInputValue(format(endDate, 'dd.MM.yyyy'));
        } else {
            setToInputValue('');
        }
    }, [endDate]);

    return (
        <>
            <RadioGroup
                legend="Periode"
                value={period}
                onChange={onPeriodChange}
                size="small"
            >
                {showToday && <Radio value="today">I dag</Radio>}
                <Radio value="current_month">{currentMonthLabel}</Radio>
                <Radio value="last_month">{lastMonthLabel}</Radio>
                <Radio value="custom">Egendefinert</Radio>
            </RadioGroup>

            {period === 'custom' && (
                <div className="mb-4 mt-2">
                    <DatePicker
                        mode="range"
                        onSelect={(range) => {
                            if (range) {
                                onStartDateChange(range.from);
                                onEndDateChange(range.to);
                            }
                        }}
                        selected={{ from: startDate, to: endDate }}
                    >
                        <div className="flex flex-col gap-2">
                            <DatePicker.Input
                                id="custom-date-from"
                                label="Fra dato"
                                value={fromInputValue}
                                onChange={(e) => {
                                    setFromInputValue(e.target.value);
                                    const date = parse(e.target.value, 'dd.MM.yyyy', new Date());
                                    if (isValid(date) && e.target.value.length === 10) {
                                        onStartDateChange(date);
                                    }
                                }}
                            />
                            <DatePicker.Input
                                id="custom-date-to"
                                label="Til dato"
                                value={toInputValue}
                                onChange={(e) => {
                                    setToInputValue(e.target.value);
                                    const date = parse(e.target.value, 'dd.MM.yyyy', new Date());
                                    if (isValid(date) && e.target.value.length === 10) {
                                        onEndDateChange(date);
                                    }
                                }}
                            />
                        </div>
                    </DatePicker>
                </div>
            )}
        </>
    );
};

export default PeriodPicker;
