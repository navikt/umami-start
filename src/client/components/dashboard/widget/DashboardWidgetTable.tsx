import { Table, Pagination } from '@navikt/ds-react';
import { ExternalLink } from 'lucide-react';
import type { DashboardRow } from './dashboardWidgetUtils.ts';
import { formatTableValue, isClickablePath } from './dashboardWidgetUtils.ts';
import { translateValue } from '../../../lib/translations.ts';

interface DashboardWidgetTableProps {
    data: DashboardRow[];
    page: number;
    onPageChange: (page: number) => void;
    showTotal?: boolean;
    onSelectUrl: (url: string) => void;
}

const DashboardWidgetTable = ({ data, page, onPageChange, showTotal, onSelectUrl }: DashboardWidgetTableProps) => {
    let tableData = data;

    if (showTotal) {
        tableData = data.filter((row) => !Object.values(row).includes('__TOTAL__'));
    }

    const rowsPerPage = 10;
    const totalRows = tableData.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const currentData = tableData.slice(start, end);

    return (
        <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
                <Table size="small">
                    <Table.Header>
                        <Table.Row>
                            {Object.keys(tableData[0] || data[0]).map(key => (
                                <Table.HeaderCell key={key}>{key}</Table.HeaderCell>
                            ))}
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {currentData.map((row, i) => {
                            const keys = Object.keys(row);
                            return (
                                <Table.Row key={i}>
                                    {keys.map((key, j) => {
                                        const val = (row as Record<string, unknown>)[key];
                                        const rawString = formatTableValue(val);
                                        const translatedVal = String(translateValue(key, rawString));
                                        const displayVal = typeof val === 'number'
                                            ? val.toLocaleString('nb-NO')
                                            : translatedVal;
                                        const clickable = isClickablePath(val);
                                        return (
                                            <Table.DataCell
                                                key={j}
                                                className={`whitespace-nowrap ${clickable ? 'cursor-pointer' : ''}`}
                                                title={rawString}
                                                onClick={clickable ? () => onSelectUrl(val) : undefined}
                                            >
                                                {clickable ? (
                                                    <span className="text-blue-600 hover:underline flex items-center gap-1">
                                                        {displayVal} <ExternalLink className="h-3 w-3" />
                                                    </span>
                                                ) : (
                                                    displayVal
                                                )}
                                            </Table.DataCell>
                                        );
                                    })}
                                </Table.Row>
                            );
                        })}
                    </Table.Body>
                </Table>
            </div>
            {totalRows > rowsPerPage && (
                <div className="flex justify-center">
                    <Pagination
                        page={page}
                        onPageChange={onPageChange}
                        count={totalPages}
                        size="small"
                    />
                </div>
            )}
        </div>
    );
};

export default DashboardWidgetTable;
