import { Link, List, Heading } from '@navikt/ds-react';
import Kontaktboks from '../theme/Kontaktboks/Kontaktboks';
import { useMarketingSupport } from '../../hooks/useSiteimproveSupport';

export type AnalyticsPage = 'brukerreiser' | 'trakt' | 'brukerlojalitet' | 'grafbygger' | 'brukersammensetning' | 'event-explorer' | 'trafikkanalyse' | 'markedsanalyse' | 'diagnose' | 'enkeltbrukere' | 'personvern' | 'hendelsesreiser' | 'sql' | 'grafdeling' | 'odelagte-lenker' | 'stavekontroll';

interface AnalyticsNavigationProps {
    currentPage?: AnalyticsPage;

    className?: string;
    domain?: string;
    websiteName?: string;
}

export const analyticsPages = [
    {
        id: 'grafbygger',
        href: '/grafbygger',
        label: 'Tilpasset analyse',
        description: 'Lag egne grafer eller tabeller'
    },
    {
        id: 'trafikkanalyse',
        href: '/trafikkanalyse',
        label: 'Trafikkoversikt',
        description: 'Se besøk over tid og trafikkilder'
    },
    {
        id: 'brukersammensetning',
        href: '/brukersammensetning',
        label: 'Brukerdetaljer',
        description: 'Se informasjon om besøkende'
    },
    {
        id: 'brukerreiser',
        href: '/brukerreiser',
        label: 'Navigasjonsflyt',
        description: 'Se hvilke veier folk tar på nettsiden'
    },
    {
        id: 'hendelsesreiser',
        href: '/hendelsesreiser',
        label: 'Hendelsesforløp',
        description: 'Se rekkefølgen av hendelser på en side'
    },
    {
        id: 'trakt',
        href: '/trakt',
        label: 'Trakt',
        description: 'Se hvor folk faller fra i en prosess'
    },
    {
        id: 'enkeltbrukere',
        href: '/brukerprofiler',
        label: 'Enkeltbrukere',
        description: 'Se info om individuelle besøkende'
    },
    {
        id: 'brukerlojalitet',
        href: '/brukerlojalitet',
        label: 'Gjenbesøk',
        description: 'Se hvor mange som kommer tilbake'
    },
    {
        id: 'event-explorer',
        href: '/utforsk-hendelser',
        label: 'Egendefinerte hendelser',
        description: 'Utforsk egendefinerte hendelser'
    },
    {
        id: 'markedsanalyse',
        href: '/markedsanalyse',
        label: 'Kampanjer',
        description: 'Analyser trafikk basert på UTM-parametere'
    },
    {
        id: 'sql',
        href: '/sql',
        label: 'SQL-spørringer',
        description: 'Kjør SQL-spørringer mot Umami datasettet'
    },
    {
        id: 'diagnose',
        href: '/diagnose',
        label: 'Diagnoseverktøy',
        description: 'Oversikt over aktivitet på alle nettsteder og apper'
    },
    {
        id: 'personvern',
        href: '/personvernssjekk',
        label: 'Personvernssjekk',
        description: 'Søk etter potensielle personopplysninger'
    },
    {
        id: 'odelagte-lenker',
        href: '/kvalitet/odelagte-lenker',
        label: 'Ødelagte lenker',
        description: 'Se ødelagte lenker fra Siteimprove'
    },
    {
        id: 'stavekontroll',
        href: '/kvalitet/stavekontroll',
        label: 'Stavekontroll',
        description: 'Se stavefeil fra Siteimprove'
    }
];

const AnalyticsNavigation = ({ currentPage, className = '', domain, websiteName }: AnalyticsNavigationProps) => {
    const hasMarketing = useMarketingSupport(domain, websiteName);

    // Filter out the current page if specified
    const displayPages = (currentPage
        ? analyticsPages.filter(page => page.id !== currentPage)
        : analyticsPages
    ).filter(page => {
        if (page.id === 'markedsanalyse' && !hasMarketing) return false;
        return true;
    });

    return (
        <div className="mt-12">
            <Heading as="h3" size="medium">Andre graftyper</Heading>
            <List as="ul" className={`pt-2 ${className}`}>
                {displayPages.map(page => (
                    <List.Item key={page.id}>
                        <strong><Link href={page.href}>{page.label}:</Link></strong> {page.description}.
                    </List.Item>
                ))}
            </List>
            <div className="mt-12">
                <Kontaktboks />
            </div>
        </div>
    );
};

export default AnalyticsNavigation;
