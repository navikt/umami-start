import { useState } from 'react';
import { Button, CopyButton, ReadMore, Tooltip } from '@navikt/ds-react';
import { Copy } from 'lucide-react';

interface SqlCodeDisplayProps {
  sql: string;
  showEditButton?: boolean;
}

const SqlCodeDisplay = ({ sql, showEditButton = false }: SqlCodeDisplayProps) => {
  const [copiedDashboard, setCopiedDashboard] = useState(false);

  if (!sql) return null;

  const handleCopyToDashboard = () => {
    let dashboardSql = sql;
    // Replace website_id with template variable
    dashboardSql = dashboardSql.replace(/website_id\s*=\s*'([a-f0-9\-]+)'/gi, "website_id = '{{website_id}}'");
    // Escape backticks for TS template literal
    dashboardSql = dashboardSql.replace(/`/g, '\\`');

    navigator.clipboard.writeText(dashboardSql);
    setCopiedDashboard(true);
    setTimeout(() => setCopiedDashboard(false), 3000);
  };

  return (
    <div className="mt-2">
      <ReadMore header="Vis SQL-kode" size="medium">
        <div className="relative">
          <pre className="p-4 pt-12 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto text-sm">
            {sql}
          </pre>
          <div className="absolute top-2 right-2 flex gap-2">
            <CopyButton copyText={sql} text="Kopier" activeText="Kopiert!" size="small" />
            <Tooltip content="Kopier med {{website_id}} variabel for dashboards.ts">
              <Button
                size="xsmall"
                variant="tertiary"
                type="button"
                onClick={handleCopyToDashboard}
                icon={<Copy size={14} />}
                aria-label="Kopier til dashboard"
              >
                {copiedDashboard ? 'Kopiert!' : 'Dashboard'}
              </Button>
            </Tooltip>
            {showEditButton && (
              <Button
                size="xsmall"
                variant="tertiary"
                type="button"
                onClick={() => {
                  const encodedSql = encodeURIComponent(sql);
                  window.open(`/sql?sql=${encodedSql}`, '_blank');
                }}
                aria-label="Rediger SQL i BigQuery"
              >
                Rediger SQL
              </Button>
            )}
          </div>
        </div>
      </ReadMore>
    </div>
  );
};

export default SqlCodeDisplay;
