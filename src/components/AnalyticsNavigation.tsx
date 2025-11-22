import { Link, List } from '@navikt/ds-react';
import Kontaktboks from './kontaktboks';

type AnalyticsPage = 'brukerreiser' | 'trakt' | 'brukerlojalitet' | 'grafbygger' | 'brukersammensetning';

interface AnalyticsNavigationProps {
    currentPage?: AnalyticsPage;

    className?: string;
}

const AnalyticsNavigation = ({ currentPage, className = '' }: AnalyticsNavigationProps) => {
    const pages = [
        {
            id: 'brukerreiser',
            href: '/brukerreiser',
            label: 'Brukerreiser',
            description: 'Se hvilke veier folk tar gjennom nettsiden'
        },
        {
            id: 'trakt',
            href: '/trakt',
            label: 'Traktanalyse',
            description: 'Se hvor folk faller fra i en prosess'
        },
        {
            id: 'brukerlojalitet',
            href: '/brukerlojalitet',
            label: 'Brukerlojalitet',
            description: 'Se hvor mange som kommer tilbake'
        },
        {
            id: 'grafbygger',
            href: '/grafbygger',
            label: 'Grafbygger',
            description: 'Lag tilpassede grafer'
        },
        {
            id: 'brukersammensetning',
            href: '/brukersammensetning',
            label: 'Brukersammensetning',
            description: 'Se informasjon om besøkende'
        }
    ];

    // Filter out the current page if specified
    const displayPages = currentPage
        ? pages.filter(page => page.id !== currentPage)
        : pages;

    return (
        <>
            <List as="ul" title="Andre graftyper" className={`pt-4 ${className}`}>
                {displayPages.map(page => (
                    <List.Item key={page.id}>
                        <strong><Link href={page.href}>{page.label}:</Link></strong> {page.description}.
                    </List.Item>
                ))}
            </List>
            <Kontaktboks />
        </>
    );
};

export default AnalyticsNavigation;
