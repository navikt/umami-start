import { forwardRef } from "react";
import {Modal, Button, Accordion, BodyShort, Link, List, CopyButton} from "@navikt/ds-react";

interface SporingsModalProps {
    selectedItem: { name: string; id: string };
}

const SporingsModal = forwardRef<HTMLDialogElement, SporingsModalProps>(({ selectedItem }, ref) => (
    <Modal ref={ref} header={{ heading: "Sporingskode for " + selectedItem.name }}>
        <Modal.Body>
            <BodyShort spacing size="medium" style={{ margin: "15px 0px 30px 0px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                        <pre style={{whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>
                            <code>
                                &lt;script defer src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
                                        data-host-url="https://umami.nav.no" data-website-id="{selectedItem.id}"&gt;&lt;/script&gt;
                            </code>
                        </pre>
                    </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item>
                    <Accordion.Header>
                        Umami-sporingskode for Next.js-apper
                    </Accordion.Header>
                    <Accordion.Content>
                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', marginBottom: '15px'}}>
                            <code>
                                &lt;Script defer strategy="afterInteractive" src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
                                        data-host-url="https://umami.nav.no" data-website-id="{selectedItem.id}"&gt;&lt;/Script&gt;
                            </code>
                        </pre>
                        <p style={{ marginBottom: '15px' }}>
                        Benytter next.js sin innebygde import Script from 'next/script';
                        </p>
                        <p style={{ marginBottom: '15px' }}>
                            Trigges ikke koden? Forsøk å legger til export const dynamic = 'force-dynamic'; i en layout.tsx fil.
                        </p>
                        <Link target="_blank" href={`https://github.com/navikt/delta-frontend/blob/main/src/app/layout.tsx`}>
                            Kodeeksempel for Next.js-apper
                        </Link>
                    </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item>
                    <Accordion.Header>Umami-sporingskode for React med Vite.js</Accordion.Header>
                    <Accordion.Content>
                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                            <code>
                                 {`import { Helmet } from "react-helmet";`}
                                <br/>
                                &lt;Helmet&gt;<br/>
                                &lt;script defer src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
                                            data-host-url="https://umami.nav.no" data-website-id="{selectedItem.id}"&gt;&lt;/script&gt;
                                <br/>&lt;/Helmet&gt;
                            </code>
                        </pre>
                        <Link target="_blank" href={`https://github.com/navikt/reops-felgen/blob/master/src/App.tsx`}>
                            Kodeeksempel for React med Vite.js
                        </Link>
                    </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item>
                    <Accordion.Header>
                        Umami-sporingskode for Astro.js-apper
                    </Accordion.Header>
                    <Accordion.Content>
                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', marginBottom: '15px'}}>
                            <code>
                                &lt;script is:inline defer data-astro-rerun src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
                                        data-host-url="https://umami.nav.no" data-website-id="{selectedItem.id}"&gt;&lt;/script&gt;
                            </code>
                        </pre>
                        <Link target="_blank" href={`https://github.com/navikt/docs/blob/main/src/components/BaseHead.astro`}>
                            Kodeeksempel for Astro.js-apper
                        </Link>
                    </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item>
                    <Accordion.Header>Umami-sporingskode for Google Tag Manager (GTM)</Accordion.Header>
                    <Accordion.Content>
                        <pre style={{whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>
                          <code>
                            &lt;script&gt;
                                (function () &#123;
                                      var el = document.createElement('script');
                                      el.setAttribute('src', 'https://cdn.nav.no/team-researchops/sporing/sporing.js');
                                      el.setAttribute('data-host-url', 'https://umami.nav.no');
                                      el.setAttribute('data-website-id', '{selectedItem.id}');
                                      document.body.appendChild(el);
                                &#125;)();
                            &lt;/script&gt;
                          </code>
                        </pre>
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion>
            <List as="ul" title="Verdt å vite" style={{marginTop: "30px"}}>
                <List.Item>
                    Sporingskoden legges vanligvis til i &lt;head&gt;-delen på nettsiden.
                </List.Item>
                <List.Item>
                    Vil du at sporingskoden kun skal kjøre på spesifikke domener, for eksempel ikke på localhost? Da kan
                    du legge til <Link target="_blank" href={`https://umami.is/docs/tracker-configuration`}>attributtet data-domains</Link>.
                </List.Item>
                <List.Item>
                Umami sporer besøk (sidevisninger) ut av boksen. Ønsker du ikke dette? Da kan du legge til <Link target="_blank" href={`https://umami.is/docs/tracker-configuration`}>attributtet data-auto-track="false"</Link>.
                </List.Item>
            </List>
        </Modal.Body>
        <Modal.Footer>
            <Button type="button" onClick={() => (ref as React.RefObject<HTMLDialogElement>).current?.close()}>
                Lukk
            </Button>
        </Modal.Footer>
    </Modal>
));

export default SporingsModal;