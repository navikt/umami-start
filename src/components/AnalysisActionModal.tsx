import React, { useState } from 'react';
import { Modal, Button } from '@navikt/ds-react';
import { BarChart2, ExternalLink, Activity, Search, Users, Map, Repeat, TrendingUp, UserSearch, Copy, Check } from 'lucide-react';

interface AnalysisActionModalProps {
    open: boolean;
    onClose: () => void;
    urlPath: string | null;
    websiteId?: string;
    period?: string;
}

const AnalysisActionModal: React.FC<AnalysisActionModalProps> = ({
    open,
    onClose,
    urlPath,
    websiteId,
    period = 'current_month'
}) => {
    const [copySuccess, setCopySuccess] = useState(false);

    if (!urlPath || !websiteId) return null;

    const openAnalysis = (path: string, paramName: string = 'urlPath') => {
        const encodedPath = encodeURIComponent(urlPath);
        const url = `${path}?websiteId=${websiteId}&period=${period}&${paramName}=${encodedPath}`;
        window.open(url, '_blank');
        onClose();
    };

    const openOnWebsite = () => {
        // Assuming nav.no for now
        const url = `https://www.nav.no${urlPath}`;
        window.open(url, '_blank');
        onClose();
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(urlPath);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <Modal open={open} onClose={onClose} header={{ heading: 'Hva vil du gjøre med lenken?' }} width="medium">
            <Modal.Body>
                <div className="p-2 pb-4 flex flex-col gap-6 text-left">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-sm font-medium text-gray-700">
                                URL-sti
                            </div>
                            <div className="flex gap-1">
                                <Button
                                    size="small"
                                    variant="tertiary"
                                    onClick={copyLink}
                                    icon={copySuccess ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} />}
                                >
                                    {copySuccess ? 'Kopiert!' : 'Kopier'}
                                </Button>
                                <Button
                                    size="small"
                                    variant="tertiary"
                                    onClick={openOnWebsite}
                                    icon={<ExternalLink aria-hidden size={18} />}
                                >
                                    Åpne på nav.no
                                </Button>
                            </div>
                        </div>
                        <div className="text-sm font-mono bg-gray-50 p-3 rounded-md border border-gray-200 break-all text-gray-800">
                            {urlPath}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Column 1: Trafikk & Hendelser */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Trafikk & Hendelser
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/trafikkanalyse', 'urlPath')} icon={<BarChart2 aria-hidden />} className="justify-start">
                                Trafikkanalyse
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/markedsanalyse', 'urlPath')} icon={<TrendingUp aria-hidden />} className="justify-start">
                                Markedsanalyse
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/utforsk-hendelser', 'pagePath')} icon={<Search aria-hidden />} className="justify-start">
                                Hendelse-utforsker
                            </Button>
                        </div>

                        {/* Column 2: Brukere & lojalitet */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Brukere & lojalitet
                            </div>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukersammensetning', 'pagePath')} icon={<Users aria-hidden />} className="justify-start">
                                Brukersammensetning
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerprofiler', 'pagePath')} icon={<UserSearch aria-hidden />} className="justify-start">
                                Brukerprofiler
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerlojalitet', 'urlPath')} icon={<Repeat aria-hidden />} className="justify-start">
                                Brukerlojalitet
                            </Button>
                        </div>
                    </div>

                    {/* Bottom row: Brukerreiser - 2 items side by side */}
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Brukerreiser
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="secondary" onClick={() => openAnalysis('/brukerreiser', 'startUrl')} icon={<Map aria-hidden />} className="justify-start">
                                Sideflyt
                            </Button>
                            <Button variant="secondary" onClick={() => openAnalysis('/hendelsesreiser', 'urlPath')} icon={<Activity aria-hidden />} className="justify-start">
                                Hendelsesflyt
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default AnalysisActionModal;
