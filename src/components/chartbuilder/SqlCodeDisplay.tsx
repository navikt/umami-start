import { Button, CopyButton, ReadMore } from '@navikt/ds-react';

interface SqlCodeDisplayProps {
  sql: string;
  showEditButton?: boolean;
}

const SqlCodeDisplay = ({ sql, showEditButton = false }: SqlCodeDisplayProps) => {
  if (!sql) return null;

  return (
    <div className="mt-6">
      <ReadMore header="Vis SQL-kode" size="medium">
        <div className="relative">
          <pre className="bg-gray-50 p-4 pt-12 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
            {sql}
          </pre>
          <div className="absolute top-2 right-2 flex gap-2">
            <CopyButton copyText={sql} text="Kopier" activeText="Kopiert!" size="small" />
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
