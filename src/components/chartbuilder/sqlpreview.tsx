import { useState, useEffect } from 'react';
import { Heading, Link, CopyButton, Button, Alert, FormProgress } from '@navikt/ds-react';
import { ChevronDown, ChevronUp, Copy, ExternalLink, RotateCcw } from 'lucide-react';
import AlertWithCloseButton from './AlertWithCloseButton';

interface SQLPreviewProps {
  sql: string;
  activeStep?: number;
  openFormprogress?: boolean;
  onOpenChange?: (open: boolean) => void;
  filters?: Array<{ column: string; interactive?: boolean; metabaseParam?: boolean }>;
  metrics?: Array<{ column?: string }>;
  groupByFields?: string[];
  onResetAll?: () => void; // Add new prop for reset functionality
}

const SQLPreview = ({
  sql,
  activeStep = 1,
  openFormprogress = true,
  onOpenChange,
  filters = [],
  metrics = [],
  groupByFields = [],
  onResetAll,
}: SQLPreviewProps) => {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [wasManuallyOpened, setWasManuallyOpened] = useState(false);

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

  // Check for interactive date filter and visit duration combination
  const hasInteractiveDateFilter = filters.some(
    (f) => f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
  );

  const hasVisitDuration =
    metrics.some((m) => m.column === 'visit_duration') || groupByFields.includes('visit_duration');

  // Flag to show warning
  const showIncompatibilityWarning = hasInteractiveDateFilter && hasVisitDuration;

  // Track previous step to detect transitions
  const [prevStep, setPrevStep] = useState(activeStep);
  const [autoClosedFinalStep, setAutoClosedFinalStep] = useState(false);

  const FINAL_STEP = 3;

  // Update the function to track manual opening state
  const ensureFormProgressOpen = () => {
    if (onOpenChange) {
      onOpenChange(true);
      setWasManuallyOpened(true);
      setAutoClosedFinalStep(false);
    }
  };

  // Custom handler for form progress open state changes
  const handleFormProgressOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
      // If the user manually opens it, track this action
      if (open && activeStep === FINAL_STEP) {
        setWasManuallyOpened(true);
      }
    }
  };

  useEffect(() => {
    if (onOpenChange) {
      // Case 1: Moving to final step - auto-close it if it wasn't manually opened
      if (activeStep === FINAL_STEP && prevStep !== FINAL_STEP && !wasManuallyOpened) {
        onOpenChange(false);
        setAutoClosedFinalStep(true);
      }
      // Case 2: Moving back from final step to an earlier step - reopen it
      else if (prevStep === FINAL_STEP && activeStep < FINAL_STEP) {
        onOpenChange(true);
        setAutoClosedFinalStep(false);
      }
      // Case 3: Initial setup on first render
      else if (prevStep === activeStep && activeStep === 1) {
        onOpenChange(openFormprogress);
      }
      // Case 4: If parent explicitly sets openFormprogress, respect that
      else if (
        openFormprogress !== undefined &&
        prevStep !== activeStep // Only process external state changes on step changes
      ) {
        onOpenChange(openFormprogress);
      }
    }
    
    // Update previous step
    setPrevStep(activeStep);
    
    // Reset manual opening flag when changing steps (except when at step 3)
    if (prevStep !== activeStep && activeStep !== FINAL_STEP) {
      setWasManuallyOpened(false);
    }
  }, [activeStep, openFormprogress, onOpenChange, prevStep, autoClosedFinalStep, wasManuallyOpened, FINAL_STEP]);

  return (
    <>
      <div className="space-y-4 bg-white p-6 rounded-lg border shadow-sm">
        {isBasicTemplate() ? (
          // Show getting started guidance
          <div className="space-y-4">
            <Heading level="2" size="small">Klargjør spørsmålet ditt</Heading>
            
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
                  {showCode ? 'Skjul SQL-kode' : 'Vis SQL-kode'}
                </Button>

                {showCode && (
                  <div className="relative">
                    <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                      {sql}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton copyText={sql} text="Kopier" activeText="Kopiert!" size="small" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Show the original SQL preview instructions
          <div>
            <div className="space-y-2 mb-4">
              <Heading level="2" size="small">Få svaret i Metabase</Heading>

              {/* Add incompatibility warning */}
              {showIncompatibilityWarning && (
                <Alert variant="warning" className="mt-3 mb-3">
                  <div>
                    <p className="font-medium">Interaktiv dato + besøksvarighet = funker ikke</p>
                    <p className="mt-1">
                      Du bruker både interaktivt datofilter og besøksvarighet, som ikke fungerer sammen i Metabase.
                      Vurder å bruke en av de andre datofiltrene i stedet.
                    </p>
                  </div>
                </Alert>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-grow">
                    <p className="font-medium">Kopier spørsmålet</p>
                    <div className="mt-2">
                      {!copied ? (
                        <Button
                          variant="primary"
                          onClick={handleCopy}
                          icon={<Copy size={18} />}
                          className="w-full md:w-auto"
                        >
                          Kopier spørsmålet
                        </Button>
                      ) : (
                        <Alert variant="success" className="w-fit p-2 flex items-center">
                          Spørsmålet er kopiert!
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-grow">
                    <p className="font-medium mb-2">Lim inn i Metabase</p>
                    <Link
                      href="https://metabase.ansatt.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImRhdGFiYXNlIjo3MzEsInR5cGUiOiJuYXRpdmUiLCJuYXRpdmUiOnsicXVlcnkiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX19LCJkaXNwbGF5IjoidGFibGUiLCJ2aXN1YWxpemF0aW9uX3NldHRpbmdzIjp7fSwidHlwZSI6InF1ZXN0aW9uIn0="
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      Åpne Metabase <ExternalLink size={14} />
                    </Link>{' '}
                    (Merk: Hvis siden "Velg dine startdata" vises, lukk den og klikk på lenken på nytt.)
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium">
                      Trykk på <span role="img" aria-label="spill av-knapp">▶️</span> "vis resultater"-knappen
                    </p>
                    <p className="text-md text-gray-700 mt-1">
                      Trykk "visualisering" for å bytte fra tabell til graf
                    </p>
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
                  {showCode ? 'Skjul SQL-kode' : 'Vis SQL-kode'}
                </Button>

                {showCode && (
                  <div className="relative">
                    <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                      {sql}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton copyText={sql} text="Kopier" activeText="Kopiert!" size="small" />
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
            activeStep={Math.min(activeStep, FINAL_STEP)} // Ensure we never show step 4
            totalSteps={3}
            open={openFormprogress}
            onOpenChange={handleFormProgressOpenChange}
            interactiveSteps={false}
          >
            <FormProgress.Step>Velg nettside eller app</FormProgress.Step>
            <FormProgress.Step>Formuler spørsmålet</FormProgress.Step>
            <FormProgress.Step>Få svaret i Metabase</FormProgress.Step>
          </FormProgress>
        </div>
      </div>

      <div className="mt-4 mr-4">
        {/* Only show reset button after step 1 */}
        {onResetAll && activeStep > 1 && (
          <>
            <div className="flex justify-end">
              <Button
                variant="tertiary"
                size="small"
                onClick={() => {
                  onResetAll();
                  setShowAlert(true);

                  // Move this call AFTER onResetAll to ensure it happens last
                  // Use a small timeout to ensure it happens after any state changes in onResetAll
                  setTimeout(() => {
                    ensureFormProgressOpen();
                  }, 0);

                  // Auto-hide the alert after 4 seconds
                  setTimeout(() => setShowAlert(false), 4000);
                }}
                icon={<RotateCcw size={16} />}
              >
                Tilbakestill alle valg
              </Button>
            </div>

            {/* Show success alert below the button */}
            {showAlert && (
              <div className="mt-2">
                <AlertWithCloseButton variant="success">
                  Alle innstillinger ble tilbakestilt
                </AlertWithCloseButton>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default SQLPreview;