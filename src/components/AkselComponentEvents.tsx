import { useState, useMemo } from 'react';
import { 
  Heading, 
  VStack, 
  Box, 
  Search,
  Label,
  Tag,
  Accordion,
  Table,
} from '@navikt/ds-react';

// Define the component data structure
const akselComponentEvents = [
  {
    component: "Accordion",
    events: [
      { name: "accordion åpnet", details: { komponentId: "string", tittelTekst: "string" } },
      { name: "accordion lukket", details: { komponentId: "string", tittelTekst: "string" } }
    ]
  },
  {
    component: "Alert",
    events: [
      { name: "alert lukket", details: { alertType: "string", alertVariant: "string" } }
    ]
  },
  {
    component: "Button",
    events: [
      { name: "knapp klikket", details: { knappTekst: "string", knappType: "string", knappVariant: "string" } }
    ]
  },
  {
    component: "Chat",
    events: [
      { name: "chat åpnet", details: { chatId: "string" } },
      { name: "chat lukket", details: { chatId: "string" } },
      { name: "chat melding sendt", details: { chatId: "string" } }
    ]
  },
  {
    component: "Checkbox",
    events: [
      { name: "avkrysningsboks valgt", details: { sjekkboksId: "string", sjekkboksTekst: "string", sjekkboksVerdi: "boolean" } }
    ]
  },
  {
    component: "Chips",
    events: [
      { name: "chip valgt", details: { chipTekst: "string", chipVerdi: "string" } },
      { name: "chip fjernet", details: { chipTekst: "string", chipVerdi: "string" } }
    ]
  },
  // More components follow the same pattern
  {
    component: "ComboboxBeta",
    events: [
      { name: "combobox valg endret", details: { valgtVerdi: "string", valgtTekst: "string" } }
    ]
  },
  {
    component: "ConfirmationPanel",
    events: [
      { name: "bekreftelsespanel huket av", details: { panelId: "string", panelTekst: "string" } },
      { name: "bekreftelsespanel avhuket", details: { panelId: "string", panelTekst: "string" } }
    ]
  },
  {
    component: "CopyButton",
    events: [
      { name: "tekst kopiert", details: { kopieringsTekst: "string" } }
    ]
  },
  {
    component: "DatePicker",
    events: [
      { name: "dato valgt", details: { datoVerdi: "string", datoFelt: "string" } }
    ]
  },
  {
    component: "Dropdown",
    events: [
      { name: "dropdown åpnet", details: { dropdownId: "string" } },
      { name: "dropdown lukket", details: { dropdownId: "string" } },
      { name: "dropdown valg valgt", details: { valgtVerdi: "string", valgtTekst: "string" } }
    ]
  },
  {
    component: "ExpansionCard",
    events: [
      { name: "utvidbart kort åpnet", details: { kortId: "string", kortTittel: "string" } },
      { name: "utvidbart kort lukket", details: { kortId: "string", kortTittel: "string" } }
    ]
  },
  {
    component: "FileUpload",
    events: [
      { name: "fil lastet opp", details: { filNavn: "string", filStørrelse: "number", filType: "string" } },
      { name: "fil fjernet", details: { filNavn: "string" } }
    ]
  },
  {
    component: "Modal",
    events: [
      { name: "modal åpnet", details: { modalId: "string", modalTittel: "string" } },
      { name: "modal lukket", details: { modalId: "string", modalTittel: "string", lukkMetode: "string" } }
    ]
  },
  {
    component: "ReadMore",
    events: [
      { name: "les mer åpnet", details: { lesMerId: "string", lesMerTittel: "string" } },
      { name: "les mer lukket", details: { lesMerId: "string", lesMerTittel: "string" } }
    ]
  },
  {
    component: "Search",
    events: [
      { name: "søk gjennomført", details: { søkeTekst: "string", søkeResultater: "number" } },
      { name: "søkeforslag valgt", details: { valgtForslag: "string" } }
    ]
  },
  {
    component: "Select",
    events: [
      { name: "nedtrekksliste valg endret", details: { valgtVerdi: "string", valgtTekst: "string", listeId: "string" } }
    ]
  },
  {
    component: "Tabs",
    events: [
      { name: "fane byttet", details: { faneId: "string", faneTekst: "string", fraFane: "string", tilFane: "string" } }
    ]
  },
  {
    component: "TextField",
    events: [
      { name: "tekstfelt utfylt", details: { feltId: "string", feltNavn: "string", harVerdi: "boolean" } }
    ]
  },
];

