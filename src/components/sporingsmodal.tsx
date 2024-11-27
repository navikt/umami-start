import { forwardRef } from "react";
import { Modal, BodyLong, Button } from "@navikt/ds-react";

interface SporingsModalProps {
    selectedItem: { name: string; id: string };
}

const SporingsModal = forwardRef<HTMLDialogElement, SporingsModalProps>(({ selectedItem }, ref) => (
    <Modal ref={ref} header={{ heading: "Sporingskode: " + selectedItem.name }}>
        <Modal.Body>
            <BodyLong>
                <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                    <code>
                        &lt;script defer src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
                                data-host-url="https://umami.nav.no" data-website-id="{selectedItem.id}"&gt;&lt;/script&gt;
                    </code>
                </pre>
            </BodyLong>
        </Modal.Body>
        <Modal.Footer>
            <Button type="button" onClick={() => (ref as React.RefObject<HTMLDialogElement>).current?.close()}>
                Lukk
            </Button>
        </Modal.Footer>
    </Modal>
));

export default SporingsModal;