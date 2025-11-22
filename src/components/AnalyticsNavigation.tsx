import { BodyShort, Link, List } from '@navikt/ds-react';

type AnalyticsPage = 'brukerreiser' | 'trakt' | 'brukerlojalitet' | 'grafbygger';

interface AnalyticsNavigationProps {
    currentPage?: AnalyticsPage;
    variant?: 'inline' | 'list';
    className?: string;
}

const AnalyticsNavigation = ({ currentPage, variant = 'inline', className = '' }: AnalyticsNavigationProps) => {
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
        }
    ];

    // Filter out the current page if specified
    const displayPages = currentPage
        ? pages.filter(page => page.id !== currentPage)
        : pages;

    // List variant (for Chartbuilder)
    if (variant === 'list') {
        return (
            <List as="ul" title="Andre graftyper" className={`pt-4 ${className}`}>
                {displayPages.map(page => (
                    <List.Item key={page.id}>
                        <strong><Link href={page.href}>{page.label}:</Link></strong> {page.description}.
                    </List.Item>
                ))}
            </List>
        );
    }

    // Inline variant (for analytics pages)
    return (
        <div className={`mt-8 pt-6 border-t border-gray-200 ${className}`}>
            <BodyShort className="text-gray-600 mb-3">Andre graftyper:</BodyShort>
            <div className="flex flex-wrap gap-4">
                {displayPages.map((page, index) => (
                    <span key={page.id}>
                        <Link href={page.href}>{page.label}</Link>
                        {index < displayPages.length - 1 && <span className="ml-4">•</span>}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default AnalyticsNavigation;
