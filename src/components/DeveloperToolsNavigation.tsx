import { Link, List, Heading } from '@navikt/ds-react';

export const developerTools = [
    {
        id: 'personvern',
        href: '/personvernssjekk',
        label: 'Personvernssjekk',
        description: 'Oppdager personopplysninger'
    },
    {
        id: 'diagnose',
        href: '/diagnose',
        label: 'Diagnoseverktøy',
        description: 'Sjekker om hendelser mottas'
    },
    {
        id: 'sql',
        href: '/sql',
        label: 'SQL-spørringer',
        description: 'Kjør egne SQL-spørringer'
    }
];

const DeveloperToolsNavigation = () => {
    return (
        <div className="mt-8">
            <Heading as="h2" size="medium" className="mb-2">
                Utviklerverktøy
            </Heading>
            <List as="ul" className="pt-2">
                {developerTools.map(tool => (
                    <List.Item key={tool.id}>
                        <strong><Link href={tool.href}>{tool.label}:</Link></strong> {tool.description}.
                    </List.Item>
                ))}
            </List>
        </div>
    );
};

export default DeveloperToolsNavigation;
