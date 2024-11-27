import { forwardRef } from "react";
import {Modal, Button, Accordion, BodyShort} from "@navikt/ds-react";

interface SporingsModalProps {
    selectedItem: { name: string; id: string };
}

const SporingsModal = forwardRef<HTMLDialogElement, SporingsModalProps>(({ selectedItem }, ref) => (
    <Modal ref={ref} header={{ heading: "Sporingskode: " + selectedItem.name }}>
        <Modal.Body>
            <BodyShort spacing size="medium" style={{ marginTop: "10px",  marginBottom: "30px" }}>
              Sporingskoden legges til i &lt;head&gt; på nettsiden.
            </BodyShort>

            <Accordion>
                <Accordion.Item defaultOpen>
                    <Accordion.Header>Standard Umami sporingskode</Accordion.Header>
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
                        Sporingskode for Astro.js apper
                    </Accordion.Header>
                    <Accordion.Content>
                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                            <code>
                                &lt;script defer data-astro-rerun src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
                                        data-host-url="https://umami.nav.no" data-website-id="{selectedItem.id}"&gt;&lt;/script&gt;
                            </code>
                        </pre>
                    </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item>
                    <Accordion.Header>Sporingskode for React Vite.js apper</Accordion.Header>
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
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion>
        </Modal.Body>
        <Modal.Footer>
            <Button type="button" onClick={() => (ref as React.RefObject<HTMLDialogElement>).current?.close()}>
                Lukk
            </Button>
        </Modal.Footer>
    </Modal>
));

export default SporingsModal;