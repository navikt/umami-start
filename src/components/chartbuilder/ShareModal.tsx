import { useState, useEffect } from 'react';
import { Modal, Button, Textarea, CopyButton, Select, Checkbox, CheckboxGroup } from '@navikt/ds-react';

interface ShareModalProps {
  sql: string;
  open: boolean;
  onClose: () => void;
}

const ShareModal = ({ sql, open, onClose }: ShareModalProps) => {
  const [description, setDescription] = useState('');
  const [selectedTab, setSelectedTab] = useState('table');
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
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
    let baseUrl = `${window.location.origin}/grafdeling?sql=${encodedSql}`;
    
    if (encodedDesc) {
      baseUrl += `&beskrivelse=${encodedDesc}`;
    }
    
    if (selectedTab !== 'table') {
      baseUrl += `&tab=${selectedTab}`;
    }
    
    if (hiddenTabs.length > 0) {
      baseUrl += `&hideTabs=${hiddenTabs.join(',')}`;
    }
    
    return baseUrl;
  };

  const shareUrl = getShareUrl();

  const handleClose = () => {
    setDescription('');
    setSelectedTab('table');
    setHiddenTabs([]);
    onClose();
  };

  const tabOptions = [
    { label: 'Tabell', value: 'table' },
    { label: 'Linje', value: 'linechart' },
    { label: 'Område', value: 'areachart' },
    { label: 'Stolpe', value: 'barchart' },
    { label: 'Kake', value: 'piechart' },
  ];

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

          <Select
            label="Start på fane"
            description="Velg hvilken fane som vises når lenken åpnes"
            value={selectedTab}
            onChange={(e) => setSelectedTab(e.target.value)}
          >
            {tabOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <CheckboxGroup
            legend="Skjul graftyper"
            description="Velg graftyper du vil skjule i delingsvisningen"
            value={hiddenTabs}
            onChange={(val) => setHiddenTabs(val as string[])}
          >
            {tabOptions.map((option) => (
              <Checkbox key={option.value} value={option.value}>
                {option.label}
              </Checkbox>
            ))}
          </CheckboxGroup>

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
              kollegaer. Du kan velge hvilken fane som vises først og skjule faner du ikke ønsker å vise.
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
