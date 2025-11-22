import { BodyShort, Link } from '@navikt/ds-react';

type AnalyticsPage = 'brukerreiser' | 'trakt' | 'brukerlojalitet';

interface AnalyticsNavigationProps {
    currentPage: AnalyticsPage;
}

const AnalyticsNavigation = ({ currentPage }: AnalyticsNavigationProps) => {
    const pages = [
        { id: 'brukerreiser', href: '/brukerreiser', label: 'Brukerreiser' },
        { id: 'trakt', href: '/trakt', label: 'Traktanalyse' },
        { id: 'brukerlojalitet', href: '/brukerlojalitet', label: 'Brukerlojalitet' },
        { id: 'grafbygger', href: '/grafbygger', label: 'Grafbygger' }
    ];

    // Filter out the current page
    const otherPages = pages.filter(page => page.id !== currentPage);

    return (
        <div className="mt-8 pt-6 border-t border-gray-200">
            <BodyShort className="text-gray-600 mb-3">Andre graftyper:</BodyShort>
            <div className="flex flex-wrap gap-4">
                {otherPages.map((page, index) => (
                    <span key={page.id}>
                        <Link href={page.href}>{page.label}</Link>
                        {index < otherPages.length - 1 && <span className="ml-4">•</span>}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default AnalyticsNavigation;