const getExampleValue = (key: string, componentName: string) => {
  switch (key) {
    // IDs
    case 'komponentId': return `${componentName.toLowerCase()}-1`;
    case 'modalId': return 'bekreftelses-modal';
    case 'panelId': return 'informasjons-panel';
    case 'faneId': return 'skjema-oversikt';
    case 'chatId': return 'bruker-hjelp';
    case 'sjekkboksId': return 'godta-vilkaar';
    case 'feltId': return 'bruker-epost';
    case 'dropdownId': return 'velg-kategori';
    case 'lesMerId': return 'mer-info';
    
    // Text content
    case 'knappTekst': return 'Send skjema';
    case 'tittelTekst': return 'Skjemaoversikt';
    case 'sjekkboksTekst': return 'Jeg godtar vilkårene';
    case 'modalTittel': return 'Bekreft valg';
    case 'chipTekst': return 'Filter: Aktive';
    case 'kopieringsTekst': return 'https://nav.no/skjema';
    case 'lesMerTittel': return 'Mer informasjon';
    case 'feltNavn': return 'epost';
    
    // Values
    case 'valgtVerdi': return 'deltid';
    case 'valgtTekst': return 'Deltidsjobb';
    case 'søkeTekst': return 'stønad';
    case 'søkeResultater': return '42';
    case 'datoVerdi': return '2024-06-15';
    case 'datoFelt': return 'startDato';
    case 'harVerdi': return 'true';
    case 'filNavn': return 'vedlegg.pdf';
    case 'filStørrelse': return '1024';
    case 'filType': return 'application/pdf';
    case 'sjekkboksVerdi': return 'true';
    
    // Types and variants
    case 'alertType': return 'warning';
    case 'alertVariant': return 'info';
    case 'knappType': return 'submit';
    case 'knappVariant': return 'primary';
    case 'chipVerdi': return 'aktiv';
    
    // Navigation
    case 'fraFane': return 'oversikt';
    case 'tilFane': return 'detaljer';
    case 'faneTekst': return 'Skjemadetaljer';
    
    // Methods
    case 'lukkMetode': return 'escape';
    
    default: return 'eksempel-verdi';
  }
};

