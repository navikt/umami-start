import { useEffect, useState } from 'react';
import { Alert, Loader, BodyShort, Heading, VStack, HStack, Label } from '@navikt/ds-react';
import { PersonIcon, EnvelopeClosedIcon } from '@navikt/aksel-icons';

interface UserInfo {
    navIdent: string;
    name: string;
    email: string;
    authenticated: boolean;
    message: string;
}

export default function UserProfile() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/user/me')
            .then(res => {
                if (!res.ok) {
                    return res.json().then(err => {
                        throw new Error(err.message || err.error || 'Failed to fetch user info');
                    });
                }
                return res.json();
            })
            .then(data => {
                setUser(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader size="3xlarge" title="Laster brukerinformasjon..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-8 max-w-2xl">
                <Alert variant="info">
                    <Heading size="medium" spacing>Autentisering ikke tilgjengelig</Heading>
                    <BodyShort>{error}</BodyShort>
                    <BodyShort className="mt-4">
                        Dette endepunktet fungerer kun når applikasjonen er deployet til NAIS med Entra ID aktivert.
                    </BodyShort>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-8 max-w-2xl">
            <VStack gap="6">
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-lg shadow-lg">
                    <Heading size="large" className="mb-4">Din profil</Heading>
                    <BodyShort className="text-blue-100">{user?.message}</BodyShort>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <VStack gap="4">
                        <HStack gap="3" align="center">
                            <PersonIcon className="text-blue-600" fontSize="2rem" />
                            <div>
                                <Label>NAV-ident</Label>
                                <BodyShort className="text-2xl font-bold text-blue-600">
                                    {user?.navIdent}
                                </BodyShort>
                            </div>
                        </HStack>

                        <div className="h-px bg-gray-200" />

                        <div>
                            <Label>Navn</Label>
                            <BodyShort className="text-lg">{user?.name}</BodyShort>
                        </div>

                        <div className="h-px bg-gray-200" />

                        <HStack gap="3" align="center">
                            <EnvelopeClosedIcon className="text-blue-600" fontSize="1.5rem" />
                            <div>
                                <Label>E-post</Label>
                                <BodyShort className="text-lg">{user?.email}</BodyShort>
                            </div>
                        </HStack>
                    </VStack>
                </div>

                <Alert variant="success">
                    <Heading size="small" spacing>Autentisering vellykket!</Heading>
                    <BodyShort>
                        Du er logget inn via Entra ID. Dette endepunktet kan brukes til å hente
                        brukerinformasjon i andre deler av applikasjonen.
                    </BodyShort>
                </Alert>

                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <Label className="mb-2">API-endepunkt:</Label>
                    <code className="text-sm bg-gray-800 text-green-400 p-2 rounded block">
                        GET /api/user/me
                    </code>
                </div>
            </VStack>
        </div>
    );
}
