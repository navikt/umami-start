import { Link, List, Heading } from '@navikt/ds-react';
import Kontaktboks from '../theme/Kontaktboks/Kontaktboks';

export type AnalyticsPage = 'brukerreiser' | 'trakt' | 'brukerlojalitet' | 'grafbygger' | 'brukersammensetning' | 'event-explorer' | 'trafikkanalyse' | 'markedsanalyse' | 'diagnose' | 'brukerprofiler' | 'personvern' | 'hendelsesreiser' | 'sql';

interface AnalyticsNavigationProps {
    currentPage?: AnalyticsPage;

    className?: string;
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
        label: 'Trafikkanalyse',
        description: 'Se besøk over tid og trafikkilder'
    },
    {
        id: 'brukersammensetning',
        href: '/brukersammensetning',
        label: 'Brukersammensetning',
        description: 'Se informasjon om besøkende'
    },
    {
        id: 'brukerreiser',
        href: '/brukerreiser',
        label: 'Sideflyt',
        description: 'Se hvilke veier folk tar på nettsiden'
    },
    {
        id: 'hendelsesreiser',
        href: '/hendelsesreiser',
        label: 'Hendelsesflyt',
        description: 'Se rekkefølgen av hendelser på en side'
    },
    {
        id: 'trakt',
        href: '/trakt',
        label: 'Traktanalyse',
        description: 'Se hvor folk faller fra i en prosess'
    },
    {
        id: 'brukerprofiler',
        href: '/brukerprofiler',
        label: 'Brukerprofiler',
        description: 'Se info om individuelle besøkende'
    },
    {
        id: 'brukerlojalitet',
        href: '/brukerlojalitet',
        label: 'Brukerlojalitet',
        description: 'Se hvor mange som kommer tilbake'
    },
    {
        id: 'markedsanalyse',
        href: '/markedsanalyse',
        label: 'Markedsanalyse',
        description: 'Analyser trafikk basert på UTM-parametere'
    },
    {
        id: 'event-explorer',
        href: '/utforsk-hendelser',
        label: 'Egendefinerte hendelser',
        description: 'Utforsk egendefinerte hendelser'
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
    }
];

const AnalyticsNavigation = ({ currentPage, className = '' }: AnalyticsNavigationProps) => {
    // Filter out the current page if specified
    const displayPages = currentPage
        ? analyticsPages.filter(page => page.id !== currentPage)
        : analyticsPages;

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
