import { Heading, Link, CopyButton } from '@navikt/ds-react';

interface SQLPreviewProps {
  sql: string;
}

const SQLPreview = ({ sql }: SQLPreviewProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2 py-4 pt-6">
        <Heading level="2" size="small">
          SQL-kode for Metabase
        </Heading>
        <p className="text-sm text-gray-600">
          🔄 SQL-koden oppdateres automatisk når du gjør endringer.
        </p>
      </div>

      <ol className="list-decimal list-inside text-sm text-gray-600 mb-4">
        <li>
          <Link href="https://metabase.ansatt.nav.no/dashboard/484" target="_blank" rel="noopener noreferrer">
            Åpne Metabase
          </Link> og klikk på den blå "Ny / New" knappen i toppmenyen.
        </li>
        <li>Velg "SQL-spørring / SQL query" fra menyen som vises.</li>
        <li>Kopier og kjør SQL-koden nedenfor og lim den inn i spørringseditoren.</li>
      </ol>

      {sql && (
        <div className="relative">
          <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-200px)] overflow-y-auto">
            {sql}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton
              copyText={sql}
              text="Kopier SQL"
              activeText="Kopiert!"
              size="small"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SQLPreview;