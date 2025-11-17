import { useState, useEffect } from 'react';
import { Modal, Button, Textarea, CopyButton } from '@navikt/ds-react';

interface ShareModalProps {
  sql: string;
  open: boolean;
  onClose: () => void;
}

const ShareModal = ({ sql, open, onClose }: ShareModalProps) => {
  const [description, setDescription] = useState('');
  const maxChars = 200;

  // On open, if description is empty, set it from URL param 'beskrivelse'
  useEffect(() => {
    if (open && description === '') {
      const urlParams = new URLSearchParams(window.location.search);
      const descParam = urlParams.get('beskrivelse');
      if (descParam) {
        setDescription(descParam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const getShareUrl = () => {
    const encodedSql = encodeURIComponent(sql);
    const encodedDesc = description.trim() ? encodeURIComponent(description.trim()) : '';
    const baseUrl = `${window.location.origin}/grafdeling?sql=${encodedSql}`;
    return encodedDesc ? `${baseUrl}&beskrivelse=${encodedDesc}` : baseUrl;
  };

  const shareUrl = getShareUrl();

  const handleClose = () => {
    setDescription('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      header={{
        heading: "Del tabell & graf",
        closeButton: true,
      }}
      width="medium"
    >
      <Modal.Body>
        <div className="space-y-4">
          <Textarea
            label="Kort beskrivende tittel"
            description={`${description.length}/${maxChars} tegn`}
            value={description}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= maxChars) {
                setDescription(value);
              }
            }}
            maxLength={maxChars}
            rows={3}
          />

          <div>
            <label className="block text-sm font-medium mb-2">Delbar lenke</label>
            <div className="flex items-start gap-2">
              <div className="flex-1 bg-gray-50 p-3 rounded border border-gray-300 text-sm break-all">
                {shareUrl}
              </div>
              <CopyButton
                copyText={shareUrl}
                text="Kopier"
                activeText="Kopiert!"
                size="small"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm">
            <p>
              <strong>Tips:</strong> Denne lenken åpner grafen i en enkel visning perfekt for deling med
              kollegaer.
            </p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Lukk
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ShareModal;
