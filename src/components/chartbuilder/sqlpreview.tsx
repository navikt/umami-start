import { useState, useEffect } from 'react';
import { Heading, Link, CopyButton, Button, Alert, FormProgress } from '@navikt/ds-react';
import { ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';

interface SQLPreviewProps {
  sql: string;
  activeStep?: number;
  openFormprogress?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SQLPreview = ({ 
  sql, 
  activeStep = 1, 
  openFormprogress = true,
  onOpenChange 
}: SQLPreviewProps) => {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Check if SQL is just a basic template without metrics or groupings
  const isBasicTemplate = () => {
    if (!sql) return true;
    
    // Check if there are any SELECT columns specified or if it's just the basic structure
    const selectPattern = /SELECT\s+(\s*FROM|\s*$)/i;
    return selectPattern.test(sql);
  };

  // Check if SQL is meaningful enough to display
  const isSQLMeaningful = () => {
    if (!sql) return false;
    
    // Basic template SQL should not be shown, it's not useful yet
    if (isBasicTemplate()) return false;
    
    return true;
  };

  // Calculate if form progress should start open based on step
  const defaultOpen = activeStep < 4 && openFormprogress;

  // Used useEffect to set initial state when step changes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(defaultOpen);
    }
  }, [activeStep]);

  return (
    <div className="space-y-4 bg-white p-6 rounded-lg border shadow-sm">
      {isBasicTemplate() ? (
        // Show getting started guidance
        <div className="space-y-4">
                      <Heading level="2" size="small">
              Lag graf eller tabell
            </Heading>
          {/*
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Lag grafer og tabeller basert på data fra Umami, klare til å presenteres i Metabase.
            </p>
          </div>
          */}

          {/* Only show SQL code button if the SQL is meaningful */}
          {isSQLMeaningful() && (
            <div className="mt-4">
              <Button 
                variant="tertiary"
                size="small"
                onClick={() => setShowCode(!showCode)}
                icon={showCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                className="mb-2"
              >
                {showCode ? "Skjul SQL-kode" : "Vis SQL-kode"}
              </Button>

              {showCode && (
                <div className="relative">
                  <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                    {sql}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton
                      copyText={sql}
                      text="Kopier"
                      activeText="Kopiert!"
                      size="small"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // Show the original SQL preview instructions
        <div>
          <div className="space-y-2 mb-6">
            <Heading level="2" size="small">
              Legg til graf eller tabell i Metabase
            </Heading>
            {/* <p className="text-sm text-gray-600">
            Følg stegene under for å teste spørringen i Metabase. Du kan gjøre dette når som helst 
        underveis mens du jobber med å sette opp grafen / tabellen din.
            </p> */}
          </div>

          <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium">Åpne Metabase</p>
                  <Link 
                    href="https://metabase.ansatt.nav.no/dashboard/484" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-1"
                  >
                    Klikk her for å gå til Metabase <ExternalLink size={14} />
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium">Klikk på "ny/new"-knappen i toppmenyen</p>
                  <p className="text-sm text-gray-600 mt-1">Velg deretter "SQL-spørring / SQL query"</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-grow">
                  <p className="font-medium">Kopier og lim inn i Metabase</p>
                  <div className="mt-2">
                    {!copied ? (
                      <Button 
                        variant="primary" 
                        onClick={handleCopy} 
                        icon={<Copy size={18} />}
                        className="w-full md:w-auto"
                      >
                        Kopier spørringen
                      </Button>
                    ) : (
                      <Alert variant="success" className="w-fit p-2 flex items-center">
                        Spørringen er kopiert!
                      </Alert>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <p className="font-medium">Trykk på ▶️ "vis tabell/graf"-knappen</p>
                  <p className="text-sm text-gray-600 mt-1">Metabase viseer nå tabell. Trykk "visualiser/visualize" for å endre til graf</p>
                </div>
              </div>
            </div>
          </div>

          {sql && (
            <div className="mt-4">
              <Button 
                variant="tertiary"
                size="small"
                onClick={() => setShowCode(!showCode)}
                icon={showCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                className="mb-2"
              >
                {showCode ? "Skjul SQL-kode" : "Vis SQL-kode"}
              </Button>

              {showCode && (
                <div className="relative">
                  <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                    {sql}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton
                      copyText={sql}
                      text="Kopier"
                      activeText="Kopiert!"
                      size="small"
                    />
                  </div>

                  <div className="mt-2 mb-8 text-sm bg-yellow-50 p-3 rounded-md border border-yellow-100">
                  <p>
                    <strong>Tips:</strong> Du trenger ikke å forstå koden! Den er generert basert på valgene dine, 
                    og vil fungere når du kopierer og limer inn i Metabase.
                  </p>
                </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
      <div className="pt-0">
        <FormProgress 
          activeStep={activeStep} 
          totalSteps={4} 
          open={openFormprogress}
          onOpenChange={onOpenChange}
          interactiveSteps={false}
        >
          <FormProgress.Step>Velg nettside eller app</FormProgress.Step>
          <FormProgress.Step>Bruk filtre for å velge data</FormProgress.Step>
          <FormProgress.Step>Velg gruppering og/eller beregning</FormProgress.Step>
          <FormProgress.Step>Legg til graf eller tabell i Metabase</FormProgress.Step>
        </FormProgress>
      </div>

    </div>
  );
};

export default SQLPreview;