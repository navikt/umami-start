import { useState, useRef } from 'react';
import { Select, Modal, DatePicker, Button } from '@navikt/ds-react'; // Added Button import
import { format } from 'date-fns';

interface PeriodPickerProps {
    period: string;
    onPeriodChange: (period: string) => void;
    startDate: Date | undefined;
    onStartDateChange: (date: Date | undefined) => void;
    endDate: Date | undefined;
    onEndDateChange: (date: Date | undefined) => void;
    lastMonthLabel?: string;
    currentMonthLabel?: string;
    showShortPeriods?: boolean;
}

export const PeriodPicker = ({
    period,
    onPeriodChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    lastMonthLabel = 'Forrige måned',
    currentMonthLabel = 'Denne måneden',
    showShortPeriods = true
}: PeriodPickerProps) => {
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const dateModalRef = useRef<HTMLDialogElement>(null);

    // Helper to format date range for display
    const formatDateRange = (start?: Date, end?: Date) => {
        if (!start || !end) return '';
        return `${format(start, 'dd.MM.yy')} - ${format(end, 'dd.MM.yy')}`;
    };

    const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'custom' || value === 'custom-edit') {
            onPeriodChange('custom'); // Ensure parent state is 'custom'
            setIsDateModalOpen(true);
        } else {
            onPeriodChange(value);
        }
    };

    return (
        <>
            <div className="w-full sm:w-auto min-w-[200px]">
                <Select
                    label="Periode"
                    size="small"
                    value={period === 'custom' && startDate && endDate ? 'custom' : period}
                    onChange={handlePeriodChange}
                >
                    {/* Period options in requested order */}
                    {showShortPeriods && (
                        <>
                            <option value="today">I dag</option>
                            <option value="yesterday">I går</option>
                            <option value="this_week">Denne uken</option>
                            <option value="last_7_days">Siste 7 dager</option>
                            <option value="last_week">Forrige uke</option>
                            <option value="last_28_days">Siste 28 dager</option>
                        </>
                    )}
                    <option value="current_month">{currentMonthLabel}</option>
                    <option value="last_month">{lastMonthLabel}</option>
                    {period === 'custom' && startDate && endDate ? (
                        <>
                            <option value="custom">
                                {formatDateRange(startDate, endDate)}
                            </option>
                            <option value="custom-edit">Endre datoer</option>
                        </>
                    ) : (
                        <option value="custom">Egendefinert</option>
                    )}
                </Select>
            </div>

            <Modal
                ref={dateModalRef}
                open={isDateModalOpen}
                onClose={() => setIsDateModalOpen(false)}
                header={{ heading: "Velg datoperiode", closeButton: true }}
            >
                <Modal.Body>
                    <div className="flex flex-col gap-4">
                        <DatePicker
                            mode="range"
                            selected={{ from: startDate, to: endDate }}
                            onSelect={(range) => {
                                if (range) {
                                    onStartDateChange(range.from);
                                    onEndDateChange(range.to);
                                }
                            }}
                        >
                            <div className="flex flex-col gap-2">
                                <DatePicker.Input
                                    id="custom-start-date"
                                    label="Fra dato"
                                    size="small"
                                    value={startDate ? format(startDate, 'dd.MM.yyyy') : ''}
                                />
                                <DatePicker.Input
                                    id="custom-end-date"
                                    label="Til dato"
                                    size="small"
                                    value={endDate ? format(endDate, 'dd.MM.yyyy') : ''}
                                />
                            </div>
                        </DatePicker>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type="button"
                        onClick={() => {
                            if (startDate && endDate) {
                                onPeriodChange('custom');
                                setIsDateModalOpen(false);
                            }
                        }}
                        disabled={!startDate || !endDate}
                    >
                        Bruk datoer
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setIsDateModalOpen(false)}
                    >
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default PeriodPicker;
