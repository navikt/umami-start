import { useState } from 'react';
import { Button, CopyButton, ReadMore, Tooltip, Heading, Link } from '@navikt/ds-react';
import { Copy, ExternalLink } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface SqlViewerProps {
  sql: string;
  showEditButton?: boolean;
  withoutReadMore?: boolean;
}

const SqlViewer = ({ sql, showEditButton = false, withoutReadMore = false }: SqlViewerProps) => {
  const [copiedDashboard, setCopiedDashboard] = useState(false);
  const [copiedMetabase, setCopiedMetabase] = useState(false);
  const isDevEnvironment =
    typeof window !== 'undefined' &&
    window.location.hostname.includes('.dev.nav.no');
  const metabaseQuestionUrl = isDevEnvironment
    ? 'https://metabase.ansatt.dev.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImxpYi90eXBlIjoibWJxbC9xdWVyeSIsImRhdGFiYXNlIjo1Njg2LCJzdGFnZXMiOlt7ImxpYi90eXBlIjoibWJxbC5zdGFnZS9uYXRpdmUiLCJuYXRpdmUiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX1dfSwiZGlzcGxheSI6InRhYmxlIiwidmlzdWFsaXphdGlvbl9zZXR0aW5ncyI6e30sInR5cGUiOiJxdWVzdGlvbiJ9'
    : 'https://metabase.ansatt.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImxpYi90eXBlIjoibWJxbC9xdWVyeSIsImRhdGFiYXNlIjoxNTQ4LCJzdGFnZXMiOlt7ImxpYi90eXBlIjoibWJxbC5zdGFnZS9uYXRpdmUiLCJuYXRpdmUiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX1dfSwiZGlzcGxheSI6InRhYmxlIiwidmlzdWFsaXphdGlvbl9zZXR0aW5ncyI6e30sInR5cGUiOiJxdWVzdGlvbiJ9';

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

  const handleCopyToMetabase = () => {
    navigator.clipboard.writeText(sql);
    setCopiedMetabase(true);
    setTimeout(() => setCopiedMetabase(false), 3000);
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
        {showEditButton && (() => {
          const encodedSql = encodeURIComponent(sql);
          const urlLength = `/sql?sql=${encodedSql}`.length;
          const isTooLong = urlLength > 2000;

          return (
            <Button
              size="xsmall"
              variant="tertiary"
              type="button"
              onClick={() => {
                if (isTooLong) {
                  window.open('/sql', '_blank');
                } else {
                  window.open(`/sql?sql=${encodedSql}`, '_blank');
                }
              }}
              aria-label="Åpne redigeringsverktøy"
            >
              Åpne redigeringsverktøy
            </Button>
          );
        })()}
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

      <div className="pt-2 border-t border-[var(--ax-border-neutral-subtle)] space-y-2">
        <Heading level="3" size="xsmall">Legg til i Metabase</Heading>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="xsmall"
            variant="secondary"
            type="button"
            onClick={handleCopyToMetabase}
            icon={<Copy size={14} />}
          >
            {copiedMetabase ? 'Kopiert!' : 'Kopier spørringen'}
          </Button>
          <Link
            href={metabaseQuestionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm"
          >
            Åpne Metabase <ExternalLink size={14} />
          </Link>
        </div>
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

export default SqlViewer;