// Update the ComponentAccordion component
const ComponentAccordion = ({ component }: { component: { component: string; events: Array<{ name: string; details: Record<string, string | undefined> }> } }) => (
  <Accordion>
    <Accordion.Item>
      <Accordion.Header>
        <div className="flex justify-between items-center w-full py-2">
          <span className="font-medium">{component.component}</span>
          <Tag variant="neutral" size="xsmall" className="ml-2 mr-8">{component.events.length} hendelse{component.events.length !== 1 ? 'r' : ''}</Tag>
        </div>
      </Accordion.Header>
      <Accordion.Content>
        {component.events.map((event, eventIndex) => (
          <div key={event.name} className={eventIndex > 0 ? 'mt-10' : 'mt-2'}>
            <span className='text-xl '><strong>Hendelse: </strong> {event.name}</span>
            <Table className="mt-5" size="small">
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Detalj</Table.HeaderCell>
                  <Table.HeaderCell>Forklaring</Table.HeaderCell>
                  <Table.HeaderCell>Eksempel</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {Object.entries(event.details).map(([key]) => (
                  <Table.Row key={key}>
                    <Table.DataCell>
                      <code>{key}</code>
                    </Table.DataCell>
                    <Table.DataCell>
                      {key === 'knappTekst' ? 'Teksten på knappen' : 
                       key === 'komponentId' ? 'Unik ID for komponenten' :
                       key === 'tittelTekst' ? 'Tekst i overskriften' : 
                       key === 'valgtVerdi' ? 'Verdien som ble valgt' :
                       key === 'modalId' ? 'ID for modal-dialogen' :
                       key === 'søkeTekst' ? 'Teksten som ble søkt etter' :
                       key === 'søkeResultater' ? 'Antall søketreff' :
                       key === 'filNavn' ? 'Navnet på filen' :
                       key === 'filStørrelse' ? 'Filstørrelse i KB' :
                       key === 'filType' ? 'Type fil (MIME)' :
                       key === 'harVerdi' ? 'Om feltet har verdi' :
                       key === 'lukkMetode' ? 'Hvordan dialogen ble lukket' :
                       key === 'faneTekst' ? 'Tekst på fanen' :
                       key === 'alertType' ? 'Type varsel' :
                       key === 'feltNavn' ? 'Navn på feltet' :
                       key === 'knappVariant' ? 'Variant av knappen (primær/sekundær)' :
                       'Identifikator for komponenten'}
                    </Table.DataCell>
                    <Table.DataCell>
                      <code>{getExampleValue(key, component.component)}</code>
                    </Table.DataCell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        ))}
      </Accordion.Content>
    </Accordion.Item>
  </Accordion>
);

const AkselComponentEvents = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredComponents = useMemo(() => {
    if (!searchTerm.trim()) {
      return akselComponentEvents;
    }
    
    return akselComponentEvents.filter(component => 
      component.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
      component.events.some(event => 
        event.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm]);

  // Group components by first letter for better organization
  const groupedComponents = useMemo(() => {
    const groups: Record<string, typeof akselComponentEvents> = {};
    
    filteredComponents.forEach(component => {
      const firstLetter = component.component[0].toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(component);
    });
    
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredComponents]);

  // Fix search functionality
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  return (
    <section id="aksel-komponenter">
      <Heading level="2" size="medium" spacing>
        Hendelsesnavn og detaljer for Aksel-komponenter
      </Heading>
      <p className="mb-6">
      For enhetlig sporing på tvers av team ved bruk av Aksel-komponenter, anbefaler vi disse hendelsesnavnene og detaljene. Dette forenkler analysearbeidet.
      </p>

      <Box 
        padding="6" 
        borderRadius="medium"
        background="surface-subtle"
        className="mb-8"
      >
        <Label htmlFor="component-search" spacing>Søk etter komponenter eller hendelsesnavn</Label>
        <Search 
          id="component-search"
          label="Søk" 
          size="medium"
          variant="simple"
          onChange={handleSearchChange}
          onClear={() => setSearchTerm("")}
          value={searchTerm}
        />

        {searchTerm && (
          <div className="mt-4 text-sm text-text-subtle">
            {filteredComponents.length === 0 ? 
              'Ingen komponenter funnet' : 
              `Fant ${filteredComponents.length} ${filteredComponents.length === 1 ? 'komponent' : 'komponenter'}`
            }
          </div>
        )}
      </Box>

      {/* Simplified structure with just one tab */}
      <Box 
        padding="6" 
        borderWidth="1" 
        borderRadius="medium" 
        borderColor="border-subtle" 
        className="mt-6 mb-8"
      >
        <div className="flex items-center mb-4 pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <Heading level="3" size="small" className="m-0">Alle komponenter</Heading>
            <Tag variant="neutral" size="xsmall">{filteredComponents.length}</Tag>
          </div>
        </div>
        
        {filteredComponents.length === 0 ? (
          <Box padding="6" background="surface-subtle" borderRadius="medium" className="text-center">
            <p>Ingen komponenter funnet som samsvarer med søket ditt.</p>
          </Box>
        ) : (
          <div>
            {searchTerm.trim() ? (
              <VStack gap="0">
                {filteredComponents.map((component) => (
                  <ComponentAccordion key={component.component} component={component} />
                ))}
              </VStack>
            ) : (
              <div>
                {groupedComponents.map(([letter, components]) => (
                  <div key={letter} className="mb-8">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-action-subtle text-text-action">
                        <span className="text-xl font-medium">{letter}</span>
                      </div>
                      <div className="h-px bg-border-subtle flex-grow ml-4"></div>
                    </div>
                    
                    <VStack gap="0" className="ml-2">
                      {components.map((component) => (
                        <ComponentAccordion key={component.component} component={component} />
                      ))}
                    </VStack>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Box>
    </section>
  );
};

export default AkselComponentEvents;
