import { useState } from 'react';
import { Button, CopyButton, ReadMore, Tooltip } from '@navikt/ds-react';
import { Copy } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface SqlCodeDisplayProps {
  sql: string;
  showEditButton?: boolean;
  withoutReadMore?: boolean;
}

const SqlCodeDisplay = ({ sql, showEditButton = false, withoutReadMore = false }: SqlCodeDisplayProps) => {
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

  const content = (
    <div className="space-y-2">
      <div className="flex justify-end gap-2 items-center">
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
      <div className="border rounded-md overflow-hidden bg-[#1e1e1e]">
        <Editor
          height="400px"
          defaultLanguage="sql"
          value={sql}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            fixedOverflowWidgets: true,
            stickyScroll: { enabled: false },
            lineNumbersMinChars: 4,
            glyphMargin: false,
            renderLineHighlight: 'none', // cleaner look for read-only
            contextmenu: false, // disable context menu for cleaner feel
          }}
        />
      </div>
    </div>
  );

  if (withoutReadMore) {
    return <div className="mt-2">{content}</div>;
  }

  return (
    <div className="mt-2">
      <ReadMore header="Vis SQL-kode" size="medium">
        {content}
      </ReadMore>
    </div>
  );
};

export default SqlCodeDisplay;
