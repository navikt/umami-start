import { forwardRef } from "react";
import {
  Modal,
  Button,
  Accordion,
  BodyShort,
  Link,
  List,
  CopyButton,
  Box,
} from "@navikt/ds-react";
import { CopyBlock, a11yLight } from "react-code-blocks";
import {
  getStandardSnippet,
  getNextJsSnippet,
  getReactViteProviderSnippet,
  getReactViteHeadSnippet,
  getAstroSnippet,
  getGTMSnippet,
} from "../data/tracking-snippets";

interface SporingsModalProps {
  selectedItem: { name: string; id: string };
}

const SporingsModal = forwardRef<HTMLDialogElement, SporingsModalProps>(
  ({ selectedItem }, ref) => (
    <Modal
      ref={ref}
      header={{ heading: "Sporingskode for " + selectedItem.name }}
      width="medium"
      className="sporings-modal"
    >
      <Modal.Body>
        <BodyShort
          spacing
          size="medium"
          style={{
            margin: "15px 0px 30px 0px",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <div>
            <strong>Nettside-ID:</strong> {selectedItem.id}
          </div>
          <CopyButton
            copyText={selectedItem.id}
            text="Kopier ID"
            activeText="Kopiert!"
            size="small"
          />
        </BodyShort>

        <Accordion>
          <Accordion.Item>
            <Accordion.Header>Umami-sporingskode (standard)</Accordion.Header>
            <Accordion.Content>
              <Box
                borderWidth="1"
                borderColor="border-subtle"
                borderRadius="medium"
                padding="0"
              >
                <CopyBlock
                  wrapLongLines
                  theme={a11yLight}
                  text={getStandardSnippet(selectedItem.id)}
                  language="html"
                  showLineNumbers={false}
                />
              </Box>
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              Umami-sporingskode for Next.js-apper
            </Accordion.Header>
            <Accordion.Content>
              <Box
                borderWidth="1"
                borderColor="border-subtle"
                borderRadius="medium"
                padding="0"
                style={{ marginBottom: "15px" }}
              >
                <CopyBlock
                  wrapLongLines
                  theme={a11yLight}
                  text={getNextJsSnippet(selectedItem.id)}
                  language="jsx"
                  showLineNumbers={false}
                />
              </Box>
              <p style={{ marginBottom: "15px" }}>
                Benytter next.js sin innebygde import Script from 'next/script';
              </p>
              <p style={{ marginBottom: "15px" }}>
                Trigges ikke koden? Forsøk å legger til export const dynamic =
                'force-dynamic'; i en layout.tsx fil.
              </p>
              <Link
                target="_blank"
                href={`https://github.com/navikt/delta-frontend/blob/main/src/app/layout.tsx`}
              >
                Kodeeksempel for Next.js-apper
              </Link>
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              Umami-sporingskode for React med Vite.js
            </Accordion.Header>
            <Accordion.Content>
              <p style={{ marginBottom: "10px" }}>
                <strong>Steg 1:</strong> Installer <code>@unhead/react</code> og
                sett opp UnheadProvider i hovedkomponenten din (f.eks. App.tsx)
              </p>
              <Box
                borderWidth="1"
                borderColor="border-subtle"
                borderRadius="medium"
                padding="0"
                style={{ marginBottom: "15px" }}
              >
                <CopyBlock
                  wrapLongLines
                  text={getReactViteProviderSnippet()}
                  language="jsx"
                  showLineNumbers={false}
                  theme={a11yLight}
                />
              </Box>
              <p style={{ marginBottom: "10px" }}>
                <strong>Steg 2:</strong> Legg til sporingskoden med
                Head-komponenten
              </p>
              <Box
                borderWidth="1"
                borderColor="border-subtle"
                borderRadius="medium"
                padding="0"
                style={{ marginBottom: "15px" }}
              >
                <CopyBlock
                  wrapLongLines
                  text={getReactViteHeadSnippet(selectedItem.id)}
                  language="jsx"
                  showLineNumbers={false}
                  theme={a11yLight}
                />
              </Box>
              <Link
                target="_blank"
                href={`https://github.com/navikt/reops-felgen/blob/master/src/App.tsx`}
              >
                Kodeeksempel for React med Vite.js
              </Link>
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              Umami-sporingskode for Astro.js-apper
            </Accordion.Header>
            <Accordion.Content>
              <Box
                borderWidth="1"
                borderColor="border-subtle"
                borderRadius="medium"
                padding="0"
                style={{ marginBottom: "15px" }}
              >
                <CopyBlock
                  wrapLongLines
                  theme={a11yLight}
                  text={getAstroSnippet(selectedItem.id)}
                  language="html"
                  showLineNumbers={false}
                />
              </Box>
              <Link
                target="_blank"
                href={`https://github.com/navikt/docs/blob/main/src/components/BaseHead.astro`}
              >
                Kodeeksempel for Astro.js-apper
              </Link>
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              Umami-sporingskode for Google Tag Manager (GTM)
            </Accordion.Header>
            <Accordion.Content>
              <Box
                borderWidth="1"
                borderColor="border-subtle"
                borderRadius="medium"
                padding="0"
              >
                <CopyBlock
                  wrapLongLines
                  theme={a11yLight}
                  text={getGTMSnippet(selectedItem.id)}
                  language="javascript"
                  showLineNumbers={false}
                />
              </Box>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
        <List as="ul" title="Verdt å vite" style={{ marginTop: "30px" }}>
          <List.Item>
            Sporingskoden legges vanligvis til i &lt;head&gt;-delen på
            nettsiden.
          </List.Item>
          <List.Item>
            Vil du at sporingskoden kun skal kjøre på spesifikke domener, for
            eksempel ikke på localhost? Da kan du legge til{" "}
            <Link
              target="_blank"
              href={`https://umami.is/docs/tracker-configuration`}
            >
              attributtet data-domains
            </Link>
            .
          </List.Item>
          <List.Item>
            Umami sporer besøk (sidevisninger) ut av boksen. Ønsker du ikke
            dette? Da kan du legge til{" "}
            <Link
              target="_blank"
              href={`https://umami.is/docs/tracker-configuration`}
            >
              attributtet data-auto-track="false"
            </Link>
            .
          </List.Item>
        </List>
      </Modal.Body>
      <Modal.Footer>
        <Button
          type="button"
          onClick={() =>
            (ref as React.RefObject<HTMLDialogElement>).current?.close()
          }
        >
          Lukk
        </Button>
      </Modal.Footer>
    </Modal>
  ),
);

export default SporingsModal;
